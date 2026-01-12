import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { SECTOR_STOCKS } from '@/constants/sector-stocks-mapping'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

/**
 * Cron job API route that updates stock snapshots every 3 minutes
 * Fetches all stocks, calculates percent change, and upserts to database
 * 
 * Percent Change Formula: ((LTP - Open) / Open) * 100
 * 
 * Security: Validates CRON_SECRET to prevent unauthorized access
 */
export async function GET(request: NextRequest) {
    try {
        // Validate cron secret for security
        const authHeader = request.headers.get('authorization')
        const cronSecret = process.env.CRON_SECRET

        if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
            console.error('[STOCK-SNAPSHOTS] Unauthorized cron request')
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Check if within market hours (9:15 AM - 3:30 PM IST, Mon-Fri)
        const now = new Date()
        const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000))
        const istHour = istTime.getUTCHours()
        const istMinute = istTime.getUTCMinutes()
        const dayOfWeek = istTime.getUTCDay() // 0 = Sunday, 6 = Saturday

        // Check if it's a weekend
        // DISABLED FOR TESTING
        /*
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            console.log('[STOCK-SNAPSHOTS] Skipping - Weekend')
            return NextResponse.json({
                success: true,
                message: 'Weekend - market closed',
                updated: 0,
            })
        }
        */

        // Check if within market hours (9:15 AM - 3:30 PM IST)
        // TEMPORARY: Disabled for testing
        /*
        const currentTimeInMinutes = istHour * 60 + istMinute
        const marketOpenTime = 9 * 60 + 15  // 9:15 AM
        const marketCloseTime = 15 * 60 + 30 // 3:30 PM

        if (currentTimeInMinutes < marketOpenTime || currentTimeInMinutes > marketCloseTime) {
            console.log('[STOCK-SNAPSHOTS] Skipping - Outside market hours')
            return NextResponse.json({
                success: true,
                message: 'Outside market hours',
                updated: 0,
            })
        }
        */

        console.log(`[STOCK-SNAPSHOTS] Starting update at ${istTime.toISOString()}`)

        // Get all unique stock symbols
        const allStocks = new Set<string>()
        Object.values(SECTOR_STOCKS).forEach(stocks => {
            stocks.forEach(stock => allStocks.add(stock))
        })
        const symbols = Array.from(allStocks)

        console.log(`[STOCK-SNAPSHOTS] Fetching data for ${symbols.length} stocks`)

        // Fetch stock data using individual quote API (parallel batches)
        const BATCH_SIZE = 10 // Reduced to avoid rate limits
        const snapshots: Array<{
            symbol: string
            open_price: number
            last_price: number
            percent_change: number
            volume: number
            day_high: number
            day_low: number
            prev_close: number
            updated_at: string
        }> = []
        let successCount = 0
        let errorCount = 0

        for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
            const batch = symbols.slice(i, i + BATCH_SIZE)
            console.log(`[STOCK-SNAPSHOTS] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(symbols.length / BATCH_SIZE)}`)

            // Fetch all stocks in this batch in parallel
            const batchPromises = batch.map(async (symbol) => {
                try {
                    const quoteUrl = `https://api.groww.in/v1/live-data/quote?exchange=NSE&segment=CASH&trading_symbol=${symbol}`
                    const response = await fetch(quoteUrl, {
                        headers: {
                            'Accept': 'application/json',
                            'Authorization': `Bearer ${process.env.GROWW_API_TOKEN || ''}`,
                            'X-API-VERSION': '1.0',
                        },
                        cache: 'no-store',
                    })

                    if (!response.ok) {
                        console.error(`[STOCK-SNAPSHOTS] Failed to fetch ${symbol}: ${response.status}`)
                        return null
                    }

                    const data = await response.json()

                    // Check if response is successful
                    if (data.status !== 'SUCCESS' || !data.payload) {
                        return null
                    }

                    const payload = data.payload
                    const ohlc = payload.ohlc || {}

                    // Extract values from quote response
                    // When market is closed, use close price as LTP
                    let ltp = payload.ltp || payload.last_price || 0
                    if (ltp === 0) {
                        ltp = ohlc.close || 0
                    }

                    const open = ohlc.open || 0
                    const high = ohlc.high || 0
                    const low = ohlc.low || 0
                    const close = ohlc.close || 0
                    const volume = payload.volume || 0

                    if (!ltp || !open || ltp <= 0 || open <= 0) {
                        console.log(`[STOCK-SNAPSHOTS] Skipping ${symbol}: ltp=${ltp}, open=${open}`)
                        return null
                    }

                    // Calculate percent change: ((LTP - Open) / Open) * 100
                    const percentChange = ((ltp - open) / open) * 100

                    return {
                        symbol,
                        open_price: open,
                        last_price: ltp,
                        percent_change: percentChange,
                        volume,
                        day_high: high,
                        day_low: low,
                        prev_close: close,
                        updated_at: new Date().toISOString(),
                    }
                } catch (error) {
                    console.error(`[STOCK-SNAPSHOTS] Error processing ${symbol}:`, error)
                    return null
                }
            })

            const batchResults = await Promise.all(batchPromises)

            // Filter out nulls and add to snapshots
            batchResults.forEach(result => {
                if (result) {
                    snapshots.push(result)
                    successCount++
                } else {
                    errorCount++
                }
            })

            console.log(`[STOCK-SNAPSHOTS] Batch complete: ${successCount}/${symbols.length} successful`)

            // Add delay between batches to avoid rate limiting
            if (i + BATCH_SIZE < symbols.length) {
                await new Promise(resolve => setTimeout(resolve, 5000)) // 5 second delay
            }
        }

        console.log(`[STOCK-SNAPSHOTS] Processed: ${successCount} success, ${errorCount} errors`)

        // Upsert to database (batch insert with ON CONFLICT)
        if (snapshots.length > 0) {
            const { error: upsertError } = await supabaseAdmin
                .from('stock_snapshots')
                .upsert(snapshots, {
                    onConflict: 'symbol',
                    ignoreDuplicates: false,
                })

            if (upsertError) {
                console.error('[STOCK-SNAPSHOTS] Upsert error:', upsertError)
                return NextResponse.json(
                    { error: 'Failed to update database', details: upsertError.message },
                    { status: 500 }
                )
            }

            console.log(`[STOCK-SNAPSHOTS] ✅ Updated ${snapshots.length} stocks in database`)
        }

        return NextResponse.json({
            success: true,
            updated_at: now.toISOString(),
            stocks_processed: symbols.length,
            stocks_updated: successCount,
            errors: errorCount,
        })

    } catch (error) {
        console.error('[STOCK-SNAPSHOTS] Fatal error:', error)
        return NextResponse.json(
            { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        )
    }
}
