# Setup Guide: Automated Data Capture Every 5 Minutes

## Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Click "New Project"
3. Choose a name, database password, and region
4. Wait for project to be created (~2 minutes)

## Step 2: Create Database Tables

1. In your Supabase dashboard, go to **SQL Editor**
2. Click "New Query"
3. Copy and paste the entire contents of `supabase/schema.sql`
4. Click "Run" to execute the SQL
5. Verify tables were created in **Table Editor**

## Step 3: Get Supabase Credentials

1. In Supabase dashboard, go to **Settings** → **API**
2. Copy these values:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon public** key
   - **service_role** key (click "Reveal" to see it)

## Step 4: Add Environment Variables

Add to your `.env.local` file:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Cron Security (generate a random string)
CRON_SECRET=my_super_secret_cron_key_12345

# Existing Groww API credentials (already have these)
GROWW_API_TOKEN=your_token
GROWW_COOKIES=your_cookies
GROWW_DEVICE_ID=your_device_id
```

## Step 5: Test Locally (Manual Trigger)

Run this command to test the cron job manually:

```bash
curl -X GET http://localhost:3000/api/cron/capture-market-data \
  -H "Authorization: Bearer my_super_secret_cron_key_12345"
```

You should see a response like:
```json
{
  "success": true,
  "captured_at": "2025-12-26T07:47:00.000Z",
  "sectors_captured": 11,
  "stocks_captured": 13,
  "errors": []
}
```

Check your Supabase dashboard → **Table Editor** → `sector_snapshots` and `stock_snapshots` to verify data was inserted!

## Step 6: Deploy to Vercel

```bash
# Commit your changes
git add .
git commit -m "Add time-travel replay system with automated data capture"

# Deploy to Vercel
vercel --prod
```

## Step 7: Add Environment Variables to Vercel

1. Go to your Vercel project dashboard
2. Click **Settings** → **Environment Variables**
3. Add all the variables from `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `CRON_SECRET`
   - `GROWW_API_TOKEN`
   - `GROWW_COOKIES`
   - `GROWW_DEVICE_ID`
4. Click "Save"
5. Redeploy if necessary

## Step 8: Verify Cron Job is Running

1. Go to Vercel dashboard → **Deployments** → **Functions**
2. Click on your latest deployment
3. Go to **Logs** tab
4. Wait for market hours (9:15 AM - 3:30 PM IST, Mon-Fri)
5. You should see logs every 5 minutes showing data capture

**Or manually trigger on production:**
```bash
curl -X GET https://your-app.vercel.app/api/cron/capture-market-data \
  -H "Authorization: Bearer my_super_secret_cron_key_12345"
```

## Verification Checklist

- [ ] Supabase project created
- [ ] Database tables created (run schema.sql)
- [ ] Environment variables added to `.env.local`
- [ ] Local test successful (data appears in Supabase)
- [ ] Deployed to Vercel
- [ ] Environment variables added to Vercel
- [ ] Cron job running (check Vercel logs)
- [ ] Data appearing in Supabase every 5 minutes

## Troubleshooting

**"Unauthorized" error:**
- Check that `CRON_SECRET` matches in both `.env.local` and Vercel

**"Failed to fetch sector data":**
- NSE API might be down or rate-limiting
- Check Vercel function logs for details

**No data in Supabase:**
- Verify `SUPABASE_SERVICE_ROLE_KEY` is correct
- Check table names match exactly: `sector_snapshots`, `stock_snapshots`
- Look for errors in Vercel function logs

**Cron not running:**
- Cron jobs only work in **production** deployments
- Check `vercel.json` is in the root directory
- Verify schedule format: `*/5 9-15 * * 1-5`

## What Happens Next

Once deployed and running:
- ✅ Data captured every 5 minutes during market hours
- ✅ Slider on `/momentum` page shows historical data
- ✅ ~1,800 records per day
- ✅ ~54,000 records per month
- ✅ Automatic cleanup after 90 days (if you enable it)

🎉 Your time-travel replay system is now live!
