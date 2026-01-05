import type { NextApiRequest, NextApiResponse } from 'next';

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

    try {
        // First, establish session by visiting BSE homepage
        const homeResponse = await fetch('https://www.bseindia.com/', {
            headers: {
                'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'accept-language': 'en-US,en;q=0.9',
                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
                'referer': 'https://www.google.com/',
            },
        });

        // Extract cookies
        let cookies = '';
        const cookieHeaders = homeResponse.headers.getSetCookie?.() || [];
        if (cookieHeaders.length > 0) {
            cookies = cookieHeaders.map(cookie => cookie.split(';')[0]).join('; ');
        } else {
            const setCookieHeader = homeResponse.headers.get('set-cookie') || '';
            if (setCookieHeader) {
                cookies = setCookieHeader.split(',').map(c => c.trim().split(';')[0]).join('; ');
            }
        }

        // Try BSE API endpoint for indices
        const apiUrl = 'https://www.bseindia.com/api/webdata/Index_Display?type=indices';
        const response = await fetch(apiUrl, {
            headers: {
                'accept': 'application/json, text/plain, */*',
                'accept-language': 'en-US,en;q=0.9',
                'referer': 'https://www.bseindia.com/indices/IndexDetail.html',
                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
                'cookie': cookies,
            },
        });

        if (!response.ok) {
            console.error('BSE API request failed:', response.status, response.statusText);
            // Return empty data structure
            return res.status(200).json({
                data: []
            });
        }

        const data = await response.json();
        console.log('[BSE API] Raw response:', JSON.stringify(data).substring(0, 500));

        // BSE API returns data in different formats, try to normalize it
        let indicesData: any[] = [];

        if (Array.isArray(data)) {
            indicesData = data;
        } else if (data.data && Array.isArray(data.data)) {
            indicesData = data.data;
        } else if (data.Index_Display && Array.isArray(data.Index_Display)) {
            indicesData = data.Index_Display;
        } else if (typeof data === 'object') {
            // Try to extract arrays from the object
            Object.values(data).forEach((value: any) => {
                if (Array.isArray(value)) {
                    indicesData = [...indicesData, ...value];
                }
            });
        }

        console.log('[BSE API] Parsed indices count:', indicesData.length);

        // Return the full response
        return res.status(200).json({
            data: indicesData
        });

    } catch (error) {
        console.error('Error in BSE indices handler:', error);
        // Return empty structure instead of error
        return res.status(200).json({
            data: []
        });
    }
}

