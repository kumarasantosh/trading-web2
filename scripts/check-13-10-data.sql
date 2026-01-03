-- Quick query to check data at 13:10 IST
-- Run this in Supabase SQL Editor

-- Since timestamps are stored in UTC and IST = UTC+5:30
-- 13:10 IST = 07:40 UTC

SELECT 
    captured_at,
    captured_at AT TIME ZONE 'Asia/Kolkata' as ist_time,
    sector_name,
    last_price,
    change_percent,
    open_price,
    previous_close
FROM sector_snapshots
WHERE captured_at = '2026-01-02 07:40:00+00:00'
ORDER BY sector_name;

