import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Force dynamic rendering since we use request body and searchParams
export const dynamic = 'force-dynamic';
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const MONTH_MAP: Record<string, string> = {
    JAN: '01',
    FEB: '02',
    MAR: '03',
    APR: '04',
    MAY: '05',
    JUN: '06',
    JUL: '07',
    AUG: '08',
    SEP: '09',
    OCT: '10',
    NOV: '11',
    DEC: '12',
};

function shiftWeekendTimestampToFriday(isoTimestamp: string): string {
    const parsed = new Date(isoTimestamp);
    if (Number.isNaN(parsed.getTime())) return isoTimestamp;

    const istDate = new Date(parsed.getTime() + IST_OFFSET_MS);
    const weekDay = istDate.getUTCDay();
    if (weekDay !== 0 && weekDay !== 6) return isoTimestamp;

    const adjustedIst = new Date(istDate);
    adjustedIst.setUTCDate(adjustedIst.getUTCDate() - (weekDay === 0 ? 2 : 1));

    const adjustedUtc = new Date(adjustedIst.getTime() - IST_OFFSET_MS);
    return adjustedUtc.toISOString();
}

function normalizeExpiryDate(expiryDate: string): string {
    // Already normalized (YYYY-MM-DD)
    if (/^\d{4}-\d{2}-\d{2}$/.test(expiryDate)) {
        return expiryDate;
    }

    // DD-MM-YYYY
    const ddMmYyyy = expiryDate.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (ddMmYyyy) {
        const [, day, month, year] = ddMmYyyy;
        return `${year}-${month}-${day}`;
    }

    // DD-MMM-YYYY
    const ddMmmYyyy = expiryDate.match(/^(\d{2})-([A-Za-z]{3})-(\d{4})$/);
    if (ddMmmYyyy) {
        const [, day, monthText, year] = ddMmmYyyy;
        const month = MONTH_MAP[monthText.toUpperCase()];
        if (month) {
            return `${year}-${month}-${day}`;
        }
    }

    return expiryDate;
}

/**
 * API route to save option chain snapshot
 * POST /api/option-chain/save
 * Body: { symbol, expiryDate, data, niftySpot }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { symbol, expiryDate, data, niftySpot } = body;

        if (!symbol || !expiryDate || !data) {
            return NextResponse.json(
                { error: 'Missing required fields: symbol, expiryDate, data' },
                { status: 400 }
            );
        }

        const capturedAt = new Date().toISOString();

        // Save to database
        const { error } = await supabaseAdmin
            .from('option_chain_snapshots')
            .insert({
                symbol,
                expiry_date: expiryDate,
                captured_at: capturedAt,
                nifty_spot: niftySpot || null,
                option_chain_data: data,
            });

        if (error) {
            console.error('Database error:', error);
            return NextResponse.json(
                { error: 'Failed to save snapshot', details: error.message },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            captured_at: capturedAt,
        });

    } catch (error: any) {
        console.error('Save snapshot error:', error);
        return NextResponse.json(
            { error: 'Internal server error', details: error.message },
            { status: 500 }
        );
    }
}

/**
 * API route to fetch historical option chain snapshots
 * GET /api/option-chain/save?symbol=NIFTY&expiryDate=06-Jan-2026&start=...&end=...
 */
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const symbol = searchParams.get('symbol') || 'NIFTY';
        const expiryDate = searchParams.get('expiryDate');
        const start = searchParams.get('start');
        const end = searchParams.get('end');

        if (!start || !end) {
            return NextResponse.json(
                { error: 'Missing required parameters: start, end' },
                { status: 400 }
            );
        }

        const effectiveStart = shiftWeekendTimestampToFriday(start);
        const effectiveEnd = shiftWeekendTimestampToFriday(end);

        let query = supabaseAdmin
            .from('option_chain_snapshots')
            .select('*')
            .eq('symbol', symbol)
            .gte('captured_at', effectiveStart)
            .lte('captured_at', effectiveEnd)
            .order('captured_at', { ascending: true });

        if (expiryDate) {
            const normalizedExpiry = normalizeExpiryDate(expiryDate);
            query = query.eq('expiry_date', normalizedExpiry);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Database error:', error);
            return NextResponse.json(
                { error: 'Failed to fetch snapshots', details: error.message },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            snapshots: data || [],
            effective_start: effectiveStart,
            effective_end: effectiveEnd,
        });

    } catch (error: any) {
        console.error('Fetch snapshots error:', error);
        return NextResponse.json(
            { error: 'Internal server error', details: error.message },
            { status: 500 }
        );
    }
}
