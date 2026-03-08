import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getGrowwAccessToken } from '@/lib/groww-token'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/** Indices to monitor for market change detection */
const INDICES_TO_MONITOR = [
    { key: 'NIFTY', nseName: 'NIFTY 50' },
    { key: 'BANKNIFTY', nseName: 'NIFTY BANK' },
    { key: 'FINNIFTY', nseName: 'NIFTY FIN SERVICE' },
    { key: 'SENSEX', nseName: 'SENSEX' },
]
const MIN_CHANGED_INDICES_FOR_CLEANUP = 2

/** Round for comparison (avoid float precision issues) */
function roundValue(v: number): number {
    return Math.round((v || 0) * 100) / 100
}

function getMissingIndexKeys(values: Record<string, number>): string[] {
    return INDICES_TO_MONITOR
        .map((idx) => idx.key)
        .filter((key) => values[key] == null || values[key] <= 0)
}

/**
 * Fetch live market values for NIFTY, BANKNIFTY, FINNIFTY, SENSEX
 */
async function fetchLiveMarketValues(): Promise<Record<string, number> | null> {
    const values: Record<string, number> = {}

    try {
        // Fetch NSE indices (NIFTY 50, NIFTY BANK, NIFTY FIN SERVICE)
        const nseResponse = await fetch('https://www.nseindia.com/api/allIndices', {
            headers: {
                Accept: 'application/json',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
            },
            cache: 'no-store',
        })

        if (!nseResponse.ok) {
            console.error('[CLEANUP] NSE API returned', nseResponse.status)
            return null
        }

        const nseData = await nseResponse.json()
        let allIndices: any[] = []
        if (Array.isArray(nseData.data)) {
            allIndices = nseData.data
        } else if (nseData.data && typeof nseData.data === 'object') {
            Object.values(nseData.data).forEach((val: any) => {
                if (Array.isArray(val)) allIndices = [...allIndices, ...val]
            })
        }

        for (const idx of INDICES_TO_MONITOR) {
            if (idx.key === 'SENSEX') continue // Fetch SENSEX separately from BSE/Groww
            const item = allIndices.find(
                (i: any) =>
                    i.index === idx.nseName ||
                    i.indexSymbol === idx.nseName ||
                    (i.index && String(i.index).includes(idx.nseName)) ||
                    (i.indexSymbol && String(i.indexSymbol).includes(idx.nseName))
            )
            if (item && (item.last || item.lastPrice) > 0) {
                values[idx.key] = roundValue(item.last || item.lastPrice || 0)
            }
        }

        // Fetch SENSEX from Groww (BSE)
        const growwToken = await getGrowwAccessToken() || process.env.GROWW_API_TOKEN || ''
        const bseResponse = await fetch('https://api.groww.in/v1/live-data/quote?exchange=BSE&segment=CASH&trading_symbol=SENSEX', {
            headers: {
                Authorization: `Bearer ${growwToken}`,
                'X-API-VERSION': '1.0',
                Accept: 'application/json',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            },
            cache: 'no-store',
        })

        if (bseResponse.ok) {
            const data = await bseResponse.json()
            const payload = data.payload
            const value = payload?.last_price || payload?.close || 0
            if (value > 0) {
                values.SENSEX = roundValue(Number(value))
            }
        } else {
            // SENSEX may also appear in NSE response sometimes
            const sensexInNse = allIndices.find(
                (i: any) =>
                    i.index === 'SENSEX' ||
                    (i.index && String(i.index).includes('SENSEX'))
            )
            if (sensexInNse && (sensexInNse.last || sensexInNse.lastPrice) > 0) {
                values.SENSEX = roundValue(sensexInNse.last || sensexInNse.lastPrice || 0)
            }
        }

        const missingKeys = getMissingIndexKeys(values)
        if (missingKeys.length > 0) {
            console.warn('[CLEANUP] Missing live values for indices:', missingKeys.join(', '))
            return null
        }
        return values
    } catch (e) {
        console.error('[CLEANUP] Live market data fetch failed:', e)
        return null
    }
}

/**
 * Fetch previous trading day's close values from market_indices_snapshots
 */
