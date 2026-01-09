-- Query to check if data exists in stock_snapshots table
SELECT symbol, percent_change, last_price, open_price, updated_at
FROM stock_snapshots
ORDER BY percent_change DESC
LIMIT 10;

-- Check total count
SELECT COUNT(*) as total_stocks FROM stock_snapshots;

-- Check gainers
SELECT symbol, percent_change
FROM stock_snapshots
WHERE percent_change > 0
ORDER BY percent_change DESC
LIMIT 5;

-- Check losers
SELECT symbol, percent_change
FROM stock_snapshots
WHERE percent_change < 0
ORDER BY percent_change ASC
LIMIT 5;
