import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { SECTOR_STOCKS } from '@/constants/sector-stocks-mapping'
import YahooFinance from 'yahoo-finance2'

// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max

/**
 * Cron job API route that populates daily_high_low table with PREVIOUS DAY's OHLC data
 * Mirrors the logic of populate_daily_high_low.py using yahoo-finance2
 * 
 * Logic:
 * 1. Fetch last 5-10 days of history for each stock
 * 2. Pick the latest COMPLETED trading day (Yesterday)
 * 3. Clear table and Insert
 * 
 * Runs ONCE per day (e.g. 9:15 AM)
 */
export async function GET(request: NextRequest) {
    try {
        // Validate cron secret for security
        const authHeader = request.headers.get('authorization')
        const cronSecret = process.env.CRON_SECRET

        if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
            console.error('[POPULATE-DAILY-HL] Unauthorized cron request')
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        console.log(`[POPULATE-DAILY-HL] Starting population mirror of python script`)

        // Collect all unique stocks from all sectors
        const allStocks = new Set<string>()
        const stockToSectorMap = new Map<string, string>()

        Object.entries(SECTOR_STOCKS).forEach(([sector, stocks]) => {
            stocks.forEach(symbol => {
                allStocks.add(symbol)
                if (!stockToSectorMap.has(symbol)) {
                    stockToSectorMap.set(symbol, sector)
                }
            })
        })

        console.log(`[POPULATE-DAILY-HL] Processing ${allStocks.size} stocks`)

        // Instantiate YahooFinance
        const yahooFinance = new YahooFinance()

        const highLowData: any[] = []
        const errors: string[] = []
        let successCount = 0
        let failedCount = 0

        // Process in batches (concurrently but limited)
        const stockArray = Array.from(allStocks)
        const BATCH_SIZE = 10 // Python does sequential, we can do 10 parallel safely

        for (let i = 0; i < stockArray.length; i += BATCH_SIZE) {
            const batch = stockArray.slice(i, i + BATCH_SIZE)
            console.log(`[POPULATE-DAILY-HL] Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(stockArray.length / BATCH_SIZE)}`)

            const batchPromises = batch.map(async (symbol) => {
                try {
                    const yahooSymbol = symbol.endsWith('.NS') ? symbol : `${symbol}.NS`

                    // Python logic: ticker.history(period="5d")
                    // We fetch 10 days to be safe
                    const today = new Date()
                    const tenDaysAgo = new Date(today)
                    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10)

                    let ohlcData = null

                    // Try Library Fetch
                    try {
                        const result = await yahooFinance.historical(yahooSymbol, {
                            period1: tenDaysAgo.toISOString().split('T')[0],
                            period2: new Date().toISOString().split('T')[0], // Today (exclusive) - actually we want today included to check if open
                            interval: '1d'
                        }) as any[]

                        if (result && result.length > 0) {
                            // Find the latest candle that is NOT today
                            let idx = result.length - 1;
                            const todayStr = new Date().toISOString().split('T')[0];

                            // Check last date
                            const lastDate = result[idx].date.toISOString().split('T')[0];

                            // If the last candle is today, go back to yesterday
                            if (lastDate === todayStr) {
                                console.log(`[POPULATE-DAILY-HL] ${symbol}: Skipping today's candle (${todayStr}), moving to previous`);
                                idx--;
                            } else {
                                // console.log(`[POPULATE-DAILY-HL] ${symbol}: Last candle is ${lastDate} (Today is ${todayStr}), keeping it.`);
                            }

                            if (idx >= 0) {
                                const lastCandle = result[idx]
                                if (lastCandle.high !== undefined && lastCandle.low !== undefined) {
                                    ohlcData = {
                                        high: lastCandle.high,
                                        low: lastCandle.low,
                                        open: lastCandle.open,
                                        close: lastCandle.close,
                                        date: lastCandle.date.toISOString().split('T')[0]
                                    }
                                }
                            }
                        }
                    } catch (libErr) {
                        console.warn(`[POPULATE-DAILY-HL] Library failed for ${symbol}, trying manual... Error: ${libErr}`)
                    }

                    // Manual Fallback if library failed
                    if (!ohlcData) {
                        try {
                            const response = await fetch(`https://query2.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=5d`, {
                                headers: { 'User-Agent': 'Mozilla/5.0' }
                            })
                            if (response.ok) {
                                const data = await response.json()
                                const result = data?.chart?.result?.[0]
                                if (result?.timestamp) {
                                    const quotes = result.indicators.quote[0]
                                    let idx = result.timestamp.length - 1

                                    // Check if last candle is today (partial)
                                    const lastDate = new Date(result.timestamp[idx] * 1000)
                                    const todayStr = new Date().toISOString().split('T')[0]

                                    if (lastDate.toISOString().split('T')[0] === todayStr) {
                                        idx-- // Go back to yesterday
                                    }

                                    if (idx >= 0 && quotes.high[idx] !== null) {
                                        ohlcData = {
                                            high: quotes.high[idx],
                                            low: quotes.low[idx],
                                            open: quotes.open[idx],
                                            close: quotes.close[idx],
                                            date: new Date(result.timestamp[idx] * 1000).toISOString().split('T')[0]
                                        }
                                    }
                                }
                            }
                        } catch (manErr) {
                            // Ignore
                        }
                    }

                    if (ohlcData) {
                        return {
                            symbol: symbol,
                            sector: stockToSectorMap.get(symbol) || 'Unknown',
                            today_high: ohlcData.high,
                            today_low: ohlcData.low,
                            today_open: ohlcData.open,
                            today_close: ohlcData.close,
                            captured_date: ohlcData.date,
                        }
                    } else {
                        errors.push(`${symbol}: No data`)
                        return null
                    }

                } catch (e) {
                    errors.push(`${symbol}: Error ${e}`)
                    return null
                }
            })

            const results = await Promise.all(batchPromises)
            results.forEach(r => {
                if (r) {
                    highLowData.push(r)
                    successCount++
                } else {
                    failedCount++
                }
            })

            // Small delay to be nice
            await new Promise(r => setTimeout(r, 500))
        }

        console.log(`[POPULATE-DAILY-HL] Fetched ${successCount} successfully, ${failedCount} failed`)

        // Database Update (Clear & Insert)
        if (highLowData.length > 0) {
            console.log('[POPULATE-DAILY-HL] Clearing and Inserting...')

            // Delete all records
            await supabaseAdmin.from('daily_high_low').delete().neq('symbol', '___')

            // Insert new records
            const { error } = await supabaseAdmin.from('daily_high_low').insert(highLowData)

            if (error) {
                console.error('Insert error:', error)
                return NextResponse.json({ success: false, error: error.message }, { status: 500 })
            }
        }

        return NextResponse.json({
            success: true,
            total: allStocks.size,
            captured: successCount,
            failed: failedCount,
            errors: errors.slice(0, 10)
        })

    } catch (error) {
        console.error('[POPULATE-DAILY-HL] Fatal:', error)
        return NextResponse.json({ success: false, error: 'Fatal Error' }, { status: 500 })
    }
}
