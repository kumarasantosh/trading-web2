import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Force dynamic rendering since we use request headers
export const dynamic = 'force-dynamic';

/**
 * Cron job API route that captures market data every 5 minutes
 * Runs during market hours (9:15 AM - 3:30 PM IST, Mon-Fri)
 * 
 * Security: Validates CRON_SECRET to prevent unauthorized access
 */
export async function GET(request: NextRequest) {
    try {
        // Validate cron secret for security
        const authHeader = request.headers.get('authorization')
        const cronSecret = process.env.CRON_SECRET

        if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
            console.error('Unauthorized cron request')
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Round DOWN to nearest 5-minute interval for consistent querying
        // This ensures all data captured within the same 5-minute window (e.g., 12:40-12:44)
        // gets saved with the same timestamp (12:40:00), making it easy to query with the slider
        const now = new Date()
        const minutes = now.getMinutes()
        const roundedMinutes = Math.floor(minutes / 5) * 5
        const roundedTime = new Date(now)
        roundedTime.setMinutes(roundedMinutes, 0, 0) // Set seconds and milliseconds to 0
        const capturedAt = roundedTime.toISOString()
        console.log(`[CRON] Starting data capture at ${capturedAt} (rounded from ${now.toISOString()})`)

        // Check if this is the 3:30 PM capture (end of trading day)
        // 3:30 PM IST = 10:00 AM UTC (IST is UTC+5:30)
        const istHour = now.getUTCHours() + 5.5 // Convert to IST
        const istMinutes = now.getUTCMinutes() + (now.getUTCSeconds() / 60)
        const isEndOfDay = Math.floor(istHour) === 15 && Math.floor(istMinutes) >= 30 && Math.floor(istMinutes) < 35

        // Capture sector data
        const sectorResults = await captureSectorData(capturedAt)

        // Capture stock data for selected sectors
        const stockResults = await captureStockData(capturedAt)

        // Capture market indices at 3:30 PM (end of trading day)
        let marketIndicesResults = { count: 0, errors: [] as string[] }
        if (isEndOfDay) {
            console.log('[CRON] End of trading day detected - capturing market indices')
            marketIndicesResults = await captureMarketIndices()
            
            // Clean up previous day's records (keep only today's data)
            await cleanupPreviousDayData()
        }

        console.log(`[CRON] Capture complete: ${sectorResults.count} sectors, ${stockResults.count} stocks, ${marketIndicesResults.count} market indices`)

        return NextResponse.json({
            success: true,
            captured_at: capturedAt,
            sectors_captured: sectorResults.count,
            stocks_captured: stockResults.count,
            market_indices_captured: marketIndicesResults.count,
            is_end_of_day: isEndOfDay,
            errors: [...sectorResults.errors, ...stockResults.errors, ...marketIndicesResults.errors]
        })

    } catch (error) {
        console.error('[CRON] Fatal error:', error)
        return NextResponse.json(
            { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        )
    }
}

/**
 * Capture sector performance data from NSE API
 */
async function captureSectorData(capturedAt: string) {
    const errors: string[] = []
    let count = 0

    try {
        // Fetch sector data from NSE API (no caching to ensure fresh data)
        const response = await fetch('https://www.nseindia.com/api/allIndices', {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
            },
            cache: 'no-store', // Ensure fresh data on each request
        })

        if (!response.ok) {
            throw new Error(`NSE API returned ${response.status}`)
        }

        const nseData = await response.json()

        // Map of NSE index names to our sector names
        const sectorMap: Record<string, string> = {
            'NIFTY BANK': 'Bank Nifty',
            'NIFTY IT': 'IT',
            'NIFTY PHARMA': 'Pharma',
            'NIFTY AUTO': 'Auto',
            'NIFTY METAL': 'Metal',
            'NIFTY ENERGY': 'Energy',
            'NIFTY FMCG': 'FMCG',
            'NIFTY REALTY': 'Realty',
            'NIFTY FIN SERVICE': 'Financial Services',
            'NIFTY PVT BANK': 'Private Bank',
            'NIFTY PSU BANK': 'PSU Bank',
            'NIFTY CONSUMPTION': 'Consumer Durables',
            'NIFTY INFRASTRUCTURE': 'Infrastructure',
        }

        const snapshots = []

        if (nseData.data && Array.isArray(nseData.data)) {
            for (const item of nseData.data) {
                const sectorName = sectorMap[item.index]
                if (!sectorName) continue

                snapshots.push({
                    captured_at: capturedAt,
                    sector_name: sectorName,
                    last_price: item.last || 0,
                    open_price: item.open || 0,
                    previous_close: item.previousClose || 0,
                    change_percent: item.percentChange || 0,
                    variation: item.variation || 0,
                    one_week_ago_val: item.oneWeekAgoVal || 0,
                    one_month_ago_val: item.oneMonthAgoVal || 0,
                    one_year_ago_val: item.oneYearAgoVal || 0,
                })
            }
        }

        // Insert into Supabase (upsert to handle duplicates)
        if (snapshots.length > 0) {
            const { error } = await supabaseAdmin
                .from('sector_snapshots')
                .upsert(snapshots, {
                    onConflict: 'sector_name,captured_at',
                    ignoreDuplicates: true
                })

            if (error) {
                console.error('[CRON] Supabase insert error:', error)
                errors.push(`Sector insert failed: ${error.message}`)
            } else {
                count = snapshots.length
            }
        }

    } catch (error) {
        console.error('[CRON] Sector capture error:', error)
        errors.push(`Sector capture failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    return { count, errors }
}

/**
 * Capture stock data for major stocks
 */
async function captureStockData(capturedAt: string) {
    const errors: string[] = []
    let count = 0

    try {
        // Define stocks to track (can be expanded)
        const stocksToTrack = [
            // PSU Bank
            { symbol: 'PNB', sector: 'PSU Bank' },
            { symbol: 'SBIN', sector: 'PSU Bank' },
            { symbol: 'CANBK', sector: 'PSU Bank' },
            { symbol: 'BANKBARODA', sector: 'PSU Bank' },

            // Private Bank
            { symbol: 'HDFCBANK', sector: 'Private Bank' },
            { symbol: 'ICICIBANK', sector: 'Private Bank' },
            { symbol: 'AXISBANK', sector: 'Private Bank' },
            { symbol: 'KOTAKBANK', sector: 'Private Bank' },

            // IT
            { symbol: 'TCS', sector: 'IT' },
            { symbol: 'INFY', sector: 'IT' },
            { symbol: 'WIPRO', sector: 'IT' },

            // Auto
            { symbol: 'MARUTI', sector: 'Auto' },
            { symbol: 'TATAMOTORS', sector: 'Auto' },
        ]

        const snapshots = []

        // Fetch data for each stock
        for (const stock of stocksToTrack) {
            try {
                const url = `https://groww.in/v1/api/stocks_data/v1/tr_live_prices/exchange/NSE/segment/CASH/${stock.symbol}/latest`

                const response = await fetch(url, {
                    headers: {
                        'authorization': `Bearer ${process.env.GROWW_API_TOKEN || ''}`,
                        'cookie': process.env.GROWW_COOKIES || '',
                        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                    }
                })

                if (response.ok) {
                    const data = await response.json()

                    snapshots.push({
                        captured_at: capturedAt,
                        symbol: stock.symbol,
                        sector: stock.sector,
                        ltp: data.ltp || 0,
                        open_price: data.open || 0,
                        close_price: data.close || 0,
                        change_percent: data.dayChangePerc || 0,
                        high: data.high || null,
                        low: data.low || null,
                        volume: data.volume || null,
                    })
                }

                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 100))

            } catch (error) {
                console.error(`[CRON] Error fetching ${stock.symbol}:`, error)
                errors.push(`${stock.symbol} fetch failed`)
            }
        }

        // Insert into Supabase
        if (snapshots.length > 0) {
            const { error } = await supabaseAdmin
                .from('stock_snapshots')
                .upsert(snapshots, {
                    onConflict: 'symbol,captured_at',
                    ignoreDuplicates: true
                })

            if (error) {
                console.error('[CRON] Stock insert error:', error)
                errors.push(`Stock insert failed: ${error.message}`)
            } else {
                count = snapshots.length
            }
        }

    } catch (error) {
        console.error('[CRON] Stock capture error:', error)
        errors.push(`Stock capture failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    return { count, errors }
}

/**
 * Capture market indices data at end of trading day (3:30 PM IST)
 */
async function captureMarketIndices() {
    const errors: string[] = []
    let count = 0

    try {
        // Get today's date (IST date)
        const now = new Date()
        // Convert to IST: UTC + 5:30
        const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000))
        const todayDate = istTime.toISOString().split('T')[0] // YYYY-MM-DD format

        // Fetch market indices from internal API (uses Groww API)
        const marketSymbols = [
            'NSE_NIFTY 50',
            'BSE_SENSEX',
            'NSE_NIFTY BANK',
            'NSE_NIFTY FIN SERVICE',
            'NSE_NIFTY MIDCAP 100',
            'NSE_NIFTY SMLCAP 100',
            'NSE_INDIA VIX',
        ]

        // Fetch LTP data using internal API route
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
        const ltpUrl = new URL(`${baseUrl}/api/groww/ltp`)
        ltpUrl.searchParams.append('segment', 'CASH')
        ltpUrl.searchParams.append('exchange_symbols', marketSymbols.join(','))

        const ltpResponse = await fetch(ltpUrl.toString(), {
            headers: {
                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            },
            cache: 'no-store',
        })

        if (!ltpResponse.ok) {
            throw new Error(`Groww LTP API returned ${ltpResponse.status}`)
        }

        const ltpData: any = await ltpResponse.json()

        // Fetch OHLC data using internal API route
        const ohlcUrl = new URL(`${baseUrl}/api/groww/ohlc`)
        ohlcUrl.searchParams.append('segment', 'CASH')
        ohlcUrl.searchParams.append('exchange_symbols', marketSymbols.join(','))

        const ohlcResponse = await fetch(ohlcUrl.toString(), {
            headers: {
                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            },
            cache: 'no-store',
        })

        const ohlcData: any = ohlcResponse.ok ? await ohlcResponse.json() : {}

        // Map symbols to display names
        const symbolMap: Record<string, string> = {
            'NSE_NIFTY 50': 'NIFTY 50',
            'BSE_SENSEX': 'SENSEX',
            'NSE_NIFTY BANK': 'NIFTY BANK',
            'NSE_NIFTY FIN SERVICE': 'FINNIFTY',
            'NSE_NIFTY MIDCAP 100': 'NIFTY MIDCAP',
            'NSE_NIFTY SMLCAP 100': 'NIFTY SMALLCAP',
            'NSE_INDIA VIX': 'INDIA_VIX',
        }

        const snapshots = []

        for (const symbol of marketSymbols) {
            try {
                const ltpResponse = ltpData[symbol]
                const ltp = typeof ltpResponse === 'object' && ltpResponse !== null ? ltpResponse.ltp : (ltpResponse as number || 0)
                const ohlc = ohlcData[symbol]
                const previousClose = ohlc?.close || ltp
                const change = ltp - previousClose
                const changePercent = previousClose !== 0 ? (change / previousClose) * 100 : 0

                snapshots.push({
                    captured_at: todayDate,
                    index_name: symbolMap[symbol] || symbol,
                    value: ltp,
                    change: change,
                    change_percent: changePercent,
                })
            } catch (error) {
                console.error(`[CRON] Error processing ${symbol}:`, error)
                errors.push(`Failed to process ${symbol}`)
            }
        }

        // Delete previous day's records before inserting new ones
        // This ensures only today's data exists
        const { error: deleteError } = await supabaseAdmin
            .from('market_indices_snapshots')
            .delete()
            .neq('captured_at', todayDate) // Delete all except today

        if (deleteError) {
            console.error('[CRON] Error deleting old market indices:', deleteError)
            errors.push(`Delete error: ${deleteError.message}`)
        } else {
            console.log('[CRON] Cleaned up previous market indices records')
        }

        // Insert new snapshots
        if (snapshots.length > 0) {
            const { error } = await supabaseAdmin
                .from('market_indices_snapshots')
                .upsert(snapshots, {
                    onConflict: 'index_name,captured_at',
                    ignoreDuplicates: false // Update if exists
                })

            if (error) {
                console.error('[CRON] Market indices insert error:', error)
                errors.push(`Market indices insert failed: ${error.message}`)
            } else {
                count = snapshots.length
            }
        }

    } catch (error) {
        console.error('[CRON] Market indices capture error:', error)
        errors.push(`Market indices capture failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    return { count, errors }
}

/**
 * Clean up previous day's data (keep only today's data)
 */
async function cleanupPreviousDayData() {
    try {
        const now = new Date()
        // Convert to IST: UTC + 5:30
        const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000))
        const todayDate = istTime.toISOString().split('T')[0] // YYYY-MM-DD format

        console.log(`[CRON] Cleaning up data before ${todayDate}`)

        // Delete all sector snapshots from previous days
        const { error: sectorError } = await supabaseAdmin
            .from('sector_snapshots')
            .delete()
            .lt('captured_at', `${todayDate}T00:00:00Z`)

        if (sectorError) {
            console.error('[CRON] Error deleting old sector snapshots:', sectorError)
        } else {
            console.log('[CRON] Cleaned up old sector snapshots')
        }

        // Delete all stock snapshots from previous days
        const { error: stockError } = await supabaseAdmin
            .from('stock_snapshots')
            .delete()
            .lt('captured_at', `${todayDate}T00:00:00Z`)

        if (stockError) {
            console.error('[CRON] Error deleting old stock snapshots:', stockError)
        } else {
            console.log('[CRON] Cleaned up old stock snapshots')
        }

        // Delete all option chain snapshots from previous days
        const { error: optionError } = await supabaseAdmin
            .from('option_chain_snapshots')
            .delete()
            .lt('captured_at', `${todayDate}T00:00:00Z`)

        if (optionError) {
            console.error('[CRON] Error deleting old option chain snapshots:', optionError)
        } else {
            console.log('[CRON] Cleaned up old option chain snapshots')
        }

    } catch (error) {
        console.error('[CRON] Cleanup error:', error)
    }
}
