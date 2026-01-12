-- One-time cleanup script to clear all old breakout/breakdown data
-- Run this in your Supabase SQL Editor to start fresh

-- Clear all breakout stocks
DELETE FROM breakout_stocks;

-- Clear all breakdown stocks  
DELETE FROM breakdown_stocks;

-- Clear all breakout snapshots (if using this table)
DELETE FROM breakout_snapshots;

-- Verify cleanup
SELECT 'breakout_stocks' as table_name, COUNT(*) as remaining_records FROM breakout_stocks
UNION ALL
SELECT 'breakdown_stocks' as table_name, COUNT(*) as remaining_records FROM breakdown_stocks
UNION ALL
SELECT 'breakout_snapshots' as table_name, COUNT(*) as remaining_records FROM breakout_snapshots;
