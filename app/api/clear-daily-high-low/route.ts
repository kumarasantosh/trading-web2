import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * API endpoint to clear all data from daily_high_low table
 * For testing purposes only
 */
export async function GET() {
    try {
        // Delete all records from daily_high_low table
        const { error } = await supabaseAdmin
            .from('daily_high_low')
            .delete()
            .neq('symbol', '__DUMMY__') // Delete all (using dummy condition)

        if (error) {
            console.error('[CLEAR-DAILY-HIGH-LOW] Error:', error)
            return NextResponse.json(
                {
                    success: false,
                    error: 'Failed to clear data',
                    details: error.message
                },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            message: 'All records deleted from daily_high_low table',
        })

    } catch (error) {
        console.error('[CLEAR-DAILY-HIGH-LOW] Fatal error:', error)
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
