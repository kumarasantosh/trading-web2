-- =====================================================
-- Migration: Add OI Trendline Table
-- =====================================================
-- This migration creates the oi_trendline table to store
-- total put OI and call OI data for trendline plotting.
-- Data is captured every 3 minutes during market hours (9:15 AM - 3:30 PM IST)

-- Table: oi_trendline
-- Stores total put OI and call OI for trendline plotting
-- Captured every 3 minutes during market hours (9:15 AM - 3:30 PM IST)
CREATE TABLE IF NOT EXISTS oi_trendline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  captured_at TIMESTAMPTZ NOT NULL,
  symbol VARCHAR(50) NOT NULL,
  expiry_date VARCHAR(50) NOT NULL,
  total_put_oi BIGINT NOT NULL,
  total_call_oi BIGINT NOT NULL,
  pcr DECIMAL(10, 4), -- Put Call Ratio
  nifty_spot DECIMAL(10, 2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicate entries for same symbol/expiry at same time
  CONSTRAINT unique_oi_trendline UNIQUE (symbol, expiry_date, captured_at)
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_oi_trendline_time ON oi_trendline(captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_oi_trendline_symbol_time ON oi_trendline(symbol, expiry_date, captured_at DESC);

-- Enable RLS on oi_trendline
ALTER TABLE oi_trendline ENABLE ROW LEVEL SECURITY;

-- Allow public read access
-- Note: IF NOT EXISTS is not supported for CREATE POLICY, so drop first if needed
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'oi_trendline' 
        AND policyname = 'Allow public read access on oi_trendline'
    ) THEN
        CREATE POLICY "Allow public read access on oi_trendline"
            ON oi_trendline FOR SELECT
            USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'oi_trendline' 
        AND policyname = 'Allow service role insert on oi_trendline'
    ) THEN
        CREATE POLICY "Allow service role insert on oi_trendline"
            ON oi_trendline FOR INSERT
            WITH CHECK (true);
    END IF;
END $$;

-- Update cleanup function to include oi_trendline
CREATE OR REPLACE FUNCTION cleanup_old_snapshots()
RETURNS void AS $$
BEGIN
  DELETE FROM sector_snapshots
  WHERE captured_at < NOW() - INTERVAL '90 days';
  
  DELETE FROM stock_snapshots
  WHERE captured_at < NOW() - INTERVAL '90 days';
  
  DELETE FROM option_chain_snapshots
  WHERE captured_at < NOW() - INTERVAL '90 days';
  
  DELETE FROM oi_trendline
  WHERE captured_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

