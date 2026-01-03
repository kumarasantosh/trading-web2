import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Force dynamic rendering since we use request headers
export const dynamic = 'force-dynamic';

/**
 * Cron job API route that captures option chain data every 5 minutes
 * Runs during market hours (9:15 AM - 3:30 PM IST, Mon-Fri)
 * 
 * Security: Validates CRON_SECRET to prevent unauthorized access
 */
export async function GET(request: NextRequest) {
    try {
        // Validate cron secret for security
        const authHeader = request.headers.get('authorization');
        const cronSecret = process.env.CRON_SECRET;

        if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
            console.error('Unauthorized cron request');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Round DOWN to nearest 5-minute interval for consistent querying
        // This ensures all data captured within the same 5-minute window (e.g., 12:40-12:44)
        // gets saved with the same timestamp (12:40:00), making it easy to query with the slider
        const now = new Date();
        const minutes = now.getMinutes();
        const roundedMinutes = Math.floor(minutes / 5) * 5;
        const roundedTime = new Date(now);
        roundedTime.setMinutes(roundedMinutes, 0, 0); // Set seconds and milliseconds to 0
        const capturedAt = roundedTime.toISOString();
        console.log(`[CRON] Starting option chain data capture at ${capturedAt} (rounded from ${now.toISOString()})`);

        // Default to NIFTY
        const symbol = 'NIFTY';

        // Helper function to establish NSE session and get cookies
        const establishSession = async () => {
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
                console.warn('[CRON] Failed to visit option chain page, continuing anyway:', pageError);
            }
            
            // Small delay to ensure session is established
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            return { allCookies, optionChainPageUrl };
        };

        // Establish session
        const { allCookies, optionChainPageUrl } = await establishSession();

        // Fetch available expiry dates first
        const dropdownUrl = `https://www.nseindia.com/api/NextApi/apiClient/GetQuoteApi?functionName=getOptionChainDropdown&symbol=${symbol}`;
        const dropdownResponse = await fetch(dropdownUrl, {
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
            },
            cache: 'no-store',
        });

        if (!dropdownResponse.ok) {
            throw new Error(`Failed to fetch expiry dates: ${dropdownResponse.status}`);
        }

        const dropdownData = await dropdownResponse.json();
        
        // Extract expiry dates
        let expiries: string[] = [];
        if (dropdownData && Array.isArray(dropdownData)) {
            expiries = dropdownData;
        } else if (dropdownData?.expiryDates && Array.isArray(dropdownData.expiryDates)) {
            expiries = dropdownData.expiryDates;
        } else if (dropdownData?.data && Array.isArray(dropdownData.data)) {
            expiries = dropdownData.data;
        } else if (dropdownData?.records?.expiryDates && Array.isArray(dropdownData.records.expiryDates)) {
            expiries = dropdownData.records.expiryDates;
        }

        if (expiries.length === 0) {
            throw new Error('No expiry dates found');
        }

        // Use the first expiry (nearest expiry) - it's in DD-MMM-YYYY format
        const expiryDate = expiries[0];

        // Fetch option chain data from NSE using the actual expiry date
        const nseUrl = `https://www.nseindia.com/api/NextApi/apiClient/GetQuoteApi?functionName=getOptionChainData&symbol=${symbol}&params=expiryDate=${expiryDate}`;
        
        const response = await fetch(nseUrl, {
            headers: {
                'Accept': '*/*',
                'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8,be;q=0.7,te;q=0.6',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
                'Referer': optionChainPageUrl,
                'Origin': 'https://www.nseindia.com',
                'Cookie': allCookies,
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'same-origin',
            },
            cache: 'no-store',
        });

        if (!response.ok) {
            throw new Error(`NSE API returned ${response.status}`);
        }

        const data = await response.json();

        // Validate that we got actual data
        if (!data || (data.data && data.data.length === 0 && data.underlyingValue === 0)) {
            console.warn('[CRON] Received empty option chain data, skipping save');
            return NextResponse.json({
                success: false,
                error: 'Empty option chain data received from NSE',
                captured_at: capturedAt,
            });
        }

        // Extract NIFTY spot price from the data
        const niftySpot = data?.underlyingValue || data?.records?.underlyingValue || null;

        // Check how many strikes are in the data
        const strikesCount = data?.data?.length || data?.records?.data?.length || 0;
        console.log(`[CRON] Option chain data contains ${strikesCount} strikes for expiry ${expiryDate}`);

        // Convert expiry date from DD-MMM-YYYY to DD-MM-YYYY for storage
        const monthMap: { [key: string]: string } = {
            'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
            'may': '05', 'jun': '06', 'jul': '07', 'aug': '08',
            'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
        };
        
        let expiryDateForStorage = expiryDate;
        const mmmFormatMatch = expiryDate.match(/^(\d{2})-([A-Za-z]{3})-(\d{4})$/);
        if (mmmFormatMatch) {
            const [, day, month, year] = mmmFormatMatch;
            const monthNum = monthMap[month.toLowerCase()];
            if (monthNum) {
                expiryDateForStorage = `${day}-${monthNum}-${year}`;
            }
        }

        console.log(`[CRON] Saving snapshot: symbol=${symbol}, expiry=${expiryDateForStorage}, strikes=${strikesCount}, nifty_spot=${niftySpot}`);

        // Save to database
        const { error } = await supabaseAdmin
            .from('option_chain_snapshots')
            .insert({
                symbol,
                expiry_date: expiryDateForStorage,
                captured_at: capturedAt,
                nifty_spot: niftySpot,
                option_chain_data: data,
            });

        if (error) {
            console.error('[CRON] Database error:', error);
            return NextResponse.json(
                { error: 'Failed to save snapshot', details: error.message },
                { status: 500 }
            );
        }

        console.log(`[CRON] Option chain capture complete at ${capturedAt}`);

        return NextResponse.json({
            success: true,
            captured_at: capturedAt,
            symbol,
            expiry_date: expiryDateForStorage,
            nifty_spot: niftySpot,
        });

    } catch (error) {
        console.error('[CRON] Fatal error:', error);
        return NextResponse.json(
            { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}


