import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getGrowwAccessToken } from '@/lib/groww-token'

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Cron job API route that checks for breakout/breakdown stocks during market hours
 * Runs every 1 minute during market hours (9:15 AM - 3:30 PM IST)
 * 
 * CRITICAL FIX: All snapshots MUST use daily_high_low table for previous day values
 * Breakout: LTP > yesterday's high
 * Breakdown: LTP < yesterday's low
 */
export async function GET(request: NextRequest) {
    try {
        // Validate cron secret for security
        const authHeader = request.headers.get('authorization')
        const cronSecret = process.env.CRON_SECRET

        if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
            console.error('[BREAKOUT-CHECK] Unauthorized cron request')
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const now = new Date()
        const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000))
        const istHour = istTime.getUTCHours()
        const istMinute = istTime.getUTCMinutes()
        const currentTimeInMinutes = istHour * 60 + istMinute
        const marketOpenTime = 9 * 60 + 15

        const todayDate = istTime.toISOString().split('T')[0]
        console.log(`[BREAKOUT-CHECK] Checking breakouts/breakdowns for ${todayDate}`)

        // Clear tables at market open (9:15-9:16 AM)
        const isMarketOpenWindow = currentTimeInMinutes >= marketOpenTime && currentTimeInMinutes < marketOpenTime + 1

        if (isMarketOpenWindow) {
            console.log('[BREAKOUT-CHECK] Market open detected - clearing previous day breakdown/breakout data')
            try {
                await Promise.all([
                    supabaseAdmin.from('breakout_stocks').delete().neq('symbol', ''),
                    supabaseAdmin.from('breakdown_stocks').delete().neq('symbol', ''),
                    supabaseAdmin.from('breakout_snapshots').delete().neq('symbol', '')
                ])
                console.log('[BREAKOUT-CHECK] ✅ Successfully cleared breakdown/breakout tables')
                return NextResponse.json({
                    success: true,
                    message: 'Market open - cleared breakdown/breakout tables',
                    action: 'cleanup',
                    cleared_at: now.toISOString()
                })
            } catch (clearError) {
                console.error('[BREAKOUT-CHECK] Error clearing tables:', clearError)
            }
        }

        // Auto-generate token if needed
        const growwToken = await getGrowwAccessToken() || process.env.GROWW_API_TOKEN || '';

        // ===== FETCH PREVIOUS DAY DATA FROM daily_high_low TABLE =====
        console.log('[BREAKOUT-CHECK] Fetching previous day data from daily_high_low table...')

        const { data: highLowData, error: fetchError } = await supabaseAdmin
            .from('daily_high_low')
            .select('symbol, sector, today_high, today_low, today_open, today_close')

        if (fetchError) {
            console.error('[BREAKOUT-CHECK] Error fetching high-low data:', fetchError)
            return NextResponse.json(
                { error: 'Failed to fetch high-low data', details: fetchError.message },
                { status: 500 }
            )
        }

        // Filter out indices
        const filteredData = (highLowData || []).filter(stock =>
            !['NIFTY', 'BANKNIFTY'].includes(stock.symbol)
        )

        console.log(`[BREAKOUT-CHECK] Fetched ${highLowData?.length || 0} records, analyzing ${filteredData.length} stocks`)

        if (!filteredData || filteredData.length === 0) {
            console.log('[BREAKOUT-CHECK] No high-low data available - run EOD capture first')
            return NextResponse.json({
                success: true,
                message: 'No high-low data available',
                breakouts: 0,
                breakdowns: 0,
            })
        }

        // Log sample to verify correct previous day data
        if (filteredData.length > 0) {
            const sample = filteredData.slice(0, 3).map((s: any) => ({
                symbol: s.symbol,
                prev_high: s.today_high,
                prev_low: s.today_low,
                prev_close: s.today_close
            }))
            console.log(`[BREAKOUT-CHECK] Sample previous day data:`, JSON.stringify(sample))
        }

        const breakoutsToInsert: any[] = []
        const breakdownsToInsert: any[] = []
        const snapshotsToInsert: any[] = []
        const errors: string[] = []

        // Process in batches
        const BATCH_SIZE = 20
        const batches = []
        for (let i = 0; i < filteredData.length; i += BATCH_SIZE) {
            batches.push(filteredData.slice(i, i + BATCH_SIZE))
        }

        console.log(`[BREAKOUT-CHECK] Processing ${batches.length} batches of ${BATCH_SIZE} stocks`)

        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
            const batch = batches[batchIndex]
            console.log(`[BREAKOUT-CHECK] Batch ${batchIndex + 1}/${batches.length}`)

            const batchPromises = batch.map(async (stock: any) => {
                try {
                    let ltp = 0
                    let todayOpen = 0

                    // TRY GROWW API FIRST
                    try {
                        const growwUrl = `https://api.groww.in/v1/live-data/quote?exchange=NSE&segment=CASH&trading_symbol=${stock.symbol}`
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
                            ltp = data.payload?.last_price || 0
                            todayOpen = data.payload?.open || 0
                        }
                    } catch (growwError) {
                        // Silent fail, try next API
                    }

                    // FALLBACK 2: OLD GROWW API
                    if (ltp === 0) {
                        try {
                            const oldGrowwUrl = `https://groww.in/v1/api/stocks_data/v1/tr_live_prices/exchange/NSE/segment/CASH/${stock.symbol}/latest`
                            const oldGrowwResponse = await fetch(oldGrowwUrl, {
                                headers: {
                                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                                },
                                cache: 'no-store',
                            })

                            if (oldGrowwResponse.ok) {
                                const oldData = await oldGrowwResponse.json()
                                ltp = oldData.ltp || oldData.last || 0
                                todayOpen = oldData.open || 0
                            }
                        } catch (oldGrowwError) {
                            // Silent fail, try next API
                        }
                    }

                    // FALLBACK 3: NSE API
                    if (ltp === 0) {
                        try {
                            const nseUrl = `https://www.nseindia.com/api/quote-equity?symbol=${stock.symbol}`
                            const nseResponse = await fetch(nseUrl, {
                                headers: {
                                    'Accept': 'application/json',
                                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                                    'Accept-Language': 'en-US,en;q=0.9',
                                },
                                cache: 'no-store',
                            })

                            if (nseResponse.ok) {
                                const nseData = await nseResponse.json()
                                ltp = nseData.priceInfo?.lastPrice || 0
                                todayOpen = nseData.priceInfo?.open || 0
                            }
                        } catch (nseError) {
                            console.log(`[BREAKOUT-CHECK] All APIs failed for ${stock.symbol}`)
                        }
                    }

                    if (ltp > 0) {
                        // Check for BREAKOUT (LTP > yesterday's high from daily_high_low)
                        if (ltp > stock.today_high) {
                            const breakoutPercent = ((ltp - stock.today_high) / stock.today_high) * 100
                            console.log(`[BREAKOUT] ${stock.symbol}: ${ltp} > ${stock.today_high} (+${breakoutPercent.toFixed(2)}%)`)

                            return {
                                type: 'breakout',
                                data: {
                                    symbol: stock.symbol,
                                    breakout_stocks: {
                                        symbol: stock.symbol,
                                        sector: stock.sector,
                                        ltp: ltp,
                                        yesterday_high: stock.today_high,
                                        breakout_percent: breakoutPercent,
                                        breakout_date: todayDate,
                                        yesterday_open: stock.today_open || 0,
                                        yesterday_close: stock.today_close || 0,
                                    },
                                    snapshot: {
                                        symbol: stock.symbol,
                                        current_price: ltp,
                                        // CRITICAL: Use daily_high_low values directly
                                        prev_day_high: stock.today_high,
                                        prev_day_low: stock.today_low,
                                        prev_day_close: stock.today_close || 0,
                                        prev_day_open: stock.today_open || 0,
                                        breakout_percentage: breakoutPercent,
                                        breakdown_percentage: 0,
                                        is_breakout: true,
                                        is_breakdown: false,
                                        updated_at: new Date().toISOString()
                                    }
                                }
                            }
                        }

                        // Check for BREAKDOWN (LTP < yesterday's low from daily_high_low)
                        if (ltp < stock.today_low) {
                            const breakdownPercent = ((stock.today_low - ltp) / stock.today_low) * 100
                            console.log(`[BREAKDOWN] ${stock.symbol}: ${ltp} < ${stock.today_low} (-${breakdownPercent.toFixed(2)}%)`)

                            return {
                                type: 'breakdown',
                                data: {
                                    symbol: stock.symbol,
                                    breakdown_stocks: {
                                        symbol: stock.symbol,
                                        sector: stock.sector,
                                        ltp: ltp,
                                        yesterday_low: stock.today_low,
                                        breakdown_percent: breakdownPercent,
                                        breakdown_date: todayDate,
                                        yesterday_open: stock.today_open || 0,
                                        yesterday_close: stock.today_close || 0,
                                    },
                                    snapshot: {
                                        symbol: stock.symbol,
                                        current_price: ltp,
                                        // CRITICAL: Use daily_high_low values directly
                                        prev_day_high: stock.today_high,
                                        prev_day_low: stock.today_low,
                                        prev_day_close: stock.today_close || 0,
                                        prev_day_open: stock.today_open || 0,
                                        breakout_percentage: 0,
                                        breakdown_percentage: breakdownPercent,
                                        is_breakout: false,
                                        is_breakdown: true,
                                        updated_at: new Date().toISOString()
                                    }
                                }
                            }
                        }
                    }
                    return null
                } catch (error) {
                    errors.push(`${stock.symbol}: ${error instanceof Error ? error.message : 'Unknown error'}`)
                    return null
                }
            })

            const results = await Promise.all(batchPromises)

            // Collect results
            results.forEach(result => {
                if (result) {
                    if (result.type === 'breakout') {
                        breakoutsToInsert.push(result.data.breakout_stocks)
                        snapshotsToInsert.push(result.data.snapshot)
                    } else if (result.type === 'breakdown') {
                        breakdownsToInsert.push(result.data.breakdown_stocks)
                        snapshotsToInsert.push(result.data.snapshot)
                    }
                }
            })

            // Small delay between batches
            if (batchIndex < batches.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 100))
            }
        }

        // === ATOMIC UPDATE START ===
        console.log('[BREAKOUT-CHECK] Clearing old records...')
        await Promise.all([
            supabaseAdmin.from('breakout_stocks').delete().neq('symbol', ''),
            supabaseAdmin.from('breakdown_stocks').delete().neq('symbol', ''),
            supabaseAdmin.from('breakout_snapshots').delete().neq('symbol', '')
        ])

        // Batch insert new records
        let breakoutCount = 0
        let breakdownCount = 0
        let snapshotCount = 0

        if (breakoutsToInsert.length > 0) {
            const { error: insertError } = await supabaseAdmin
                .from('breakout_stocks')
                .upsert(breakoutsToInsert, { onConflict: 'symbol,breakout_date' })
            if (insertError) {
                console.error('[BREAKOUT-CHECK] Error batch upserting breakouts:', insertError)
                errors.push(`Batch upsert breakouts: ${insertError.message}`)
            } else {
                breakoutCount = breakoutsToInsert.length
            }
        }

        if (breakdownsToInsert.length > 0) {
            const { error: insertError } = await supabaseAdmin
                .from('breakdown_stocks')
                .upsert(breakdownsToInsert, { onConflict: 'symbol,breakdown_date' })
            if (insertError) {
                console.error('[BREAKOUT-CHECK] Error batch upserting breakdowns:', insertError)
                errors.push(`Batch upsert breakdowns: ${insertError.message}`)
            } else {
                breakdownCount = breakdownsToInsert.length
            }
        }

        if (snapshotsToInsert.length > 0) {
            const { error: insertError } = await supabaseAdmin
                .from('breakout_snapshots')
                .upsert(snapshotsToInsert, { onConflict: 'symbol' })
            if (insertError) {
                console.error('[BREAKOUT-CHECK] Error upserting snapshots:', insertError)
                errors.push(`Upsert snapshots: ${insertError.message}`)
            } else {
                snapshotCount = snapshotsToInsert.length
            }
        }

        console.log(`[BREAKOUT-CHECK] ✅ Complete: ${breakoutCount} breakouts, ${breakdownCount} breakdowns, ${snapshotCount} snapshots`)
        console.log(`[BREAKOUT-CHECK] ✅ All snapshots use daily_high_low table for previous day values`)

        return NextResponse.json({
            success: true,
            checked_at: now.toISOString(),
            stocks_checked: filteredData.length,
            breakouts_detected: breakoutCount,
            breakdowns_detected: breakdownCount,
            snapshots_detected: snapshotCount,
            errors: errors.slice(0, 10),
            error_count: errors.length,
        })

    } catch (error) {
        console.error('[BREAKOUT-CHECK] Fatal error:', error)
        return NextResponse.json(
            { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        )
    }
}
