import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Frontend API endpoint for breakouts and breakdowns
 * Returns pre-calculated data from breakout_snapshots table
 */
export async function GET() {
    try {
        // Fetch ALL breakouts (sorted by highest breakout percentage)
        const { data: breakoutsData, error: breakoutsError } = await supabaseAdmin
            .from('breakout_snapshots')
            .select('symbol, current_price, prev_day_high, prev_day_low, prev_day_close, prev_day_open, breakout_percentage, breakdown_percentage, is_breakout, is_breakdown, volume, updated_at')
            .eq('is_breakout', true)
            .order('breakout_percentage', { ascending: false })

        if (breakoutsError) {
            console.error('[BREAKOUTS-API] Error fetching breakouts:', breakoutsError)
            throw breakoutsError
        }

        // Fetch ALL breakdowns (sorted by lowest breakdown percentage = most negative)
        const { data: breakdownsData, error: breakdownsError } = await supabaseAdmin
            .from('breakout_snapshots')
            .select('symbol, current_price, prev_day_high, prev_day_low, prev_day_close, prev_day_open, breakout_percentage, breakdown_percentage, is_breakout, is_breakdown, volume, updated_at')
            .eq('is_breakdown', true)
            .order('breakdown_percentage', { ascending: true }) // Most negative first

        if (breakdownsError) {
            console.error('[BREAKOUTS-API] Error fetching breakdowns:', breakdownsError)
            throw breakdownsError
        }

        const breakouts = breakoutsData || []
        const breakdowns = breakdownsData || []

        // Get total counts
        const { count: totalBreakouts } = await supabaseAdmin
            .from('breakout_snapshots')
            .select('*', { count: 'exact', head: true })
            .eq('is_breakout', true)

        const { count: totalBreakdowns } = await supabaseAdmin
            .from('breakout_snapshots')
            .select('*', { count: 'exact', head: true })
            .eq('is_breakdown', true)

        // Get the most recent update timestamp
        const latestUpdate = breakouts?.[0]?.updated_at || breakdowns?.[0]?.updated_at || new Date().toISOString()

        return NextResponse.json({
            success: true,
            breakouts: breakouts || [],
            breakdowns: breakdowns || [],
            updated_at: latestUpdate,
            count: {
                total_breakouts: totalBreakouts || 0,
                total_breakdowns: totalBreakdowns || 0,
            },
        })

    } catch (error) {
        console.error('[BREAKOUTS-API] Error:', error)

        // Check if it's a "relation does not exist" error
        if (error instanceof Error && error.message.includes('relation') && error.message.includes('does not exist')) {
            return NextResponse.json(
                {
                    error: 'Database table not found',
                    details: 'The breakout_snapshots table does not exist. Please run the SQL schema in Supabase.',
                    hint: 'Execute supabase/breakout-snapshots-schema.sql in your Supabase SQL Editor',
                },
                { status: 500 }
            )
        }

        return NextResponse.json(
            {
                error: 'Internal server error',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        )
    }
}
