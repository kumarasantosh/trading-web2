import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Helper to create a chainable mock query builder for build-time
function createMockQueryBuilder() {
    const errorResult = Promise.resolve({
        data: null,
        error: { message: 'Supabase not configured. Please set environment variables.' }
    })

    const chainable = {
        select: () => chainable,
        insert: () => errorResult,
        upsert: () => errorResult,
        update: () => errorResult,
        delete: () => errorResult,
        eq: () => chainable,
        gte: () => chainable,
        lte: () => chainable,
        order: () => errorResult,
    }

    return chainable
}

// Helper to safely create Supabase client
// During build, if env vars are missing, create a client that will error gracefully
function createSupabaseClient(url: string | undefined, key: string | undefined, isAdmin = false): SupabaseClient {
    // During build time, if env vars are not set, we need to handle this gracefully
    // Supabase client requires valid URL and key, so we'll use a try-catch approach
    if (!url || !key) {
        // Create a minimal mock client that will fail at runtime with a clear error
        // This allows the build to complete
        const mockClient = {
            from: () => createMockQueryBuilder(),
        } as any as SupabaseClient

        return mockClient
    }

    return createClient(url, key, isAdmin ? {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        },
        global: {
            // Force no-store to prevent caching of admin queries (critical for cron jobs)
            fetch: (url, options) => {
                return fetch(url, { ...options, cache: 'no-store' })
            }
        }
    } : undefined)
}

// Supabase client for client-side usage (uses anon key)
export const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    false
)

// Supabase client for server-side usage (uses service role key)
// This bypasses RLS and should only be used in API routes
console.log('[SUPABASE-LIB] Initializing supabaseAdmin...')
console.log('[SUPABASE-LIB] URL exists:', !!process.env.NEXT_PUBLIC_SUPABASE_URL)
console.log('[SUPABASE-LIB] Key exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY)
console.log('[SUPABASE-LIB] Key length:', process.env.SUPABASE_SERVICE_ROLE_KEY?.length || 0)

export const supabaseAdmin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    true
)

// Types for database tables
export interface SectorSnapshot {
    id: string
    captured_at: string
    sector_name: string
    last_price: number
    open_price: number
    previous_close: number
    change_percent: number
    variation: number
    one_week_ago_val: number
    one_month_ago_val: number
    one_year_ago_val: number
    created_at: string
}

export interface StockSnapshot {
    id: string
    captured_at: string
    symbol: string
    sector: string | null
    ltp: number
    open_price: number
    close_price: number
    change_percent: number
    high: number | null
    low: number | null
    volume: number | null
    created_at: string
}
