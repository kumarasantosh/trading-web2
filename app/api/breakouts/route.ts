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
        // Fetch breakouts from breakout_stocks table
        const { data: breakoutsData, error: breakoutsError } = await supabaseAdmin
            .from('breakout_stocks')
            .select('*')
            .order('detected_at', { ascending: false })

        if (breakoutsError) {
            console.error('[BREAKOUTS-API] Error fetching breakouts:', breakoutsError)
            throw breakoutsError
        }

        // Fetch breakdowns from breakdown_stocks table
        const { data: breakdownsData, error: breakdownsError } = await supabaseAdmin
            .from('breakdown_stocks')
            .select('*')
            .order('detected_at', { ascending: false })

        if (breakdownsError) {
            console.error('[BREAKOUTS-API] Error fetching breakdowns:', breakdownsError)
            // Don't throw - table might not exist yet
            console.log('[BREAKOUTS-API] breakdown_stocks table might not exist')
        }

        // Fetch daily_high_low data for sentiment indicators
        const { data: dailyHighLowData, error: dailyHighLowError } = await supabaseAdmin
            .from('daily_high_low')
            .select('symbol, today_open, today_close')

        if (dailyHighLowError) {
            console.error('[BREAKOUTS-API] Error fetching daily_high_low:', dailyHighLowError)
        }

        // Create a map for quick lookup
        const highLowMap = new Map()
        if (dailyHighLowData) {
            dailyHighLowData.forEach((item: any) => {
                highLowMap.set(item.symbol, {
                    today_open: item.today_open,
                    today_close: item.today_close
                })
            })
        }

        // Merge the data
        const finalBreakouts = (breakoutsData || []).map((item: any) => ({
            ...item,
            today_open: highLowMap.get(item.symbol)?.today_open,
            today_close: highLowMap.get(item.symbol)?.today_close,
        }))

        const finalBreakdowns = (breakdownsData || []).map((item: any) => ({
            ...item,
            today_open: highLowMap.get(item.symbol)?.today_open,
            today_close: highLowMap.get(item.symbol)?.today_close,
        }))

        // Get the most recent update timestamp
        const latestUpdate = finalBreakouts?.[0]?.detected_at || finalBreakdowns?.[0]?.detected_at || new Date().toISOString()

        return NextResponse.json({
            success: true,
            breakouts: finalBreakouts || [],
            breakdowns: finalBreakdowns || [],
            updated_at: latestUpdate,
            count: {
                total_breakouts: finalBreakouts.length || 0,
                total_breakdowns: finalBreakdowns.length || 0,
            },
        })

    } catch (error) {
        console.error('[BREAKOUTS-API] Error:', error)

        // Check if it's a "relation does not exist" error
        if (error instanceof Error && error.message.includes('relation') && error.message.includes('does not exist')) {
            return NextResponse.json(
                {
                    error: 'Database table not found',
                    details: 'The breakout_stocks table does not exist. Please run the SQL schema in Supabase.',
                    hint: 'Create the breakout_stocks table in your Supabase SQL Editor',
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
