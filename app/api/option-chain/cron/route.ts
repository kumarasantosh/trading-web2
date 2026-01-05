import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Force dynamic rendering since we use request headers
export const dynamic = 'force-dynamic';

/**
 * Cron job API route that captures option chain data every 3 minutes
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

        // Check if within market hours (9:15 AM - 3:30 PM IST)
        // IST is UTC+5:30
        const now = new Date();
        const utcHours = now.getUTCHours();
        const utcMinutes = now.getUTCMinutes();
        
        // Convert to IST (UTC + 5:30)
        // Create a new date object to handle day overflow properly
        const istDate = new Date(now.getTime() + (5.5 * 60 * 60 * 1000)); // Add 5:30 hours
        let istHours = istDate.getUTCHours();
        let istMinutes = istDate.getUTCMinutes();
        
        // Check if within market hours: 9:15 AM to 3:30 PM IST
        const isWithinMarketHours = 
            (istHours > 9 || (istHours === 9 && istMinutes >= 15)) &&
            (istHours < 15 || (istHours === 15 && istMinutes <= 30));
        
        if (!isWithinMarketHours) {
            console.log(`[CRON] Outside market hours (current IST: ${istHours}:${istMinutes.toString().padStart(2, '0')}), skipping capture`);
            return NextResponse.json({
                success: false,
                message: 'Outside market hours',
                current_ist_time: `${istHours}:${istMinutes.toString().padStart(2, '0')}`,
            });
        }

        // Round DOWN to nearest 3-minute interval for consistent querying
        // This ensures all data captured within the same 3-minute window gets saved with the same timestamp
        const minutes = now.getMinutes();
        const roundedMinutes = Math.floor(minutes / 3) * 3;
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

        // Extract data array from different possible structures
        const dataArray = data?.data || data?.records?.data || [];
        const strikesCount = dataArray.length || 0;
        console.log(`[CRON] Option chain data contains ${strikesCount} strikes for expiry ${expiryDate}`);

        // Calculate total put OI and call OI
        let totalPutOI = 0;
        let totalCallOI = 0;

        if (Array.isArray(dataArray) && dataArray.length > 0) {
            dataArray.forEach((item: any) => {
                if (!item) return;
                
                const ceData = item.CE || {};
                const peData = item.PE || {};
                
                const callOI = Number(ceData.openInterest || 0);
                const putOI = Number(peData.openInterest || 0);

                totalCallOI += callOI;
                totalPutOI += putOI;
            });
        }

        // Calculate PCR (Put Call Ratio)
        const pcr = totalCallOI > 0 ? totalPutOI / totalCallOI : 0;

        console.log(`[CRON] Calculated OI totals: Put OI=${totalPutOI}, Call OI=${totalCallOI}, PCR=${pcr.toFixed(4)}`);

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

        // Save option chain snapshot to database (use upsert to handle duplicates)
        const { error: snapshotError } = await supabaseAdmin
            .from('option_chain_snapshots')
            .upsert({
                symbol,
                expiry_date: expiryDateForStorage,
                captured_at: capturedAt,
                nifty_spot: niftySpot,
                option_chain_data: data,
            }, {
                onConflict: 'symbol,expiry_date,captured_at',
                ignoreDuplicates: false, // Update if exists
            });

        if (snapshotError) {
            console.error('[CRON] Database error saving snapshot:', snapshotError);
            // Check if it's a constraint violation (duplicate) - this is acceptable
            const isDuplicate = snapshotError.code === '23505' || snapshotError.message?.includes('duplicate') || snapshotError.message?.includes('unique');
            if (isDuplicate) {
                console.log('[CRON] Snapshot already exists for this timestamp, continuing...');
            } else {
                return NextResponse.json(
                    { error: 'Failed to save snapshot', details: snapshotError.message, code: snapshotError.code },
                    { status: 500 }
                );
            }
        } else {
            console.log('[CRON] Option chain snapshot saved successfully');
        }

        // Save OI trendline data to database (use upsert to handle duplicates)
        const { error: trendlineError } = await supabaseAdmin
            .from('oi_trendline')
            .upsert({
                symbol,
                expiry_date: expiryDateForStorage,
                captured_at: capturedAt,
                total_put_oi: totalPutOI,
                total_call_oi: totalCallOI,
                pcr: pcr,
                nifty_spot: niftySpot,
            }, {
                onConflict: 'symbol,expiry_date,captured_at',
                ignoreDuplicates: false, // Update if exists
            });

        if (trendlineError) {
            console.error('[CRON] Database error saving trendline:', trendlineError);
            // Check if it's a constraint violation (duplicate) - this is acceptable
            const isDuplicate = trendlineError.code === '23505' || trendlineError.message?.includes('duplicate') || trendlineError.message?.includes('unique');
            if (isDuplicate) {
                console.log('[CRON] Trendline data already exists for this timestamp, continuing...');
            } else {
                console.error('[CRON] Non-duplicate error saving trendline, but continuing...');
            }
        } else {
            console.log(`[CRON] OI trendline data saved: Put OI=${totalPutOI}, Call OI=${totalCallOI}`);
        }

        console.log(`[CRON] Option chain capture complete at ${capturedAt}`);

        return NextResponse.json({
            success: true,
            captured_at: capturedAt,
            symbol,
            expiry_date: expiryDateForStorage,
            nifty_spot: niftySpot,
            total_put_oi: totalPutOI,
            total_call_oi: totalCallOI,
            pcr: pcr,
        });

    } catch (error) {
        console.error('[CRON] Fatal error:', error);
        return NextResponse.json(
            { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}


