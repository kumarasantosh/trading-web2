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
        const date = searchParams.get('date'); // Date in YYYY-MM-DD format

        if (!date) {
            return NextResponse.json(
                { error: 'Missing required parameter: date (YYYY-MM-DD)' },
                { status: 400 }
            );
        }

        // Calculate market hours in UTC
        // Market hours: 9:15 AM - 3:30 PM IST
        // IST is UTC+5:30
        // 9:15 AM IST = 3:45 AM UTC
        // 3:30 PM IST = 10:00 AM UTC
        const startTime = `${date}T03:45:00.000Z`; // 9:15 AM IST
        const endTime = `${date}T10:00:00.000Z`; // 3:30 PM IST

        let query = supabaseAdmin
            .from('oi_trendline')
            .select('*')
            .eq('symbol', symbol)
            .gte('captured_at', startTime)
            .lte('captured_at', endTime)
            .order('captured_at', { ascending: true });

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

