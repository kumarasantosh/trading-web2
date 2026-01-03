-- =====================================================
-- Market Indices Snapshots Table
-- Stores market indices data captured at 3:30 PM daily
-- =====================================================

-- Table: market_indices_snapshots
-- Stores market indices data captured at end of trading day (3:30 PM IST)
CREATE TABLE IF NOT EXISTS market_indices_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  captured_at DATE NOT NULL, -- Date only (3:30 PM IST = 10:00 UTC)
  index_name VARCHAR(100) NOT NULL,
  value DECIMAL(10, 2),
  change DECIMAL(10, 2),
  change_percent DECIMAL(10, 4),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- One snapshot per index per day
  CONSTRAINT unique_market_index_snapshot UNIQUE (index_name, captured_at)
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_market_indices_date ON market_indices_snapshots(captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_indices_name_date ON market_indices_snapshots(index_name, captured_at DESC);

-- Enable RLS
ALTER TABLE market_indices_snapshots ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access on market_indices_snapshots"
  ON market_indices_snapshots FOR SELECT
  USING (true);

-- Allow service role to insert (for cron job)
CREATE POLICY "Allow service role insert on market_indices_snapshots"
  ON market_indices_snapshots FOR INSERT
  WITH CHECK (true);

-- Allow service role to delete (for cleanup)
CREATE POLICY "Allow service role delete on market_indices_snapshots"
  ON market_indices_snapshots FOR DELETE
  USING (true);

