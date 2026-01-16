import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * API route to fetch PCR trendline data from the pcr_data table (ATM ±10)
 * GET /api/pcr-trendline?symbol=NIFTY&date=2026-01-12
 */
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const symbol = searchParams.get('symbol') || 'NIFTY';
        const date = searchParams.get('date'); // Date in YYYY-MM-DD format

        // IST to UTC market hours: 09:15 IST (03:45 UTC) to 15:30 IST (10:00 UTC)
        // Convert server time to IST to determine "today" correctly
        const now = new Date();
        const istDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
        const todayStr = istDate.toISOString().split('T')[0];
        const effectiveDate = date || todayStr;

        const startTime = `${effectiveDate}T03:45:00.000Z`;

        // If it's today, we don't cap the end time to get live updates
        // If it's a past date, we cap at market close
        const isHistorical = effectiveDate !== todayStr;

        let query = supabaseAdmin
            .from('pcr_data')
            .select('*')
            .eq('index_name', symbol)
            .gte('captured_at', startTime)
            .order('captured_at', { ascending: true });

        if (isHistorical) {
            const endTime = `${effectiveDate}T10:00:00.000Z`;
            query = query.lte('captured_at', endTime);
        }

        const { data, error } = await query;

        if (error) {
            console.error('[PCR Trendline API] Database error:', error);
            return NextResponse.json(
                { error: 'Failed to fetch PCR trendline data', details: error.message },
                { status: 500 }
            );
        }

        // Transform data for charting
        const chartData = (data || []).map((item: any) => ({
            time: item.captured_at,
            pcr: Number(item.pcr_value),
            spot: Number(item.spot_price),
            sentiment: item.sentiment,
            totalPutOI: Number(item.total_put_oi),
            totalCallOI: Number(item.total_call_oi),
        }));

        return NextResponse.json({
            success: true,
            symbol,
            date: effectiveDate,
            data: chartData,
            count: chartData.length,
        });

    } catch (error: any) {
        console.error('[PCR Trendline API] Error:', error);
        return NextResponse.json(
            { error: 'Internal server error', details: error.message },
            { status: 500 }
        );
    }
}
