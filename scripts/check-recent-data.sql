-- Check recent data captures to see if timestamps are rounded correctly
-- Run this in Supabase SQL Editor

-- Check the most recent 10 sector snapshots with their timestamps
SELECT 
    captured_at,
    sector_name,
    last_price,
    change_percent,
    EXTRACT(MINUTE FROM captured_at)::INTEGER as minute_part,
    EXTRACT(SECOND FROM captured_at)::INTEGER as second_part
FROM sector_snapshots
ORDER BY captured_at DESC
LIMIT 50;

-- Check unique timestamps and how many sectors per timestamp
SELECT 
    captured_at,
    COUNT(*) as sector_count,
    CASE 
        WHEN EXTRACT(SECOND FROM captured_at) = 0 
         AND (EXTRACT(MINUTE FROM captured_at)::INTEGER % 5) = 0 
        THEN 'Rounded ✓' 
        ELSE 'NOT Rounded ✗' 
    END as rounding_status
FROM sector_snapshots
GROUP BY captured_at
ORDER BY captured_at DESC
LIMIT 20;

-- Check if there are duplicate (sector_name, captured_at) pairs
SELECT 
    sector_name,
    captured_at,
    COUNT(*) as duplicate_count
FROM sector_snapshots
GROUP BY sector_name, captured_at
HAVING COUNT(*) > 1
ORDER BY captured_at DESC;

