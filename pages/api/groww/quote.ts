import type { NextApiRequest, NextApiResponse } from 'next';
import { getGrowwAccessToken } from '@/lib/groww-token';

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { exchange, segment, trading_symbol } = req.query;

    if (!exchange || !segment || !trading_symbol) {
        return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Auto-generate token if needed
    const growwToken = await getGrowwAccessToken() || process.env.GROWW_API_TOKEN || '';

    try {
        const url = `https://groww.in/v1/api/stocks_data/v1/tr_live_prices/exchange/${exchange}/segment/${segment}/${trading_symbol}/latest`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'accept': 'application/json, text/plain, */*',
                'authorization': `Bearer ${growwToken}`,
                'cookie': process.env.GROWW_COOKIES || '',
                'referer': 'https://groww.in/stocks/user/explore',
                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
                'x-app-id': 'growwWeb',
                'x-device-id': process.env.GROWW_DEVICE_ID || 'baebee61-e0ef-53bb-991d-2b80fcd66e37',
                'x-device-type': 'desktop',
                'x-platform': 'web',
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Groww API Error (Quote):', response.status, errorText);
            return res.status(response.status).json({
                error: `Groww API returned ${response.status}`,
                details: errorText
            });
        }

        const data = await response.json();
        return res.status(200).json(data);

    } catch (error) {
        console.error('Error fetching quote:', error);
        return res.status(500).json({ error: 'Failed to fetch quote from Groww' });
    }
}
