import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getGrowwAccessToken } from '@/lib/groww-token'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'
export const maxDuration = 300

/**
 * Cron job API route that checks for breakout/breakdown stocks
 * NOW FORCED TO NO-CACHE TO ENSURE FRESH DATA
 */
export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization')
        const cronSecret = process.env.CRON_SECRET

        if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const now = new Date()
        const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000))
        const todayDate = istTime.toISOString().split('T')[0]
        console.log(`[BREAKOUT-CHECK] Starting check for ${todayDate}`)

        // 1. Fetch Fresh Daily High/Low Data
        // Using upserted data from populate-daily-high-low cron
        console.log('[BREAKOUT-CHECK] Fetching daily_high_low...')
        const { data: highLowData, error: fetchError } = await supabaseAdmin
            .from('daily_high_low')
            .select('symbol, sector, today_high, today_low, today_open, today_close')

        if (fetchError) {
            console.error('[BREAKOUT-CHECK] Data fetch error:', fetchError)
            return NextResponse.json({ error: fetchError.message }, { status: 500 })
        }

        // Filter indices
        const stocksToAnalyze = (highLowData || []).filter(s => !['NIFTY', 'BANKNIFTY'].includes(s.symbol))

        if (stocksToAnalyze.length === 0) {
            console.log('[BREAKOUT-CHECK] No stocks found in daily_high_low')
            return NextResponse.json({ message: 'No data' })
        }

        console.log(`[BREAKOUT-CHECK] Analyzing ${stocksToAnalyze.length} stocks from daily_high_low`)

        // Debug: Log first 3 stocks to verify data freshness in logs
        console.log('[BREAKOUT-CHECK] Sample Reference Data:', JSON.stringify(stocksToAnalyze.slice(0, 3).map(s => ({
            s: s.symbol, h: s.today_high
        }))))

        // 2. Clear Tables (Atomic Reset)
        // We clear first to ensure no stale snapshots remain
        await Promise.all([
            supabaseAdmin.from('breakout_stocks').delete().neq('symbol', ''),
            supabaseAdmin.from('breakdown_stocks').delete().neq('symbol', ''),
            supabaseAdmin.from('breakout_snapshots').delete().neq('symbol', '')
        ])

        // 3. Process Stocks
        const growwToken = await getGrowwAccessToken() || process.env.GROWW_API_TOKEN || ''
        const breakouts = []
        const breakdowns = []
        const snapshots = []
        const errors = []

        // Batch processing
        const BATCH_SIZE = 20
        const batches = []
        for (let i = 0; i < stocksToAnalyze.length; i += BATCH_SIZE) {
            batches.push(stocksToAnalyze.slice(i, i + BATCH_SIZE))
        }

        for (const batch of batches) {
            const results = await Promise.all(batch.map(async (stock: any) => {
                try {
                    // Fetch Live Price for Stock
                    let ltp = 0

                    // Strategy: Groww New -> Groww Old -> NSE
                    // ... (Using condensed logic for brevity but robustness) ...

                    // 1. Groww New
                    try {
                        const res = await fetch(`https://api.groww.in/v1/live-data/quote?exchange=NSE&segment=CASH&trading_symbol=${stock.symbol}`, {
                            headers: { 'Authorization': `Bearer ${growwToken}`, 'X-API-VERSION': '1.0' },
                            cache: 'no-store'
                        })
                        if (res.ok) {
                            const d = await res.json()
                            ltp = d.payload?.last_price || 0
                        }
                    } catch (e) { }

                    // 2. Groww Old
                    if (!ltp) {
                        try {
                            const res = await fetch(`https://groww.in/v1/api/stocks_data/v1/tr_live_prices/exchange/NSE/segment/CASH/${stock.symbol}/latest`, { cache: 'no-store' })
                            if (res.ok) {
                                const d = await res.json()
                                ltp = d.ltp || d.last || 0
                            }
                        } catch (e) { }
                    }

                    // 3. NSE
                    if (!ltp) {
                        try {
                            const res = await fetch(`https://www.nseindia.com/api/quote-equity?symbol=${stock.symbol}`, {
                                headers: { 'User-Agent': 'Mozilla/5.0' },
                                cache: 'no-store'
                            })
                            if (res.ok) {
                                const d = await res.json()
                                ltp = d.priceInfo?.lastPrice || 0
                            }
                        } catch (e) { }
                    }

                    if (ltp > 0) {
                        // Check Breakout
                        if (ltp > stock.today_high) {
                            const pct = ((ltp - stock.today_high) / stock.today_high) * 100
                            return {
                                type: 'breakout',
                                stock: {
                                    symbol: stock.symbol,
                                    sector: stock.sector,
                                    ltp,
                                    yesterday_high: stock.today_high,
                                    breakout_percent: pct,
                                    breakout_date: todayDate,
                                    yesterday_open: stock.today_open || 0,
                                    yesterday_close: stock.today_close || 0
                                },
                                snapshot: {
                                    symbol: stock.symbol,
                                    current_price: ltp,
                                    prev_day_high: stock.today_high, // FROM DB
                                    prev_day_low: stock.today_low,   // FROM DB
                                    prev_day_close: stock.today_close || 0,
                                    prev_day_open: stock.today_open || 0,
                                    breakout_percentage: pct,
                                    breakdown_percentage: 0,
                                    is_breakout: true,
                                    is_breakdown: false,
                                    updated_at: new Date().toISOString()
                                }
                            }
                        }
                        // Check Breakdown
                        if (ltp < stock.today_low) {
                            const pct = ((stock.today_low - ltp) / stock.today_low) * 100
                            return {
                                type: 'breakdown',
                                stock: {
                                    symbol: stock.symbol,
                                    sector: stock.sector,
                                    ltp,
                                    yesterday_low: stock.today_low,
                                    breakdown_percent: pct,
                                    breakdown_date: todayDate,
                                    yesterday_open: stock.today_open || 0,
                                    yesterday_close: stock.today_close || 0
                                },
                                snapshot: {
                                    symbol: stock.symbol,
                                    current_price: ltp,
                                    prev_day_high: stock.today_high, // FROM DB
                                    prev_day_low: stock.today_low,   // FROM DB
                                    prev_day_close: stock.today_close || 0,
                                    prev_day_open: stock.today_open || 0,
                                    breakout_percentage: 0,
                                    breakdown_percentage: pct,
                                    is_breakout: false,
                                    is_breakdown: true,
                                    updated_at: new Date().toISOString()
                                }
                            }
                        }
                    }
                } catch (err: any) {
                    errors.push(`${stock.symbol}: ${err.message}`)
                }
                return null
            }))

            results.forEach((r: any) => {
                if (r) {
                    if (r.type === 'breakout') {
                        breakouts.push(r.stock)
                        snapshots.push(r.snapshot)
                    } else {
                        breakdowns.push(r.stock)
                        snapshots.push(r.snapshot)
                    }
                }
            })

            // Delay 100ms
            await new Promise(r => setTimeout(r, 100))
        }

        // 4. Batch Updates
        if (breakouts.length) await supabaseAdmin.from('breakout_stocks').upsert(breakouts, { onConflict: 'symbol,breakout_date' })
        if (breakdowns.length) await supabaseAdmin.from('breakdown_stocks').upsert(breakdowns, { onConflict: 'symbol,breakdown_date' })
        if (snapshots.length) await supabaseAdmin.from('breakout_snapshots').upsert(snapshots, { onConflict: 'symbol' })

        console.log(`[BREAKOUT-CHECK] Done. Breakouts: ${breakouts.length}, Snapshots: ${snapshots.length}`)

        return NextResponse.json({
            success: true,
            checked: stocksToAnalyze.length,
            breakouts: breakouts.length,
            snapshots: snapshots.length,
            errors: errors.slice(0, 5)
        })

    } catch (error: any) {
        console.error('[BREAKOUT-CHECK] Fatal:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
