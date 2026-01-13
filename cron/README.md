# Trading Cron Service

This Railway service runs automated market data capture tasks that call the Vercel-hosted API.

## Architecture

- **Main App**: https://trading-web2.vercel.app (Vercel)
- **Cron Service**: Railway (calls Vercel API every minute)

## Tasks Performed

The cron service coordinates the following tasks:

### Always Running
- **Market Data Capture**: Every 1 minute
  - Captures sector snapshots
  - Endpoint: `/api/cron/capture-market-data`

### Market Hours Only (9:15 AM - 3:30 PM IST, Mon-Fri)
- **PCR Calculation**: Every 1 minute
  - Calculates Put-Call Ratio for indices
  - Endpoint: `/api/cron/calculate-pcr`

- **Breakout/Breakdown Check**: Every 1 minute
  - Detects stocks breaking out or breaking down
  - Endpoint: `/api/cron/check-breakouts`

- **Stock Snapshots**: Every 1 minute
  - Updates top movers data
  - Endpoint: `/api/cron/update-stock-snapshots`

- **Option Chain OI**: Every 3 minutes
  - Captures option chain open interest data
  - Endpoint: `/api/option-chain/cron`

### Daily Task
- **Cleanup**: Once at 9:00 AM IST
  - Cleans up previous day's intraday data
  - Endpoint: `/api/cron/cleanup-intraday`

## Environment Variables Required

Set these in Railway dashboard:

```env
CRON_SECRET=9f3c1a7e4b2d8f0a6e9c3d1b5f7a2e4c8a6d0b9e3f2c1a4d7e8b5c6f0
API_BASE_URL=https://trading-web2.vercel.app
TZ=Asia/Kolkata
```

### Important Notes

1. **CRON_SECRET**: Must match the secret in your Vercel environment variables
2. **API_BASE_URL**: Your Vercel deployment URL (no trailing slash)
3. **TZ**: Set to Asia/Kolkata for correct market hours detection

## Deployment

### Using Railway Dashboard

1. Go to https://railway.app
2. Create new project or select existing
3. Click "New" → "GitHub Repo"
4. Select `kumarasantosh/trading-web2`
5. Name: `trading-cron`
6. Settings → Root Directory: `cron`
7. Add environment variables (see above)
8. Deploy

### Using Railway CLI

```bash
cd cron
railway init
railway link
railway variables set CRON_SECRET=9f3c1a7e4b2d8f0a6e9c3d1b5f7a2e4c8a6d0b9e3f2c1a4d7e8b5c6f0
railway variables set API_BASE_URL=https://trading-web2.vercel.app
railway variables set TZ=Asia/Kolkata
railway up
```

## Monitoring

### View Logs

```bash
railway logs --tail 50
```

### Expected Log Output

```
[2026-01-13 10:15:00 IST] ℹ️  ========== Railway Cron Handler ==========
[2026-01-13 10:15:00 IST] ℹ️  API URL: https://trading-web2.vercel.app
[2026-01-13 10:15:00 IST] ℹ️  Market status: OPEN
[2026-01-13 10:15:01 IST] ✅ Market data captured: 12 sectors
[2026-01-13 10:15:02 IST] ✅ PCR calculated: 3 indices
[2026-01-13 10:15:03 IST] ✅ Breakout check: 500 stocks - 5 breakouts, 3 breakdowns
[2026-01-13 10:15:04 IST] ✅ Stock snapshots updated: 20/20 stocks
[2026-01-13 10:15:04 IST] ========== Cron cycle complete ==========
```

## Troubleshooting

### 401 Unauthorized
- Check that CRON_SECRET matches in both Railway and Vercel
- Verify Authorization header is being sent

### 404 Not Found
- Verify API endpoints exist in Vercel deployment
- Check API_BASE_URL is correct

### Connection Timeout
- Vercel functions may timeout (10s hobby, 60s pro)
- Optimize API endpoints for faster response

### "Outside market hours"
- This is normal and expected
- Market-specific tasks only run 9:15 AM - 3:30 PM IST, Mon-Fri

## Cost

- Railway Cron Service: ~$5/month
- Runs 24/7, executes every minute

## Files

- `cron-handler.sh`: Main cron script
- `railway.json`: Railway configuration
- `README.md`: This file

## Support

- Railway Docs: https://docs.railway.com/reference/cron-jobs
- Repository: https://github.com/kumarasantosh/trading-web2
- Issues: Create an issue in the GitHub repository
