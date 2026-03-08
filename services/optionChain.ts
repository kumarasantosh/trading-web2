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

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
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

const NSE_COMMON_HEADERS = {
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

const BSE_HEADERS = {
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Referer': 'https://www.bseindia.com/markets/Derivatives/DeriReports/DeriOptionchain.html',
    'Origin': 'https://www.bseindia.com',
    'sec-fetch-site': 'same-site',
    'sec-fetch-mode': 'cors',
};

const BSE_SENSEX_SCRIP_CODE = '1';
const BSE_PRODUCT_TYPE = 'IO';

type ParsedExpiryParts = {
    day: string;
    monthNum: string;
    monthShort: string;
    year: string;
};

function parseNumber(value: any): number {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (value === null || value === undefined) return 0;
    const normalized = String(value).replace(/,/g, '').trim();
    if (!normalized) return 0;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
}

function parseExpiryParts(expiry?: string | null): ParsedExpiryParts | null {
    if (!expiry) return null;

    const raw = decodeURIComponent(expiry).replace(/\+/g, ' ').trim();
    if (!raw) return null;

    const ddMmYyyy = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (ddMmYyyy) {
        const [, d, m, y] = ddMmYyyy;
        const monthIdx = Number(m) - 1;
        if (monthIdx >= 0 && monthIdx < MONTH_NAMES.length) {
            return {
                day: d.padStart(2, '0'),
                monthNum: m.padStart(2, '0'),
                monthShort: MONTH_NAMES[monthIdx],
                year: y,
            };
        }
    }

    const yyyyMmDd = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (yyyyMmDd) {
        const [, y, m, d] = yyyyMmDd;
        const monthIdx = Number(m) - 1;
        if (monthIdx >= 0 && monthIdx < MONTH_NAMES.length) {
            return {
                day: d.padStart(2, '0'),
                monthNum: m.padStart(2, '0'),
                monthShort: MONTH_NAMES[monthIdx],
                year: y,
            };
        }
    }

    const ddMmmYyyy = raw.match(/^(\d{1,2})[-\s]([A-Za-z]{3})[-\s](\d{4})$/);
    if (ddMmmYyyy) {
        const [, d, mon, y] = ddMmmYyyy;
        const monthNum = MONTH_MAP[mon.toUpperCase()];
        if (monthNum) {
            const monthShort = MONTH_NAMES[Number(monthNum) - 1];
            return {
                day: d.padStart(2, '0'),
                monthNum,
                monthShort,
                year: y,
            };
        }
    }

    return null;
}

function toDdMmYyyy(expiry?: string | null): string | null {
    const parts = parseExpiryParts(expiry);
    if (!parts) return null;
    return `${parts.day}-${parts.monthNum}-${parts.year}`;
}

function toDdMmmYyyy(expiry?: string | null): string | null {
    const parts = parseExpiryParts(expiry);
    if (!parts) return null;
    return `${parts.day}-${parts.monthShort}-${parts.year}`;
}

function toBseExpiryFormat(expiry?: string | null): string | null {
    const parts = parseExpiryParts(expiry);
    if (!parts) return null;
    return `${parts.day} ${parts.monthShort} ${parts.year}`;
}

function buildOptionChainObject(rows: any[]): Record<string, any> {
    const optionChain: Record<string, any> = {};
    rows.forEach((item: any) => {
        if (item && item.strikePrice) {
            optionChain[item.strikePrice.toString()] = item;
        }
    });
    return optionChain;
}

async function fetchSensexExpiriesFromBse(): Promise<string[]> {
    const expiryUrl = new URL('https://api.bseindia.com/BseIndiaAPI/api/ddlExpiry_IV/w');
    expiryUrl.searchParams.set('ProductType', BSE_PRODUCT_TYPE);
    expiryUrl.searchParams.set('scrip_cd', BSE_SENSEX_SCRIP_CODE);

    const response = await fetch(expiryUrl.toString(), {
        headers: BSE_HEADERS,
        cache: 'no-store',
    });

    if (!response.ok) {
        throw new Error(`BSE expiry API returned ${response.status}: ${response.statusText}`);
    }

    const payload = await response.json();
    const table1 = Array.isArray(payload?.Table1) ? payload.Table1 : [];
    const expiries = table1
        .map((item: any) => String(item?.ExpiryDate || '').trim())
        .filter(Boolean);

    return Array.from(new Set(expiries));
}

export async function fetchSensexExpiries(): Promise<string[]> {
    const expiries = await fetchSensexExpiriesFromBse();
    const normalized = expiries
        .map((expiry) => toDdMmYyyy(expiry) || expiry)
        .filter(Boolean);

    return Array.from(new Set(normalized));
}

async function fetchSensexOptionChainData(expiryDate?: string | null): Promise<OptionChainResponse> {
    try {
        console.log(`[OptionChain Service] Fetching BSE SENSEX option chain, expiry: ${expiryDate || 'nearest'}`);

        let bseExpiry = toBseExpiryFormat(expiryDate);
        if (!bseExpiry) {
            const expiries = await fetchSensexExpiriesFromBse();
            bseExpiry = expiries[0] || null;
        }

        if (!bseExpiry) {
            throw new Error('Could not determine BSE expiry date for SENSEX');
        }

        const expiryDdMm = toDdMmYyyy(bseExpiry) || toDdMmYyyy(expiryDate) || '';
        const expiryDdMmm = toDdMmmYyyy(bseExpiry) || toDdMmmYyyy(expiryDate) || bseExpiry.replace(/\s+/g, '-');

        const dataUrl = new URL('https://api.bseindia.com/BseIndiaAPI/api/DerivOptionChain_IV/w');
        dataUrl.searchParams.set('Expiry', bseExpiry);
        dataUrl.searchParams.set('scrip_cd', BSE_SENSEX_SCRIP_CODE);
        dataUrl.searchParams.set('strprice', '0');

        const response = await fetch(dataUrl.toString(), {
            headers: BSE_HEADERS,
            cache: 'no-store',
        });

        if (!response.ok) {
            throw new Error(`BSE option chain API returned ${response.status}: ${response.statusText}`);
        }

        const payload = await response.json();
        const tableRows = Array.isArray(payload?.Table) ? payload.Table : [];

        if (tableRows.length === 0) {
            return {
                success: false,
                error: 'Empty option chain data received from BSE',
            };
        }

        const transformedRows = tableRows
            .map((row: any) => {
                const strikePrice = parseNumber(row?.Strike_Price1 || row?.Strike_Price);
                if (strikePrice <= 0) return null;

                return {
                    strikePrice,
                    expiryDate: expiryDdMm || (toDdMmYyyy(row?.End_TimeStamp) || ''),
                    CE: {
                        openInterest: parseNumber(row?.C_Open_Interest),
                        changeinOpenInterest: parseNumber(row?.C_Absolute_Change_OI),
                        totalTradedVolume: parseNumber(row?.C_Vol_Traded),
                        impliedVolatility: parseNumber(row?.C_IV),
                        lastPrice: parseNumber(row?.C_Last_Trd_Price),
                        change: parseNumber(row?.C_NetChange),
                        bidQty: parseNumber(row?.C_BIdQty),
                        bidprice: parseNumber(row?.C_BidPrice),
                        askPrice: parseNumber(row?.C_OfferPrice),
                        askQty: parseNumber(row?.C_OfferQty),
                    },
                    PE: {
                        openInterest: parseNumber(row?.Open_Interest),
                        changeinOpenInterest: parseNumber(row?.Absolute_Change_OI),
                        totalTradedVolume: parseNumber(row?.Vol_Traded),
                        impliedVolatility: parseNumber(row?.IV),
                        lastPrice: parseNumber(row?.Last_Trd_Price),
                        change: parseNumber(row?.NetChange),
                        bidQty: parseNumber(row?.BIdQty),
                        bidprice: parseNumber(row?.BidPrice),
                        askPrice: parseNumber(row?.OfferPrice),
                        askQty: parseNumber(row?.OfferQty),
                    },
                };
            })
            .filter(Boolean);

        if (transformedRows.length === 0) {
            return {
                success: false,
                error: 'No valid strikes found in BSE option chain data',
            };
        }

        const spotPrice =
            parseNumber(tableRows[0]?.UlaValue) ||
            parseNumber(payload?.Table2?.[0]?.UlaValue);

        const records = {
            underlyingValue: spotPrice,
            expiryDates: expiryDdMm ? [expiryDdMm] : [],
            timestamp: payload?.ASON?.DT_TM || new Date().toISOString(),
            data: transformedRows,
            source: 'BSE',
        };

        return {
            success: true,
            spotPrice,
            optionChain: buildOptionChainObject(transformedRows),
            records,
            symbol: 'SENSEX',
            expiryDate: expiryDdMmm,
            timestamp: new Date().toISOString(),
        };
    } catch (error: any) {
        console.error('[OptionChain Service] BSE SENSEX error:', error);
        return {
            success: false,
            error: error.message,
        };
    }
}

/**
 * Service to fetch option chain data from NSE/BSE
 * Used by:
 * - /api/option-chain (Frontend API)
 * - /api/cron/option-chain-cron (Data collection)
 * - /api/cron/calculate-pcr (PCR calculation)
 */
export async function fetchOptionChainData(symbol: string, expiryDate?: string | null): Promise<OptionChainResponse> {
    try {
        const normalizedSymbol = symbol.trim().toUpperCase();
        console.log(`[OptionChain Service] Fetching for symbol: ${normalizedSymbol}, expiry: ${expiryDate || 'nearest'}`);

        if (normalizedSymbol === 'SENSEX') {
            return fetchSensexOptionChainData(expiryDate);
        }

        // Helper function to establish NSE session and get cookies
        const establishSession = async () => {
            // Step 1: Visit homepage to get initial cookies
            const homeResponse = await fetch('https://www.nseindia.com', {
                headers: NSE_COMMON_HEADERS,
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
                        ...NSE_COMMON_HEADERS,
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
            ...NSE_COMMON_HEADERS,
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
            const dropdownUrl = `https://www.nseindia.com/api/NextApi/apiClient/GetQuoteApi?functionName=getOptionChainDropdown&symbol=${normalizedSymbol}`;
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
                const isIndex = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'NIFTYIT', 'MIDCPNIFTY'].includes(normalizedSymbol);
                const oldApiUrl = isIndex
                    ? `https://www.nseindia.com/api/option-chain-indices?symbol=${normalizedSymbol}`
                    : `https://www.nseindia.com/api/option-chain-equities?symbol=${normalizedSymbol}`;

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
                const month = MONTH_NAMES[nextThursday.getMonth()];
                const year = nextThursday.getFullYear();

                expiryDate = `${day}-${month}-${year}`;
                console.log(`[OptionChain Service] Calculated expiry: ${expiryDate}`);
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
                const monthIdx = parseInt(m) - 1;
                if (MONTH_NAMES[monthIdx]) {
                    nseExpiryDate = `${d}-${MONTH_NAMES[monthIdx]}-${y}`;
                    console.log(`[OptionChain Service] Converted date ${expiryDate} to ${nseExpiryDate}`);
                }
            } else if (nseExpiryDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
                // Handle YYYY-MM-DD
                const [y, m, d] = nseExpiryDate.split('-');
                const monthIdx = parseInt(m) - 1;
                if (MONTH_NAMES[monthIdx]) {
                    nseExpiryDate = `${d}-${MONTH_NAMES[monthIdx]}-${y}`;
                    console.log(`[OptionChain Service] Converted date ${expiryDate} to ${nseExpiryDate}`);
                }
            }
        } catch (e) {
            console.warn('[OptionChain Service] Date conversion failed, using original:', nseExpiryDate);
        }

        // Step 4: Fetch option chain data
        const nseUrl = `https://www.nseindia.com/api/NextApi/apiClient/GetQuoteApi?functionName=getOptionChainData&symbol=${normalizedSymbol}&params=expiryDate=${nseExpiryDate}`;

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
        const dataArray = data?.data || data?.records?.data || [];

        const spotPrice = data?.underlyingValue || data?.records?.underlyingValue || 0;

        return {
            success: true,
            spotPrice,
            optionChain: buildOptionChainObject(Array.isArray(dataArray) ? dataArray : []),
            records: data,
            symbol: normalizedSymbol,
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
