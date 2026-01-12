-- Fix RLS policies for all tables to allow service role access
-- Run this in your Supabase SQL Editor

-- ============================================
-- 1. FIX daily_high_low TABLE
-- ============================================
DROP POLICY IF EXISTS "Allow public read access on daily_high_low" ON daily_high_low;
DROP POLICY IF EXISTS "Allow service role full access on daily_high_low" ON daily_high_low;

ALTER TABLE daily_high_low ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on daily_high_low"
  ON daily_high_low FOR SELECT
  USING (true);

CREATE POLICY "Allow service role full access on daily_high_low"
  ON daily_high_low FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- 2. FIX stock_snapshots TABLE
-- ============================================
DROP POLICY IF EXISTS "Allow public read access on stock_snapshots" ON stock_snapshots;
DROP POLICY IF EXISTS "Allow service role full access on stock_snapshots" ON stock_snapshots;

ALTER TABLE stock_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on stock_snapshots"
  ON stock_snapshots FOR SELECT
  USING (true);

CREATE POLICY "Allow service role full access on stock_snapshots"
  ON stock_snapshots FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- 3. FIX breakout_stocks TABLE
-- ============================================
DROP POLICY IF EXISTS "Allow public read access on breakout_stocks" ON breakout_stocks;
DROP POLICY IF EXISTS "Allow service role full access on breakout_stocks" ON breakout_stocks;

ALTER TABLE breakout_stocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on breakout_stocks"
  ON breakout_stocks FOR SELECT
  USING (true);

CREATE POLICY "Allow service role full access on breakout_stocks"
  ON breakout_stocks FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- 4. FIX breakdown_stocks TABLE
-- ============================================
DROP POLICY IF EXISTS "Allow public read access on breakdown_stocks" ON breakdown_stocks;
DROP POLICY IF EXISTS "Allow service role full access on breakdown_stocks" ON breakdown_stocks;

ALTER TABLE breakdown_stocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on breakdown_stocks"
  ON breakdown_stocks FOR SELECT
  USING (true);

CREATE POLICY "Allow service role full access on breakdown_stocks"
  ON breakdown_stocks FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- VERIFY POLICIES
-- ============================================
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd, 
    qual
FROM pg_policies
WHERE tablename IN ('daily_high_low', 'stock_snapshots', 'breakout_stocks', 'breakdown_stocks')
ORDER BY tablename, policyname;
