import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { SECTOR_STOCKS } from '@/constants/sector-stocks-mapping'
import { fetchYahooStockData } from '@/services/yahooFinance'
import { getGrowwAccessToken } from '@/lib/groww-token'

// Force dynamic rendering since we use request headers
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max

/**
 * Cron job API route that populates daily_high_low table with PREVIOUS DAY's OHLC data
 * Uses Groww API (primary) and Yahoo Finance (fallback) to get accurate historical data
 * 
 * This should run ONCE per day at market open (9:15 AM IST) or before
 * to ensure we have yesterday's data ready for breakout detection
 * 
 * Security: Validates CRON_SECRET to prevent unauthorized access
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

        // Get current IST time
        const now = new Date()
        const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000))
        const todayDate = istTime.toISOString().split('T')[0] // YYYY-MM-DD format

        console.log(`[POPULATE-DAILY-HL] Starting population for ${todayDate}`)

        // Collect all unique stocks from all sectors
        const allStocks = new Set<string>()
        const stockToSectorMap = new Map<string, string>()

        Object.entries(SECTOR_STOCKS).forEach(([sector, stocks]) => {
            stocks.forEach(symbol => {
                allStocks.add(symbol)
                // Store first sector mapping (a stock may appear in multiple sectors)
                if (!stockToSectorMap.has(symbol)) {
                    stockToSectorMap.set(symbol, sector)
                }
            })
        })

        console.log(`[POPULATE-DAILY-HL] Fetching previous day data for ${allStocks.size} unique stocks`)

        // Get Groww token
        const growwToken = await getGrowwAccessToken() || process.env.GROWW_API_TOKEN || '';

        // Fetch previous day OHLC data for all stocks
        const highLowData: any[] = []
        const errors: string[] = []
        let successCount = 0
        let failedCount = 0
        let growwCount = 0
        let yahooCount = 0

        // Process stocks in batches to avoid overwhelming the API
        const stockArray = Array.from(allStocks)
        const BATCH_SIZE = 10 // Process 10 stocks at a time

        for (let i = 0; i < stockArray.length; i += BATCH_SIZE) {
            const batch = stockArray.slice(i, i + BATCH_SIZE)
            console.log(`[POPULATE-DAILY-HL] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(stockArray.length / BATCH_SIZE)} (${batch.length} stocks)`)

            // Process batch in parallel
            const batchPromises = batch.map(async (symbol) => {
                try {
                    let ohlcData: any = null

                    // TRY 1: Groww API (more reliable for Indian stocks, gives today's data)
                    try {
                        const growwUrl = `https://api.groww.in/v1/live-data/quote?exchange=NSE&segment=CASH&trading_symbol=${symbol}`
                        const growwResponse = await fetch(growwUrl, {
                            headers: {
                                'Authorization': `Bearer ${growwToken}`,
                                'X-API-VERSION': '1.0',
                                'Accept': 'application/json',
                                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                            },
                            cache: 'no-store',
                        })

                        if (growwResponse.ok) {
                            const data = await growwResponse.json()
                            const payload = data.payload
                            const ohlc = payload?.ohlc

                            if (ohlc?.high && ohlc?.low) {
                                ohlcData = {
                                    high: ohlc.high,
                                    low: ohlc.low,
                                    open: ohlc.open || payload?.open || ohlc.high,
                                    close: ohlc.close || payload?.close || payload?.last_price || ohlc.low,
                                    source: 'Groww'
                                }
                                growwCount++
                            }
                        }
                    } catch (growwError) {
                        // Continue to Yahoo Finance fallback
                    }

                    // TRY 2: Yahoo Finance (fallback - gives previous day data)
                    if (!ohlcData) {
                        const yahooData = await fetchYahooStockData(symbol)

                        if (yahooData && yahooData.high > 0 && yahooData.low > 0) {
                            ohlcData = {
                                high: yahooData.high,
                                low: yahooData.low,
                                open: yahooData.open || yahooData.high,
                                close: yahooData.close || yahooData.low,
                                source: 'Yahoo'
                            }
                            yahooCount++
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
                            captured_date: todayDate,
                        }
                    } else {
                        errors.push(`${symbol}: No valid data from Groww or Yahoo Finance`)
                        return null
                    }
                } catch (error) {
                    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
                    errors.push(`${symbol}: ${errorMsg}`)
                    return null
                }
            })

            const batchResults = await Promise.all(batchPromises)

            // Collect successful results
            batchResults.forEach(result => {
                if (result) {
                    highLowData.push(result)
                    successCount++
                } else {
                    failedCount++
                }
            })

            // Small delay between batches to avoid rate limiting
            if (i + BATCH_SIZE < stockArray.length) {
                await new Promise(resolve => setTimeout(resolve, 500))
            }
        }

        console.log(`[POPULATE-DAILY-HL] Fetch complete: ${successCount} successful (${growwCount} from Groww, ${yahooCount} from Yahoo), ${failedCount} failed`)

        // Clear existing data and insert fresh data
        if (highLowData.length > 0) {
            console.log('[POPULATE-DAILY-HL] Clearing old data from daily_high_low table...')

            // Delete all existing records
            const { error: deleteError } = await supabaseAdmin
                .from('daily_high_low')
                .delete()
                .neq('symbol', '__DUMMY__') // Delete all records

            if (deleteError) {
                console.error('[POPULATE-DAILY-HL] Error deleting old records:', deleteError)
                errors.push(`Delete error: ${deleteError.message}`)
            } else {
                console.log('[POPULATE-DAILY-HL] Old data cleared successfully')
            }

            // Insert fresh high-low data
            console.log(`[POPULATE-DAILY-HL] Inserting ${highLowData.length} records...`)

            const { error: insertError } = await supabaseAdmin
                .from('daily_high_low')
                .insert(highLowData)

            if (insertError) {
                console.error('[POPULATE-DAILY-HL] Insert error:', insertError)
                return NextResponse.json(
                    {
                        success: false,
                        error: 'Failed to insert data',
                        details: insertError.message
                    },
                    { status: 500 }
                )
            }

            console.log(`[POPULATE-DAILY-HL] ✅ Successfully inserted ${highLowData.length} records`)
        } else {
            console.log('[POPULATE-DAILY-HL] ⚠️ No data to insert')
        }

        return NextResponse.json({
            success: true,
            captured_date: todayDate,
            total_stocks: allStocks.size,
            stocks_captured: successCount,
            stocks_failed: failedCount,
            stocks_inserted: highLowData.length,
            sources: {
                groww: growwCount,
                yahoo: yahooCount
            },
            errors: errors.slice(0, 20), // Limit errors to first 20
            error_count: errors.length,
            message: `Successfully populated ${highLowData.length} stocks (${growwCount} from Groww, ${yahooCount} from Yahoo Finance)`
        })

    } catch (error) {
        console.error('[POPULATE-DAILY-HL] Fatal error:', error)
        return NextResponse.json(
            {
                success: false,
                error: 'Internal server error',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        )
    }
}
