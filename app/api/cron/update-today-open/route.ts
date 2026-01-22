import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getGrowwAccessToken } from '@/lib/groww-token'

// Force dynamic rendering and disable all caching
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'
export const maxDuration = 300 // 5 minutes max

/**
 * Cron job API route that updates today_open in daily_high_low with live market open price
 * Runs at 9:15 AM (after populate-daily-high-low)
 * 
 * Logic:
 * 1. Fetch all existing rows from daily_high_low
 * 2. Fetch live quotes from Groww
 * 3. Update today_open column
 * 4. Upsert back to database
 */
export async function GET(request: NextRequest) {
    try {
        // Validate cron secret for security
        const authHeader = request.headers.get('authorization')
        const cronSecret = process.env.CRON_SECRET

        if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
            console.error('[UPDATE-TODAY-OPEN] Unauthorized cron request')
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        console.log(`[UPDATE-TODAY-OPEN] Starting update of today_open...`)

        // 1. Fetch existing rows from daily_high_low
        const { data: existingRows, error: fetchError } = await supabaseAdmin
            .from('daily_high_low')
            .select('*')

        if (fetchError) {
            console.error('[UPDATE-TODAY-OPEN] Failed to fetch existing rows:', fetchError)
            return NextResponse.json({ error: fetchError.message }, { status: 500 })
        }

        if (!existingRows || existingRows.length === 0) {
            console.log('[UPDATE-TODAY-OPEN] No rows found in daily_high_low. run populate-daily-high-low first.')
            return NextResponse.json({
                success: false,
                message: 'No rows found in daily_high_low'
            })
        }

        console.log(`[UPDATE-TODAY-OPEN] Found ${existingRows.length} existing rows to update`)

        // 2. Prepare for Groww API calls
        const { forceRefreshFromSupabase } = await import('@/lib/groww-token');
        let growwToken = await forceRefreshFromSupabase();

        if (!growwToken) {
            console.log('[UPDATE-TODAY-OPEN] Force refresh failed, using fallback');
            growwToken = await getGrowwAccessToken() || process.env.GROWW_API_TOKEN || '';
        }

        const symbols = existingRows.map(row => row.symbol)
        const updates: any[] = []
        const errors: string[] = []
        let successCount = 0
        let errorCount = 0

        // 3. Fetch live data in batches and update
        const BATCH_SIZE = 3 // Conservative batch size

        for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
            const batchSymbols = symbols.slice(i, i + BATCH_SIZE)
            console.log(`[UPDATE-TODAY-OPEN] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(symbols.length / BATCH_SIZE)}`)

            const batchPromises = batchSymbols.map(async (symbol) => {
                try {
                    // Find the existing row to modify
                    const existingRow = existingRows.find(r => r.symbol === symbol)
                    if (!existingRow) return null

                    // Fetch live data from Groww
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
                        return null
                    }

                    const ohlc = payload.ohlc || {}

                    // Get live open price
                    const liveOpen = payload.open || ohlc.open || 0

                    if (liveOpen > 0) {
                        // Return the mutated row (merging existing data with new open)
                        // properly typed for daily_high_low table
                        return {
                            ...existingRow,
                            today_open: liveOpen,
                            // Ensure captured_date is preserved or updated if needed? 
                            // User request: "update all the rows of today_open"
                            // We keep other fields as is.
                        }
                    } else {
                        // If live open is 0, arguably we shouldn't overwrite with 0 if previous value existed
                        // But if it's 9:15 AM, 0 might mean "not yet traded"
                        // I'll skip update if liveOpen is 0 or null
                        return null
                    }

                } catch (error: any) {
                    errors.push(`${symbol}: ${error.message}`)
                    return null
                }
            })

            const results = await Promise.all(batchPromises)

            results.forEach(updatedRow => {
                if (updatedRow) {
                    updates.push(updatedRow)
                    successCount++
                } else {
                    errorCount++
                }
            })

            // Rate limit delay
            if (i + BATCH_SIZE < symbols.length) {
                await new Promise(r => setTimeout(r, 1000))
            }
        }

        console.log(`[UPDATE-TODAY-OPEN] Prepared ${updates.length} updates`)

        // 4. Upsert back to database
        if (updates.length > 0) {
            const { error: upsertError } = await supabaseAdmin
                .from('daily_high_low')
                .upsert(updates, {
                    onConflict: 'symbol',
                    ignoreDuplicates: false
                })

            if (upsertError) {
                console.error('[UPDATE-TODAY-OPEN] Database upsert failed:', upsertError)
                return NextResponse.json({ error: upsertError.message }, { status: 500 })
            }
        }

        return NextResponse.json({
            success: true,
            total_processed: symbols.length,
            updated: successCount,
            failed: errorCount,
            errors: errors.slice(0, 5)
        })

    } catch (error: any) {
        console.error('[UPDATE-TODAY-OPEN] Fatal:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
