import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

/**
 * API route to fetch historical snapshots
 * GET /api/snapshots?type=sector&start=...&end=...
 */
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams
        const type = searchParams.get('type') // 'sector' or 'stock'
        const start = searchParams.get('start') // ISO timestamp
        const end = searchParams.get('end') // ISO timestamp
        const sectorFilter = searchParams.get('sector') // Optional sector filter

        if (!type || !start || !end) {
            return NextResponse.json(
                { error: 'Missing required parameters: type, start, end' },
                { status: 400 }
            )
        }

        if (type === 'sector') {
            // Calculate the target time as the midpoint between start and end
            // (since start = time - 5min, end = time + 5min, midpoint = actual selected time)
            const startTime = new Date(start).getTime()
            const endTime = new Date(end).getTime()
            const targetTime = new Date((startTime + endTime) / 2).toISOString()
            const targetTimestamp = new Date(targetTime).getTime()
            
            // Maximum allowed time difference (2.5 minutes = 150000ms)
            // This ensures we only return data if it was captured within ±2.5 min of selected time
            const MAX_TIME_DIFF_MS = 2.5 * 60 * 1000
            
            // Query snapshots in the range, ordered by time
            const query = supabase
                .from('sector_snapshots')
                .select('*')
                .gte('captured_at', start)
                .lte('captured_at', end)
                .order('captured_at', { ascending: true })

            const { data, error } = await query

            if (error) {
                console.error('Supabase query error:', error)
                return NextResponse.json({ error: error.message }, { status: 500 })
            }

            if (!data || data.length === 0) {
                console.log(`[Snapshots API] No data found in range ${start} to ${end}`)
                return NextResponse.json({ snapshots: [] })
            }

            // Group by sector_name and pick the closest snapshot to target time for each sector
            // BUT only if it's within MAX_TIME_DIFF_MS of the target
            const sectorMap = new Map<string, any>()
            
            data.forEach((snap: any) => {
                const snapTimestamp = new Date(snap.captured_at).getTime()
                const timeDiff = Math.abs(snapTimestamp - targetTimestamp)
                
                // Skip if this snapshot is too far from the target time
                if (timeDiff > MAX_TIME_DIFF_MS) {
                    return
                }
                
                const key = snap.sector_name
                const existing = sectorMap.get(key)
                
                if (!existing || timeDiff < existing.timeDiff) {
                    sectorMap.set(key, { ...snap, timeDiff })
                }
            })

            // If no snapshots are within the allowed time range, return empty
            if (sectorMap.size === 0) {
                console.log(`[Snapshots API] Data found but none within ±2.5min of target ${targetTime}`)
                return NextResponse.json({ snapshots: [] })
            }

            // Convert map back to array (removing the timeDiff property)
            const closestSnapshots = Array.from(sectorMap.values()).map(({ timeDiff, ...snap }) => snap)
            console.log(`[Snapshots API] Returning ${closestSnapshots.length} sectors for target ${targetTime}`)

            return NextResponse.json({ snapshots: closestSnapshots })

        } else if (type === 'stock') {
            let query = supabase
                .from('stock_snapshots')
                .select('*')
                .gte('captured_at', start)
                .lte('captured_at', end)
                .order('captured_at', { ascending: true })

            if (sectorFilter) {
                query = query.eq('sector', sectorFilter)
            }

            const { data, error } = await query

            if (error) {
                console.error('Supabase query error:', error)
                return NextResponse.json({ error: error.message }, { status: 500 })
            }

            return NextResponse.json({ snapshots: data || [] })

        } else {
            return NextResponse.json(
                { error: 'Invalid type. Must be "sector" or "stock"' },
                { status: 400 }
            )
        }

    } catch (error) {
        console.error('Snapshot API error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}

export const dynamic = 'force-dynamic'
