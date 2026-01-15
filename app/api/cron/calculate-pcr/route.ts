import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { fetchOptionChainData } from '@/services/optionChain'

// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Cron job API route that calculates and stores PCR every 1 minute
 * Uses ATM ±10 strikes for NIFTY, BANKNIFTY, and FINNIFTY
 * 
 * Security: Validates CRON_SECRET to prevent unauthorized access
 */
export async function GET(request: NextRequest) {
    try {
        // Validate cron secret for security
        const authHeader = request.headers.get('authorization')
        const cronSecret = process.env.CRON_SECRET

        if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
            console.error('[PCR] Unauthorized cron request')
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Check if within market hours (9:15 AM - 3:30 PM IST, Mon-Fri)
        const now = new Date()
        const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000))
        const istHour = istTime.getUTCHours()
        const istMinute = istTime.getUTCMinutes()
        const dayOfWeek = istTime.getUTCDay() // 0 = Sunday, 6 = Saturday

        // Check if it's a weekend
        // DISABLED FOR TESTING
        /*
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            console.log('[PCR] Skipping - Weekend')
            return NextResponse.json({
                success: true,
                message: 'Weekend - market closed',
                pcr_calculated: 0,
            })
        }
        */

        // Check if within market hours (9:15 AM - 3:30 PM IST)
        const currentTimeInMinutes = istHour * 60 + istMinute
        const marketOpenTime = 9 * 60 + 15  // 9:15 AM
        const marketCloseTime = 15 * 60 + 30 // 3:30 PM

        if (currentTimeInMinutes < marketOpenTime || currentTimeInMinutes > marketCloseTime) {
            console.log('[PCR] Skipping - Outside market hours')
            return NextResponse.json({
                success: true,
                message: 'Outside market hours',
                pcr_calculated: 0,
            })
        }

        // Round to nearest minute for consistent timestamps
        // Storage should be in UTC
        const capturedAt = new Date(now)
        capturedAt.setSeconds(0, 0)
        capturedAt.setMilliseconds(0)
        const capturedAtISO = capturedAt.toISOString()

        console.log(`[PCR] Calculating PCR at ${capturedAtISO} (IST: ${istTime.toISOString()})`)

        const indices = ['NIFTY', 'BANKNIFTY', 'FINNIFTY']
        const pcrResults: any[] = []
        const errors: string[] = []

        for (const indexName of indices) {
            try {
                const pcrData = await calculatePCR(indexName, capturedAtISO)
                if (pcrData) {
                    pcrResults.push(pcrData)
                }
            } catch (error) {
                console.error(`[PCR] Error calculating ${indexName}:`, error)
                errors.push(`${indexName}: ${error instanceof Error ? error.message : 'Unknown error'}`)
            }
        }

        // Insert PCR data into database
        if (pcrResults.length > 0) {
            const { error: insertError } = await supabaseAdmin
                .from('pcr_data')
                .insert(pcrResults)

            if (insertError) {
                // Ignore duplicate errors (code 23505)
                if (insertError.code !== '23505') {
                    console.error('[PCR] Insert error:', insertError)
                    errors.push(`Insert error: ${insertError.message}`)
                }
            } else {
                console.log(`[PCR] ✅ Inserted ${pcrResults.length} PCR records`)
            }
        }

        return NextResponse.json({
            success: true,
            captured_at: capturedAtISO,
            pcr_calculated: pcrResults.length,
            results: pcrResults,
            errors: errors,
        })

    } catch (error) {
        console.error('[PCR] Fatal error:', error)
        return NextResponse.json(
            { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        )
    }
}

/**
 * Calculate PCR for a given index using ATM ±10 strikes
 */
async function calculatePCR(indexName: string, capturedAt: string) {
    try {
        // Map index names to Groww symbols
        const symbolMap: Record<string, string> = {
            'NIFTY': 'NIFTY',
            'BANKNIFTY': 'BANKNIFTY',
            'FINNIFTY': 'FINNIFTY',
        }

        const growwSymbol = symbolMap[indexName]
        if (!growwSymbol) {
            throw new Error(`Unknown index: ${indexName}`)
        }

        // Fetch option chain data (Direct service call)
        console.log(`[PCR] Fetching option chain for ${growwSymbol}`)

        const data = await fetchOptionChainData(growwSymbol)
        if (!data.success) {
            throw new Error(`Option chain service returned error: ${data.error}`)
        }

        if (!data.success || !data.optionChain) {
            throw new Error('Invalid option chain data')
        }

        const spotPrice = data.spotPrice || 0
        const optionChain = data.optionChain

        // Find ATM strike (closest to spot price)
        let atmStrike = 0
        let minDiff = Infinity

        Object.keys(optionChain).forEach(strike => {
            const strikePrice = parseFloat(strike)
            const diff = Math.abs(strikePrice - spotPrice)
            if (diff < minDiff) {
                minDiff = diff
                atmStrike = strikePrice
            }
        })

        if (atmStrike === 0) {
            throw new Error('Could not find ATM strike')
        }

        // Get all strikes and sort them
        const allStrikes = Object.keys(optionChain).map(s => parseFloat(s)).sort((a, b) => a - b)

        // Find ATM index
        const atmIndex = allStrikes.indexOf(atmStrike)
        if (atmIndex === -1) {
            throw new Error('ATM strike not found in strike list')
        }

        // Select ATM ±10 strikes
        const startIndex = Math.max(0, atmIndex - 10)
        const endIndex = Math.min(allStrikes.length - 1, atmIndex + 10)
        const selectedStrikes = allStrikes.slice(startIndex, endIndex + 1)

        console.log(`[PCR] ${indexName}: Spot=${spotPrice}, ATM=${atmStrike}, Strikes=${selectedStrikes.length}`)

        // Calculate total Put OI and Call OI
        let totalPutOI = 0
        let totalCallOI = 0

        selectedStrikes.forEach(strike => {
            const strikeData = optionChain[strike.toString()]
            if (strikeData) {
                totalPutOI += strikeData.PE?.openInterest || 0
                totalCallOI += strikeData.CE?.openInterest || 0
            }
        })

        // Calculate PCR
        const pcrValue = totalCallOI > 0 ? totalPutOI / totalCallOI : 0

        // Classify sentiment
        let sentiment = 'Neutral'
        if (pcrValue < 0.91) {
            sentiment = 'Bullish'
        } else if (pcrValue > 1.09) {
            sentiment = 'Bearish'
        }

        console.log(`[PCR] ${indexName}: PCR=${pcrValue.toFixed(4)}, Sentiment=${sentiment}`)

        return {
            index_name: indexName,
            total_put_oi: totalPutOI,
            total_call_oi: totalCallOI,
            pcr_value: pcrValue,
            sentiment: sentiment,
            spot_price: spotPrice,
            atm_strike: atmStrike,
            strikes_used: selectedStrikes.length,
            captured_at: capturedAt,
        }

    } catch (error) {
        console.error(`[PCR] Error calculating ${indexName}:`, error)
        throw error
    }
}
