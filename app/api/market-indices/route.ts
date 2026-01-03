import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

/**
 * API route to fetch saved market indices data
 * GET /api/market-indices?date=2026-01-02 (optional, defaults to today)
 */
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams
        const dateParam = searchParams.get('date')

        // Get today's date in IST
        const now = new Date()
        const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000))
        const todayDate = dateParam || istTime.toISOString().split('T')[0] // YYYY-MM-DD format

        // Fetch saved market indices for the specified date
        const { data, error } = await supabase
            .from('market_indices_snapshots')
            .select('*')
            .eq('captured_at', todayDate)
            .order('index_name', { ascending: true })

        if (error) {
            console.error('Supabase query error:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        // Transform to match TopNavigation format
        const indices = (data || []).map((item: any) => ({
            name: item.index_name,
            value: item.value || 0,
            change: item.change || 0,
            changePercent: item.change_percent || 0,
        }))

        return NextResponse.json({
            success: true,
            date: todayDate,
            indices: indices,
            count: indices.length
        })

    } catch (error) {
        console.error('Market indices API error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}

export const dynamic = 'force-dynamic'

