import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Frontend API endpoint for breakouts and breakdowns
 * Returns pre-calculated data from breakout_snapshots table
 */
export async function GET() {
    try {
        // Fetch data from breakout_snapshots table updated in the last 15 minutes
        const { data: snapshotsData, error: snapshotsError } = await supabaseAdmin
            .from('breakout_snapshots')
            .select('*')
            .order('updated_at', { ascending: false })

        if (snapshotsError) {
            console.error('[BREAKOUTS-API] Error fetching breakout_snapshots:', snapshotsError)
            throw snapshotsError
        }

        // Separate into breakouts and breakdowns
        const breakoutsList = (snapshotsData || [])
            .filter((item: any) => item.is_breakout)

        const breakdownsList = (snapshotsData || [])
            .filter((item: any) => item.is_breakdown)

        // Collect all symbols to fetch sentiment
        const allSymbols = [...breakoutsList, ...breakdownsList].map(s => s.symbol)

        let sentimentMap: Record<string, string> = {}
        if (allSymbols.length > 0) {
            const { data: sentData } = await supabaseAdmin
                .from('daily_high_low')
                .select('symbol, sentiment')
                .in('symbol', allSymbols)
                .order('captured_date', { ascending: false })

            if (sentData) {
                // Map symbol -> sentiment (using first occurrence which is latest due to order)
                sentData.forEach(item => {
                    if (!sentimentMap[item.symbol]) {
                        sentimentMap[item.symbol] = item.sentiment
                    }
                })
            }
        }

        const breakouts = breakoutsList
            .map((item: any) => ({
                symbol: item.symbol,
                ltp: item.current_price,
                yesterday_high: item.prev_day_high,
                yesterday_low: item.prev_day_low,
                breakout_percent: item.breakout_percentage,
                prev_day_open: item.prev_day_open,
                prev_day_close: item.prev_day_close,
                today_open: item.today_open || item.prev_day_open,
                volume: item.volume,
                detected_at: item.updated_at,
                prev_day_sentiment: sentimentMap[item.symbol] || null
            }))
            .sort((a: any, b: any) => b.breakout_percent - a.breakout_percent)

        const breakdowns = breakdownsList
            .map((item: any) => ({
                symbol: item.symbol,
                ltp: item.current_price,
                yesterday_high: item.prev_day_high,
                yesterday_low: item.prev_day_low,
                breakdown_percent: item.breakdown_percentage,
                prev_day_open: item.prev_day_open,
                prev_day_close: item.prev_day_close,
                today_open: item.today_open || item.prev_day_open,
                volume: item.volume,
                detected_at: item.updated_at,
                prev_day_sentiment: sentimentMap[item.symbol] || null
            }))
            .sort((a: any, b: any) => a.breakdown_percent - b.breakdown_percent)

        // Get the most recent update timestamp
        const latestUpdate = snapshotsData?.[0]?.updated_at || new Date().toISOString()

        console.log(`[BREAKOUTS-API] Fetched ${breakouts.length} breakouts and ${breakdowns.length} breakdowns`)

        return NextResponse.json({
            success: true,
            breakouts: breakouts || [],
            breakdowns: breakdowns || [],
            updated_at: latestUpdate,
            count: {
                total_breakouts: breakouts.length || 0,
                total_breakdowns: breakdowns.length || 0,
            },
        })

    } catch (error) {
        console.error('[BREAKOUTS-API] Error:', error)

        // Check if it's a "relation does not exist" error
        if (error instanceof Error && error.message.includes('relation') && error.message.includes('does not exist')) {
            return NextResponse.json(
                {
                    error: 'Database table not found',
                    details: 'The breakout_snapshots table does not exist. Please run the SQL schema in Supabase.',
                    hint: 'Create the breakout_snapshots table using supabase/breakout-snapshots-schema.sql',
                    success: false,
                    breakouts: [],
                    breakdowns: [],
                },
                { status: 200 } // Return 200 so frontend falls back gracefully
            )
        }

        return NextResponse.json(
            {
                error: 'Internal server error',
                details: error instanceof Error ? error.message : 'Unknown error',
                success: false,
                breakouts: [],
                breakdowns: [],
            },
            { status: 200 } // Return 200 so frontend falls back gracefully
        )
    }
}
