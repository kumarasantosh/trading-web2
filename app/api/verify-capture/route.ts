import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Verification API to check if auto-capture is saving data correctly
 * GET /api/verify-capture
 */
export async function GET(request: NextRequest) {
    try {
        const results: any = {
            timestampRounding: { status: 'checking', issues: [] },
            dataConsistency: { status: 'checking', issues: [] },
            recentCaptures: { status: 'checking', data: [] },
            timestampStatus: { status: 'checking', data: [] }
        }

        // 1. Check recent captures and timestamp rounding
        const { data: allSnapshots, error: allError } = await supabaseAdmin
            .from('sector_snapshots')
            .select('captured_at, sector_name, last_price, change_percent')
            .order('captured_at', { ascending: false })
            .limit(200)

        if (allError) {
            return NextResponse.json({ 
                error: allError.message,
                results 
            }, { status: 500 })
        }

        if (!allSnapshots || allSnapshots.length === 0) {
            return NextResponse.json({
                success: false,
                message: 'No data found in database',
                results: {
                    ...results,
                    timestampRounding: { status: 'error', message: 'No data to check' },
                    dataConsistency: { status: 'error', message: 'No data to check' }
                }
            })
        }

        // Group by captured_at
        const timeMap = new Map<string, any[]>()
        allSnapshots.forEach(snap => {
            const time = snap.captured_at
            if (!timeMap.has(time)) {
                timeMap.set(time, [])
            }
            timeMap.get(time)!.push(snap)
        })

        const uniqueTimes = Array.from(timeMap.keys()).slice(0, 10)

        // 2. Check timestamp rounding
        const roundingIssues: string[] = []
        const roundedTimestamps: string[] = []
        const unroundedTimestamps: string[] = []

        uniqueTimes.forEach(time => {
            const date = new Date(time)
            const seconds = date.getSeconds()
            const minutes = date.getMinutes()
            const isRounded = seconds === 0 && minutes % 5 === 0
            
            if (isRounded) {
                roundedTimestamps.push(time)
            } else {
                unroundedTimestamps.push(time)
                roundingIssues.push(`${time} is not rounded (${minutes}:${seconds})`)
            }
        })

        results.timestampRounding = {
            status: unroundedTimestamps.length === 0 ? 'pass' : 'warning',
            totalChecked: uniqueTimes.length,
            rounded: roundedTimestamps.length,
            unrounded: unroundedTimestamps.length,
            issues: roundingIssues,
            unroundedTimestamps: unroundedTimestamps.slice(0, 5)
        }

        // 3. Check data consistency (compare values across timestamps)
        const consistencyIssues: string[] = []
        const sampleSector = 'Metal' // Check one sector across different times
        const sectorData = allSnapshots
            .filter(s => s.sector_name === sampleSector)
            .slice(0, 5)

        if (sectorData.length > 1) {
            const firstPrice = sectorData[0].last_price
            const firstChange = sectorData[0].change_percent
            const allSame = sectorData.every(s => 
                s.last_price === firstPrice && s.change_percent === firstChange
            )
            
            if (allSame) {
                consistencyIssues.push(`All ${sectorData.length} recent captures for "${sampleSector}" have identical values (market data hasn't changed)`)
            }
        }

        results.dataConsistency = {
            status: consistencyIssues.length === 0 ? 'pass' : 'info',
            sampleSector,
            samplesChecked: sectorData.length,
            issues: consistencyIssues,
            sampleData: sectorData.slice(0, 3).map(s => ({
                timestamp: s.captured_at,
                last_price: s.last_price,
                change_percent: s.change_percent
            }))
        }

        // 4. Recent captures summary
        results.recentCaptures = {
            status: 'pass',
            totalUniqueTimestamps: timeMap.size,
            recentTimestamps: uniqueTimes.map(time => ({
                timestamp: time,
                sectorCount: timeMap.get(time)!.length,
                isRounded: (() => {
                    const d = new Date(time)
                    return d.getSeconds() === 0 && d.getMinutes() % 5 === 0
                })()
            }))
        }

        // 5. Overall status
        const overallStatus = 
            results.timestampRounding.status === 'pass' && 
            results.dataConsistency.status !== 'error' 
            ? 'pass' 
            : 'warning'

        return NextResponse.json({
            success: true,
            overallStatus,
            timestamp: new Date().toISOString(),
            results,
            recommendations: [
                ...(unroundedTimestamps.length > 0 ? [
                    `⚠️ Found ${unroundedTimestamps.length} unrounded timestamps. Run the SQL normalization script to fix them.`
                ] : []),
                ...(consistencyIssues.length > 0 ? [
                    `ℹ️ All data values are identical. This is normal if the market hasn't moved. Wait for more captures to see different values.`
                ] : []),
                ...(timeMap.size < 3 ? [
                    `ℹ️ Only ${timeMap.size} timestamp(s) found. Run more captures to build up historical data.`
                ] : [])
            ]
        })

    } catch (error: any) {
        console.error('Verification error:', error)
        return NextResponse.json(
            { 
                success: false,
                error: 'Internal server error', 
                details: error.message 
            },
            { status: 500 }
        )
    }
}

export const dynamic = 'force-dynamic'

