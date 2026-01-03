import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering since we use searchParams
export const dynamic = 'force-dynamic';

/**
 * API route to fetch NSE option chain data
 * GET /api/option-chain?symbol=NIFTY&expiryDate=06-Jan-2026
 */
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const symbol = searchParams.get('symbol') || 'NIFTY';
        const expiryDate = searchParams.get('expiryDate') || '';

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
            // Fallback: try to parse set-cookie header
            const setCookieHeader = homeResponse.headers.get('set-cookie') || '';
            if (setCookieHeader) {
                allCookies = setCookieHeader.split(',').map(c => c.trim().split(';')[0]).join('; ');
            }
        }
        
        // Step 2: Visit the actual option chain page to establish session
        // Use the correct URL format: /get-quote/optionchain/SYMBOL/SYMBOL-50
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
            
            // Update cookies from page visit
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
        
        console.log('Session established, cookies:', {
            cookieCount: cookieHeaders.length + pageCookieHeaders.length,
            hasCookies: !!allCookies,
            cookieLength: allCookies.length
        });
        
        // Use the exact API endpoint format as provided
        // Format expiry date: convert "06-01-2026" to "06-Jan-2026" if needed
        let formattedExpiry = expiryDate || '06-Jan-2026';
        if (formattedExpiry && /^\d{2}-\d{2}-\d{4}$/.test(formattedExpiry)) {
            // Convert DD-MM-YYYY to DD-MMM-YYYY
            const [day, month, year] = formattedExpiry.split('-');
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            formattedExpiry = `${day}-${months[parseInt(month) - 1]}-${year}`;
        }
        
        // Build URL exactly as NSE expects it (no URL encoding for params)
        const url = `https://www.nseindia.com/api/NextApi/apiClient/GetQuoteApi?functionName=getOptionChainData&symbol=${symbol}&params=expiryDate=${formattedExpiry}`;
        
        console.log('Calling NSE API:', url);
        
        // Make the API call with proper headers matching browser request
        const response = await fetch(url, {
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
            },//thi si  a test
            cache: 'no-store',
        });

        if (!response.ok) {
            let errorText = '';
            let errorData = null;
            try {
                errorText = await response.text();
                // Try to parse as JSON
                try {
                    errorData = JSON.parse(errorText);
                } catch (e) {
                    // Not JSON, use as text
                }
            } catch (e) {
                errorText = 'Unable to read error response';
            }
            
            console.error('NSE API Error:', {
                status: response.status,
                statusText: response.statusText,
                errorText: errorText.substring(0, 500),
                errorData
            });
            
            // If it's a 404, it might be that NSE is blocking the request
            // or the endpoint/parameters are wrong
            if (response.status === 404) {
                return NextResponse.json(
                    { 
                        error: 'NSE API returned 404. This might indicate: 1) Invalid expiry date format, 2) NSE blocking server requests, 3) Endpoint changed. Try without expiry date or check the format.',
                        status: response.status,
                        details: errorData || errorText.substring(0, 200),
                        suggestion: 'Try accessing the option chain page in your browser first to establish a session, then retry.'
                    },
                    { status: 502 }
                );
            }
            
            return NextResponse.json(
                { 
                    error: `Failed to fetch option chain data: ${response.statusText}`,
                    status: response.status,
                    details: errorData || errorText.substring(0, 200)
                },
                { status: response.status }
            );
        }

        let data;
        try {
            data = await response.json();
        } catch (e) {
            const text = await response.text();
            console.error('Failed to parse JSON:', text.substring(0, 500));
            return NextResponse.json(
                { error: 'Invalid JSON response from NSE API', details: text.substring(0, 200) },
                { status: 502 }
            );
        }
        
        // Log the structure for debugging
        console.log('NSE API Response structure:', {
            hasRecords: !!data.records,
            hasData: !!data.data,
            keys: Object.keys(data || {}),
            recordsKeys: data.records ? Object.keys(data.records) : null,
            recordsDataType: data.records?.data ? (Array.isArray(data.records.data) ? 'array' : typeof data.records.data) : 'none',
            recordsDataLength: Array.isArray(data.records?.data) ? data.records.data.length : 'N/A',
            responseSize: JSON.stringify(data).length,
        });
        
        // Check if response is empty or has error
        if (!data || (Object.keys(data).length === 0)) {
            console.error('Empty response from NSE API');
            return NextResponse.json(
                { error: 'Empty response from NSE API. The API might be rate-limited or require authentication. Try accessing https://www.nseindia.com/option-chain in your browser first.' },
                { status: 502 }
            );
        }
        
        // Check if records.data is empty
        if (data.records && Array.isArray(data.records.data) && data.records.data.length === 0) {
            console.warn('NSE API returned empty data array. This might be due to:');
            console.warn('1. Market is closed');
            console.warn('2. Invalid symbol or expiry date');
            console.warn('3. Rate limiting or authentication issues');
            console.warn('4. NSE API structure might have changed');
        }
        
        return NextResponse.json(data);

    } catch (error: any) {
        console.error('Option Chain API Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch option chain data', details: error.message },
            { status: 500 }
        );
    }
}

