import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Force dynamic rendering since we use request headers
export const dynamic = 'force-dynamic';

/**
 * Cron job API route that checks for breakout/breakdown stocks during market hours
 * Runs every 1 minute during market hours (9:15 AM - 3:30 PM IST)
 * 
 * Breakout: LTP > yesterday's high
 * Breakdown: LTP < yesterday's low
 * 
 * Security: Validates CRON_SECRET to prevent unauthorized access
 */
export async function GET(request: NextRequest) {
    try {
        // Validate cron secret for security
        const authHeader = request.headers.get('authorization')
        const cronSecret = process.env.CRON_SECRET

        if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
            console.error('[BREAKOUT-CHECK] Unauthorized cron request')
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Check if within market hours (9:15 AM - 3:30 PM IST, Mon-Fri)
        const now = new Date()
        const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000))
        const istHour = istTime.getUTCHours()
        const istMinute = istTime.getUTCMinutes()
        const dayOfWeek = istTime.getUTCDay() // 0 = Sunday, 6 = Saturday

        // Check if it's a weekend
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            console.log('[BREAKOUT-CHECK] Skipping - Weekend')
            return NextResponse.json({
                success: true,
                message: 'Weekend - market closed',
                breakouts: 0,
                breakdowns: 0,
            })
        }

        // Check if within market hours (9:15 AM - 3:30 PM IST)
        const currentTimeInMinutes = istHour * 60 + istMinute
        const marketOpenTime = 9 * 60 + 15  // 9:15 AM
        const marketCloseTime = 15 * 60 + 30 // 3:30 PM

        if (currentTimeInMinutes < marketOpenTime || currentTimeInMinutes > marketCloseTime) {
            console.log('[BREAKOUT-CHECK] Skipping - Outside market hours')
            return NextResponse.json({
                success: true,
                message: 'Outside market hours',
                breakouts: 0,
                breakdowns: 0,
            })
        }

        const todayDate = istTime.toISOString().split('T')[0] // YYYY-MM-DD format
        console.log(`[BREAKOUT-CHECK] Checking breakouts/breakdowns for ${todayDate}`)

        // Fetch yesterday's high-low data from database
        const { data: highLowData, error: fetchError } = await supabaseAdmin
            .from('daily_high_low')
            .select('symbol, sector, today_high, today_low')

        if (fetchError) {
            console.error('[BREAKOUT-CHECK] Error fetching high-low data:', fetchError)
            return NextResponse.json(
                { error: 'Failed to fetch high-low data', details: fetchError.message },
                { status: 500 }
            )
        }

        if (!highLowData || highLowData.length === 0) {
            console.log('[BREAKOUT-CHECK] No high-low data available - run EOD capture first')
            return NextResponse.json({
                success: true,
                message: 'No high-low data available',
                breakouts: 0,
                breakdowns: 0,
            })
        }

        console.log(`[BREAKOUT-CHECK] Checking ${highLowData.length} stocks`)

        let breakoutCount = 0
        let breakdownCount = 0
        const errors: string[] = []

        // Check each stock for breakout/breakdown
        for (const stock of highLowData) {
            try {
                // Fetch current LTP from Groww API
                const url = `https://groww.in/v1/api/stocks_data/v1/tr_live_prices/exchange/NSE/segment/CASH/${stock.symbol}/latest`

                const response = await fetch(url, {
                    headers: {
                        'authorization': `Bearer ${process.env.GROWW_API_TOKEN || ''}`,
                        'cookie': process.env.GROWW_COOKIES || '',
                        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                    },
                    cache: 'no-store',
                })

                if (response.ok) {
                    const data = await response.json()
                    const ltp = data.ltp || data.last || 0

                    if (ltp > 0) {
                        // Check for BREAKOUT (LTP > yesterday's high)
                        if (ltp > stock.today_high) {
                            const breakoutPercent = ((ltp - stock.today_high) / stock.today_high) * 100

                            // Try to insert (will fail silently if already exists due to unique constraint)
                            const { error: insertError } = await supabaseAdmin
                                .from('breakout_stocks')
                                .insert({
                                    symbol: stock.symbol,
                                    sector: stock.sector,
                                    ltp: ltp,
                                    yesterday_high: stock.today_high,
                                    breakout_percent: breakoutPercent,
                                    breakout_date: todayDate,
                                })

                            // Only count as success if no error or if error is duplicate (code 23505)
                            if (!insertError) {
                                breakoutCount++
                                console.log(`[BREAKOUT-CHECK] ✅ ${stock.symbol} breakout: ${ltp} > ${stock.today_high} (+${breakoutPercent.toFixed(2)}%)`)
                            } else if (insertError.code !== '23505') {
                                // Log non-duplicate errors
                                errors.push(`${stock.symbol} breakout insert: ${insertError.message}`)
                            }
                        }

                        // Check for BREAKDOWN (LTP < yesterday's low)
                        if (ltp < stock.today_low) {
                            const breakdownPercent = ((stock.today_low - ltp) / stock.today_low) * 100

                            // Try to insert (will fail silently if already exists due to unique constraint)
                            const { error: insertError } = await supabaseAdmin
                                .from('breakdown_stocks')
                                .insert({
                                    symbol: stock.symbol,
                                    sector: stock.sector,
                                    ltp: ltp,
                                    yesterday_low: stock.today_low,
                                    breakdown_percent: breakdownPercent,
                                    breakdown_date: todayDate,
                                })

                            // Only count as success if no error or if error is duplicate (code 23505)
                            if (!insertError) {
                                breakdownCount++
                                console.log(`[BREAKOUT-CHECK] ⬇️ ${stock.symbol} breakdown: ${ltp} < ${stock.today_low} (-${breakdownPercent.toFixed(2)}%)`)
                            } else if (insertError.code !== '23505') {
                                // Log non-duplicate errors
                                errors.push(`${stock.symbol} breakdown insert: ${insertError.message}`)
                            }
                        }
                    }
                }

                // Small delay to avoid rate limiting (50ms per stock for faster checking)
                await new Promise(resolve => setTimeout(resolve, 50))

            } catch (error) {
                errors.push(`${stock.symbol}: ${error instanceof Error ? error.message : 'Unknown error'}`)
            }
        }

        console.log(`[BREAKOUT-CHECK] ✅ Complete: ${breakoutCount} breakouts, ${breakdownCount} breakdowns`)

        return NextResponse.json({
            success: true,
            checked_at: now.toISOString(),
            stocks_checked: highLowData.length,
            breakouts_detected: breakoutCount,
            breakdowns_detected: breakdownCount,
            errors: errors.slice(0, 10), // Limit errors to first 10
            error_count: errors.length,
        })

    } catch (error) {
        console.error('[BREAKOUT-CHECK] Fatal error:', error)
        return NextResponse.json(
            { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        )
    }
}
