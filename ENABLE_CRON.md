# Vercel Cron Not Running Automatically - Fix

## Current Status
- ✅ Time: 04:47 UTC (within schedule 3-10 UTC)
- ✅ Cron configured in `vercel.json`: `*/3 3-10 * * *`
- ✅ Manual execution works (stocks_updated: 110)
- ❌ **NOT running automatically**

## Root Cause
Vercel cron jobs are **disabled by default** and need to be enabled in the dashboard.

## Solution

### Step 1: Enable Cron Jobs in Vercel

1. Go to https://vercel.com/dashboard
2. Select your project
3. Go to **Settings** → **Cron Jobs**
4. You should see all your cron jobs listed:
   - `/api/cron/refresh-groww-token` - `30 2 * * *`
   - `/api/cron/cleanup-intraday` - `30 3 * * *`
   - `/api/cron/populate-daily-high-low` - `0 3 * * *`
   - `/api/cron/capture-market-data` - `*/1 3-10 * * *`
   - `/api/cron/option-chain-cron` - `*/3 3-10 * * *`
   - `/api/cron/check-breakouts` - `*/1 3-10 * * *`
   - `/api/cron/calculate-pcr` - `*/1 3-10 * * *`
   - **`/api/cron/update-stock-snapshots`** - `*/3 3-10 * * *` ← This one!

5. **Enable** each cron job by toggling the switch
6. Specifically enable `/api/cron/update-stock-snapshots`

### Step 2: Verify Cron is Enabled

After enabling, you should see:
- Status: **Enabled** (green)
- Next run: Shows the next scheduled time
- Last run: Will update after first automatic execution

### Step 3: Monitor Execution

1. Go to **Logs** tab in Vercel
2. Filter by `/api/cron/update-stock-snapshots`
3. You should see automatic executions every 3 minutes
4. Look for logs like:
   ```
   [STOCK-SNAPSHOTS] Starting update at 2026-01-16T04:48:00.000Z
   [STOCK-SNAPSHOTS] ✅ Updated 110 stocks in database
   ```

## Alternative: Check if Cron Jobs are Available

If you don't see the "Cron Jobs" section in Settings:

### Option 1: Upgrade Vercel Plan
Cron jobs require a **Pro plan** or higher. If you're on the Hobby plan:
1. Go to **Settings** → **General**
2. Check your current plan
3. If needed, upgrade to Pro to enable cron jobs

### Option 2: Use GitHub Actions Instead
If you can't upgrade, use GitHub Actions to trigger the cron:

Create `.github/workflows/stock-snapshots-cron.yml`:
```yaml
name: Stock Snapshots Cron

on:
  schedule:
    - cron: '*/3 3-10 * * *'  # Every 3 minutes, 3-10 UTC
  workflow_dispatch:  # Allow manual trigger

jobs:
  update-stock-snapshots:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Stock Snapshots
        run: |
          curl -X GET "https://www.ectrade.in/api/cron/update-stock-snapshots" \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

Then add `CRON_SECRET` to GitHub repository secrets.

## Verification

After enabling, wait 3 minutes and check:

```bash
# Check Supabase for recent updates
# The updated_at should be within last 3 minutes
```

Or check Vercel logs for automatic executions.

## Current Schedule
- **Stock Snapshots**: Every 3 minutes, 3:00-10:59 UTC (8:30 AM - 4:29 PM IST)
- **Current Time**: 04:47 UTC ✅ (within schedule)
- **Next Run**: Should be at 04:48, 04:51, 04:54, etc.

Once enabled, the cron will run automatically every 3 minutes during market hours!
