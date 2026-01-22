
// Verification Script for Hybrid Groww + Yahoo
import YahooFinance from 'yahoo-finance2';
import { getGrowwAccessToken } from '@/lib/groww-token';

async function verifyHybrid() {
    const symbol = 'VOLTAS.NS';
    const growwSymbol = 'VOLTAS';

    // Instantiate proper Yahoo
    const yahooFinance = new YahooFinance();

    console.log(`[VERIFY] Fetching HYBRID data for ${symbol} using GROWW for Open`);

    // 0. Get Token
    const token = await getGrowwAccessToken() || process.env.GROWW_API_TOKEN;
    if (!token) {
        console.error("No Groww Token available!");
        return;
    }
    console.log("Groww Token obtained.");

    // 1. Fetch Quote from Groww
    let todayOpen: number | null = null;
    try {
        const url = `https://groww.in/v1/api/stocks_data/v1/tr_live_prices/exchange/NSE/segment/CASH/${growwSymbol}/latest`;
        const resp = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
            }
        });

        if (resp.ok) {
            const data = await resp.json();
            if (data.open) {
                todayOpen = data.open;
            } else if (data.ohlc && data.ohlc.open) {
                todayOpen = data.ohlc.open;
            }
            console.log(`[VERIFY] Groww Open: ${todayOpen}`);
        } else {
            console.log(`[VERIFY] Groww failed: ${resp.status}`);
        }
    } catch (e) {
        console.error('[VERIFY] Groww Error:', e);
    }

    // 2. Fetch Historical
    const today = new Date();
    const tenDaysAgo = new Date(today);
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

    let ohlcData: any = null;

    try {
        const result = await yahooFinance.historical(symbol, {
            period1: tenDaysAgo.toISOString().split('T')[0],
            period2: today.toISOString().split('T')[0],
            interval: '1d'
        });

        if (result && result.length > 0) {
            let idx = result.length - 1;
            const todayStr = new Date().toISOString().split('T')[0];
            const lastDate = result[idx].date.toISOString().split('T')[0];

            console.log(`[VERIFY] Last candle date: ${lastDate} (Today: ${todayStr})`);

            if (lastDate === todayStr) {
                console.log(`[VERIFY] Skipping today's candle`);
                idx--;
            }

            if (idx >= 0) {
                const lastCandle = result[idx];
                ohlcData = {
                    high: lastCandle.high,
                    low: lastCandle.low,
                    open: lastCandle.open,
                    close: lastCandle.close,
                    date: lastCandle.date.toISOString().split('T')[0]
                };
                console.log(`[VERIFY] Selected Historical Candle (Yesterday):`, ohlcData);
            }
        }

    } catch (e) {
        console.error('[VERIFY] Historical failed:', e);
    }

    // 3. Merge
    if (ohlcData) {
        const finalOpen = (todayOpen !== null && todayOpen > 0) ? todayOpen : ohlcData.open;

        const merged = {
            today_high: ohlcData.high,
            today_low: ohlcData.low,
            today_open: finalOpen,
            today_close: ohlcData.close,
            captured_date: ohlcData.date,
        };

        console.log('--------------------------------------------------');
        console.log('[VERIFY] FINAL HYBRID RECORD:');
        console.log(JSON.stringify(merged, null, 2));
        console.log('--------------------------------------------------');

        if (todayOpen && finalOpen === todayOpen) {
            console.log("SUCCESS: today_open matches Groww Open.");
        } else {
            console.log("WARNING: today_open uses Historical fallback.");
        }

    } else {
        console.log('[VERIFY] Failed to get valid OHLC data to merge.');
    }
}

verifyHybrid();
