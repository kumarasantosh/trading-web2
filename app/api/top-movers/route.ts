import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Get the most recent Friday's date in IST
 * Used for weekend fallback
 */
function getMostRecentFriday(): string {
    const now = new Date()

    // Convert to IST (UTC + 5:30)
    const istOffset = 5.5 * 60 * 60 * 1000
    const istTime = new Date(now.getTime() + istOffset)

    // Get day of week (0 = Sunday, 6 = Saturday)
    const dayOfWeek = istTime.getUTCDay()

    // Calculate days to subtract to get to Friday (5)
    let daysToSubtract = 0
    if (dayOfWeek === 0) { // Sunday
        daysToSubtract = 2
    } else if (dayOfWeek === 6) { // Saturday
        daysToSubtract = 1
    } else if (dayOfWeek < 5) { // Monday-Thursday
        daysToSubtract = dayOfWeek + 2 // Go back to last Friday
    }
    // If it's Friday (5), daysToSubtract = 0 (use today)

    const friday = new Date(istTime.getTime() - (daysToSubtract * 24 * 60 * 60 * 1000))
    return friday.toISOString().split('T')[0] // YYYY-MM-DD format
}

/**
 * Check if today is a weekend
 */
function isWeekend(): boolean {
    const now = new Date()
    const istOffset = 5.5 * 60 * 60 * 1000
    const istTime = new Date(now.getTime() + istOffset)
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
        const targetDate = weekend ? getMostRecentFriday() : null

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
                .select('symbol, today_high, today_low, today_open, today_close, sentiment')
                .in('symbol', symbols)
                .order('captured_date', { ascending: false })

            if (!prevError && prevData) {
                // Create map for easy lookup, using the most recent entry for each symbol
                // Since we ordered by captured_date desc, the first entry for each symbol is the latest
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
            const { default: yahooFinance } = await import('yahoo-finance2')

            return await Promise.all(stocks.map(async (stock) => {
                const dbData = prevDayDataMap[stock.symbol]

                if (dbData) {
                    return { ...stock, ...dbData }
                }

                // If DB data missing, fetch from Yahoo Finance using user's preferred logic
                try {
                    // Logic to get previous trading day
                    const symbol = stock.symbol.endsWith('.NS') ? stock.symbol : `${stock.symbol}.NS`

                    // Simple logic to get last 5 days to ensure we capture the previous trading day
                    const today = new Date()
                    const yesterday = new Date(today)
                    yesterday.setDate(yesterday.getDate() - 1)

                    const fiveDaysAgo = new Date(yesterday)
                    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5)

                    const result = await (yahooFinance as any).historical(symbol, {
                        period1: fiveDaysAgo.toISOString().split('T')[0],
                        period2: new Date().toISOString().split('T')[0], // Today (exclusive)
                        interval: '1d'
                    }) as any[]

                    if (result && result.length > 0) {
                        // Get the last available candle (which should be previous trading day)
                        const lastCandle = result[result.length - 1]
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
                        const response = await fetch(`https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5d`, {
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
                                    // Get last valid index (sometimes last one is null if market open)
                                    let lastIdx = timestamps.length - 1

                                    // Ensure we get a completed candle (simple check: valid close)
                                    // If today is trading day and market is open, last candle might be today.
                                    // We want YESTERDAY.
                                    // Check date of last candle.
                                    const lastDate = new Date(timestamps[lastIdx] * 1000)
                                    const todayStr = new Date().toISOString().split('T')[0]
                                    const lastDateStr = lastDate.toISOString().split('T')[0]

                                    if (lastDateStr === todayStr) {
                                        lastIdx-- // Go back one
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
            data_date: targetDate || new Date().toISOString().split('T')[0],
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
