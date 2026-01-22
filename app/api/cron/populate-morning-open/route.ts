import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { SECTOR_STOCKS } from '@/constants/sector-stocks-mapping'
import { getGrowwAccessToken } from '@/lib/groww-token'

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max

/**
 * Cron job API route that updates daily_high_low table with LIVE Open price.
 * TIMING: Runs at 9:16 AM IST (Morning).
 * PURPOSE: Updates the 'today_open' column with the actual session open price.
 *          The 'daily_high_low' table contains stats from the Previous Day (captured last night).
 *          Updating 'today_open' allows Breakout calculations (Today Open vs Yesterday High).
 */
export async function GET(request: NextRequest) {
    try {
        // Validate cron secret
        const authHeader = request.headers.get('authorization')
        const cronSecret = process.env.CRON_SECRET

        if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
            console.error('[POPULATE-MORNING-OPEN] Unauthorized cron request')
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        console.log(`[POPULATE-MORNING-OPEN] Starting morning open update...`)

        // 1. Get Groww Token
        let growwToken: string | null = null;
        try {
            const { forceRefreshFromSupabase } = await import('@/lib/groww-token');
            growwToken = await forceRefreshFromSupabase();
        } catch (e) {
            console.warn('[POPULATE-MORNING-OPEN] Import failed, using standard getter');
        }

        if (!growwToken) {
            growwToken = await getGrowwAccessToken() || process.env.GROWW_API_TOKEN || '';
        }

        if (!growwToken) {
            console.error('[POPULATE-MORNING-OPEN] No Groww Token available')
            return NextResponse.json({ error: 'No Groww Token' }, { status: 500 })
        }

        // 2. Collect targets
        const allStocks = new Set<string>()
        Object.values(SECTOR_STOCKS).flat().forEach(s => allStocks.add(s))
        const stockArray = Array.from(allStocks)

        console.log(`[POPULATE-MORNING-OPEN] Updating Open for ${stockArray.length} stocks`)

        let successCount = 0
        let failedCount = 0
        const BATCH_SIZE = 10

        // 3. Batched Processing
        for (let i = 0; i < stockArray.length; i += BATCH_SIZE) {
            const batch = stockArray.slice(i, i + BATCH_SIZE)

            const batchPromises = batch.map(async (symbol) => {
                try {
                    // Fetch Live Quote
                    const growwSymbol = symbol.toUpperCase().replace('.NS', '')
                    const quoteUrl = `https://groww.in/v1/api/stocks_data/v1/tr_live_prices/exchange/NSE/segment/CASH/${growwSymbol}/latest`

                    const resp = await fetch(quoteUrl, {
                        headers: {
                            'Accept': 'application/json',
                            'Authorization': `Bearer ${growwToken}`,
                        },
                        next: { revalidate: 0 } // No cache
                    })

                    let liveOpen: number | null = null;

                    if (resp.ok) {
                        const payload = await resp.json()
                        if (payload.open) {
                            liveOpen = payload.open
                        } else if (payload.ohlc && payload.ohlc.open) {
                            liveOpen = payload.ohlc.open
                        }
                    }

                    if (liveOpen !== null && liveOpen > 0) {
                        // Update DB
                        // Since daily_high_low table is cleared nightly and repopulated,
                        // we update the existing record for this symbol.
                        const { error } = await supabaseAdmin
                            .from('daily_high_low')
                            .update({ today_open: liveOpen })
                            .eq('symbol', symbol)

                        if (!error) {
                            successCount++
                        } else {
                            console.error(`[POPULATE-MORNING-OPEN] DB Update Error ${symbol}:`, error.message)
                            failedCount++
                        }
                    } else {
                        // console.warn(`[POPULATE-MORNING-OPEN] No open price found for ${symbol}`)
                        failedCount++
                    }

                } catch (err) {
                    console.error(`[POPULATE-MORNING-OPEN] Error processing ${symbol}:`, err)
                    failedCount++
                }
            })

            await Promise.all(batchPromises)
            // Small delay to prevent rate limits
            await new Promise(r => setTimeout(r, 100))
        }

        console.log(`[POPULATE-MORNING-OPEN] Completed. Updated: ${successCount}, Failed: ${failedCount}`)

        return NextResponse.json({
            success: true,
            updated: successCount,
            failed: failedCount
        })

    } catch (err) {
        console.error('[POPULATE-MORNING-OPEN] Fatal:', err)
        return NextResponse.json({ success: false, error: 'Fatal Error' }, { status: 500 })
    }
}
