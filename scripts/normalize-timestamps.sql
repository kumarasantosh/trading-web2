-- =====================================================
-- Normalize Timestamps in sector_snapshots
-- =====================================================
-- This script rounds all timestamps to 5-minute intervals
-- Run this in your Supabase SQL Editor
-- =====================================================

-- Step 1: Create a backup (optional but recommended)
-- CREATE TABLE sector_snapshots_backup AS SELECT * FROM sector_snapshots;

-- Step 2: Normalize timestamps to 5-minute intervals
-- This rounds DOWN to the nearest 5-minute mark (e.g., 07:22:59 -> 07:20:00)
UPDATE sector_snapshots
SET captured_at = DATE_TRUNC('hour', captured_at) + 
    (FLOOR(EXTRACT(MINUTE FROM captured_at)::INTEGER / 5) * INTERVAL '5 minutes')
WHERE captured_at != (
    DATE_TRUNC('hour', captured_at) + 
    (FLOOR(EXTRACT(MINUTE FROM captured_at)::INTEGER / 5) * INTERVAL '5 minutes')
);

-- Step 3: Handle duplicates that might be created after normalization
-- If multiple rows end up with the same (sector_name, captured_at), keep only one
-- (The unique constraint should prevent this, but this is a safety measure)
DELETE FROM sector_snapshots
WHERE id IN (
    SELECT id FROM (
        SELECT id, 
               ROW_NUMBER() OVER (
                   PARTITION BY sector_name, captured_at 
                   ORDER BY created_at DESC
               ) as rn
        FROM sector_snapshots
    ) t
    WHERE t.rn > 1
);

-- Step 4: Verify the results
SELECT 
    captured_at,
    COUNT(*) as sector_count,
    COUNT(DISTINCT sector_name) as unique_sectors
FROM sector_snapshots
GROUP BY captured_at
ORDER BY captured_at DESC
LIMIT 20;

-- Step 5: Check for any remaining unrounded timestamps
SELECT captured_at, COUNT(*)
FROM sector_snapshots
WHERE EXTRACT(SECOND FROM captured_at) != 0 
   OR (EXTRACT(MINUTE FROM captured_at)::INTEGER % 5) != 0
GROUP BY captured_at;

-- If Step 5 returns any rows, there are still unrounded timestamps
-- If Step 5 returns no rows, all timestamps are now properly rounded!

