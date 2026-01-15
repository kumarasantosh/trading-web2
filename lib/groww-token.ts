import crypto from 'crypto';

/**
 * Generate SHA-256 checksum for Groww API authentication
 */
function generateChecksum(secret: string, timestamp: string): string {
    const input = secret + timestamp;
    return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * Token cache to avoid regenerating on every request
 */
let cachedToken: { token: string; expiry: number } | null = null;

/**
 * Get Groww API access token - generates automatically using API Key and Secret
 * Token is cached and refreshed when expired
 */
export async function getGrowwAccessToken(): Promise<string | null> {
    // Check if we have a valid cached token (with 5 min buffer)
    if (cachedToken && Date.now() < cachedToken.expiry - 5 * 60 * 1000) {
        return cachedToken.token;
    }

    const apiKey = process.env.GROWW_API_KEY;
    const apiSecret = process.env.GROWW_API_SECRET;

    if (!apiKey || !apiSecret) {
        console.error('[GROWW-TOKEN] Missing GROWW_API_KEY or GROWW_API_SECRET');
        return null;
    }

    try {
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const checksum = generateChecksum(apiSecret, timestamp);

        const response = await fetch('https://api.groww.in/v1/token/api/access', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                key_type: 'approval',
                checksum: checksum,
                timestamp: timestamp,
            }),
        });

        if (!response.ok) {
            console.error(`[GROWW-TOKEN] Failed to get token: ${response.status}`);
            return null;
        }

        const data = await response.json();

        if (data.token && data.active) {
            // Cache the token with expiry
            cachedToken = {
                token: data.token,
                expiry: new Date(data.expiry).getTime(),
            };
            console.log('[GROWW-TOKEN] ✅ New token generated and cached');
            return data.token;
        }

        console.error('[GROWW-TOKEN] Invalid token response:', data);
        return null;
    } catch (error) {
        console.error('[GROWW-TOKEN] Error generating token:', error);
        return null;
    }
}

/**
 * Clear cached token (useful for force refresh)
 */
export function clearGrowwTokenCache(): void {
    cachedToken = null;
}
