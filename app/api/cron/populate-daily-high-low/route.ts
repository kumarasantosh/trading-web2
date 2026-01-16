import { NextRequest, NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Instantiate yahoo-finance2 (required for v3)
const yahooFinance = new YahooFinance();

// All unique stocks from sector-stocks-mapping (160+ stocks)
const SYMBOLS = [
    // Indices
    '^NSEI',      // NIFTY 50
    '^NSEBANK',   // BANK NIFTY

    // PSU Bank
    'BANKBARODA.NS', 'BANKINDIA.NS', 'CANBK.NS', 'INDIANB.NS', 'PNB.NS', 'SBIN.NS', 'UNIONBANK.NS',

    // Private Bank
    'AXISBANK.NS', 'BANDHANBNK.NS', 'FEDERALBNK.NS', 'HDFCBANK.NS', 'ICICIBANK.NS', 'IDFCFIRSTB.NS',
    'INDUSINDBK.NS', 'KOTAKBANK.NS', 'RBLBANK.NS', 'AUBANK.NS',

    // Financial Services
    '360ONE.NS', 'ABCAPITAL.NS', 'ANGELONE.NS', 'BAJAJFINSV.NS', 'BAJFINANCE.NS', 'BSE.NS', 'CDSL.NS',
    'CHOLAFIN.NS', 'HDFCAMC.NS', 'HDFCLIFE.NS', 'HUDCO.NS', 'ICICIGI.NS', 'ICICIPRULI.NS', 'IIFL.NS',
    'IRFC.NS', 'JIOFIN.NS', 'LICHSGFIN.NS', 'LICI.NS', 'LTF.NS', 'MANAPPURAM.NS', 'MFSL.NS',
    'MUTHOOTFIN.NS', 'NUVAMA.NS', 'PAYTM.NS', 'PFC.NS', 'PNBHOUSING.NS', 'POLICYBZR.NS', 'RECLTD.NS',
    'SAMMAANCAP.NS', 'SBICARD.NS', 'SBILIFE.NS', 'SHRIRAMFIN.NS',

    // Auto
    'ASHOKLEY.NS', 'BHARATFORG.NS', 'BOSCHLTD.NS', 'EICHERMOT.NS', 'EXIDEIND.NS', 'HAL.NS',
    'HEROMOTOCO.NS', 'M%26M.NS', 'MARUTI.NS', 'MOTHERSON.NS', 'SONACOMS.NS', 'TIINDIA.NS',
    'TITAGARH.NS', 'TVSMOTOR.NS', 'UNOMINDA.NS',

    // Metal
    'ADANIENT.NS', 'APLAPOLLO.NS', 'HINDALCO.NS', 'HINDZINC.NS', 'JINDALSTEL.NS', 'JSWSTEEL.NS',
    'NATIONALUM.NS', 'NMDC.NS', 'SAIL.NS', 'TATASTEEL.NS', 'VEDL.NS',

    // Energy
    'ADANIENSOL.NS', 'ADANIGREEN.NS', 'BDL.NS', 'BHEL.NS', 'BLUESTARCO.NS', 'BPCL.NS', 'CGPOWER.NS',
    'COALINDIA.NS', 'GMRAIRPORT.NS', 'HINDPETRO.NS', 'IEX.NS', 'IGL.NS', 'INOXWIND.NS', 'IOC.NS',
    'IREDA.NS', 'JSWENERGY.NS', 'MAZDOCK.NS', 'NHPC.NS', 'NTPC.NS', 'OIL.NS', 'ONGC.NS',
    'PETRONET.NS', 'POWERGRID.NS', 'POWERINDIA.NS', 'RELIANCE.NS', 'SOLARINDS.NS', 'SUZLON.NS',
    'TATAPOWER.NS', 'TORNTPOWER.NS', 'GAIL.NS',

    // FMCG
    'BRITANNIA.NS', 'COLPAL.NS', 'DABUR.NS', 'DMART.NS', 'GODREJCP.NS', 'HINDUNILVR.NS', 'ITC.NS',
    'MARICO.NS', 'NESTLEIND.NS', 'NYKAA.NS', 'PATANJALI.NS', 'SUPREMEIND.NS', 'TATACONSUM.NS',
    'UBL.NS', 'VBL.NS',

    // Consumer Durables
    'AMBER.NS', 'BATAINDIA.NS', 'CROMPTON.NS', 'DIXON.NS', 'HAVELLS.NS', 'KALYANKJIL.NS',
    'PGEL.NS', 'TITAN.NS', 'VOLTAS.NS',

    // Consumption
    'AMBUJACEM.NS', 'APOLLOHOSP.NS', 'ASIANPAINT.NS', 'BHARTIARTL.NS', 'DALBHARAT.NS',
    'DELHIVERY.NS', 'DLF.NS', 'GRASIM.NS', 'INDHOTEL.NS', 'INDIGO.NS', 'KEI.NS',
    'MAXHEALTH.NS', 'NAUKRI.NS', 'PIDILITEIND.NS', 'TRENT.NS', 'ULTRACEMCO.NS',

    // Realty
    'GODREJPROP.NS', 'INDUSTOWER.NS', 'LODHA.NS', 'LT.NS', 'NBCC.NS', 'NCC.NS',
    'OBEROIRLTY.NS', 'PHOENIXLTD.NS', 'PRESTIGE.NS', 'SIEMENS.NS',

    // Pharma
    'ALKEM.NS', 'AUROPHARMA.NS', 'BIOCON.NS', 'CIPLA.NS', 'DIVISLAB.NS', 'DRREDDY.NS',
    'FORTIS.NS', 'GLENMARK.NS', 'LAURUSLAB.NS', 'LUPIN.NS', 'MANKIND.NS', 'PPLPHARMA.NS',
    'SUNPHARMA.NS', 'SYNGENE.NS', 'TORNTPHARM.NS', 'ZYDUSLIFE.NS',

    // IT
    'ABB.NS', 'CAMS.NS', 'COFORGE.NS', 'CYIENT.NS', 'HCLTECH.NS', 'INFY.NS', 'KAYNES.NS',
    'KFINTECH.NS', 'KPITTECH.NS', 'LTIM.NS', 'MPHASIS.NS', 'OFSS.NS', 'PERSISTENT.NS',
    'TATAELXSI.NS', 'TATATECH.NS', 'TCS.NS', 'TECHM.NS', 'WIPRO.NS',

    // Nifty MidSelect
    'ASTRAL.NS', 'BEL.NS', 'CONCOR.NS', 'CUMMINSIND.NS', 'JUBLFOOD.NS', 'PAGEIND.NS',
    'PIIND.NS', 'POLYCAB.NS', 'RVNL.NS', 'UPL.NS',

    // Additional major stocks
    'ADANIPORTS.NS', 'ZOMATO.NS', 'TATAMOTORS.NS',
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
                        sector: 'General',
                        today_high: quote.regularMarketDayHigh || 0,
                        today_low: quote.regularMarketDayLow || 0,
                        today_open: quote.regularMarketOpen || quote.regularMarketDayHigh || 0,
                        today_close: quote.regularMarketPrice || quote.regularMarketPreviousClose || quote.regularMarketDayHigh || 0,
                        captured_date: dateStr,
                    };

                    // Delete existing record for this symbol first
                    await supabaseAdmin
                        .from('daily_high_low')
                        .delete()
                        .eq('symbol', cleanSymbol);

                    // Insert new record
                    const { error: insertError } = await supabaseAdmin
                        .from('daily_high_low')
                        .insert(data);

                    if (insertError) {
                        errors.push(`${cleanSymbol}: ${insertError.message}`);
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