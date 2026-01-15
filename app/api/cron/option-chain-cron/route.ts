import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase'
import { fetchOptionChainData } from '@/services/optionChain';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Cron job API route that captures option chain data every 3 minutes
 * Runs during market hours (9:15 AM - 3:30 PM IST, Mon-Fri)
 * 
 * Security: Validates CRON_SECRET to prevent unauthorized access
 */
export async function GET(request: NextRequest) {
    try {
        // Validate cron secret for security
        const authHeader = request.headers.get('authorization');
        const cronSecret = process.env.CRON_SECRET;

        if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
            console.error('[OPTION-CHAIN-CRON] Unauthorized request');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check if within market hours (9:15 AM - 3:30 PM IST, Mon-Fri)
        const now = new Date();
        const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
        const istHour = istTime.getUTCHours();
        const istMinute = istTime.getUTCMinutes();
        const dayOfWeek = istTime.getUTCDay(); // 0 = Sunday, 6 = Saturday

        // Check if within market hours (9:15 AM - 3:30 PM IST)
        const currentTimeInMinutes = istHour * 60 + istMinute;
        const marketOpenTime = 9 * 60 + 15;  // 9:15 AM
        const marketCloseTime = 15 * 60 + 30; // 3:30 PM

        // Check if forced execution (bypass market hours)
        const { searchParams } = new URL(request.url);
        const force = searchParams.get('force') === 'true';

        if (!force) {
            if (currentTimeInMinutes < marketOpenTime || currentTimeInMinutes > marketCloseTime) {
                console.log('[OPTION-CHAIN-CRON] Skipping - Outside market hours');
                return NextResponse.json({
                    success: true,
                    message: 'Outside market hours',
                    captured: 0,
                });
            }
        } else {
            console.log('[OPTION-CHAIN-CRON] Forced execution - Bypassing market hours check');
        }

        // Round to nearest 3 minutes for consistent timestamps
        const capturedAt = new Date(now);
        const minutes = capturedAt.getMinutes();
        const roundedMinutes = Math.floor(minutes / 3) * 3;
        capturedAt.setMinutes(roundedMinutes, 0, 0);
        const capturedAtISO = capturedAt.toISOString();

        console.log(`[OPTION-CHAIN-CRON] Capturing option chain at ${capturedAtISO}`);

        const indices = ['NIFTY', 'BANKNIFTY', 'FINNIFTY'];
        const results: any[] = [];
        const errors: string[] = [];

        for (const indexName of indices) {
            try {
                // Direct service call
                console.log(`[OPTION-CHAIN-CRON] Fetching data for ${indexName}`);

                const data = await fetchOptionChainData(indexName);

                if (!data.success) {
                    throw new Error(`Option chain service returned error: ${data.error}`);
                }

                if (!data.success || !data.optionChain) {
                    throw new Error('Invalid option chain data');
                }

                // Extract key metrics
                const spotPrice = data.spotPrice || 0;
                const optionChain = data.optionChain;

                // Calculate total OI
                let totalPutOI = 0;
                let totalCallOI = 0;

                Object.values(optionChain).forEach((strikeData: any) => {
                    totalPutOI += strikeData.PE?.openInterest || 0;
                    totalCallOI += strikeData.CE?.openInterest || 0;
                });

                // Store snapshot
                const snapshot = {
                    symbol: indexName, // DB column is 'symbol' not 'index_name'
                    spot_price: spotPrice,
                    total_put_oi: totalPutOI,
                    total_call_oi: totalCallOI,
                    captured_at: capturedAtISO,
                };

                const { error: insertError } = await supabaseAdmin
                    .from('option_chain_snapshots')
                    .insert(snapshot);

                if (insertError) {
                    // Ignore duplicate errors
                    if (insertError.code !== '23505') {
                        errors.push(`${indexName}: ${insertError.message}`);
                    }
                } else {
                    results.push(snapshot);
                }

            } catch (error) {
                console.error(`[OPTION-CHAIN-CRON] Error processing ${indexName}:`, error);
                errors.push(`${indexName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }

        console.log(`[OPTION-CHAIN-CRON] ✅ Captured ${results.length} indices`);

        return NextResponse.json({
            success: true,
            captured_at: capturedAtISO,
            indices_captured: results.length,
            results,
            errors,
        });

    } catch (error) {
        console.error('[OPTION-CHAIN-CRON] Fatal error:', error);
        return NextResponse.json(
            { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
