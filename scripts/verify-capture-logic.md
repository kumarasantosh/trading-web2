# How to Verify Auto-Capture is Saving Data Correctly

## Quick Verification (Automated)

Run the verification script:
```bash
./scripts/verify-capture.sh
```

Or visit the verification API in your browser:
```
http://localhost:3000/api/verify-capture
```

This will automatically check:
- ✅ Timestamp rounding status
- ✅ Data consistency across timestamps
- ✅ Recent captures summary
- ✅ Overall status and recommendations

## 1. Check Auto-Capture Logs

Look at the terminal where auto-capture is running. You should see:
```
✅ Market Data: 10 sectors, 12 stocks
✅ Option Chain: NIFTY (06-01-2026)
```

If you see errors, the data isn't being saved.

## 2. Check Recent Captures in Database

Run this SQL in Supabase SQL Editor:

```sql
-- Check the most recent 5 captures with their timestamps and data
SELECT 
    captured_at,
    sector_name,
    last_price,
    change_percent,
    COUNT(*) OVER (PARTITION BY captured_at) as sectors_at_this_time
FROM sector_snapshots
ORDER BY captured_at DESC
LIMIT 50;
```

This will show:
- Recent timestamps
- Whether timestamps are rounded (should end in :00, :05, :10, :15, etc.)
- Data values for each sector at each time

## 3. Verify Data is Different Across Times

Run this SQL to compare values across different timestamps:

```sql
-- Compare a specific sector across different times
SELECT 
    captured_at,
    sector_name,
    last_price,
    change_percent
FROM sector_snapshots
WHERE sector_name = 'Metal'  -- or any other sector
ORDER BY captured_at DESC
LIMIT 10;
```

If all `last_price` and `change_percent` values are identical, the market data hasn't changed between captures.

## 4. Check if Timestamps are Rounded

Run this SQL:

```sql
-- Check if all timestamps are properly rounded
SELECT 
    captured_at,
    EXTRACT(MINUTE FROM captured_at)::INTEGER as minutes,
    EXTRACT(SECOND FROM captured_at)::INTEGER as seconds,
    CASE 
        WHEN EXTRACT(SECOND FROM captured_at) = 0 
         AND (EXTRACT(MINUTE FROM captured_at)::INTEGER % 5) = 0 
        THEN '✓ Rounded' 
        ELSE '✗ NOT Rounded' 
    END as status
FROM sector_snapshots
GROUP BY captured_at
ORDER BY captured_at DESC
LIMIT 20;
```

All should show "✓ Rounded" for new captures.

## 5. Test the Capture Endpoint Manually

You can test if the capture is working by calling the API directly:

```bash
curl -X GET "http://localhost:3000/api/cron/capture-market-data" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Replace `YOUR_CRON_SECRET` with the actual value from `.env.local`.

## Expected Behavior

- **Timestamps**: Should be rounded to 5-minute intervals (07:35:00, 07:40:00, etc.)
- **Data Values**: May be identical if market hasn't moved (this is normal)
- **Count**: Should capture 10 sectors and 12 stocks each time
- **Frequency**: Should capture every 5 minutes during market hours

## Verification API Response Example

The `/api/verify-capture` endpoint returns:

```json
{
  "success": true,
  "overallStatus": "pass",
  "results": {
    "timestampRounding": {
      "status": "pass",
      "totalChecked": 10,
      "rounded": 10,
      "unrounded": 0
    },
    "dataConsistency": {
      "status": "info",
      "sampleSector": "Metal",
      "samplesChecked": 5,
      "issues": ["All 5 recent captures have identical values"]
    },
    "recentCaptures": {
      "status": "pass",
      "totalUniqueTimestamps": 6,
      "recentTimestamps": [...]
    }
  },
  "recommendations": [...]
}
```

**Status values:**
- `pass` = Everything is working correctly
- `warning` = Some issues found (e.g., unrounded timestamps)
- `info` = Informational message (e.g., data values are identical, which is normal)
- `error` = Critical issue (e.g., no data found)

