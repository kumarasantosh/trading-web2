import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getGrowwAccessToken } from '@/lib/groww-token'

// Force dynamic rendering since we use request headers
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

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

        // Round DOWN to nearest 3-minute interval for consistent querying
        // This ensures all data captured within the same 3-minute window (e.g., 12:40-12:42)
        // gets saved with the same timestamp (12:39:00 or 12:42:00), matching the slider interval
        const now = new Date()
        const minutes = now.getMinutes()
        const roundedMinutes = Math.floor(minutes / 3) * 3
        const roundedTime = new Date(now)
        roundedTime.setMinutes(roundedMinutes, 0, 0) // Set seconds and milliseconds to 0
        const capturedAt = roundedTime.toISOString()
        console.log(`[CRON] Starting data capture at ${capturedAt} (rounded from ${now.toISOString()})`)

        // Check if this is the 3:30 PM capture (end of trading day) or forced
        // 3:30 PM IST = 10:00 AM UTC (IST is UTC+5:30)
        const istHour = now.getUTCHours() + 5.5 // Convert to IST
        const istMinutes = now.getUTCMinutes() + (now.getUTCSeconds() / 60)
        const isTimeMatch = Math.floor(istHour) === 15 && Math.floor(istMinutes) >= 30 && Math.floor(istMinutes) < 35
        const isForced = request.nextUrl.searchParams.get('force') === 'true'
        const isEndOfDay = isTimeMatch || isForced

        // Capture sector data
        const sectorResults = await captureSectorData(capturedAt)

        // Capture stock data for selected sectors
        // const stockResults = await captureStockData(capturedAt)
        const stockResults = { count: 0, errors: [] as string[] }

        // Capture market indices at 3:30 PM (end of trading day)
        let marketIndicesResults = { count: 0, errors: [] as string[] }
        if (isEndOfDay) {
            console.log(`[CRON] ${isForced ? 'Forced capture' : 'End of trading day detected'} - capturing market indices`)
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

        // Map of NSE index names to our sector names (16 sectors total)
        const sectorMap: Record<string, string> = {
            'NIFTY BANK': 'Bank Nifty',
            'NIFTY IT': 'IT',
            'NIFTY PHARMA': 'Pharma',
            'NIFTY AUTO': 'Auto',
            'NIFTY METAL': 'Metal',
            'NIFTY ENERGY': 'Energy',
            'NIFTY FMCG': 'FMCG',
            'NIFTY REALTY': 'Realty',
            'NIFTY FINANCIAL SERVICES': 'Financial Services',
            'NIFTY PRIVATE BANK': 'Private Bank',
            'NIFTY PSU BANK': 'PSU Bank',
            'NIFTY CONSUMER DURABLES': 'Consumer Durables',
            'NIFTY OIL & GAS': 'Oil & Gas',
            'NIFTY INDIA CONSUMPTION': 'Consumption',
            'NIFTY 50': 'Sensex',  // Using NIFTY 50 as proxy for Sensex
            'NIFTY MIDCAP SELECT': 'Nifty MidSelect',
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

    // Auto-generate token if needed
    const growwToken = await getGrowwAccessToken() || process.env.GROWW_API_TOKEN || '';

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
                const url = `https://api.groww.in/v1/live-data/quote?exchange=NSE&segment=CASH&trading_symbol=${stock.symbol}`

                const response = await fetch(url, {
                    headers: {
                        'Authorization': `Bearer ${growwToken}`,
                        'X-API-VERSION': '1.0',
                        'Accept': 'application/json',
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                    },
                    cache: 'no-store',
                })

                if (response.ok) {
                    const data = await response.json()
                    const payload = data.payload
                    const ohlc = payload?.ohlc

                    snapshots.push({
                        captured_at: capturedAt,
                        symbol: stock.symbol,
                        sector: stock.sector,
                        ltp: payload?.last_price || 0,
                        open_price: ohlc?.open || 0,
                        close_price: ohlc?.close || 0,
                        change_percent: payload?.day_change_perc || 0,
                        high: ohlc?.high || null,
                        low: ohlc?.low || null,
                        volume: payload?.volume || null,
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

        const snapshots: any[] = []

        // Fetch NSE indices from NSE API (more accurate percentChange)
        try {
            const nseResponse = await fetch('https://www.nseindia.com/api/allIndices', {
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                    'Accept-Language': 'en-US,en;q=0.9',
                },
                cache: 'no-store',
            })

            if (nseResponse.ok) {
                const nseData = await nseResponse.json()

                // Handle different NSE API response structures
                let allIndices: any[] = []

                // Check if data is directly an array
                if (Array.isArray(nseData.data)) {
                    allIndices = nseData.data
                }
                // Check if data has nested structure (e.g., "INDICES ELIGIBLE IN DERIVATIVES")
                else if (nseData.data && typeof nseData.data === 'object') {
                    // Try to find arrays in the data object
                    Object.values(nseData.data).forEach((value: any) => {
                        if (Array.isArray(value)) {
                            allIndices = [...allIndices, ...value]
                        }
                    })
                }

                // Target indices to capture
                const targetIndices = [
                    { searchName: 'NIFTY 50', displayName: 'NIFTY 50' },
                    { searchName: 'SENSEX', displayName: 'SENSEX' },
                    { searchName: 'NIFTY BANK', displayName: 'NIFTY BANK' },
                    { searchName: 'NIFTY FIN SERVICE', displayName: 'FINNIFTY' },
                    { searchName: 'NIFTY MIDCAP 100', displayName: 'NIFTY MIDCAP' },
                    { searchName: 'INDIA VIX', displayName: 'INDIA_VIX' },
                ]

                // Process all target indices
                targetIndices.forEach(({ searchName, displayName }) => {
                    const indexData = allIndices.find((item: any) =>
                        item.index === searchName ||
                        item.indexSymbol === searchName ||
                        item.index?.includes(searchName) ||
                        item.indexSymbol?.includes(searchName)
                    )

                    if (indexData) {
                        snapshots.push({
                            captured_at: todayDate,
                            index_name: displayName,
                            value: indexData.last || indexData.lastPrice || 0,
                            change: indexData.variation || (indexData.last && indexData.previousClose ?
                                (indexData.last - indexData.previousClose) : 0) || 0,
                            change_percent: indexData.percentChange !== undefined ? indexData.percentChange :
                                (indexData.previousClose && indexData.last ?
                                    ((indexData.last - indexData.previousClose) / indexData.previousClose) * 100 : 0),
                            previous_close: indexData.previousClose || 0,
                            open_price: indexData.open || 0,
                        })
                    }
                })
            } else {
                console.warn('[CRON] NSE API returned non-OK status:', nseResponse.status)
                errors.push(`NSE API returned ${nseResponse.status}`)
            }
        } catch (nseError) {
            console.error('[CRON] Error fetching NSE indices:', nseError)
            errors.push('Failed to fetch NSE indices')
        }

        // Check if SENSEX was already found in NSE API response
        const sensexInNse = snapshots.find(s => s.index_name === 'SENSEX')

        // Fetch BSE SENSEX from Groww API if not found in NSE
        if (!sensexInNse) {
            try {
                const growwToken = await getGrowwAccessToken() || process.env.GROWW_API_TOKEN || '';
                const url = 'https://api.groww.in/v1/live-data/quote?exchange=BSE&segment=CASH&trading_symbol=SENSEX'

                const bseResponse = await fetch(url, {
                    headers: {
                        'Authorization': `Bearer ${growwToken}`,
                        'X-API-VERSION': '1.0',
                        'Accept': 'application/json',
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                    },
                    cache: 'no-store',
                })

                if (bseResponse.ok) {
                    const data = await bseResponse.json()
                    console.log('[CRON] SENSEX response from Groww:', data.payload ? 'Found' : 'Empty')

                    if (data.payload) {
                        const payload = data.payload
                        const ohlc = payload.ohlc

                        const value = payload.last_price || 0
                        const previousClose = ohlc?.close || payload.close || 0
                        const change = payload.day_change || (value - previousClose)
                        const changePercent = payload.day_change_perc || ((change / previousClose) * 100)

                        if (value > 0) {
                            snapshots.push({
                                captured_at: todayDate,
                                index_name: 'SENSEX',
                                value: Number(value),
                                change: Number(change),
                                change_percent: Number(changePercent),
                                previous_close: Number(previousClose),
                                open_price: ohlc?.open || 0,
                            })
                            console.log('[CRON] ✅ SENSEX added from Groww API')
                        }
                    }
                } else {
                    console.warn('[CRON] Groww API for SENSEX returned non-OK status:', bseResponse.status)
                    errors.push('Groww API for SENSEX failed')
                }
            } catch (bseError) {
                console.error('[CRON] Error fetching BSE SENSEX from Groww:', bseError)
                errors.push('Failed to fetch BSE SENSEX')
            }
        } else {
            console.log('[CRON] ✅ SENSEX already found in NSE API response')
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
