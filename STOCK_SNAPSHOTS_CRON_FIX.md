# Stock Snapshots Cron Troubleshooting

## Current Status (2026-01-16 10:30 IST)

### ✅ What's Working
- Cron is configured in `vercel.json`
- Cron Jobs are **ENABLED** in Vercel dashboard
- Manual execution works (114/204 stocks updated)
- Code is deployed (commit: 4d09e85)

### ❌ Issues Found

#### 1. **Rate Limiting (HTTP 429)**
- **Problem**: Groww API is rate-limiting requests
- **Impact**: Only 114 out of 204 stocks are being updated
- **Error**: `HTTP 429 for IDFCFIRSTB, KOTAKBANK, HDFCBANK, etc.`
- **Fix Applied**: 
  - Reduced batch size from 5 → 3
  - Increased delay from 1s → 2s between batches
  - **Action Required**: Deploy these changes

#### 2. **Cron Not Running Automatically (Suspected)**
- **Problem**: Cron may not be triggering automatically from Vercel
- **Evidence**: 
  - Manual execution works
  - No "Last Run" or "Next Run" shown in Vercel dashboard
  - Other crons are running, but this one might not be
  
### 🔍 Verification Steps

#### Step 1: Check Vercel Logs
1. Go to https://vercel.com/dashboard
2. Select your project → **Logs** tab
3. Filter by: `/api/cron/update-stock-snapshots`
4. Look for automatic executions (every 3 minutes)
5. Check timestamps - should be: 05:00, 05:03, 05:06, 05:09, etc. (UTC)

**What to look for:**
```
[STOCK-SNAPSHOTS] Starting update at 2026-01-16T05:00:00.000Z
[STOCK-SNAPSHOTS] Fetching data for 204 stocks
[STOCK-SNAPSHOTS] ✅ Updated 114 stocks in database
```

#### Step 2: Check if Cron is Actually Enabled
Even though the dashboard shows "Enabled", sometimes crons need to be:
1. **Disabled and Re-enabled**: Toggle off, wait 10 seconds, toggle back on
2. **Redeployed**: Push a new commit to trigger re-registration

#### Step 3: Verify Schedule
- Current schedule: `*/3 3-10 * * *`
- Means: Every 3 minutes, between 03:00-10:59 UTC
- Current time: ~05:00 UTC ✅ (within window)

### 🚀 Solutions

#### Solution 1: Redeploy to Re-register Cron
Sometimes Vercel needs a fresh deployment to properly register crons:

```bash
# Make a minor change and redeploy
git commit --allow-empty -m "Trigger cron re-registration"
git push origin main
```

#### Solution 2: Toggle Cron in Dashboard
1. Go to Settings → Cron Jobs
2. Find `/api/cron/update-stock-snapshots`
3. **Disable** it (toggle off)
4. Wait 10 seconds
5. **Enable** it again (toggle on)
6. Check logs after 3 minutes

#### Solution 3: Fix Rate Limiting (Already Applied)
Changes made to reduce rate limiting:
- `BATCH_SIZE`: 5 → 3
- `DELAY`: 1000ms → 2000ms

**Deploy these changes:**
```bash
git add app/api/cron/update-stock-snapshots/route.ts
git commit -m "Fix rate limiting: reduce batch size and increase delay"
git push origin main
```

### 📊 Expected Behavior After Fix

Once working correctly, you should see:
- **Vercel Logs**: New entry every 3 minutes
- **Database**: `stock_snapshots` table updated every 3 minutes
- **Success Rate**: Higher than 114/204 (less rate limiting)

### 🔧 Alternative: GitHub Actions Fallback

If Vercel cron continues to fail, use GitHub Actions:

Create `.github/workflows/stock-snapshots-cron.yml`:
```yaml
name: Stock Snapshots Cron

on:
  schedule:
    - cron: '*/3 3-10 * * *'
  workflow_dispatch:

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

### 📝 Next Steps

1. **Deploy the rate limiting fixes** (commit and push)
2. **Check Vercel logs** for automatic executions
3. **If still not running**: Toggle cron off/on in dashboard
4. **If still failing**: Set up GitHub Actions fallback

### 🎯 How to Confirm It's Working

Run this script to check:
```bash
./check-stock-snapshots-cron.sh
```

Then check Vercel logs to see if automatic executions are happening.
