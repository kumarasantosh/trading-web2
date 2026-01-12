import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Handle GET requests for option chain data
 * GET /api/option-chain?symbol=NIFTY&expiryDate=13-Jan-2026
 */
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const symbol = searchParams.get('symbol') || 'NIFTY';
        let expiryDate = searchParams.get('expiryDate');

        console.log(`[OptionChain API] Fetching for symbol: ${symbol}, expiry: ${expiryDate || 'nearest'}`);

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

        // Step 2: Visit the actual option chain page to establish session
        const optionChainPageUrl = `https://www.nseindia.com/get-quote/optionchain/${symbol}/${symbol === 'NIFTY' ? 'NIFTY-50' : symbol}`;
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

            const pageCookies = pageResponse.headers.getSetCookie?.() || [];
            if (pageCookies.length > 0) {
                const combinedCookies = pageCookies.map(cookie => cookie.split(';')[0]).join('; ');
                allCookies = allCookies ? `${allCookies}; ${combinedCookies}` : combinedCookies;
            }
        } catch (pageError) {
            console.warn('[OptionChain API] Page visit failed:', pageError);
        }

        // Small delay
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Step 3: If no expiryDate provided, fetch first available expiry
        if (!expiryDate) {
            const dropdownUrl = `https://www.nseindia.com/api/NextApi/apiClient/GetQuoteApi?functionName=getOptionChainDropdown&symbol=${symbol}`;
            const dropdownResponse = await fetch(dropdownUrl, {
                headers: {
                    'Accept': '*/*',
                    'Accept-Language': 'en-IN,en;q=0.9',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
                    'Referer': optionChainPageUrl,
                    'Cookie': allCookies,
                }
            });

            if (dropdownResponse.ok) {
                const dropdownData = await dropdownResponse.json();
                let expiries: string[] = [];
                if (dropdownData && Array.isArray(dropdownData)) expiries = dropdownData;
                else if (dropdownData?.expiryDates) expiries = dropdownData.expiryDates;

                if (expiries.length > 0) {
                    expiryDate = expiries[0];
                    console.log(`[OptionChain API] Found nearest expiry: ${expiryDate}`);
                }
            }
        }

        if (!expiryDate) {
            throw new Error('Could not determine expiry date');
        }

        // NSE expects DD-MMM-YYYY (e.g., 13-Jan-2026)
        // If frontend sends DD-MM-YYYY (e.g., 13-01-2026), convert it
        let nseExpiryDate = expiryDate;
        const mmFormatMatch = expiryDate.match(/^(\d{2})-(\d{2})-(\d{4})$/);
        if (mmFormatMatch) {
            const [, day, month, year] = mmFormatMatch;
            const reverseMonthMap: { [key: string]: string } = {
                '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr',
                '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Aug',
                '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec'
            };
            const monthName = reverseMonthMap[month];
            if (monthName) {
                nseExpiryDate = `${day}-${monthName}-${year}`;
                console.log(`[OptionChain API] Converted ${expiryDate} to NSE format: ${nseExpiryDate}`);
            }
        }

        // Step 4: Fetch option chain data using new URL
        const nseUrl = `https://www.nseindia.com/api/NextApi/apiClient/GetQuoteApi?functionName=getOptionChainData&symbol=${symbol}&params=expiryDate=${nseExpiryDate}`;

        console.log(`[OptionChain API] Requesting NSE: ${nseUrl}`);
        const response = await fetch(nseUrl, {
            headers: {
                'Accept': '*/*',
                'Accept-Language': 'en-IN,en;q=0.9',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
                'Referer': optionChainPageUrl,
                'Cookie': allCookies,
                'Origin': 'https://www.nseindia.com',
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'same-origin',
            },
            cache: 'no-store',
        });

        if (!response.ok) {
            throw new Error(`NSE API returned ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

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

        return NextResponse.json({
            success: true,
            spotPrice,
            optionChain, // For PCR calculation
            records: data, // For app/option-chain/page.tsx
            symbol,
            expiryDate,
            timestamp: new Date().toISOString()
        });

    } catch (error: any) {
        console.error('[OptionChain API] Error:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
