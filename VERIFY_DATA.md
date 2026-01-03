# How to Verify Data at Different Times

## Step 1: Check what data exists in Supabase

Visit: `http://localhost:3000/api/test-snapshots?limit=10`

This will show you:
- All unique timestamps where data was saved
- For each timestamp: which sectors exist and their values
- Sample data for verification

## Step 2: Test the actual API endpoint used by the frontend

The frontend uses: `/api/snapshots?type=sector&start={startTime}&end={endTime}`

Example:
```
http://localhost:3000/api/snapshots?type=sector&start=2026-01-02T07:10:00.000Z&end=2026-01-02T07:20:00.000Z
```

Replace the timestamps with actual times from Step 1.

## Step 3: Verify in Frontend

1. Go to the momentum page: `http://localhost:3000/momentum`
2. Enable replay mode (move the slider)
3. Move the slider to different times that you saw in Step 1
4. Compare the sector data shown with what the API returned

## Step 4: Check Browser Console

Open browser DevTools (F12) and check the Console tab for:
- `[SectorPerformance] Fetching historical data for time: ...`
- Any errors or warnings

## Expected Behavior

- When you move the slider to time T, it should:
  1. Query for snapshots in range [T-5min, T+5min]
  2. Find the closest snapshot to time T for each sector
  3. Display those sectors with their values

## Troubleshooting

If data is the same at all times:
1. Check if multiple timestamps have the same data (from test-snapshots API)
2. Check if the API is returning the same snapshots for different time ranges
3. Check browser console for any errors
4. Verify that timestamps are rounded to 5-minute intervals (12:40, 12:45, etc.)

