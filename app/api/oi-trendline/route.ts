import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * API route to fetch OI trendline data
 * GET /api/oi-trendline?symbol=NIFTY&expiryDate=06-01-2026&date=2026-01-06
 * 
 * Returns total put OI and call OI data for plotting trendline
 */
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const symbol = searchParams.get('symbol') || 'NIFTY';
        const expiryDate = searchParams.get('expiryDate');
        const dateParam = searchParams.get('date'); // Date in YYYY-MM-DD format

        // Effective date: on Sat/Sun use last trading day (Friday)
        const now = new Date();
        const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
        const dayOfWeek = istTime.getUTCDay();
        let effectiveDate: string;
        if (dayOfWeek === 0) {
            const friday = new Date(istTime);
            friday.setDate(friday.getDate() - 2);
            effectiveDate = friday.toISOString().split('T')[0];
        } else if (dayOfWeek === 6) {
            const friday = new Date(istTime);
            friday.setDate(friday.getDate() - 1);
            effectiveDate = friday.toISOString().split('T')[0];
        } else {
            effectiveDate = istTime.toISOString().split('T')[0];
        }

        const date = dateParam || effectiveDate;

        let query = supabaseAdmin
            .from('oi_trendline')
            .select('*')
            .eq('symbol', symbol)
            .order('captured_at', { ascending: true });

        if (date) {
            // Market hours: 9:15 AM - 3:30 PM IST (3:45 AM - 10:00 AM UTC)
            const startTime = `${date}T03:45:00.000Z`;
            query = query.gte('captured_at', startTime);

            // If it's the effective "today" (current trading day), don't limit end time for live data
            if (date !== effectiveDate) {
                const endTime = `${date}T10:00:00.000Z`;
                query = query.lte('captured_at', endTime);
            }
        }

        if (expiryDate) {
            query = query.eq('expiry_date', expiryDate);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Database error:', error);
            return NextResponse.json(
                { error: 'Failed to fetch trendline data', details: error.message },
                { status: 500 }
            );
        }

        // Transform data for charting
        const chartData = (data || []).map((item: any) => ({
            time: item.captured_at,
            putOI: Number(item.total_put_oi),
            callOI: Number(item.total_call_oi),
            pcr: Number(item.pcr),
            niftySpot: item.nifty_spot ? Number(item.nifty_spot) : null,
        }));

        return NextResponse.json({
            success: true,
            symbol,
            expiryDate: expiryDate || null,
            date,
            data: chartData,
            count: chartData.length,
        });

    } catch (error: any) {
        console.error('Fetch trendline error:', error);
        return NextResponse.json(
            { error: 'Internal server error', details: error.message },
            { status: 500 }
        );
    }
}

