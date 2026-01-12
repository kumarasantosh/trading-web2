-- Fix RLS policies for daily_high_low table to allow service role access
-- Run this in your Supabase SQL Editor

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public read access on daily_high_low" ON daily_high_low;
DROP POLICY IF EXISTS "Allow service role full access on daily_high_low" ON daily_high_low;

-- Enable RLS
ALTER TABLE daily_high_low ENABLE ROW LEVEL SECURITY;

-- Allow public read access (for frontend)
CREATE POLICY "Allow public read access on daily_high_low"
  ON daily_high_low FOR SELECT
  USING (true);

-- Allow service role full access (for cron jobs)
CREATE POLICY "Allow service role full access on daily_high_low"
  ON daily_high_low FOR ALL
  USING (auth.role() = 'service_role');

-- Verify policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'daily_high_low';
