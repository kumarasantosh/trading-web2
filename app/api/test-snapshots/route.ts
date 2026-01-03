import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Test API route to check what data exists in Supabase
 * GET /api/test-snapshots?limit=10
 */
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams
        const limit = parseInt(searchParams.get('limit') || '10')

        // Get unique timestamps
        const { data: allSnapshots, error: allError } = await supabaseAdmin
            .from('sector_snapshots')
            .select('captured_at, sector_name, last_price, change_percent')
            .order('captured_at', { ascending: false })
            .limit(1000)

        if (allError) {
            return NextResponse.json({ error: allError.message }, { status: 500 })
        }

        // Group by captured_at
        const timeMap = new Map<string, any[]>()
        allSnapshots?.forEach(snap => {
            const time = snap.captured_at
            if (!timeMap.has(time)) {
                timeMap.set(time, [])
            }
            timeMap.get(time)!.push(snap)
        })

        // Get unique times
        const uniqueTimes = Array.from(timeMap.keys()).slice(0, limit)

        const result = uniqueTimes.map(time => {
            const sectors = timeMap.get(time)!.map(s => ({
                name: s.sector_name,
                last_price: s.last_price,
                change_percent: s.change_percent,
            })).sort((a, b) => b.change_percent - a.change_percent)
            
            // Check if timestamp is rounded to 5-minute interval
            const date = new Date(time)
            const isRounded = date.getSeconds() === 0 && date.getMinutes() % 5 === 0
            
            return {
                timestamp: time,
                isRounded: isRounded,
                sectorCount: timeMap.get(time)!.length,
                sectors: sectors
            }
        })

        return NextResponse.json({
            success: true,
            totalUniqueTimes: timeMap.size,
            showing: limit,
            snapshots: result
        })

    } catch (error: any) {
        console.error('Test API error:', error)
        return NextResponse.json(
            { error: 'Internal server error', details: error.message },
            { status: 500 }
        )
    }
}

export const dynamic = 'force-dynamic'

