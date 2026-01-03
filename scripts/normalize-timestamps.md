# Normalize Existing Timestamps

The issue is that existing data has unrounded timestamps (like 07:22:59.696). We need to normalize them to 5-minute intervals.

## Option 1: SQL Script to Normalize Timestamps

Run this in your Supabase SQL Editor:

```sql
-- Normalize all timestamps in sector_snapshots to 5-minute intervals
UPDATE sector_snapshots
SET captured_at = DATE_TRUNC('hour', captured_at) + 
    INTERVAL '5 minutes' * FLOOR(EXTRACT(MINUTE FROM captured_at) / 5)
WHERE captured_at != (DATE_TRUNC('hour', captured_at) + 
    INTERVAL '5 minutes' * FLOOR(EXTRACT(MINUTE FROM captured_at) / 5));

-- Check the results
SELECT DISTINCT captured_at 
FROM sector_snapshots 
ORDER BY captured_at DESC 
LIMIT 20;
```

**Note**: This will modify existing data. Make sure to backup first if needed.

## Option 2: Delete Old Unrounded Data

If the data is all the same anyway, you might want to delete the old unrounded timestamps and keep only the properly rounded ones:

```sql
-- Delete unrounded timestamps (keep only those that are already on 5-minute intervals)
DELETE FROM sector_snapshots
WHERE EXTRACT(SECOND FROM captured_at) != 0 
   OR EXTRACT(MINUTE FROM captured_at)::INTEGER % 5 != 0;

-- Verify
SELECT DISTINCT captured_at 
FROM sector_snapshots 
ORDER BY captured_at DESC;
```

## Option 3: Keep Only Most Recent Rounded Data

If you want to clean up and start fresh:

```sql
-- Keep only data from timestamps that are properly rounded
DELETE FROM sector_snapshots
WHERE captured_at NOT IN (
    SELECT DISTINCT captured_at 
    FROM sector_snapshots
    WHERE EXTRACT(SECOND FROM captured_at) = 0 
      AND EXTRACT(MINUTE FROM captured_at)::INTEGER % 5 = 0
);
```

Choose the option that works best for your situation.

