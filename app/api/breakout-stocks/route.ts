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
        // Get date in IST; on Saturday/Sunday use last trading day (Friday)
        const now = new Date()
        const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000))
        const dayOfWeek = istTime.getUTCDay()
        let effectiveDate: string
        if (dayOfWeek === 0) {
            const friday = new Date(istTime)
            friday.setDate(friday.getDate() - 2)
            effectiveDate = friday.toISOString().split('T')[0]
        } else if (dayOfWeek === 6) {
            const friday = new Date(istTime)
            friday.setDate(friday.getDate() - 1)
            effectiveDate = friday.toISOString().split('T')[0]
        } else {
            effectiveDate = istTime.toISOString().split('T')[0]
        }

        // Fetch breakout stocks for the effective date
        const { data, error } = await supabaseAdmin
            .from('breakout_stocks')
            .select('*')
            .eq('breakout_date', effectiveDate)
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
            date: effectiveDate,
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
