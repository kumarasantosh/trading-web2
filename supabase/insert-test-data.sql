-- Insert test data for stock snapshots to test the system
-- This simulates what the data would look like during market hours

INSERT INTO stock_snapshots (symbol, open_price, last_price, percent_change, volume, day_high, day_low, prev_close, updated_at)
VALUES
    -- Top Gainers
    ('RELIANCE', 2450.00, 2598.50, 6.06, 5234567, 2610.00, 2445.00, 2480.00, NOW()),
    ('TCS', 3200.00, 3392.00, 6.00, 3456789, 3400.00, 3195.00, 3250.00, NOW()),
    ('INFY', 1450.00, 1537.00, 6.00, 4567890, 1545.00, 1448.00, 1480.00, NOW()),
    ('HDFCBANK', 1600.00, 1680.00, 5.00, 6789012, 1685.00, 1598.00, 1620.00, NOW()),
    ('ICICIBANK', 950.00, 995.00, 4.74, 5678901, 998.00, 948.00, 960.00, NOW()),
    ('WIPRO', 420.00, 437.40, 4.14, 2345678, 440.00, 418.00, 425.00, NOW()),
    ('AXISBANK', 1050.00, 1092.00, 4.00, 4567890, 1095.00, 1048.00, 1060.00, NOW()),
    ('BHARTIARTL', 1200.00, 1245.60, 3.80, 3456789, 1250.00, 1198.00, 1210.00, NOW()),
    ('SBIN', 580.00, 601.40, 3.69, 7890123, 605.00, 578.00, 590.00, NOW()),
    ('LT', 3400.00, 3525.00, 3.68, 2345678, 3530.00, 3395.00, 3420.00, NOW()),
    
    -- Top Losers
    ('TATAMOTORS', 850.00, 807.50, -5.00, 6789012, 852.00, 805.00, 840.00, NOW()),
    ('TATASTEEL', 120.00, 114.00, -5.00, 8901234, 121.00, 113.50, 118.00, NOW()),
    ('HINDALCO', 520.00, 494.00, -5.00, 4567890, 522.00, 492.00, 510.00, NOW()),
    ('JSWSTEEL', 780.00, 741.00, -5.00, 3456789, 782.00, 738.00, 765.00, NOW()),
    ('COALINDIA', 380.00, 361.00, -5.00, 5678901, 382.00, 359.00, 375.00, NOW()),
    ('ADANIPORTS', 1100.00, 1045.00, -5.00, 2345678, 1105.00, 1042.00, 1080.00, NOW()),
    ('ONGC', 240.00, 228.00, -5.00, 6789012, 242.00, 226.00, 235.00, NOW()),
    ('NTPC', 320.00, 304.00, -5.00, 7890123, 322.00, 302.00, 315.00, NOW()),
    ('POWERGRID', 280.00, 266.00, -5.00, 4567890, 282.00, 264.00, 275.00, NOW()),
    ('BPCL', 560.00, 532.00, -5.00, 3456789, 562.00, 530.00, 550.00, NOW())
ON CONFLICT (symbol) 
DO UPDATE SET
    open_price = EXCLUDED.open_price,
    last_price = EXCLUDED.last_price,
    percent_change = EXCLUDED.percent_change,
    volume = EXCLUDED.volume,
    day_high = EXCLUDED.day_high,
    day_low = EXCLUDED.day_low,
    prev_close = EXCLUDED.prev_close,
    updated_at = EXCLUDED.updated_at;
