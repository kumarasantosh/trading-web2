import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { SECTOR_STOCKS } from '@/constants/sector-stocks-mapping'
import YahooFinance from 'yahoo-finance2'
import { getGrowwAccessToken } from '@/lib/groww-token'

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

        console.log(`[POPULATE-DAILY-HL] Starting EOD population (10:30 PM logic)`)

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

        // Process in batches
        const stockArray = Array.from(allStocks)
        const BATCH_SIZE = 10

        for (let i = 0; i < stockArray.length; i += BATCH_SIZE) {
            const batch = stockArray.slice(i, i + BATCH_SIZE)

            const batchPromises = batch.map(async (symbol) => {
                try {
                    const yahooSymbol = symbol.endsWith('.NS') ? symbol : `${symbol}.NS`

                    // Fetch 10 days to ensure we have enough history for sentiment
                    const today = new Date()
                    const tenDaysAgo = new Date(today)
                    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10)

                    let ohlcData: any = null
                    let sentiment: 'green' | 'red' | null = null

                    // Fetch Historical Data
                    try {
                        const result = await yahooFinance.historical(yahooSymbol, {
                            period1: tenDaysAgo.toISOString().split('T')[0],
                            // period2 defaults to now, capturing today if available
                            interval: '1d'
                        }) as any[]

                        if (result && result.length > 0) {
                            // We want the LATEST completed candle. 
                            // If running at 10:30 PM, the last candle should be "Today".

                            const lastIndex = result.length - 1;
                            const currentCandle = result[lastIndex];

                            // To calculate sentiment, we need the PREVIOUS candle
                            const prevCandle = lastIndex > 0 ? result[lastIndex - 1] : null;

                            if (currentCandle && currentCandle.close !== null) {
                                ohlcData = {
                                    high: currentCandle.high,
                                    low: currentCandle.low,
                                    open: currentCandle.open,
                                    close: currentCandle.close,
                                    date: currentCandle.date.toISOString().split('T')[0]
                                }

                                if (prevCandle && prevCandle.close !== null) {
                                    // Sentiment: Green if Close > PrevClose, Red if Close < PrevClose, else (neutral) we default to red or green? 
                                    // User request: "dayChange > zero is green if < zero is red"
                                    const change = currentCandle.close - prevCandle.close;
                                    sentiment = change >= 0 ? 'green' : 'red';
                                }
                            }
                        }
                    } catch (libErr) {
                        console.warn(`[POPULATE-DAILY-HL] Library failed for ${symbol}: ${libErr}`)
                    }

                    if (ohlcData) {
                        return {
                            symbol: symbol,
                            sector: stockToSectorMap.get(symbol) || 'Unknown',
                            today_high: ohlcData.high,
                            today_low: ohlcData.low,
                            today_open: ohlcData.open,
                            today_close: ohlcData.close,
                            sentiment: sentiment || 'green', // Default to green if unknown, or maybe null? User wants green/red.
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

            // Respect rate limits
            await new Promise(r => setTimeout(r, 200))
        }

        console.log(`[POPULATE-DAILY-HL] Fetched ${successCount} successfully`)

        // Database Update (Clear & Insert)
        if (highLowData.length > 0) {
            // Delete all records to ensure fresh snapshot
            // Note: If we want to keep history, we shouldn't delete everything. 
            // But the current logic (mirroring python) clears the table ("daily_high_low" usually implies a single day snapshot).
            // Retaining the 'delete all' logic as per previous behavior, but we might want to change this to 'upsert' based on date?
            // User request implies "Run a cron job and store to table". 
            // Existing code did `delete().neq('symbol', '___')`. I will stick to that to avoid stale data accumulating if schema assumes uniqueness.

            await supabaseAdmin.from('daily_high_low').delete().neq('symbol', '___')

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
