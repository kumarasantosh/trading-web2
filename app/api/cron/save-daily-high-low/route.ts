import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { SECTOR_STOCKS } from '@/constants/sector-stocks-mapping'
import { getGrowwAccessToken } from '@/lib/groww-token'

// Force dynamic rendering since we use request headers
export const dynamic = 'force-dynamic';

/**
 * Cron job API route that captures daily high-low data at 3:35 PM IST (EOD)
 * This data becomes "yesterday's high-low" for the next trading session
 * 
 * Security: Validates CRON_SECRET to prevent unauthorized access
 */
export async function GET(request: NextRequest) {
    try {
        // Validate cron secret for security
        const authHeader = request.headers.get('authorization')
        const cronSecret = process.env.CRON_SECRET

        if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
            console.error('[DAILY-HIGH-LOW] Unauthorized cron request')
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Get current IST time
        const now = new Date()
        const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000))
        const todayDate = istTime.toISOString().split('T')[0] // YYYY-MM-DD format

        console.log(`[DAILY-HIGH-LOW] Starting EOD capture for ${todayDate}`)

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

        console.log(`[DAILY-HIGH-LOW] Tracking ${allStocks.size} unique stocks`)

        // Fetch high-low data for all stocks
        const highLowData: any[] = []
        const errors: string[] = []
        const failedStocks: string[] = []
        let successCount = 0

        // STEP 1: Try Groww API for all stocks

        // Auto-generate token if needed
        const growwToken = await getGrowwAccessToken() || process.env.GROWW_API_TOKEN || '';

        for (const symbol of Array.from(allStocks)) {
            try {
                // Fetch OHLC data from Groww API (new endpoint)
                const url = `https://api.groww.in/v1/live-data/quote?exchange=NSE&segment=CASH&trading_symbol=${symbol}`

                const response = await fetch(url, {
                    headers: {
                        'Authorization': `Bearer ${growwToken}`,
                        'X-API-VERSION': '1.0',
                        'Accept': 'application/json',
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                    },
                    cache: 'no-store',
                })

                if (response.ok) {
                    const data = await response.json()
                    const payload = data.payload
                    const ohlc = payload?.ohlc

                    // Only add if we have valid high and low values
                    if (ohlc?.high && ohlc?.low) {
                        highLowData.push({
                            symbol: symbol,
                            sector: stockToSectorMap.get(symbol) || 'Unknown',
                            today_high: ohlc.high,
                            today_low: ohlc.low,
                            today_open: ohlc.open || payload?.open || ohlc.high, // Fallback to high if open missing
                            today_close: ohlc.close || payload?.close || payload?.last_price || ohlc.low, // Fallback to close/ltp/low
                            captured_date: todayDate,
                        })
                        successCount++
                    } else {
                        failedStocks.push(symbol)
                        errors.push(`${symbol}: Missing high/low data`)
                    }
                } else {
                    // Track failed stocks for Yahoo Finance fallback
                    failedStocks.push(symbol)
                    errors.push(`${symbol}: API returned ${response.status}`)
                }

                // Small delay to avoid rate limiting (100ms per stock)
                await new Promise(resolve => setTimeout(resolve, 100))

            } catch (error) {
                console.error(`[DAILY-HIGH-LOW] Error fetching ${symbol}:`, error)
                failedStocks.push(symbol)
                errors.push(`${symbol}: ${error instanceof Error ? error.message : 'Unknown error'}`)
            }
        }

        console.log(`[DAILY-HIGH-LOW] Groww API: ${successCount}/${allStocks.size} stocks successful`)

        // STEP 2: Retry failed stocks with Yahoo Finance
        if (failedStocks.length > 0) {
            console.log(`[DAILY-HIGH-LOW] Retrying ${failedStocks.length} failed stocks with Yahoo Finance...`)

            // Import Yahoo Finance helper
            const { fetchYahooStockData } = await import('@/services/yahooFinance')

            for (const symbol of failedStocks) {
                try {
                    const yahooData = await fetchYahooStockData(symbol)

                    if (yahooData && yahooData.high > 0 && yahooData.low > 0) {
                        highLowData.push({
                            symbol: symbol,
                            sector: stockToSectorMap.get(symbol) || 'Unknown',
                            today_high: yahooData.high,
                            today_low: yahooData.low,
                            today_open: yahooData.open || yahooData.high, // Fallback to high if open missing
                            today_close: yahooData.close || yahooData.low, // Fallback to low if close missing
                            captured_date: todayDate,
                        })
                        successCount++
                        console.log(`[DAILY-HIGH-LOW] ✅ ${symbol} recovered via Yahoo Finance`)
                    } else {
                        console.log(`[DAILY-HIGH-LOW] ❌ ${symbol} failed on Yahoo Finance too`)
                    }

                    // Small delay to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, 200))

                } catch (error) {
                    console.error(`[DAILY-HIGH-LOW] Yahoo Finance error for ${symbol}:`, error)
                }
            }
        }

        console.log(`[DAILY-HIGH-LOW] Final: ${successCount}/${allStocks.size} stocks captured (${failedStocks.length} retried with Yahoo Finance)`)

        // Delete all existing records from daily_high_low table
        // This ensures we only keep the latest EOD data
        const { error: deleteError } = await supabaseAdmin
            .from('daily_high_low')
            .delete()
            .neq('symbol', '__DUMMY__') // Delete all records (using a dummy condition)

        if (deleteError) {
            console.error('[DAILY-HIGH-LOW] Error deleting old records:', deleteError)
            errors.push(`Delete error: ${deleteError.message}`)
        } else {
            console.log('[DAILY-HIGH-LOW] Deleted all previous records')
        }

        // Insert fresh high-low data
        if (highLowData.length > 0) {
            const { error: insertError } = await supabaseAdmin
                .from('daily_high_low')
                .insert(highLowData)

            if (insertError) {
                console.error('[DAILY-HIGH-LOW] Insert error:', insertError)
                errors.push(`Insert error: ${insertError.message}`)
            } else {
                console.log(`[DAILY-HIGH-LOW] ✅ Inserted ${highLowData.length} records`)
            }
        }

        return NextResponse.json({
            success: true,
            captured_date: todayDate,
            total_stocks: allStocks.size,
            stocks_captured: successCount,
            stocks_inserted: highLowData.length,
            errors: errors.slice(0, 10), // Limit errors to first 10
            error_count: errors.length,
        })

    } catch (error) {
        console.error('[DAILY-HIGH-LOW] Fatal error:', error)
        return NextResponse.json(
            { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        )
    }
}
