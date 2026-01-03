# Auto-Capture Script Guide

This script automatically captures market data every 5 minutes to populate your database with historical snapshots for testing the time-travel replay feature.

## Usage

### Run Indefinitely
Captures data every 5 minutes until you stop it (Ctrl+C):
```bash
./auto-capture.sh
```

### Run for Specific Duration
Captures data for a specified number of minutes:
```bash
# Run for 1 hour (12 captures)
./auto-capture.sh 60

# Run for 30 minutes (6 captures)
./auto-capture.sh 30

# Run for market hours (6.25 hours = 375 minutes, ~75 captures)
./auto-capture.sh 375
```

## What It Does

1. **Calls the cron API** every 5 minutes
2. **Captures 15 sectors** (Bank Nifty, IT, Pharma, Auto, Metal, Energy, FMCG, Realty, Financial Services, Private Bank, PSU Bank, Media, Commodities, Infrastructure, Services Sector)
3. **Captures 12 stocks** (PNB, SBIN, CANBK, BANKBARODA, HDFCBANK, ICICIBANK, AXISBANK, KOTAKBANK, TCS, INFY, WIPRO, MARUTI, TATAMOTORS)
4. **Stores snapshots in Supabase** with timestamps
5. **Shows progress** with colored output

## Example Output

```
🕐 Auto-capture will run for 60 minutes
📊 Capturing data every 5 minutes...
Press Ctrl+C to stop

[2025-12-26 14:00:00] Capturing market data...
✅ Success! Captured 15 sectors, 12 stocks
   Total captures: 1

⏳ Waiting 5 minutes until next capture...

[2025-12-26 14:05:00] Capturing market data...
✅ Success! Captured 15 sectors, 12 stocks
   Total captures: 2
```

## Stopping the Script

Press **Ctrl+C** to stop. It will show a summary:
```
Stopping auto-capture...
Total successful captures: 12
```

## Use Cases

### 1. Testing the Replay Feature
Run for 30-60 minutes to create enough data points to test the timeline slider:
```bash
./auto-capture.sh 60
```

### 2. Simulating a Full Market Day
Run during market hours (9:15 AM - 3:30 PM) to capture real market movements:
```bash
# Start at 9:15 AM and let it run until 3:30 PM
./auto-capture.sh 375
```

### 3. Quick Demo Data
Run for 15 minutes to get 3 snapshots for a quick demo:
```bash
./auto-capture.sh 15
```

## Viewing Captured Data

After running the script, you can:

1. **Check Supabase Dashboard**
   - Go to https://supabase.com
   - Open Table Editor → `sector_snapshots`
   - See all captured snapshots with timestamps

2. **Test the Slider**
   - Open http://localhost:3000/momentum
   - Drag the timeline slider
   - See historical data at different times

3. **Query via API**
   ```bash
   # Check snapshots between 2:00 PM and 2:05 PM
   curl "http://localhost:3000/api/snapshots?type=sector&start=2025-12-26T08:30:00.000Z&end=2025-12-26T08:35:00.000Z"
   ```

## Tips

- **Run in background**: Add `&` at the end to run in background
  ```bash
  ./auto-capture.sh 60 &
  ```

- **Save output to file**: Redirect output to a log file
  ```bash
  ./auto-capture.sh 60 > capture.log 2>&1
  ```

- **Check if running**: Use `ps` to see if the script is running
  ```bash
  ps aux | grep auto-capture
  ```

## Troubleshooting

**Script says "Permission denied"**
```bash
chmod +x auto-capture.sh
```

**API returns 401 Unauthorized**
- Check that `CRON_SECRET` in `.env.local` matches the script
- Default: `9f3c1a7e4b2d8f0a6e9c3d1b5f7a2e4c8a6d0b9e3f2c1a4d7e8b5c6f0`

**API returns 404**
- Make sure dev server is running: `npm run dev`
- Check that the API route exists at `app/api/cron/capture-market-data/route.ts`

**No data in Supabase**
- Verify Supabase credentials in `.env.local`
- Check Supabase dashboard for any errors
- Run `./test-cron.sh` to test manually

## Production Alternative

For production, use **GitHub Actions** instead of this script:
- Runs automatically every 5 minutes
- No need to keep your computer on
- Free with GitHub Actions
- See `GITHUB_ACTIONS_SETUP.md` for setup instructions

---

**Note**: This script is for **local testing only**. For production, deploy to Vercel and use GitHub Actions for automated data capture.
