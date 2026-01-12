import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering since we use searchParams
export const dynamic = 'force-dynamic';

/**
 * API route to fetch and parse NSE option chain data
 * Returns a standardized format: { success: true, spotPrice: number, optionChain: { strike: { CE: ..., PE: ... } } }
 */
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const symbol = searchParams.get('symbol') || 'NIFTY';

        // NSE Session Establishment (same as before)
        const homeResponse = await fetch('https://www.nseindia.com/', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
            },
        });

        let cookies = '';
        const cookieHeaders = homeResponse.headers.getSetCookie?.() || [];
        if (cookieHeaders.length > 0) {
            cookies = cookieHeaders.map(c => c.split(';')[0]).join('; ');
        }

        // Fetch Data
        const url = `https://www.nseindia.com/api/option-chain-indices?symbol=${symbol}`;
        console.log(`[OPTION-CHAIN] Fetching from ${url}`);

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': '*/*',
                'Cookie': cookies,
                'Referer': 'https://www.nseindia.com/option-chain',
            },
        });

        if (!response.ok) {
            throw new Error(`NSE API returned ${response.status}`);
        }

        const data = await response.json();
        const records = data.records;
        const filtered = data.filtered; // Often contains the most relevant expiry data

        if (!records || !records.data) {
            throw new Error('Invalid NSE response structure');
        }

        const spotPrice = records.underlyingValue;
        const expiryDates = records.expiryDates;

        // Use the first expiry date if not specified, or use the filtered data if available
        const currentExpiry = expiryDates[0];

        // Process the data into the format expected by calculate-pcr and frontend
        // Structure: { [strikePrice]: { CE: { openInterest, changeinOpenInterest, lastPrice }, PE: { ... } } }
        const processedChain: Record<string, any> = {};

        // Use filtered data if available (usually contains ATM ± strikes for current expiry)
        const sourceData = filtered?.data || records.data;

        sourceData.forEach((item: any) => {
            // Filter by expiry if we're using the raw list (filtered.data is already filtered by expiry)
            if (item.expiryDate === currentExpiry) {
                const strikePrice = item.strikePrice;
                processedChain[strikePrice] = {};

                if (item.CE) {
                    processedChain[strikePrice].CE = {
                        openInterest: item.CE.openInterest,
                        changeinOpenInterest: item.CE.changeinOpenInterest,
                        lastPrice: item.CE.lastPrice,
                        impliedVolatility: item.CE.impliedVolatility,
                        totalTradedVolume: item.CE.totalTradedVolume
                    };
                }

                if (item.PE) {
                    processedChain[strikePrice].PE = {
                        openInterest: item.PE.openInterest,
                        changeinOpenInterest: item.PE.changeinOpenInterest,
                        lastPrice: item.PE.lastPrice,
                        impliedVolatility: item.PE.impliedVolatility,
                        totalTradedVolume: item.PE.totalTradedVolume
                    };
                }
            }
        });

        return NextResponse.json({
            success: true,
            spotPrice: spotPrice,
            timestamp: records.timestamp,
            expiryDate: currentExpiry,
            optionChain: processedChain
        });

    } catch (error: any) {
        console.error('[OPTION-CHAIN] Error:', error.message);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}

