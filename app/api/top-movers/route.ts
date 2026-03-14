import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const revalidate = 0

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000

function toIstDateString(date: Date): string {
    return new Date(date.getTime() + IST_OFFSET_MS).toISOString().split('T')[0]
}

function parseDateString(dateString: string): Date {
    return new Date(`${dateString}T00:00:00.000Z`)
}

function getMostRecentTradingDate(referenceDate: Date = new Date()): string {
    const tradingDate = parseDateString(toIstDateString(referenceDate))

    while (tradingDate.getUTCDay() === 0 || tradingDate.getUTCDay() === 6) {
        tradingDate.setUTCDate(tradingDate.getUTCDate() - 1)
    }

    return tradingDate.toISOString().split('T')[0]
}

function getHistoricalStartDate(referenceDate: string, daysBack: number = 10): string {
    const startDate = parseDateString(referenceDate)
    startDate.setUTCDate(startDate.getUTCDate() - daysBack)
    return startDate.toISOString().split('T')[0]
}

/**
 * Check if today is a weekend
 */
function isWeekend(): boolean {
    const now = new Date()
    const istTime = new Date(now.getTime() + IST_OFFSET_MS)
    const dayOfWeek = istTime.getUTCDay()
    return dayOfWeek === 0 || dayOfWeek === 6 // Sunday or Saturday
}

/**
 * Lightweight API endpoint to fetch top gainers and losers from database
 * On weekends, returns Friday's data
 * 
 * Returns: { gainers: [...], losers: [...], updated_at: timestamp, data_date: string, is_weekend: boolean }
 */