async function fetchPreviousDayValues(): Promise<Record<string, number>> {
    const values: Record<string, number> = {}

    try {
        const now = new Date()
        const istTime = new Date(now.getTime() + 5.5 * 60 * 60 * 1000)
        const todayDate = istTime.toISOString().split('T')[0]

        const { data, error } = await supabaseAdmin
            .from('market_indices_snapshots')
            .select('index_name, value, captured_at')
            .lt('captured_at', todayDate)
            .order('captured_at', { ascending: false })

        if (error) {
            console.error('[CLEANUP] Failed to fetch previous values:', error)
            return values
        }

        const seen = new Set<string>()
        for (const row of data || []) {
            const name = row.index_name
            if (seen.has(name)) continue
            seen.add(name)
            const v = Number(row.value)
            if (!isNaN(v) && v > 0) {
                if (name === 'NIFTY 50') values.NIFTY = roundValue(v)
                else if (name === 'NIFTY BANK') values.BANKNIFTY = roundValue(v)
                else if (name === 'FINNIFTY') values.FINNIFTY = roundValue(v)
                else if (name === 'SENSEX') values.SENSEX = roundValue(v)
            }
        }
        const missingKeys = getMissingIndexKeys(values)
        if (missingKeys.length > 0) {
            console.warn('[CLEANUP] Missing previous reference values for indices:', missingKeys.join(', '))
        }
        return values
    } catch (e) {
        console.error('[CLEANUP] Error fetching previous values:', e)
        return {}
    }
}

/** Check if minimum monitored indices have changed */
function hasMarketChanged(
    live: Record<string, number>,
    previous: Record<string, number>
): { changed: boolean; updatedIndices: string[] } {
    const updatedIndices: string[] = []
    for (const idx of INDICES_TO_MONITOR) {
        const l = live[idx.key]
        const p = previous[idx.key]
        if (l != null && p != null && roundValue(l) !== roundValue(p)) {
            updatedIndices.push(idx.key)
        }
    }
    return { changed: updatedIndices.length >= MIN_CHANGED_INDICES_FOR_CLEANUP, updatedIndices }
}

/**
 * Perform full cleanup of intraday tables
 */
async function runCleanup(todayDate: string): Promise<{ results: string[]; errors: string[] }> {
    const results: string[] = []
    const errors: string[] = []

    // 1. Clear stock_snapshots (delete all - current state)
    const { error: stockError } = await supabaseAdmin.from('stock_snapshots').delete().gte('id', 0)
    if (stockError) errors.push(`stock_snapshots: ${stockError.message}`)
    else results.push('Cleared stock_snapshots')

    // 2. Clear breakout_snapshots
    const { error: breakoutError } = await supabaseAdmin.from('breakout_snapshots').delete().gte('id', 0)
    if (breakoutError) errors.push(`breakout_snapshots: ${breakoutError.message}`)
    else results.push('Cleared breakout_snapshots')

    // 3. Clean market_indices_snapshots - keep today's
    const { error: indicesError } = await supabaseAdmin.from('market_indices_snapshots').delete().lt('captured_at', todayDate)
    if (indicesError) errors.push(`market_indices_snapshots: ${indicesError.message}`)
    else results.push('Cleaned market_indices_snapshots')

    // 4. Clean sector_snapshots - keep today's
    const { error: sectorError } = await supabaseAdmin.from('sector_snapshots').delete().lt('captured_at', `${todayDate}T00:00:00Z`)
    if (sectorError) errors.push(`sector_snapshots: ${sectorError.message}`)
    else results.push('Cleaned sector_snapshots')

    // 5. Clean pcr_data - keep today's
    const { error: pcrError } = await supabaseAdmin.from('pcr_data').delete().lt('captured_at', `${todayDate}T00:00:00Z`)
    if (pcrError) errors.push(`pcr_data: ${pcrError.message}`)
    else results.push('Cleaned pcr_data')

    // 6. Clean option_chain_snapshots - keep today's
    const { error: optionChainError } = await supabaseAdmin.from('option_chain_snapshots').delete().lt('captured_at', `${todayDate}T00:00:00Z`)
    if (optionChainError) errors.push(`option_chain_snapshots: ${optionChainError.message}`)
    else results.push('Cleaned option_chain_snapshots')

    // 7. Clean oi_trendline - keep today's
    const { error: oiError } = await supabaseAdmin.from('oi_trendline').delete().lt('captured_at', `${todayDate}T00:00:00Z`)
    if (oiError) errors.push(`oi_trendline: ${oiError.message}`)
    else results.push('Cleaned oi_trendline')

    // 8. Clear breakout_stocks (use detected_at filter to match all - pg-safeupdate requires a filter)
    const { error: breakoutStocksError } = await supabaseAdmin.from('breakout_stocks').delete().gte('detected_at', '1970-01-01T00:00:00Z')
    if (breakoutStocksError) errors.push(`breakout_stocks: ${breakoutStocksError.message}`)
    else results.push('Cleared breakout_stocks')

    // 9. Clear breakdown_stocks
    const { error: breakdownStocksError } = await supabaseAdmin.from('breakdown_stocks').delete().gte('detected_at', '1970-01-01T00:00:00Z')
    if (breakdownStocksError) errors.push(`breakdown_stocks: ${breakdownStocksError.message}`)
    else results.push('Cleared breakdown_stocks')

    return { results, errors }
}

