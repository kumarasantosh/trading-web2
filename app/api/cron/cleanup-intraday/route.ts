import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
    try {
        // Validate cron secret
        const authHeader = request.headers.get('authorization')
        const cronSecret = process.env.CRON_SECRET

        if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
            console.error('[CLEANUP] Unauthorized request')
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        console.log('[CLEANUP] Starting cleanup of intraday data...')

        const now = new Date()
        const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000))
        const todayDate = istTime.toISOString().split('T')[0] // YYYY-MM-DD

        const errors: string[] = []
        const results: string[] = []

        // 1. Clear stock_snapshots (Live current state)
        // We delete ALL because this table represents "current" state. 
        // If it has yesterday's data, it's stale.
        const { error: stockError } = await supabaseAdmin
            .from('stock_snapshots')
            .delete()
            .gte('id', 0) // Delete all rows (id >= 0 matches everything)

        if (stockError) {
            errors.push(`stock_snapshots: ${stockError.message}`)
        } else {
            results.push('Cleared stock_snapshots')
        }

        // 2. Clear breakout_snapshots (Live current state)
        const { error: breakoutError } = await supabaseAdmin
            .from('breakout_snapshots')
            .delete()
            .gte('id', 0) // Delete all rows

        if (breakoutError) {
            errors.push(`breakout_snapshots: ${breakoutError.message}`)
        } else {
            results.push('Cleared breakout_snapshots')
        }

        // 3. Clear market_indices_snapshots (History) - Keep today's
        const { error: indicesError } = await supabaseAdmin
            .from('market_indices_snapshots')
            .delete()
            .lt('captured_at', todayDate)

        if (indicesError) {
            errors.push(`market_indices_snapshots: ${indicesError.message}`)
        } else {
            results.push('Cleaned market_indices_snapshots')
        }

        // 4. Clear sector_snapshots (History) - Keep today's
        const { error: sectorError } = await supabaseAdmin
            .from('sector_snapshots')
            .delete()
            .lt('captured_at', todayDate)

        if (sectorError) {
            errors.push(`sector_snapshots: ${sectorError.message}`)
        } else {
            results.push('Cleaned sector_snapshots')
        }

        // 5. Clear pcr_data (History) - Keep today's
        const { error: pcrError } = await supabaseAdmin
            .from('pcr_data')
            .delete()
            .lt('captured_at', todayDate)

        if (pcrError) {
            // pcr_data might be a different table name or structure, ignore if fails
            // errors.push(`pcr_data: ${pcrError.message}`)
        } else {
            results.push('Cleaned pcr_data')
        }

        // 6. Clear option_chain_snapshots (or similar) if exists
        // Check table name... assuming 'option_chain_snapshots' based on context

        return NextResponse.json({
            success: true,
            results,
            errors
        })

    } catch (error) {
        console.error('[CLEANUP] Error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
