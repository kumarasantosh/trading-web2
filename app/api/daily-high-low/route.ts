import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * API endpoint to fetch daily high-low data from database
 * This data represents yesterday's high and low for all tracked stocks
 */
export async function GET() {
    try {
        // Fetch all daily high-low data from database
        const { data, error } = await supabaseAdmin
            .from('daily_high_low')
            .select('symbol, sector, today_high, today_low, today_open, today_close, captured_date')
            .order('symbol', { ascending: true })

        if (error) {
            console.error('[DAILY-HIGH-LOW-API] Error fetching data:', error)
            return NextResponse.json(
                {
                    success: false,
                    error: 'Failed to fetch daily high-low data',
                    details: error.message
                },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            count: data?.length || 0,
            data: data || [],
        })

    } catch (error) {
        console.error('[DAILY-HIGH-LOW-API] Fatal error:', error)
        return NextResponse.json(
            {
                success: false,
                error: 'Internal server error',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        )
    }
}