export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization')
        const cronSecret = process.env.CRON_SECRET
        if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
            console.error('[CLEANUP] Unauthorized request')
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const now = new Date()
        const istTime = new Date(now.getTime() + 5.5 * 60 * 60 * 1000)
        const todayDate = istTime.toISOString().split('T')[0]

        console.log('[CLEANUP] Starting at 09:09 IST - checking for market change...')

        // 1. Fetch live market data
        const liveValues = await fetchLiveMarketValues()
        if (!liveValues || Object.keys(liveValues).length === 0) {
            console.log('[CLEANUP] Live market data fetch failed. Skipping cleanup to protect existing data.')
            return NextResponse.json({
                success: true,
                cleanup_performed: false,
                reason: 'Live market data fetch failed. Skipping cleanup to protect existing data.',
                log: 'Live market data fetch failed. Skipping cleanup to protect existing data.',
            })
        }

        // 2. Fetch previous reference values
        const previousValues = await fetchPreviousDayValues()
        const missingPreviousKeys = getMissingIndexKeys(previousValues)
        if (missingPreviousKeys.length > 0) {
            console.log('[CLEANUP] Previous reference data incomplete. Cleanup skipped to preserve existing data.')
            return NextResponse.json({
                success: true,
                cleanup_performed: false,
                reason: `Missing previous reference values for indices: ${missingPreviousKeys.join(', ')}`,
                log: 'Previous reference data incomplete. Cleanup skipped to preserve existing data.',
                previous_values: previousValues,
            })
        }

        // 3. Compare values
        const { changed, updatedIndices } = hasMarketChanged(liveValues, previousValues)

        if (!changed) {
            console.log(
                `[CLEANUP] Fewer than ${MIN_CHANGED_INDICES_FOR_CLEANUP} index changes detected. Cleanup skipped. Existing data preserved across all tables.`
            )
            return NextResponse.json({
                success: true,
                cleanup_performed: false,
                reason: `Fewer than ${MIN_CHANGED_INDICES_FOR_CLEANUP} index changes detected.`,
                log: `Fewer than ${MIN_CHANGED_INDICES_FOR_CLEANUP} index changes detected. Cleanup skipped. Existing data preserved across all tables.`,
                updated_indices: updatedIndices,
                live_values: liveValues,
                previous_values: previousValues,
            })
        }

        // 4. Change detected - run cleanup
        console.log('[CLEANUP] Market change detected. Cleanup triggered at 09:09 IST. Updated indices:', updatedIndices.join(', '))
        const { results, errors } = await runCleanup(todayDate)

        return NextResponse.json({
            success: true,
            cleanup_performed: true,
            reason: 'Market change detected.',
            log: `Market change detected. Cleanup triggered at 09:09 IST. Updated indices: ${updatedIndices.join(', ')}`,
            updated_indices: updatedIndices,
            results,
            errors,
        })
    } catch (error) {
        console.error('[CLEANUP] Error:', error)
        return NextResponse.json(
            { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        )
    }
}
