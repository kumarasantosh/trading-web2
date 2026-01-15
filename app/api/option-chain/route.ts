import { NextRequest, NextResponse } from 'next/server';
import { fetchOptionChainData } from '@/services/optionChain';

export const dynamic = 'force-dynamic';

/**
 * Handle GET requests for option chain data
 * GET /api/option-chain?symbol=NIFTY&expiryDate=13-Jan-2026
 */
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const symbol = searchParams.get('symbol') || 'NIFTY';
        let expiryDate = searchParams.get('expiryDate');

        console.log(`[OptionChain API] Fetching for symbol: ${symbol}, expiry: ${expiryDate || 'nearest'}`);

        // Use centralized service
        const data = await fetchOptionChainData(symbol, expiryDate);

        if (!data.success) {
            throw new Error(data.error);
        }

        return NextResponse.json({
            success: true,
            spotPrice: data.spotPrice,
            optionChain: data.optionChain,
            records: data.records,
            symbol: data.symbol,
            expiryDate: data.expiryDate,
            timestamp: data.timestamp
        });

    } catch (error: any) {
        console.error('[OptionChain API] Error:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
