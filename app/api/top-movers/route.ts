import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

/**
 * Lightweight API endpoint to fetch top gainers and losers from database
 * No calculations - just reads pre-calculated data from stock_snapshots table
 * 
 * Returns: { gainers: [...], losers: [...], updated_at: timestamp }
 */
export async function GET() {
    try {
        // Fetch all stocks and filter/sort in JavaScript to avoid type issues
        const { data: allStocks, error: fetchError } = await supabaseAdmin
            .from('stock_snapshots')
            .select('symbol, open_price, last_price, percent_change, volume, updated_at')
            .order('percent_change', { ascending: false })

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
            count: {
                gainers: gainers?.length || 0,
                losers: losers?.length || 0,
            },
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
