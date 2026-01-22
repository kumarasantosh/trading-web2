
// Verification Script for Hybrid Groww + Yahoo (Mocked Token)
import YahooFinance from 'yahoo-finance2';

// MOCK TOKEN for testing (since we can't easily auth locally without env vars setup perfect)
const MOCK_TOKEN = process.env.GROWW_API_TOKEN;

async function verifyHybrid() {
    const symbol = 'VOLTAS.NS';
    const growwSymbol = 'VOLTAS';

    // Instantiate proper Yahoo
    const yahooFinance = new YahooFinance();

    console.log(`[VERIFY] Fetching HYBRID data for ${symbol} using GROWW for Open`);

    // 0. Use Env Token directly
    const token = MOCK_TOKEN;
    if (!token) {
        console.error("No GROWW_API_TOKEN found in env variables. Cannot verify live Groww fetch.");
        console.log("Please export GROWW_API_TOKEN='...' and run again.");
        return;
    }
    console.log(`Groww Token obtained (length: ${token.length})`);

    // 1. Fetch Quote from Groww
    let todayOpen: number | null = null;
    try {
        const url = `https://groww.in/v1/api/stocks_data/v1/tr_live_prices/exchange/NSE/segment/CASH/${growwSymbol}/latest`;
        console.log(`[VERIFY] Fetching ${url}...`);

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
            console.log(`[VERIFY] Groww Live Open: ${todayOpen}`);
        } else {
            console.log(`[VERIFY] Groww failed: ${resp.status} ${resp.statusText}`);
            const text = await resp.text();
            console.log(`[VERIFY] Response: ${text.substring(0, 100)}...`);
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
            console.log("SUCCESS: today_open uses Groww Live Data.");
        } else if (todayOpen === null) {
            console.log("WARNING: Groww fetch failed, fell back to Historical Open.");
        } else {
            console.log("WARNING: today_open uses Historical fallback logic unexpectedly.");
        }

    } else {
        console.log('[VERIFY] Failed to get valid OHLC data to merge.');
    }
}

verifyHybrid();
