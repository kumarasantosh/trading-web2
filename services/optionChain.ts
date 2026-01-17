export const dynamic = 'force-dynamic';

interface OptionChainResponse {
    success: boolean;
    spotPrice?: number;
    optionChain?: Record<string, any>; // Keyed by strike price
    records?: any; // Raw data
    symbol?: string;
    expiryDate?: string;
    timestamp?: string;
    error?: string;
}

/**
 * Service to fetch option chain data from NSE
 * Used by:
 * - /api/option-chain (Frontend API)
 * - /api/cron/option-chain-cron (Data collection)
 * - /api/cron/calculate-pcr (PCR calculation)
 */
export async function fetchOptionChainData(symbol: string, expiryDate?: string | null): Promise<OptionChainResponse> {
    try {
        console.log(`[OptionChain Service] Fetching for symbol: ${symbol}, expiry: ${expiryDate || 'nearest'}`);

        // Common headers matching a real browser
        const commonHeaders = {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Language': 'en-GB,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"macOS"'
        };

        // Helper function to establish NSE session and get cookies (Adapted from cron logic)
        const establishSession = async () => {
            // Step 1: Visit homepage to get initial cookies
            const homeResponse = await fetch('https://www.nseindia.com', {
                headers: commonHeaders,
                cache: 'no-store',
            });

            // Extract cookies
            let allCookies = '';
            const cookieHeaders = homeResponse.headers.getSetCookie?.() || [];
            if (cookieHeaders.length > 0) {
                allCookies = cookieHeaders.map(cookie => cookie.split(';')[0]).join('; ');
            } else {
                const setCookieHeader = homeResponse.headers.get('set-cookie') || '';
                if (setCookieHeader) {
                    allCookies = setCookieHeader.split(',').map(c => c.trim().split(';')[0]).join('; ');
                }
            }

            // Step 2: Visit the code-based option chain page (sometimes needed for session)
            const optionChainPageUrl = `https://www.nseindia.com/option-chain`;

            try {
                const pageResponse = await fetch(optionChainPageUrl, {
                    headers: {
                        ...commonHeaders,
                        'Referer': 'https://www.nseindia.com/',
                        'Cookie': allCookies,
                        'Sec-Fetch-Site': 'same-origin',
                    },
                    cache: 'no-store',
                });

                const pageCookies = pageResponse.headers.getSetCookie?.() || [];
                if (pageCookies.length > 0) {
                    const combinedCookies = pageCookies.map(cookie => cookie.split(';')[0]).join('; ');
                    allCookies = allCookies ? `${allCookies}; ${combinedCookies}` : combinedCookies;
                }
            } catch (pageError) {
                console.warn('[OptionChain Service] Page visit failed:', pageError);
            }

            // Small delay to simulate human behavior
            await new Promise(resolve => setTimeout(resolve, 500));

            return { allCookies, optionChainPageUrl };
        };

        const { allCookies, optionChainPageUrl } = await establishSession();

        const apiHeaders = {
            ...commonHeaders,
            'Accept': '*/*',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-origin',
            'Referer': optionChainPageUrl,
            'Cookie': allCookies,
            'Origin': 'https://www.nseindia.com',
            'X-Requested-With': 'XMLHttpRequest'
        };

        // Step 3: If no expiryDate provided, fetch first available expiry
        if (!expiryDate) {
            // Try method 1: New dropdown API
            const dropdownUrl = `https://www.nseindia.com/api/NextApi/apiClient/GetQuoteApi?functionName=getOptionChainDropdown&symbol=${symbol}`;
            console.log(`[OptionChain Service] Trying dropdown API: ${dropdownUrl}`);

            try {
                const dropdownResponse = await fetch(dropdownUrl, {
                    headers: apiHeaders,
                    cache: 'no-store',
                });

                if (dropdownResponse.ok) {
                    const dropdownData = await dropdownResponse.json();
                    console.log(`[OptionChain Service] Dropdown response:`, JSON.stringify(dropdownData).substring(0, 200));

                    let expiries: string[] = [];
                    // Handle various response structures
                    if (dropdownData && Array.isArray(dropdownData)) expiries = dropdownData;
                    else if (dropdownData?.expiryDates) expiries = dropdownData.expiryDates;
                    else if (dropdownData?.data) expiries = dropdownData.data;
                    else if (dropdownData?.records?.expiryDates) expiries = dropdownData.records.expiryDates;

                    if (expiries.length > 0) {
                        expiryDate = expiries[0];
                        console.log(`[OptionChain Service] Found nearest expiry via dropdown: ${expiryDate}`);
                    }
                } else {
                    console.warn(`[OptionChain Service] Dropdown API returned ${dropdownResponse.status}`);
                }
            } catch (dropdownError) {
                console.warn('[OptionChain Service] Dropdown API failed:', dropdownError);
            }

            // Try method 2: Old option-chain-indices API (fallback)
            if (!expiryDate) {
                const isIndex = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'NIFTYIT', 'MIDCPNIFTY'].includes(symbol);
                const oldApiUrl = isIndex
                    ? `https://www.nseindia.com/api/option-chain-indices?symbol=${symbol}`
                    : `https://www.nseindia.com/api/option-chain-equities?symbol=${symbol}`;

                console.log(`[OptionChain Service] Trying old API: ${oldApiUrl}`);

                try {
                    const oldResponse = await fetch(oldApiUrl, {
                        headers: apiHeaders,
                        cache: 'no-store',
                    });

                    if (oldResponse.ok) {
                        const oldData = await oldResponse.json();
                        const recordsExpiries = oldData?.records?.expiryDates || [];

                        if (recordsExpiries.length > 0) {
                            expiryDate = recordsExpiries[0];
                            console.log(`[OptionChain Service] Found nearest expiry via old API: ${expiryDate}`);
                        }
                    } else {
                        console.warn(`[OptionChain Service] Old API returned ${oldResponse.status}`);
                    }
                } catch (oldApiError) {
                    console.warn('[OptionChain Service] Old API failed:', oldApiError);
                }
            }

            // Try method 3: Hardcoded weekly expiry calculation (last resort)
            if (!expiryDate) {
                console.log('[OptionChain Service] Using calculated weekly expiry as last resort');
                const now = new Date();
                const dayOfWeek = now.getDay(); // 0 = Sunday, 4 = Thursday
                const daysUntilThursday = (4 - dayOfWeek + 7) % 7 || 7; // Next Thursday
                const nextThursday = new Date(now.getTime() + daysUntilThursday * 24 * 60 * 60 * 1000);

                const day = nextThursday.getDate().toString().padStart(2, '0');
                const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                const month = monthNames[nextThursday.getMonth()];
                const year = nextThursday.getFullYear();

                expiryDate = `${day}-${month}-${year}`;
                console.log(`[OptionChain Service] Calculated expiry: ${expiryDate}`);
            }
        }

        if (!expiryDate) {
            throw new Error('Could not determine expiry date');
        }
        //
        // NSE expects DD-MMM-YYYY (e.g., 13-Jan-2026)
        let nseExpiryDate = expiryDate;

        // Fix: Ensure date is in DD-MMM-YYYY format
        try {
            if (nseExpiryDate.match(/^\d{2}-\d{2}-\d{4}$/)) {
                // Handle DD-MM-YYYY
                const [d, m, y] = nseExpiryDate.split('-');
                const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                const monthIdx = parseInt(m) - 1;
                if (monthNames[monthIdx]) {
                    nseExpiryDate = `${d}-${monthNames[monthIdx]}-${y}`;
                    console.log(`[OptionChain Service] Converted date ${expiryDate} to ${nseExpiryDate}`);
                }
            } else if (nseExpiryDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
                // Handle YYYY-MM-DD
                const [y, m, d] = nseExpiryDate.split('-');
                const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                const monthIdx = parseInt(m) - 1;
                if (monthNames[monthIdx]) {
                    nseExpiryDate = `${d}-${monthNames[monthIdx]}-${y}`;
                    console.log(`[OptionChain Service] Converted date ${expiryDate} to ${nseExpiryDate}`);
                }
            }
        } catch (e) {
            console.warn('[OptionChain Service] Date conversion failed, using original:', nseExpiryDate);
        }

        // Step 4: Fetch option chain data
        const nseUrl = `https://www.nseindia.com/api/NextApi/apiClient/GetQuoteApi?functionName=getOptionChainData&symbol=${symbol}&params=expiryDate=${nseExpiryDate}`;

        console.log(`[OptionChain Service] Requesting NSE: ${nseUrl}`);
        const response = await fetch(nseUrl, {
            headers: apiHeaders,
            cache: 'no-store',
        });

        if (!response.ok) {
            throw new Error(`NSE API returned ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        // VALIDATION: Check for empty data (same as cron logic)
        if (!data || (data.data && data.data.length === 0 && data.underlyingValue === 0)) {
            console.warn('[OptionChain Service] Received empty option chain data');
            return {
                success: false,
                error: 'Empty option chain data received from NSE'
            };
        }

        // Transform for calculate-pcr (object indexed by strike)
        const optionChain: Record<string, any> = {};
        const dataArray = data?.data || data?.records?.data || [];

        if (Array.isArray(dataArray)) {
            dataArray.forEach((item: any) => {
                if (item && item.strikePrice) {
                    optionChain[item.strikePrice.toString()] = item;
                }
            });
        }

        const spotPrice = data?.underlyingValue || data?.records?.underlyingValue || 0;

        return {
            success: true,
            spotPrice,
            optionChain,
            records: data,
            symbol,
            expiryDate,
            timestamp: new Date().toISOString()
        };

    } catch (error: any) {
        console.error('[OptionChain Service] Error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}
