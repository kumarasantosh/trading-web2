import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * API endpoint to fetch today's breakdown stocks
 * Breakdown = stocks where LTP < yesterday's low
 */
export async function GET() {
    try {
        // Get today's date in IST
        const now = new Date()
        const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000))
        const todayDate = istTime.toISOString().split('T')[0]

        // Fetch breakdown stocks for today
        const { data, error } = await supabaseAdmin
            .from('breakdown_stocks')
            .select('*')
            .eq('breakdown_date', todayDate)
            .order('breakdown_percent', { ascending: false })

        if (error) {
            console.error('[BREAKDOWN-STOCKS] Error fetching data:', error)
            return NextResponse.json(
                { error: 'Failed to fetch breakdown stocks', details: error.message },
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
        console.error('[BREAKDOWN-STOCKS] Fatal error:', error)
        return NextResponse.json(
            { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        )
    }
}
