import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { SECTOR_STOCKS } from '@/constants/sector-stocks-mapping'
import { getGrowwAccessToken } from '@/lib/groww-token'

// Force dynamic rendering and disable all caching
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'
export const maxDuration = 300

/**
 * Cron job API route that populates daily_high_low table.
 * TIMING: Runs at 10:30 PM IST (Evening).
 * PURPOSE: Captures the COMPLETED trading day's stats (High, Low, Close, Open).
 *          Calculates Sentiment based on dayChange.
 *          dayChange > 0 = Green, dayChange < 0 = Red.
 * 
 * Uses Groww Live API (same as update-stock-snapshots).
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

        console.log(`[POPULATE-DAILY-HL] Starting evening population using Groww Live API...`)

        // Force refresh token from Supabase to avoid stale cache
        const { forceRefreshFromSupabase } = await import('@/lib/groww-token');
        let growwToken = await forceRefreshFromSupabase();

        // Fallback to regular method if force refresh fails
        if (!growwToken) {
            console.log('[POPULATE-DAILY-HL] Force refresh failed, using fallback');
            growwToken = await getGrowwAccessToken() || process.env.GROWW_API_TOKEN || '';
        }

        if (!growwToken) {
            console.error('[POPULATE-DAILY-HL] No Groww Token available')
            return NextResponse.json({ error: 'No Groww Token' }, { status: 500 })
        }

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

        const symbols = Array.from(allStocks)
        console.log(`[POPULATE-DAILY-HL] Processing ${symbols.length} stocks`)

        // Get today's date in IST for captured_date
        const now = new Date()
        const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000))
        const todayDate = istTime.toISOString().split('T')[0]

        const highLowData: any[] = []
        const errors: string[] = []
        let successCount = 0
        let failedCount = 0

        // Process in batches (same as update-stock-snapshots)
        const BATCH_SIZE = 3

        for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
            const batch = symbols.slice(i, i + BATCH_SIZE)
            console.log(`[POPULATE-DAILY-HL] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(symbols.length / BATCH_SIZE)}`)

            const batchPromises = batch.map(async (symbol) => {
                try {
                    // Use Groww Live API (same as update-stock-snapshots)
                    const quoteUrl = `https://groww.in/v1/api/stocks_data/v1/tr_live_prices/exchange/NSE/segment/CASH/${symbol}/latest`
                    const response = await fetch(quoteUrl, {
                        headers: {
                            'Accept': 'application/json',
                            'Authorization': `Bearer ${growwToken}`,
                        },
                        cache: 'no-store',
                    })

                    if (!response.ok) {
                        errors.push(`HTTP ${response.status} for ${symbol}`)
                        return null
                    }

                    const payload = await response.json()

                    if (!payload || typeof payload !== 'object') {
                        errors.push(`Invalid response for ${symbol}`)
                        return null
                    }

                    const ohlc = payload.ohlc || {}

                    // Extract values
                    let ltp = payload.ltp || payload.last_price || 0
                    if (ltp === 0) {
                        ltp = ohlc.close || 0
                    }

                    const open = payload.open || ohlc.open || 0
                    const high = payload.high || ohlc.high || 0
                    const low = payload.low || ohlc.low || 0
                    const close = ltp // Use LTP as close at EOD

                    if (!ltp || !open || ltp <= 0 || open <= 0) {
                        errors.push(`Invalid data for ${symbol}: ltp=${ltp}, open=${open}`)
                        return null
                    }

                    // Use dayChange directly from API response
                    const dayChange = payload.dayChange || payload.change || 0

                    // Sentiment: dayChange > 0 = Green, dayChange < 0 = Red
                    const sentiment = dayChange >= 0 ? 'Green' : 'Red'

                    return {
                        symbol: symbol,
                        sector: stockToSectorMap.get(symbol) || 'Unknown',
                        today_high: high,
                        today_low: low,
                        today_open: open,
                        today_close: close,
                        sentiment: sentiment,
                        captured_date: todayDate,
                    }

                } catch (error) {
                    errors.push(`${symbol}: ${error instanceof Error ? error.message : 'Unknown error'}`)
                    return null
                }
            })

            const batchResults = await Promise.all(batchPromises)

            batchResults.forEach(result => {
                if (result) {
                    highLowData.push(result)
                    successCount++
                } else {
                    failedCount++
                }
            })

            // Add delay between batches to avoid rate limiting
            if (i + BATCH_SIZE < symbols.length) {
                await new Promise(resolve => setTimeout(resolve, 2000))
            }
        }

        console.log(`[POPULATE-DAILY-HL] Fetched ${successCount} successfully, ${failedCount} failed`)

        // Database Update (Clear & Insert)
        if (highLowData.length > 0) {
            console.log('[POPULATE-DAILY-HL] Clearing and Inserting...')

            // Delete all records to ensure we only keep the latest reference set
            await supabaseAdmin.from('daily_high_low').delete().neq('symbol', '___')

            // Insert new records
            const { error } = await supabaseAdmin.from('daily_high_low').insert(highLowData)

            if (error) {
                console.error('Insert error:', error)
                return NextResponse.json({ success: false, error: error.message }, { status: 500 })
            }

            console.log(`[POPULATE-DAILY-HL] ✅ Inserted ${highLowData.length} stocks in database`)
        }

        return NextResponse.json({
            success: true,
            total: symbols.length,
            captured: successCount,
            failed: failedCount,
            errors: errors.slice(0, 10)
        })

    } catch (error) {
        console.error('[POPULATE-DAILY-HL] Fatal:', error)
        return NextResponse.json({ success: false, error: 'Fatal Error' }, { status: 500 })
    }
}
