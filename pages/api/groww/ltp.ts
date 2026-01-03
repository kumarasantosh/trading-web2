import type { NextApiRequest, NextApiResponse } from 'next';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    // Disable caching to ensure fresh data
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { segment, exchange_symbols, exchange_trading_symbols } = req.query;

    if (!segment) {
        return res.status(400).json({ error: 'Missing segment parameter' });
    }

    // Support both parameter formats
    let symbolsParam = exchange_symbols || exchange_trading_symbols;

    if (!symbolsParam) {
        return res.status(400).json({ error: 'Missing symbols parameter' });
    }

    try {
        // Handle both string and array formats
        const symbolsString = Array.isArray(symbolsParam) ? symbolsParam.join(',') : symbolsParam as string;
        const symbols = symbolsString.split(',').filter(Boolean);
        const results: Record<string, number> = {};

        // Separate indices from regular stocks
        const indices: string[] = [];
        const stocks: string[] = [];

        symbols.forEach(symbol => {
            // Handle both formats: NSE_NIFTY 50 and NSE:SBILIFE
            const normalizedSymbol = symbol.replace(':', '_');
            const cleanSymbol = normalizedSymbol.replace(/^(NSE_|BSE_)/, '');

            if (cleanSymbol.includes('NIFTY') || cleanSymbol === 'SENSEX' || cleanSymbol.includes('VIX')) {
                indices.push(normalizedSymbol);
            } else {
                stocks.push(normalizedSymbol);
            }
        });

        // Fetch indices one by one using tr_live_indices endpoint
        // Map common index names to Groww's naming convention
        const indexNameMap: Record<string, string> = {
            'NIFTY 50': 'NIFTY',
            'NIFTY BANK': 'BANKNIFTY',
            'NIFTY IT': 'NIFTYIT',
            'NIFTY AUTO': 'NIFTYAUTO',
            'NIFTY PHARMA': 'NIFTYPHARMA',
            'NIFTY FMCG': 'NIFTYFMCG',
            'NIFTY METAL': 'NIFTYMETAL',
            'NIFTY REALTY': 'NIFTYREALTY',
            'NIFTY ENERGY': 'NIFTYENERGY',
            'NIFTY FIN SERVICE': 'FINNIFTY',
            'NIFTY PVT BANK': 'NIFTYPVTBANK',
            'NIFTY PSU BANK': 'NIFTYPSUBANK',
            'NIFTY MEDIA': 'NIFTYMEDIA',
            'NIFTY MIDCAP 100': 'NIFTYMIDSELECT',
            'NIFTY SMLCAP 100': 'NIFTYSMALL',
            'NIFTY INFRA': 'NIFTYINFRA',
            'NIFTY COMMODITIES': 'NIFTYCOMMODITIES',
            'NIFTY CONSUMPTION': 'NIFTYCONSUMPTION',
            'NIFTY CPSE': 'NIFTYCPSE',
            'NIFTY PSE': 'NIFTYPSE',
            'NIFTY SERV SECTOR': 'NIFTYSERVSECTOR',
            'NIFTY MNC': 'NIFTYMNC',
            'INDIA VIX': 'INDIAVIX',
            'SENSEX': 'SENSEX',
        };

        for (let i = 0; i < indices.length; i++) {
            const symbol = indices[i];

            try {
                // Clean the symbol name
                const cleanSymbol = symbol.replace(/^(NSE_|BSE_)/, '');
                const exchange = symbol.startsWith('BSE_') ? 'BSE' : 'NSE';

                // Use mapped name if available, otherwise remove spaces
                const growwSymbol = indexNameMap[cleanSymbol] || cleanSymbol.replace(/\s+/g, '');

                const url = `https://groww.in/v1/api/stocks_data/v1/tr_live_indices/exchange/${exchange}/segment/${segment}/${growwSymbol}/latest`;

                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'accept': 'application/json, text/plain, */*',
                        'authorization': `Bearer ${process.env.GROWW_API_TOKEN || ''}`,
                        'cookie': process.env.GROWW_COOKIES || '',
                        'referer': 'https://groww.in/indices',
                        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
                        'x-app-id': 'growwWeb',
                        'x-device-id': process.env.GROWW_DEVICE_ID || 'baebee61-e0ef-53bb-991d-2b80fcd66e37',
                        'x-device-type': 'desktop',
                        'x-platform': 'web',
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    // Use 'value' field which contains the current price
                    results[symbol] = data.value || data.close || 0;
                } else {
                    console.error(`Failed to fetch index ${symbol}:`, response.status);
                    results[symbol] = 0;
                }

                // Add delay between requests to avoid rate limiting
                if (i < indices.length - 1) {
                    await delay(150);
                }
            } catch (error) {
                console.error(`Error fetching index ${symbol}:`, error);
                results[symbol] = 0;
            }
        }

        // Fetch regular stocks one by one
        for (let i = 0; i < stocks.length; i++) {
            const symbol = stocks[i];

            try {
                const cleanSymbol = symbol.replace(/^(NSE_|BSE_)/, '').replace(/\s+/g, '');
                const exchange = symbol.startsWith('BSE_') ? 'BSE' : 'NSE';

                const url = `https://groww.in/v1/api/stocks_data/v1/tr_live_prices/exchange/${exchange}/segment/${segment}/${cleanSymbol}/latest`;

                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'accept': 'application/json, text/plain, */*',
                        'authorization': `Bearer ${process.env.GROWW_API_TOKEN || ''}`,
                        'cookie': process.env.GROWW_COOKIES || '',
                        'referer': 'https://groww.in/stocks/user/explore',
                        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
                        'x-app-id': 'growwWeb',
                        'x-device-id': process.env.GROWW_DEVICE_ID || 'baebee61-e0ef-53bb-991d-2b80fcd66e37',
                        'x-device-type': 'desktop',
                        'x-platform': 'web',
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    // Return the full object with open, close, ltp, etc.
                    results[symbol] = data;
                } else if (response.status === 429) {
                    console.warn(`Rate limited for ${symbol}, retrying...`);
                    await delay(2000);
                    const retryResponse = await fetch(url, {
                        method: 'GET',
                        headers: {
                            'accept': 'application/json, text/plain, */*',
                            'authorization': `Bearer ${process.env.GROWW_API_TOKEN || ''}`,
                            'cookie': process.env.GROWW_COOKIES || '',
                            'referer': 'https://groww.in/stocks/user/explore',
                            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
                            'x-app-id': 'growwWeb',
                            'x-device-id': process.env.GROWW_DEVICE_ID || 'baebee61-e0ef-53bb-991d-2b80fcd66e37',
                            'x-device-type': 'desktop',
                            'x-platform': 'web',
                        }
                    });
                    if (retryResponse.ok) {
                        const retryData = await retryResponse.json();
                        results[symbol] = retryData;
                    } else {
                        results[symbol] = 0;
                    }
                } else {
                    console.error(`Failed to fetch ${symbol}:`, response.status);
                    results[symbol] = 0;
                }

                if (i < stocks.length - 1) {
                    await delay(150);
                }
            } catch (error) {
                console.error(`Error fetching ${symbol}:`, error);
                results[symbol] = 0;
            }
        }

        return res.status(200).json(results);

    } catch (error) {
        console.error('Error in LTP handler:', error);
        return res.status(500).json({ error: 'Failed to fetch LTP data' });
    }
}