import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * API endpoint to fetch today's breakout stocks
 * Breakout = stocks where LTP > yesterday's high
 */
export async function GET() {
    try {
        // Get today's date in IST
        const now = new Date()
        const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000))
        const todayDate = istTime.toISOString().split('T')[0]

        // Fetch breakout stocks for today
        const { data, error } = await supabaseAdmin
            .from('breakout_stocks')
            .select('*')
            .eq('breakout_date', todayDate)
            .order('breakout_percent', { ascending: false })

        if (error) {
            console.error('[BREAKOUT-STOCKS] Error fetching data:', error)
            return NextResponse.json(
                { error: 'Failed to fetch breakout stocks', details: error.message },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            date: todayDate,
            count: data?.length || 0,
            stocks: data || [],
        })

    } catch (error) {
        console.error('[BREAKOUT-STOCKS] Fatal error:', error)
        return NextResponse.json(
            { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        )
    }
}
