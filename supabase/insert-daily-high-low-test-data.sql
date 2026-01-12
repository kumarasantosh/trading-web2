-- Insert test data with VERY LOW highs and VERY HIGH lows
-- This guarantees current prices will show as breakouts or breakdowns

DELETE FROM daily_high_low WHERE symbol IN (
    'RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK',
    'TATAMOTORS', 'TATASTEEL', 'HINDALCO', 'JSWSTEEL', 'COALINDIA',
    'WIPRO', 'AXISBANK', 'BHARTIARTL', 'SBIN', 'LT'
);

INSERT INTO daily_high_low (symbol, sector, today_high, today_low, captured_date)
VALUES
    -- BREAKOUT STOCKS: Set yesterday's high VERY LOW so current price will be above it
    ('RELIANCE', 'Energy', 2000.00, 1900.00, CURRENT_DATE - INTERVAL '1 day'),
    ('TCS', 'IT', 2500.00, 2400.00, CURRENT_DATE - INTERVAL '1 day'),
    ('INFY', 'IT', 1200.00, 1100.00, CURRENT_DATE - INTERVAL '1 day'),
    ('HDFCBANK', 'Banking', 1400.00, 1300.00, CURRENT_DATE - INTERVAL '1 day'),
    ('ICICIBANK', 'Banking', 800.00, 750.00, CURRENT_DATE - INTERVAL '1 day'),
    ('WIPRO', 'IT', 350.00, 330.00, CURRENT_DATE - INTERVAL '1 day'),
    ('AXISBANK', 'Banking', 900.00, 850.00, CURRENT_DATE - INTERVAL '1 day'),
    ('BHARTIARTL', 'Telecom', 1000.00, 950.00, CURRENT_DATE - INTERVAL '1 day'),
    
    -- BREAKDOWN STOCKS: Set yesterday's low VERY HIGH so current price will be below it
    ('TATAMOTORS', 'Auto', 1000.00, 950.00, CURRENT_DATE - INTERVAL '1 day'),
    ('TATASTEEL', 'Metals', 150.00, 140.00, CURRENT_DATE - INTERVAL '1 day'),
    ('HINDALCO', 'Metals', 650.00, 600.00, CURRENT_DATE - INTERVAL '1 day'),
    ('JSWSTEEL', 'Metals', 900.00, 850.00, CURRENT_DATE - INTERVAL '1 day'),
    ('COALINDIA', 'Energy', 450.00, 420.00, CURRENT_DATE - INTERVAL '1 day'),
    ('SBIN', 'Banking', 700.00, 650.00, CURRENT_DATE - INTERVAL '1 day'),
    ('LT', 'Infrastructure', 4000.00, 3800.00, CURRENT_DATE - INTERVAL '1 day');
