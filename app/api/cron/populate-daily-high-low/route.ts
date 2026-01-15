import { NextRequest, NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Instantiate yahoo-finance2 (required for v3)
const yahooFinance = new YahooFinance();

// Add ALL your stock symbols here
const SYMBOLS = [
    '^NSEI',      // NIFTY 50
    '^NSEBANK',   // BANK NIFTY
    'RELIANCE.NS',
    'TCS.NS',
    'INFY.NS',
    'HDFCBANK.NS',
    'ICICIBANK.NS',
    'HINDUNILVR.NS',
    'ITC.NS',
    'SBIN.NS',
    'BHARTIARTL.NS',
    'KOTAKBANK.NS',
    'LT.NS',
    'AXISBANK.NS',
    'BAJFINANCE.NS',
    'MARUTI.NS',
    'TATAMOTORS.NS',
    'WIPRO.NS',
    'TECHM.NS',
    'SUNPHARMA.NS',
    'DRREDDY.NS',
    'CIPLA.NS',
    'TATASTEEL.NS',
    'HINDALCO.NS',
    'JSWSTEEL.NS',
    'NTPC.NS',
    'POWERGRID.NS',
    'ONGC.NS',
    'COALINDIA.NS',
    'ADANIENT.NS',
    'ADANIPORTS.NS',
    'TITAN.NS',
    'NESTLEIND.NS',
    'BRITANNIA.NS',
    'ASIANPAINT.NS',
    'ULTRACEMCO.NS',
    'GRASIM.NS',
    'M&M.NS',
    'BAJAJFINSV.NS',
    'HCLTECH.NS',
    'DIVISLAB.NS',
    'BPCL.NS',
    'INDUSINDBK.NS',
    'EICHERMOT.NS',
    'HEROMOTOCO.NS',
    'APOLLOHOSP.NS',
    'DABUR.NS',
    'VEDL.NS',
    'HINDZINC.NS',
    'JINDALSTEL.NS',
    'SAIL.NS',
    'PNB.NS',
    'BANKBARODA.NS',
    'CANBK.NS',
    'FEDERALBNK.NS',
    'IDFCFIRSTB.NS',
    'BANDHANBNK.NS',
    'LICHSGFIN.NS',
    'SBILIFE.NS',
    'HDFCLIFE.NS',
    'ICICIPRULI.NS',
    'DLF.NS',
    'GODREJPROP.NS',
    'PRESTIGE.NS',
    'OBEROIRLTY.NS',
    'ZOMATO.NS',
    'TRENT.NS',
    'DMART.NS',
    'NYKAA.NS',
    'PAYTM.NS',
    'JIOFIN.NS',
];

export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization');
        const token = authHeader?.replace('Bearer ', '');

        if (token !== process.env.CRON_SECRET) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log('🔄 Fetching yesterday\'s OHLC from yahoo-finance2...');

        const results: any[] = [];
        const errors: string[] = [];

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const dateStr = yesterday.toISOString().split('T')[0];

        for (const symbol of SYMBOLS) {
            try {
                const quote = await yahooFinance.quote(symbol) as any;

                if (quote && quote.regularMarketPreviousClose) {
                    const cleanSymbol = symbol
                        .replace('.NS', '')
                        .replace('^NSEI', 'NIFTY')
                        .replace('^NSEBANK', 'BANKNIFTY');

                    const data = {
                        symbol: cleanSymbol,
                        date: dateStr,
                        sector: 'General', // Can be enhanced with sector mapping
                        today_high: quote.regularMarketDayHigh || 0,
                        today_low: quote.regularMarketDayLow || 0,
                        open_price: quote.regularMarketOpen || 0,
                        close_price: quote.regularMarketPreviousClose || 0,
                        volume: quote.regularMarketVolume || 0,
                    };

                    // Store in Supabase using upsert
                    const { error: upsertError } = await supabaseAdmin
                        .from('daily_high_low')
                        .upsert(data, {
                            onConflict: 'symbol',
                            ignoreDuplicates: false
                        });

                    if (upsertError) {
                        errors.push(`${cleanSymbol}: ${upsertError.message}`);
                    } else {
                        results.push(data);
                    }
                }
            } catch (err) {
                errors.push(`${symbol}: ${err instanceof Error ? err.message : 'Unknown'}`);
            }

            await new Promise(resolve => setTimeout(resolve, 100)); // Rate limit
        }

        console.log(`✅ Populated ${results.length} symbols, ${errors.length} errors`);

        return NextResponse.json({
            success: true,
            message: 'Daily high-low populated',
            date: dateStr,
            symbols_processed: results.length,
            symbols_failed: errors.length,
            errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
        });

    } catch (error) {
        console.error('❌ Populate error:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to populate',
            details: error instanceof Error ? error.message : 'Unknown error',
        }, { status: 500 });
    }
}