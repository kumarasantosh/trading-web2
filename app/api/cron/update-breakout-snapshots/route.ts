import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { SECTOR_STOCKS } from '@/constants/sector-stocks-mapping'
import { getGrowwAccessToken } from '@/lib/groww-token'

/**
 * Background job to update breakout snapshots
 * Runs every 5 minutes during market hours
 * Calculates breakouts (above prev high) and breakdowns (below prev low)
 */
export async function GET(request: Request) {
    try {
        // Verify cron secret
        const authHeader = request.headers.get('authorization')
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Check if it's market hours (9:15 AM - 3:30 PM IST, Mon-Fri)
        const now = new Date()
        const istOffset = 5.5 * 60 * 60 * 1000
        const istTime = new Date(now.getTime() + istOffset)
        const istHour = istTime.getUTCHours()
        const istMinute = istTime.getUTCMinutes()
        const dayOfWeek = istTime.getUTCDay() // 0 = Sunday, 6 = Saturday

        // // Check if it's a weekend
        // if (dayOfWeek === 0 || dayOfWeek === 6) {
        //     console.log('[BREAKOUT-SNAPSHOTS] Skipping - Weekend')
        //     return NextResponse.json({
        //         success: true,
        //         message: 'Weekend - market closed',
        //         updated: 0,
        //     })
        // }

        // // Check if within market hours (9:15 AM - 3:30 PM IST)
        // const currentTimeInMinutes = istHour * 60 + istMinute
        // const marketOpenTime = 9 * 60 + 15  // 9:15 AM
        // const marketCloseTime = 15 * 60 + 30 // 3:30 PM

        // if (currentTimeInMinutes < marketOpenTime || currentTimeInMinutes > marketCloseTime) {
        //     console.log('[BREAKOUT-SNAPSHOTS] Skipping - Outside market hours')
        //     return NextResponse.json({
        //         success: true,
        //         message: 'Outside market hours',
        //         updated: 0,
        //     })
        // }

        console.log(`[BREAKOUT-SNAPSHOTS] Starting update at ${istTime.toISOString()}`)

        // Auto-generate token if needed
        const growwToken = await getGrowwAccessToken() || process.env.GROWW_API_TOKEN || '';

        // Get all unique stock symbols
        const allStocks = new Set<string>()
        Object.values(SECTOR_STOCKS).forEach(stocks => {
            stocks.forEach(stock => allStocks.add(stock))
        })
        const symbols = Array.from(allStocks)

        console.log(`[BREAKOUT-SNAPSHOTS] Processing ${symbols.length} stocks`)

        // Fetch previous day data from daily_high_low table
        const { data: prevDayData, error: prevDayError } = await supabaseAdmin
            .from('daily_high_low')
            .select('symbol, today_high, today_low')
            .in('symbol', symbols)

        if (prevDayError) {
            console.error('[BREAKOUT-SNAPSHOTS] Error fetching prev day data:', prevDayError)
            throw prevDayError
        }

        // Create a map for quick lookup
        const prevDayMap = new Map<string, any>()
        prevDayData?.forEach(item => {
            prevDayMap.set(item.symbol, {
                high: item.today_high,
                low: item.today_low,
                close: item.today_high, // Use high as fallback since close doesn't exist
                open: item.today_low,   // Use low as fallback since open doesn't exist
            })
        })

        console.log(`[BREAKOUT-SNAPSHOTS] Found ${prevDayMap.size} stocks with previous day data`)

        // Fetch current prices using individual quote API (parallel batches)
        const BATCH_SIZE = 10 // Reduced to avoid rate limits
        const snapshots: Array<{
            symbol: string
            current_price: number
            prev_day_high: number
            prev_day_low: number
            prev_day_close: number
            prev_day_open: number
            breakout_percentage: number
            breakdown_percentage: number
            is_breakout: boolean
            is_breakdown: boolean
            volume: number
            updated_at: string
        }> = []
        let successCount = 0
        let errorCount = 0

        for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
            const batch = symbols.slice(i, i + BATCH_SIZE)
            console.log(`[BREAKOUT-SNAPSHOTS] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(symbols.length / BATCH_SIZE)}`)

            const batchPromises = batch.map(async (symbol) => {
                try {
                    // Get previous day data
                    const prevDay = prevDayMap.get(symbol)
                    if (!prevDay) {
                        return null // Skip if no previous day data
                    }

                    // Fetch current price from Groww API
                    const quoteUrl = `https://api.groww.in/v1/live-data/quote?exchange=NSE&segment=CASH&trading_symbol=${symbol}`
                    const response = await fetch(quoteUrl, {
                        headers: {
                            'Accept': 'application/json',
                            'Authorization': `Bearer ${growwToken}`,
                            'X-API-VERSION': '1.0',
                        },
                        cache: 'no-store',
                    })

                    if (!response.ok) {
                        console.log(`[BREAKOUT-SNAPSHOTS] Groww API failed for ${symbol}: ${response.status}`)
                        return null
                    }

                    const data = await response.json()

                    if (data.status !== 'SUCCESS' || !data.payload) {
                        console.log(`[BREAKOUT-SNAPSHOTS] Invalid data for ${symbol}: status=${data.status}`)
                        return null
                    }

                    const payload = data.payload
                    const ohlc = payload.ohlc || {}

                    // Get current price (LTP or close)
                    let currentPrice = payload.ltp || payload.last_price || 0
                    if (currentPrice === 0) {
                        currentPrice = ohlc.close || 0
                    }

                    if (!currentPrice || currentPrice <= 0) {
                        console.log(`[BREAKOUT-SNAPSHOTS] No valid price for ${symbol}: ltp=${payload.ltp}, last_price=${payload.last_price}, close=${ohlc.close}`)
                        return null
                    }

                    // Calculate breakout/breakdown
                    const isBreakout = currentPrice > prevDay.high
                    const isBreakdown = currentPrice < prevDay.low

                    console.log(`[BREAKOUT-SNAPSHOTS] ${symbol}: price=${currentPrice}, prevHigh=${prevDay.high}, prevLow=${prevDay.low}, breakout=${isBreakout}, breakdown=${isBreakdown}`)

                    const breakoutPercentage = isBreakout
                        ? ((currentPrice - prevDay.high) / prevDay.high) * 100
                        : 0

                    const breakdownPercentage = isBreakdown
                        ? ((currentPrice - prevDay.low) / prevDay.low) * 100
                        : 0

                    return {
                        symbol,
                        current_price: currentPrice,
                        prev_day_high: prevDay.high,
                        prev_day_low: prevDay.low,
                        prev_day_close: prevDay.close,
                        prev_day_open: prevDay.open || prevDay.close,
                        breakout_percentage: breakoutPercentage,
                        breakdown_percentage: breakdownPercentage,
                        is_breakout: isBreakout,
                        is_breakdown: isBreakdown,
                        volume: payload.volume || 0,
                        updated_at: new Date().toISOString(),
                    }
                } catch (error) {
                    console.error(`[BREAKOUT-SNAPSHOTS] Error processing ${symbol}:`, error)
                    return null
                }
            })

            const batchResults = await Promise.all(batchPromises)

            batchResults.forEach((result, idx) => {
                if (result) {
                    snapshots.push(result)
                    successCount++
                } else {
                    errorCount++
                    console.log(`[BREAKOUT-SNAPSHOTS] Skipped ${batch[idx]}: no data returned`)
                }
            })

            console.log(`[BREAKOUT-SNAPSHOTS] Batch complete: ${successCount}/${symbols.length} successful, ${errorCount} skipped`)

            // Add delay between batches to avoid rate limiting
            if (i + BATCH_SIZE < symbols.length) {
                await new Promise(resolve => setTimeout(resolve, 5000)) // 5 second delay
            }
        }

        console.log(`[BREAKOUT-SNAPSHOTS] Processed: ${successCount} success, ${errorCount} errors`)

        // Upsert to database
        if (snapshots.length > 0) {
            const { error: upsertError } = await supabaseAdmin
                .from('breakout_snapshots')
                .upsert(snapshots, {
                    onConflict: 'symbol',
                    ignoreDuplicates: false,
                })

            if (upsertError) {
                console.error('[BREAKOUT-SNAPSHOTS] Error upserting data:', upsertError)
                throw upsertError
            }

            console.log(`[BREAKOUT-SNAPSHOTS] Successfully upserted ${snapshots.length} stocks`)
        }

        return NextResponse.json({
            success: true,
            updated: snapshots.length,
            breakouts: snapshots.filter(s => s.is_breakout).length,
            breakdowns: snapshots.filter(s => s.is_breakdown).length,
            timestamp: new Date().toISOString(),
        })

    } catch (error) {
        console.error('[BREAKOUT-SNAPSHOTS] Fatal error:', error)
        return NextResponse.json(
            {
                error: 'Internal server error',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        )
    }
}
