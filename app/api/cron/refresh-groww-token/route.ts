import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Cron job to refresh Groww API token once daily at 8 AM IST
 * Generates a new access token using API Key and Secret
 * Stores it in Supabase for use across all serverless functions
 */

function generateChecksum(secret: string, timestamp: string): string {
    const input = secret + timestamp;
    return crypto.createHash('sha256').update(input).digest('hex');
}

export async function GET(request: NextRequest) {
    try {
        // Validate cron secret
        const authHeader = request.headers.get('authorization');
        const cronSecret = process.env.CRON_SECRET;

        if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
            console.error('[GROWW-TOKEN-REFRESH] Unauthorized request');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log('[GROWW-TOKEN-REFRESH] Starting daily token refresh...');

        const apiKey = process.env.GROWW_API_KEY;
        const apiSecret = process.env.GROWW_API_SECRET;

        if (!apiKey || !apiSecret) {
            console.error('[GROWW-TOKEN-REFRESH] Missing GROWW_API_KEY or GROWW_API_SECRET');
            return NextResponse.json({
                success: false,
                error: 'Missing API credentials'
            }, { status: 500 });
        }

        // Generate checksum
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const checksum = generateChecksum(apiSecret, timestamp);

        console.log(`[GROWW-TOKEN-REFRESH] Timestamp: ${timestamp}`);
        console.log(`[GROWW-TOKEN-REFRESH] Checksum generated`);

        // Request new token from Groww API
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
            const errorText = await response.text();
            console.error(`[GROWW-TOKEN-REFRESH] Failed: ${response.status} - ${errorText}`);
            return NextResponse.json({
                success: false,
                error: `Token API returned ${response.status}`,
                details: errorText,
            }, { status: 500 });
        }

        const data = await response.json();

        if (!data.token || !data.active) {
            console.error('[GROWW-TOKEN-REFRESH] Invalid token response:', data);
            return NextResponse.json({
                success: false,
                error: 'Invalid token response',
            }, { status: 500 });
        }

        // Store token in Supabase for persistence across serverless functions
        const tokenData = {
            id: 'groww_api_token',
            token: data.token,
            expiry: data.expiry,
            created_at: new Date().toISOString(),
        };

        const { error: upsertError } = await supabaseAdmin
            .from('api_tokens')
            .upsert(tokenData, {
                onConflict: 'id',
            });

        if (upsertError) {
            console.error('[GROWW-TOKEN-REFRESH] Failed to store token:', upsertError);
            // Don't fail - token was generated successfully
        } else {
            console.log('[GROWW-TOKEN-REFRESH] Token stored in Supabase');
        }

        console.log(`[GROWW-TOKEN-REFRESH] ✅ Token refreshed successfully`);
        console.log(`[GROWW-TOKEN-REFRESH] Expires: ${data.expiry}`);

        return NextResponse.json({
            success: true,
            message: 'Groww token refreshed',
            expires: data.expiry,
            active: data.active,
        });

    } catch (error) {
        console.error('[GROWW-TOKEN-REFRESH] Error:', error);
        return NextResponse.json({
            success: false,
            error: 'Token refresh failed',
            details: error instanceof Error ? error.message : 'Unknown error',
        }, { status: 500 });
    }
}
