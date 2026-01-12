-- Simplified RLS policies that work with service role
-- Run this in your Supabase SQL Editor

-- ============================================
-- DISABLE RLS on all tables (simplest solution)
-- ============================================

ALTER TABLE daily_high_low DISABLE ROW LEVEL SECURITY;
ALTER TABLE stock_snapshots DISABLE ROW LEVEL SECURITY;
ALTER TABLE breakout_stocks DISABLE ROW LEVEL SECURITY;
ALTER TABLE breakdown_stocks DISABLE ROW LEVEL SECURITY;

-- Verify RLS is disabled
SELECT 
    schemaname, 
    tablename, 
    rowsecurity
FROM pg_tables
WHERE tablename IN ('daily_high_low', 'stock_snapshots', 'breakout_stocks', 'breakdown_stocks')
ORDER BY tablename;
