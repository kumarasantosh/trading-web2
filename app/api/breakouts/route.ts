import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Frontend API endpoint for breakouts and breakdowns
 * Returns pre-calculated data from breakout_snapshots table
 */
export async function GET() {
    try {
        // Fetch latest data from breakout_snapshots
        // We order by updated_at desc to get the latest snapshot batch
        const { data: snapshots, error } = await supabaseAdmin
            .from('breakout_snapshots')
            .select('*')
            .order('updated_at', { ascending: false })

        if (error) {
            console.error('[BREAKOUTS-API] Error fetching snapshots:', error)
            throw error
        }

        // Get the most recent timestamp to filter stale data if necessary
        // Ideally the cron updates all at once, so we just return what we have
        const latestUpdate = snapshots?.[0]?.updated_at || new Date().toISOString()

        // Filter for breakouts and breakdowns
        const breakouts = (snapshots || []).filter((s: any) => s.is_breakout).map((s: any) => ({
            symbol: s.symbol,
            ltp: s.current_price,
            change_percent: s.breakout_percentage,
            breakout_percent: s.breakout_percentage,
            yesterday_high: s.prev_day_high,
            yesterday_low: s.prev_day_low,
            today_open: s.prev_day_open, // Note: Schema might use prev_day_open, adjusting mapping
            today_close: s.prev_day_close,
            volume: s.volume,
            detected_at: s.updated_at
        }))

        const breakdowns = (snapshots || []).filter((s: any) => s.is_breakdown).map((s: any) => ({
            symbol: s.symbol,
            ltp: s.current_price,
            change_percent: s.breakdown_percentage,
            breakdown_percent: s.breakdown_percentage,
            yesterday_high: s.prev_day_high,
            yesterday_low: s.prev_day_low,
            today_open: s.prev_day_open,
            today_close: s.prev_day_close,
            volume: s.volume,
            detected_at: s.updated_at
        }))

        return NextResponse.json({
            success: true,
            breakouts,
            breakdowns,
            updated_at: latestUpdate,
            count: {
                total_breakouts: breakouts.length,
                total_breakdowns: breakdowns.length,
            },
        })

    } catch (error) {
        console.error('[BREAKOUTS-API] Error:', error)
        return NextResponse.json(
            {
                error: 'Internal server error',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        )
    }
}
