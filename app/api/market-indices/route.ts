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
            previousClose: item.previous_close || undefined,
            open: item.open_price || undefined,
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

/**
 * API route to save market indices snapshots
 * POST /api/market-indices
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { indices } = body

        if (!indices || !Array.isArray(indices)) {
            return NextResponse.json({ error: 'Invalid indices data' }, { status: 400 })
        }

        // Get today's date in IST
        const now = new Date()
        const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000))
        const todayDate = istTime.toISOString().split('T')[0] // YYYY-MM-DD format

        // Transform indices to database format
        const snapshots = indices.map((index: any) => ({
            captured_at: todayDate,
            index_name: index.name,
            value: index.value || 0,
            change: index.change || 0,
            change_percent: index.changePercent || 0,
            previous_close: index.previousClose || 0,
            open_price: index.open || 0,
        }))

        // Insert into Supabase (upsert to handle duplicates)
        const { error } = await supabase
            .from('market_indices_snapshots')
            .upsert(snapshots, {
                onConflict: 'index_name,captured_at',
                ignoreDuplicates: false // Update if exists
            })

        if (error) {
            console.error('Supabase insert error:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            date: todayDate,
            count: snapshots.length,
            message: 'Market indices snapshot saved successfully'
        })

    } catch (error) {
        console.error('Market indices POST error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}

export const dynamic = 'force-dynamic'