export async function GET() {
    try {
        const weekend = isWeekend()
        const targetDate = weekend ? getMostRecentTradingDate() : null

        console.log(`[TOP-MOVERS] Weekend: ${weekend}, Target Date: ${targetDate || 'today'}`)

        // Build query
        let query = supabaseAdmin
            .from('stock_snapshots')
            .select('symbol, open_price, last_price, percent_change, volume, updated_at, prev_close')

        // On weekends, filter by Friday's date
        if (weekend && targetDate) {
            // Filter by date - assuming updated_at contains the date
            const startOfDay = `${targetDate}T00:00:00Z`
            const endOfDay = `${targetDate}T23:59:59Z`
            query = query
                .gte('updated_at', startOfDay)
                .lte('updated_at', endOfDay)
        }

        query = query.order('percent_change', { ascending: false })

        const { data: allStocks, error: fetchError } = await query

        if (fetchError) {
            console.error('[TOP-MOVERS] Error fetching stocks:', fetchError)
            throw fetchError
        }

        // Filter and get top 10 gainers (positive percent_change)
        const gainersData = (allStocks || [])
            .filter(stock => Number(stock.percent_change) > 0)
            .slice(0, 10)

        // Filter and get top 10 losers (negative percent_change)
        const losersData = (allStocks || [])
            .filter(stock => Number(stock.percent_change) < 0)
            .sort((a, b) => Number(a.percent_change) - Number(b.percent_change))
            .slice(0, 10)

        const latestSnapshotTimestamp = (allStocks || []).reduce<string | null>((latest, stock) => {
            if (!stock.updated_at) return latest

            if (!latest) {
                return stock.updated_at
            }

            return new Date(stock.updated_at).getTime() > new Date(latest).getTime()
                ? stock.updated_at
                : latest
        }, null)

        const snapshotTradeDate = targetDate
            || (latestSnapshotTimestamp ? toIstDateString(new Date(latestSnapshotTimestamp)) : getMostRecentTradingDate())

        console.log(`[TOP-MOVERS] Snapshot Trade Date: ${snapshotTradeDate}`)

        // Collect all symbols to fetch previous day data
        const symbols = [
            ...gainersData.map(s => s.symbol),
            ...losersData.map(s => s.symbol)
        ]

        // Fetch previous day data from daily_high_low table
        let prevDayDataMap: Record<string, any> = {}

        if (symbols.length > 0) {
            const { data: prevData, error: prevError } = await supabaseAdmin
                .from('daily_high_low')
                .select('symbol, today_high, today_low, today_open, today_close, sentiment, captured_date')
                .in('symbol', symbols)
                .lt('captured_date', snapshotTradeDate)
                .order('captured_date', { ascending: false })

            if (!prevError && prevData) {
                // Match sentiment to the displayed snapshot date, not simply the newest daily row.
                prevData.forEach(item => {
                    if (!prevDayDataMap[item.symbol]) {
                        prevDayDataMap[item.symbol] = {
                            yesterday_high: item.today_high,
                            yesterday_low: item.today_low,
                            yesterday_open: item.today_open,
                            yesterday_close: item.today_close,
                            yesterday_sentiment: item.sentiment
                        }
                    }
                })
            }
        }

        // Merge previous day data into stocks (and fetch missing ones via Yahoo Finance)
        const mergeAndFetchMissing = async (stocks: any[]) => {
            // Import yahooFinance dynamically to avoid build issues if not used
            const { default: YahooFinance } = await import('yahoo-finance2')
            const yahooFinance = new YahooFinance()
            const referenceDate = snapshotTradeDate

            return await Promise.all(stocks.map(async (stock) => {
                const dbData = prevDayDataMap[stock.symbol]

                if (dbData) {
                    return { ...stock, ...dbData }
                }

                // If DB data missing, fetch from Yahoo Finance using user's preferred logic
                try {
                    const symbol = stock.symbol.endsWith('.NS') ? stock.symbol : `${stock.symbol}.NS`
                    const startDate = getHistoricalStartDate(referenceDate)

                    const result = await (yahooFinance as any).historical(symbol, {
                        period1: startDate,
                        period2: referenceDate, // Exclusive: fetch the last completed candle before the snapshot day
                        interval: '1d'
                    }) as any[]

                    if (result && result.length > 0) {
                        const lastCandle = [...result].reverse().find((candle: any) => {
                            if (!candle) return false

                            const candleDate = new Date(candle.date).toISOString().split('T')[0]
                            return candleDate < referenceDate
                                && candle.open != null
                                && candle.high != null
                                && candle.low != null
                                && candle.close != null
                        })

                        if (!lastCandle) {
                            throw new Error(`No historical candle found before ${referenceDate}`)
                        }

                        const sentiment = (lastCandle.close >= lastCandle.open) ? 'Green' : 'Red';

                        return {
                            ...stock,
                            yesterday_high: lastCandle.high,
                            yesterday_low: lastCandle.low,
                            yesterday_open: lastCandle.open,
                            yesterday_close: lastCandle.close,
                            yesterday_sentiment: sentiment
                        }
                    }
                } catch (err) {
                    console.error(`Library fetch failed for ${stock.symbol}, trying manual fetch:`, err)

                    // Fallback to manual fetch if library fails
                    try {
                        const symbol = stock.symbol.endsWith('.NS') ? stock.symbol : `${stock.symbol}.NS`
                        const response = await fetch(`https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=10d`, {
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                            }
                        })

                        if (response.ok) {
                            const data = await response.json()
                            const result = data?.chart?.result?.[0]
                            if (result) {
                                const quotes = result.indicators?.quote?.[0]
                                const timestamps = result.timestamp

                                if (quotes && timestamps && timestamps.length > 0) {
                                    let lastIdx = timestamps.length - 1
                                    while (lastIdx >= 0) {
                                        const candleDate = new Date(timestamps[lastIdx] * 1000).toISOString().split('T')[0]
                                        const isValidCandle = quotes.open[lastIdx] != null
                                            && quotes.high[lastIdx] != null
                                            && quotes.low[lastIdx] != null
                                            && quotes.close[lastIdx] != null

                                        if (isValidCandle && candleDate < referenceDate) {
                                            break
                                        }

                                        lastIdx--
                                    }

                                    if (lastIdx >= 0) {
                                        const sentiment = (quotes.close[lastIdx] >= quotes.open[lastIdx]) ? 'Green' : 'Red';
                                        return {
                                            ...stock,
                                            yesterday_high: quotes.high[lastIdx],
                                            yesterday_low: quotes.low[lastIdx],
                                            yesterday_open: quotes.open[lastIdx],
                                            yesterday_close: quotes.close[lastIdx],
                                            yesterday_sentiment: sentiment
                                        }
                                    }
                                }
                            }
                        }
                    } catch (manualErr) {
                        console.error(`Manual fetch also failed for ${stock.symbol}:`, manualErr)
                    }
                }

                return stock
            }))
        }

        const gainers = await mergeAndFetchMissing(gainersData)
        const losers = await mergeAndFetchMissing(losersData)

        // Get the most recent update timestamp
        const latestUpdate = gainers?.[0]?.updated_at || losers?.[0]?.updated_at || new Date().toISOString()

        return NextResponse.json({
            success: true,
            gainers: gainers || [],
            losers: losers || [],
            updated_at: latestUpdate,
            data_date: snapshotTradeDate,
            is_weekend: weekend,
            count: {
                gainers: gainers?.length || 0,
                losers: losers?.length || 0,
            },
        }, {
            headers: {
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
            }
        })

    } catch (error) {
        console.error('[TOP-MOVERS] Fatal error:', error)

        // Check if it's a table not found error
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        const isTableMissing = errorMessage.includes('relation "stock_snapshots" does not exist') ||
            errorMessage.includes('table') ||
            errorMessage.includes('relation')

        return NextResponse.json(
            {
                error: 'Failed to fetch top movers',
                details: errorMessage,
                hint: isTableMissing ? 'Database table "stock_snapshots" may not exist. Please run the SQL schema from supabase/stock-snapshots-schema.sql' : undefined,
                gainers: [],
                losers: [],
            },
            { status: 500 }
        )
    }
}
