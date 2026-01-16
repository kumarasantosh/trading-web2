# Why Stock Snapshots Isn't Using Supabase Token

## Root Cause

The production deployment is **NOT reading from Supabase** because one or both of these issues:

### 1. Missing Environment Variable in Vercel
The code requires `SUPABASE_SERVICE_ROLE_KEY` to read from Supabase's `api_tokens` table.

**Check**: Go to Vercel Dashboard → Settings → Environment Variables

**Required variables for Supabase integration**:
- `NEXT_PUBLIC_SUPABASE_URL` = `https://vbthredhljsobkfvdlvi.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = (your anon key)
- `SUPABASE_SERVICE_ROLE_KEY` = (your service role key) ← **CRITICAL**

If `SUPABASE_SERVICE_ROLE_KEY` is missing, the code will:
1. Try to read from Supabase → **FAIL** (no auth)
2. Fall back to `GROWW_API_TOKEN` env var → **EXPIRED TOKEN** → 401 errors

### 2. Deployment Not Live Yet
The new code (commit `4d09e85`) may not be deployed to production yet.

**Check**: Go to Vercel Dashboard → Deployments

Look for:
- Commit: `4d09e85` - "Force refresh token from Supabase to avoid stale cache"
- Status: Should be "Ready" (not "Building" or "Queued")

## Solution

### Step 1: Verify Environment Variables in Vercel

1. Go to https://vercel.com/dashboard
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Verify these are set for **Production**:

```
NEXT_PUBLIC_SUPABASE_URL=https://vbthredhljsobkfvdlvi.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your_anon_key>
SUPABASE_SERVICE_ROLE_KEY=<your_service_role_key>
```

### Step 2: Check Deployment Status

1. Go to **Deployments** tab
2. Find commit `4d09e85`
3. Ensure status is "Ready"
4. If still "Building", wait for it to complete

### Step 3: Temporary Fix (While Investigating)

Update `GROWW_API_TOKEN` in Vercel with the fresh token:
```
eyJraWQiOiJaTUtjVXciLCJhbGciOiJFUzI1NiJ9.eyJleHAiOjE3Njg2MDk4MDAsImlhdCI6MTc2ODUzNjEyOSwibmJmIjoxNzY4NTM2MTI5LCJzdWIiOiJ7XCJ0b2tlblJlZklkXCI6XCI4NzZhNDVhNi1iNGE4LTQwNTEtODRkOC03NGE5ODA4OWMyMjBcIixcInZlbmRvckludGVncmF0aW9uS2V5XCI6XCJlMzFmZjIzYjA4NmI0MDZjODg3NGIyZjZkODQ5NTMxM1wiLFwidXNlckFjY291bnRJZFwiOlwiZDc2M2FkMjAtYjRhOC00MTlmLWIxMWEtYjMyYThmNTVmN2UxXCIsXCJkZXZpY2VJZFwiOlwiYmFlYmVlNjEtZTBlZi01M2JiLTk5MWQtMmI4MGZjZDY2ZTM3XCIsXCJzZXNzaW9uSWRcIjpcImU4NTMwMGRmLWQ3YWUtNGE0OC1iMmM3LWEzNDYzY2U1OWNlMlwiLFwiYWRkaXRpb25hbERhdGFcIjpcIno1NC9NZzltdjE2WXdmb0gvS0EwYk1CaWdHZEtrTnI3UVRyOTNMc29EVDVSTkczdTlLa2pWZDNoWjU1ZStNZERhWXBOVi9UOUxIRmtQejFFQisybTdRPT1cIixcInJvbGVcIjpcIm9yZGVyLWJhc2ljLGxpdmVfZGF0YS1iYXNpYyxub25fdHJhZGluZy1iYXNpYyxvcmRlcl9yZWFkX29ubHktYmFzaWMsYmFja190ZXN0XCIsXCJzb3VyY2VJcEFkZHJlc3NcIjpudWxsLFwidHdvRmFFeHBpcnlUc1wiOjE3Njg2MDk4MDAwMDB9IiwiaXNzIjoiYXBleC1hdXRoLXByb2QtYXBwIn0.GcQ5T5rqRzWKtHZVII_iNb2uVu5gQ20PW7e381emGzkgbaRLelGqCLScRNkKBr4eAv5K4nIghvTqb5TRvX5pkQ
```

This will fix it immediately while you verify the Supabase environment variables.

## How to Verify It's Working

After fixing environment variables and redeploying:

1. **Check Vercel Logs** for the stock snapshots cron
2. Look for these messages:
   ```
   [GROWW-TOKEN] Force refreshing from Supabase...
   [GROWW-TOKEN] Force loaded token from Supabase, expires: 2026-01-17T06:00:00
   ```

3. If you see these instead:
   ```
   [GROWW-TOKEN] Supabase error: ...
   [GROWW-TOKEN] Using GROWW_API_TOKEN from env
   ```
   Then `SUPABASE_SERVICE_ROLE_KEY` is missing or incorrect.

## Expected Flow (When Working)

```
Stock Snapshots Cron
  ↓
forceRefreshFromSupabase()
  ↓
Read from Supabase api_tokens table (needs SUPABASE_SERVICE_ROLE_KEY)
  ↓
Get fresh token (expires 2026-01-17 06:00:00)
  ↓
Use token to fetch stocks from Groww API
  ↓
✅ Success! stocks_updated > 0
```

## Current Flow (What's Happening)

```
Stock Snapshots Cron
  ↓
forceRefreshFromSupabase()
  ↓
Try to read from Supabase → FAIL (missing SUPABASE_SERVICE_ROLE_KEY)
  ↓
Fall back to GROWW_API_TOKEN env var
  ↓
Use expired token
  ↓
❌ 401 errors! stocks_updated = 0
```
