import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getStocksForSector } from '@/constants/sector-stocks-mapping'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

const supabase = createClient(supabaseUrl, supabaseKey)

/**
 * GET /api/sector-stocks?sector=Financial Services
 * GET /api/sector-stocks?symbols=SBIN,HDFC,ICICI
 * Returns stock data from database for a given sector or list of symbols
 * Optimized for speed - minimal fields, limited results
 */
export async function GET(request: Request) {
    try {
        const startTime = Date.now()
        const { searchParams } = new URL(request.url)
        const sector = searchParams.get('sector')
        const symbolsParam = searchParams.get('symbols')

        // Determine which symbols to fetch
        let sectorStocks: string[] = []

        if (sector) {
            sectorStocks = getStocksForSector(sector)
        } else if (symbolsParam) {
            sectorStocks = symbolsParam.split(',').map(s => s.trim()).filter(Boolean)
        } else {
            return NextResponse.json(
                { error: 'Either sector or symbols parameter is required' },
                { status: 400 }
            )
        }

        if (sectorStocks.length === 0) {
            return NextResponse.json({ stocks: [], source: 'no_mapping' })
        }

        // Try daily_high_low table first (today's data)
        const today = new Date().toISOString().split('T')[0]

        const { data: dailyData, error: dailyError } = await supabase
            .from('daily_high_low')
            .select('symbol, today_open, today_close, today_high, today_low')
            .in('symbol', sectorStocks)
            .eq('captured_date', today)
            .limit(sectorStocks.length)

        if (!dailyError && dailyData && dailyData.length > 0) {
            const stocks = dailyData.map(snap => {
                const open = snap.today_open || 0
                const close = snap.today_close || 0
                const ltp = close || open
                const changePercent = open > 0 ? ((ltp - open) / open) * 100 : 0

                return {
                    symbol: snap.symbol,
                    ltp,
                    price: ltp,
                    open,
                    close,
                    changePercent,
                    high: snap.today_high || 0,
                    low: snap.today_low || 0,
                }
            })

            console.log(`[sector-stocks] Loaded ${stocks.length} from daily_high_low in ${Date.now() - startTime}ms`)
            return NextResponse.json({
                stocks,
                source: 'daily_high_low',
                count: stocks.length,
                sector: sector || 'custom',
                time_ms: Date.now() - startTime
            })
        }

        // Fallback to stock_snapshots with CORRECT column names
        // Schema: symbol, open_price, last_price, percent_change, day_high, day_low, prev_close
        const { data: snapshots, error } = await supabase
            .from('stock_snapshots')
            .select('symbol, open_price, last_price, percent_change, day_high, day_low, prev_close')
            .in('symbol', sectorStocks)
            .limit(sectorStocks.length)

        if (error) {
            console.error('[sector-stocks] Error fetching from stock_snapshots:', error)
            return NextResponse.json({ stocks: [], source: 'db_error', error: error.message, time_ms: Date.now() - startTime })
        }

        if (!snapshots || snapshots.length === 0) {
            console.log('[sector-stocks] No data in stock_snapshots for requested symbols')
            return NextResponse.json({ stocks: [], source: 'no_data', time_ms: Date.now() - startTime })
        }

        const stocks = snapshots.map(snap => ({
            symbol: snap.symbol,
            ltp: snap.last_price || 0,
            price: snap.last_price || 0,
            open: snap.open_price || 0,
            close: snap.prev_close || 0,
            changePercent: snap.percent_change || 0,
            high: snap.day_high || 0,
            low: snap.day_low || 0,
        }))

        console.log(`[sector-stocks] Loaded ${stocks.length} from stock_snapshots in ${Date.now() - startTime}ms`)
        return NextResponse.json({
            stocks,
            source: 'stock_snapshots',
            count: stocks.length,
            sector: sector || 'custom',
            time_ms: Date.now() - startTime
        })

    } catch (error) {
        console.error('[sector-stocks] Unexpected error:', error)
        return NextResponse.json(
            { error: 'Internal server error', stocks: [] },
            { status: 500 }
        )
    }
}
