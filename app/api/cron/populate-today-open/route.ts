import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { SECTOR_STOCKS } from '@/constants/sector-stocks-mapping'
import { getGrowwAccessToken } from '@/lib/groww-token'

// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max

/**
 * Cron job API route that updates 'today_open' in daily_high_low table
 * 
 * Logic:
 * 1. Runs at 9:16 AM (Market Open)
 * 2. Fetches Live 'Open' from Groww
 * 3. Updates the existing record in daily_high_low
 */
export async function GET(request: NextRequest) {
    try {
        // Validate cron secret
        const authHeader = request.headers.get('authorization')
        const cronSecret = process.env.CRON_SECRET

        if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        console.log(`[POPULATE-OPEN] Starting 9:16 AM Open Price Update`)

        // Get Groww Token
        const { forceRefreshFromSupabase } = await import('@/lib/groww-token');
        let growwToken = await forceRefreshFromSupabase();

        if (!growwToken) {
            console.log('[POPULATE-OPEN] Force refresh of Groww token failed, trying fallback');
            growwToken = await getGrowwAccessToken() || process.env.GROWW_API_TOKEN || '';
        }

        // Collect all stocks
        const allStocks = new Set<string>()
        Object.values(SECTOR_STOCKS).flat().forEach(s => allStocks.add(s))

        console.log(`[POPULATE-OPEN] Processing ${allStocks.size} stocks`)

        const stockArray = Array.from(allStocks)
        const BATCH_SIZE = 10
        let updatedCount = 0
        let failedCount = 0

        for (let i = 0; i < stockArray.length; i += BATCH_SIZE) {
            const batch = stockArray.slice(i, i + BATCH_SIZE)

            const batchPromises = batch.map(async (symbol) => {
                try {
                    // Groww symbol usually doesn't need .NS
                    const growwSymbol = symbol.toUpperCase().replace('.NS', '')
                    const quoteUrl = `https://groww.in/v1/api/stocks_data/v1/tr_live_prices/exchange/NSE/segment/CASH/${growwSymbol}/latest`

                    const resp = await fetch(quoteUrl, {
                        headers: {
                            'Accept': 'application/json',
                            'Authorization': `Bearer ${growwToken}`,
                        },
                    })

                    if (resp.ok) {
                        const payload = await resp.json()
                        let openPrice: number | null = null;

                        if (payload.open) {
                            openPrice = payload.open
                        } else if (payload.ohlc && payload.ohlc.open) {
                            openPrice = payload.ohlc.open
                        }

                        if (openPrice !== null && openPrice > 0) {
                            // Update Supabase
                            const { error } = await supabaseAdmin
                                .from('daily_high_low')
                                .update({ today_open: openPrice })
                                .eq('symbol', symbol)

                            if (error) {
                                console.error(`[POPULATE-OPEN] DB Update Error for ${symbol}:`, error)
                                return false
                            }
                            return true
                        }
                    }
                    return false
                } catch (e) {
                    // console.error(`[POPULATE-OPEN] Error for ${symbol}:`, e)
                    return false
                }
            })

            const results = await Promise.all(batchPromises)
            results.forEach(success => {
                if (success) updatedCount++
                else failedCount++
            })

            // Rate limit
            await new Promise(r => setTimeout(r, 200))
        }

        console.log(`[POPULATE-OPEN] Completed. Updated: ${updatedCount}, Failed: ${failedCount}`)

        return NextResponse.json({
            success: true,
            updated: updatedCount,
            failed: failedCount
        })

    } catch (error) {
        console.error('[POPULATE-OPEN] Fatal:', error)
        return NextResponse.json({ success: false, error: 'Fatal Error' }, { status: 500 })
    }
}
