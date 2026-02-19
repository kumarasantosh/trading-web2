import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * API route to fetch available expiry dates from NSE dropdown
 * GET /api/option-chain/expiries?symbol=NIFTY
 */
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const symbol = searchParams.get('symbol') || 'NIFTY';

        // NSE requires proper session establishment
        // Step 1: Visit homepage to get initial cookies
        const homeResponse = await fetch('https://www.nseindia.com/', {
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
                'Referer': 'https://www.google.com/',
            },
        });

        // Extract cookies from response headers
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

        // Step 2: Visit the actual option chain page to establish session
        const optionChainPageUrl = `https://www.nseindia.com/get-quote/optionchain/${symbol}/${symbol}-50`;
        let pageCookieHeaders: string[] = [];

        try {
            const pageResponse = await fetch(optionChainPageUrl, {
                headers: {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
                    'Referer': 'https://www.nseindia.com/',
                    'Cookie': allCookies,
                },
            });

            pageCookieHeaders = pageResponse.headers.getSetCookie?.() || [];
            if (pageCookieHeaders.length > 0) {
                const pageCookies = pageCookieHeaders.map(cookie => cookie.split(';')[0]).join('; ');
                allCookies = allCookies ? `${allCookies}; ${pageCookies}` : pageCookies;
            }
        } catch (pageError) {
            console.warn('Failed to visit option chain page, continuing anyway:', pageError);
        }

        // Small delay to ensure session is established
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Fetch expiry dates from dropdown API
        const dropdownUrl = `https://www.nseindia.com/api/NextApi/apiClient/GetQuoteApi?functionName=getOptionChainDropdown&symbol=${symbol}`;

        const response = await fetch(dropdownUrl, {
            headers: {
                'Accept': '*/*',
                'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8,be;q=0.7,te;q=0.6',
                'Accept-Encoding': 'gzip, deflate, br, zstd',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
                'Referer': optionChainPageUrl,
                'Origin': 'https://www.nseindia.com',
                'Cookie': allCookies,
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'same-origin',
                'Sec-CH-UA': '"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
                'Sec-CH-UA-Mobile': '?0',
                'Sec-CH-UA-Platform': '"macOS"',
            },
            cache: 'no-store',
        });

        if (!response.ok) {
            return NextResponse.json(
                { error: `Failed to fetch expiry dates: ${response.statusText}` },
                { status: response.status }
            );
        }

        const data = await response.json();

        // Extract expiry dates from the response
        // The response structure may vary, so we need to handle different formats
        let expiries: string[] = [];

        if (data && Array.isArray(data)) {
            expiries = data;
        } else if (data?.expiryDates && Array.isArray(data.expiryDates)) {
            expiries = data.expiryDates;
        } else if (data?.data && Array.isArray(data.data)) {
            expiries = data.data;
        } else if (data?.records?.expiryDates && Array.isArray(data.records.expiryDates)) {
            expiries = data.records.expiryDates;
        }

        // Convert dates from DD-MMM-YYYY to DD-MM-YYYY format
        const monthMap: { [key: string]: string } = {
            'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
            'may': '05', 'jun': '06', 'jul': '07', 'aug': '08',
            'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
        };

        const convertedExpiries = expiries.map(expiry => {
            // Check if date is in DD-MMM-YYYY format (e.g., "06-Jan-2026")
            const mmmFormatMatch = expiry.match(/^(\d{2})-([A-Za-z]{3})-(\d{4})$/);
            if (mmmFormatMatch) {
                const [, day, month, year] = mmmFormatMatch;
                const monthNum = monthMap[month.toLowerCase()];
                if (monthNum) {
                    return `${day}-${monthNum}-${year}`;
                }
            }
            // If already in DD-MM-YYYY format, return as is
            return expiry;
        });

        return NextResponse.json({ expiries: convertedExpiries });

    } catch (error: any) {
        console.error('Expiry Dates API Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch expiry dates', details: error.message },
            { status: 500 }
        );
    }
}

