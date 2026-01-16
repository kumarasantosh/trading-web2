import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Get the most recent Friday's date in IST
 * Used for weekend fallback
 */
function getMostRecentFriday(): string {
    const now = new Date()

    // Convert to IST (UTC + 5:30)
    const istOffset = 5.5 * 60 * 60 * 1000
    const istTime = new Date(now.getTime() + istOffset)

    // Get day of week (0 = Sunday, 6 = Saturday)
    const dayOfWeek = istTime.getUTCDay()

    // Calculate days to subtract to get to Friday (5)
    let daysToSubtract = 0
    if (dayOfWeek === 0) { // Sunday
        daysToSubtract = 2
    } else if (dayOfWeek === 6) { // Saturday
        daysToSubtract = 1
    } else if (dayOfWeek < 5) { // Monday-Thursday
        daysToSubtract = dayOfWeek + 2 // Go back to last Friday
    }
    // If it's Friday (5), daysToSubtract = 0 (use today)

    const friday = new Date(istTime.getTime() - (daysToSubtract * 24 * 60 * 60 * 1000))
    return friday.toISOString().split('T')[0] // YYYY-MM-DD format
}

/**
 * Check if today is a weekend
 */
function isWeekend(): boolean {
    const now = new Date()
    const istOffset = 5.5 * 60 * 60 * 1000
    const istTime = new Date(now.getTime() + istOffset)
    const dayOfWeek = istTime.getUTCDay()
    return dayOfWeek === 0 || dayOfWeek === 6 // Sunday or Saturday
}

/**
 * Lightweight API endpoint to fetch top gainers and losers from database
 * On weekends, returns Friday's data
 * 
 * Returns: { gainers: [...], losers: [...], updated_at: timestamp, data_date: string, is_weekend: boolean }
 */
export async function GET() {
    try {
        const weekend = isWeekend()
        const targetDate = weekend ? getMostRecentFriday() : null

        console.log(`[TOP-MOVERS] Weekend: ${weekend}, Target Date: ${targetDate || 'today'}`)

        // Build query
        let query = supabaseAdmin
            .from('stock_snapshots')
            .select('symbol, open_price, last_price, percent_change, volume, updated_at')

        // On weekends, filter by Friday's date
        if (weekend && targetDate) {
            // Filter by date - assuming updated_at contains the date
            const startOfDay = `${targetDate}T00:00:00Z`
            const endOfDay = `${targetDate}T23:59:59Z`
            query = query
                .gte('updated_at', startOfDay)
                .lte('updated_at', endOfDay)
        }

        query = query.order('percent_change', { ascending: false })

        const { data: allStocks, error: fetchError } = await query

        if (fetchError) {
            console.error('[TOP-MOVERS] Error fetching stocks:', fetchError)
            throw fetchError
        }

        // Filter and get top 10 gainers (positive percent_change)
        const gainers = (allStocks || [])
            .filter(stock => Number(stock.percent_change) > 0)
            .slice(0, 10)

        // Filter and get top 10 losers (negative percent_change)
        const losers = (allStocks || [])
            .filter(stock => Number(stock.percent_change) < 0)
            .sort((a, b) => Number(a.percent_change) - Number(b.percent_change))
            .slice(0, 10)

        // Get the most recent update timestamp
        const latestUpdate = gainers?.[0]?.updated_at || losers?.[0]?.updated_at || new Date().toISOString()

        return NextResponse.json({
            success: true,
            gainers: gainers || [],
            losers: losers || [],
            updated_at: latestUpdate,
            data_date: targetDate || new Date().toISOString().split('T')[0],
            is_weekend: weekend,
            count: {
                gainers: gainers?.length || 0,
                losers: losers?.length || 0,
            },
        }, {
            headers: {
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
            }
        })

    } catch (error) {
        console.error('[TOP-MOVERS] Fatal error:', error)

        // Check if it's a table not found error
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        const isTableMissing = errorMessage.includes('relation "stock_snapshots" does not exist') ||
            errorMessage.includes('table') ||
            errorMessage.includes('relation')

        return NextResponse.json(
            {
                error: 'Failed to fetch top movers',
                details: errorMessage,
                hint: isTableMissing ? 'Database table "stock_snapshots" may not exist. Please run the SQL schema from supabase/stock-snapshots-schema.sql' : undefined,
                gainers: [],
                losers: [],
            },
            { status: 500 }
        )
    }
}
