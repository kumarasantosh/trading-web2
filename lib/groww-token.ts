import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * Generate SHA-256 checksum for Groww API authentication
 */
function generateChecksum(secret: string, timestamp: string): string {
    const input = secret + timestamp;
    return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * In-memory cache for the current session
 */
let memoryCache: { token: string; expiry: number } | null = null;

/**
 * Get Groww API access token
 * 1. First checks in-memory cache
 * 2. Then checks Supabase for stored token
 * 3. Falls back to GROWW_API_TOKEN env var
 * 4. Finally generates a new token if needed
 */
export async function getGrowwAccessToken(): Promise<string | null> {
    // Check memory cache first (with 5 min buffer)
    if (memoryCache && Date.now() < memoryCache.expiry - 5 * 60 * 1000) {
        return memoryCache.token;
    }

    // Try to get token from Supabase (set by daily cron)
    try {
        const { data, error } = await supabaseAdmin
            .from('api_tokens')
            .select('token, expiry')
            .eq('id', 'groww_api_token')
            .single();

        if (!error && data?.token) {
            const expiryTime = new Date(data.expiry).getTime();
            // Check if token is still valid (with 5 min buffer)
            if (Date.now() < expiryTime - 5 * 60 * 1000) {
                memoryCache = { token: data.token, expiry: expiryTime };
                console.log('[GROWW-TOKEN] Using token from Supabase');
                return data.token;
            }
        }
    } catch (e) {
        console.log('[GROWW-TOKEN] Supabase fetch failed, trying fallback');
    }

    // Fallback to env var
    if (process.env.GROWW_API_TOKEN) {
        console.log('[GROWW-TOKEN] Using GROWW_API_TOKEN from env');
        return process.env.GROWW_API_TOKEN;
    }

    // Generate new token as last resort
    return await generateNewToken();
}

/**
 * Generate a new token using API Key and Secret
 */
async function generateNewToken(): Promise<string | null> {
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
            memoryCache = {
                token: data.token,
                expiry: new Date(data.expiry).getTime(),
            };
            console.log('[GROWW-TOKEN] ✅ New token generated');
            return data.token;
        }

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
    memoryCache = null;
}
