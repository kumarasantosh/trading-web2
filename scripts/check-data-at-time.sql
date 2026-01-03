-- =====================================================
-- Query to Check Data at 13:10 (Historical)
-- =====================================================

-- Option 1: Check data at 13:05 IST (which is 07:35 UTC)
-- Note: IST is UTC+5:30, so 13:05 IST = 07:35 UTC
SELECT 
    captured_at,
    captured_at AT TIME ZONE 'Asia/Kolkata' as ist_time,
    sector_name,
    last_price,
    change_percent,
    open_price,
    previous_close,
    variation
FROM sector_snapshots
WHERE captured_at = '2026-01-02 07:35:00+00:00'
ORDER BY sector_name;

-- Option 1b: Check data at 13:10 IST (which is 07:40 UTC)
SELECT 
    captured_at,
    captured_at AT TIME ZONE 'Asia/Kolkata' as ist_time,
    sector_name,
    last_price,
    change_percent,
    open_price,
    previous_close,
    variation
FROM sector_snapshots
WHERE captured_at = '2026-01-02 07:40:00+00:00'
ORDER BY sector_name;

-- Option 2: Check data around 13:10 IST (±5 minutes range)
-- This finds data in the range 13:05 to 13:15 IST (07:35 to 07:45 UTC)
SELECT 
    captured_at,
    sector_name,
    last_price,
    change_percent,
    open_price,
    previous_close
FROM sector_snapshots
WHERE captured_at >= '2026-01-02 07:35:00+00:00'
  AND captured_at <= '2026-01-02 07:45:00+00:00'
ORDER BY captured_at DESC, sector_name;

-- Option 3: Check for exact timestamp 13:10:00 (if stored in IST format)
-- Adjust the date part as needed
SELECT 
    captured_at,
    sector_name,
    last_price,
    change_percent
FROM sector_snapshots
WHERE DATE_TRUNC('hour', captured_at AT TIME ZONE 'Asia/Kolkata') + INTERVAL '13 hours 10 minutes' = captured_at AT TIME ZONE 'Asia/Kolkata'
ORDER BY sector_name;

-- Option 4: Most flexible - Find closest data to 13:10 IST
-- This will show data around that time
SELECT 
    captured_at,
    captured_at AT TIME ZONE 'Asia/Kolkata' as captured_at_ist,
    sector_name,
    last_price,
    change_percent,
    open_price,
    previous_close
FROM sector_snapshots
WHERE DATE(captured_at AT TIME ZONE 'Asia/Kolkata') = '2026-01-02'
  AND EXTRACT(HOUR FROM captured_at AT TIME ZONE 'Asia/Kolkata') = 13
  AND EXTRACT(MINUTE FROM captured_at AT TIME ZONE 'Asia/Kolkata') BETWEEN 5 AND 15
ORDER BY captured_at DESC, sector_name;

-- Option 5: Simple - Check all data on 2026-01-02 around 13:10 IST
-- (13:10 IST = 07:40 UTC, range ±5 min = 07:35 to 07:45 UTC)
SELECT 
    captured_at,
    sector_name,
    last_price,
    change_percent
FROM sector_snapshots
WHERE captured_at::time BETWEEN '07:35:00' AND '07:45:00'
  AND DATE(captured_at) = '2026-01-02'
ORDER BY captured_at DESC, sector_name;

-- =====================================================
-- Quick Reference:
-- IST to UTC conversion: IST = UTC + 5:30
-- So: 13:10 IST = 07:40 UTC
-- =====================================================

