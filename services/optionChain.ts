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
            const dropdownUrl = `https://www.nseindia.com/api/NextApi/apiClient/GetQuoteApi?functionName=getOptionChainDropdown&symbol=${symbol}`;
            const dropdownResponse = await fetch(dropdownUrl, {
                headers: apiHeaders,
                cache: 'no-store',
            });

            if (dropdownResponse.ok) {
                const dropdownData = await dropdownResponse.json();
                let expiries: string[] = [];
                // Handle various response structures
                if (dropdownData && Array.isArray(dropdownData)) expiries = dropdownData;
                else if (dropdownData?.expiryDates) expiries = dropdownData.expiryDates;
                else if (dropdownData?.data) expiries = dropdownData.data; // Added from cron logic

                if (expiries.length > 0) {
                    expiryDate = expiries[0];
                    console.log(`[OptionChain Service] Found nearest expiry: ${expiryDate}`);
                }
            }
        }

        if (!expiryDate) {
            throw new Error('Could not determine expiry date');
        }

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
