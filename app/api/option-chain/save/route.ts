import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Force dynamic rendering since we use request body and searchParams
export const dynamic = 'force-dynamic';

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

        let query = supabaseAdmin
            .from('option_chain_snapshots')
            .select('*')
            .eq('symbol', symbol)
            .gte('captured_at', start)
            .lte('captured_at', end)
            .order('captured_at', { ascending: true });

        if (expiryDate) {
            let normalizedExpiry = expiryDate;
            const ddmmYYYYMatch = expiryDate.match(/^(\d{2})-(\d{2})-(\d{4})$/);
            if (ddmmYYYYMatch) {
                const [, day, month, year] = ddmmYYYYMatch;
                normalizedExpiry = `${year}-${month}-${day}`;
            }
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
        });

    } catch (error: any) {
        console.error('Fetch snapshots error:', error);
        return NextResponse.json(
            { error: 'Internal server error', details: error.message },
            { status: 500 }
        );
    }
}

