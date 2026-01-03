import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Test API to debug query issues
 * GET /api/test-query?time=2026-01-02T07:35:00.000Z
 */
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams
        const timeParam = searchParams.get('time') || '2026-01-02T07:35:00.000Z'
        
        const time = new Date(timeParam)
        const start = new Date(time)
        start.setMinutes(start.getMinutes() - 5)
        const end = new Date(time)
        end.setMinutes(end.getMinutes() + 5)

        console.log('Query params:', {
            time: time.toISOString(),
            start: start.toISOString(),
            end: end.toISOString()
        })

        // Query with different formats to see which works
        const queries = {
            isoString: {
                start: start.toISOString(),
                end: end.toISOString()
            },
            // Also try with .000Z format
            zuluFormat: {
                start: start.toISOString().replace(/\.\d{3}Z$/, '.000Z'),
                end: end.toISOString().replace(/\.\d{3}Z$/, '.000Z')
            }
        }

        // Try the actual query format we use
        const { data, error } = await supabaseAdmin
            .from('sector_snapshots')
            .select('*')
            .gte('captured_at', start.toISOString())
            .lte('captured_at', end.toISOString())
            .order('captured_at', { ascending: true })
            .limit(100)

        if (error) {
            return NextResponse.json({ 
                error: error.message,
                queries,
                time: time.toISOString()
            }, { status: 500 })
        }

        // Group by captured_at to see what we get
        const byTime = new Map<string, any[]>()
        data?.forEach(snap => {
            const key = snap.captured_at
            if (!byTime.has(key)) {
                byTime.set(key, [])
            }
            byTime.get(key)!.push(snap)
        })

        return NextResponse.json({
            success: true,
            queryTime: time.toISOString(),
            queryRange: {
                start: start.toISOString(),
                end: end.toISOString()
            },
            totalRows: data?.length || 0,
            uniqueTimestamps: Array.from(byTime.keys()),
            timestampCounts: Array.from(byTime.entries()).map(([time, snaps]) => ({
                timestamp: time,
                count: snaps.length,
                sample: snaps[0]?.sector_name
            })),
            sampleData: data?.slice(0, 3)
        })

    } catch (error: any) {
        return NextResponse.json({
            error: 'Internal server error',
            details: error.message
        }, { status: 500 })
    }
}

export const dynamic = 'force-dynamic'

