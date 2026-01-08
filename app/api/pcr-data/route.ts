import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * API endpoint to fetch PCR data for frontend
 * Returns latest PCR values and historical data
 */
export async function GET() {
    try {
        // Fetch latest PCR for each index
        const { data: latestData, error: latestError } = await supabaseAdmin
            .rpc('get_latest_pcr')

        if (latestError) {
            console.error('[PCR-DATA] Error fetching latest PCR:', latestError)
        }

        // Fetch last 60 minutes of PCR data for charting
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
        const { data: historicalData, error: historicalError } = await supabaseAdmin
            .from('pcr_data')
            .select('*')
            .gte('captured_at', oneHourAgo)
            .order('captured_at', { ascending: true })

        if (historicalError) {
            console.error('[PCR-DATA] Error fetching historical PCR:', historicalError)
        }

        return NextResponse.json({
            success: true,
            latest: latestData || [],
            historical: historicalData || [],
        })

    } catch (error) {
        console.error('[PCR-DATA] Fatal error:', error)
        return NextResponse.json(
            { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        )
    }
}
