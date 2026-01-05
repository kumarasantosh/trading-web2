-- =====================================================
-- Supabase Database Schema for Time-Travel Replay System
-- =====================================================

-- Table: sector_snapshots
-- Stores historical sector performance data captured every 5 minutes
CREATE TABLE IF NOT EXISTS sector_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  captured_at TIMESTAMPTZ NOT NULL,
  sector_name VARCHAR(100) NOT NULL,
  last_price DECIMAL(10, 2),
  open_price DECIMAL(10, 2),
  previous_close DECIMAL(10, 2),
  change_percent DECIMAL(10, 4),
  variation DECIMAL(10, 2),
  one_week_ago_val DECIMAL(10, 2),
  one_month_ago_val DECIMAL(10, 2),
  one_year_ago_val DECIMAL(10, 2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicate snapshots for same sector at same time
  CONSTRAINT unique_sector_snapshot UNIQUE (sector_name, captured_at)
);

-- Indexes for fast time-range queries
CREATE INDEX IF NOT EXISTS idx_sector_snapshots_time ON sector_snapshots(captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_sector_snapshots_sector_time ON sector_snapshots(sector_name, captured_at DESC);

-- =====================================================

-- Table: stock_snapshots
-- Stores historical stock data captured every 5 minutes
CREATE TABLE IF NOT EXISTS stock_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  captured_at TIMESTAMPTZ NOT NULL,
  symbol VARCHAR(50) NOT NULL,
  sector VARCHAR(100),
  ltp DECIMAL(10, 2),
  open_price DECIMAL(10, 2),
  close_price DECIMAL(10, 2),
  change_percent DECIMAL(10, 4),
  high DECIMAL(10, 2),
  low DECIMAL(10, 2),
  volume BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicate snapshots for same stock at same time
  CONSTRAINT unique_stock_snapshot UNIQUE (symbol, captured_at)
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_stock_snapshots_time ON stock_snapshots(captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_snapshots_symbol_time ON stock_snapshots(symbol, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_snapshots_sector_time ON stock_snapshots(sector, captured_at DESC);

-- =====================================================
-- Row Level Security (RLS) Policies
-- =====================================================

-- Enable RLS on both tables
ALTER TABLE sector_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_snapshots ENABLE ROW LEVEL SECURITY;

-- Allow public read access (for authenticated and anonymous users)
CREATE POLICY "Allow public read access on sector_snapshots"
  ON sector_snapshots FOR SELECT
  USING (true);

CREATE POLICY "Allow public read access on stock_snapshots"
  ON stock_snapshots FOR SELECT
  USING (true);

-- Allow service role to insert (for cron job)
CREATE POLICY "Allow service role insert on sector_snapshots"
  ON sector_snapshots FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow service role insert on stock_snapshots"
  ON stock_snapshots FOR INSERT
  WITH CHECK (true);

-- =====================================================
-- Helper Functions
-- =====================================================

-- Function to get snapshots for a specific time range
CREATE OR REPLACE FUNCTION get_sector_snapshots_by_range(
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ
)
RETURNS TABLE (
  captured_at TIMESTAMPTZ,
  sector_name VARCHAR,
  last_price DECIMAL,
  change_percent DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.captured_at,
    s.sector_name,
    s.last_price,
    s.change_percent
  FROM sector_snapshots s
  WHERE s.captured_at BETWEEN start_time AND end_time
  ORDER BY s.captured_at ASC, s.sector_name ASC;
END;
$$ LANGUAGE plpgsql;

-- =====================================================

-- Table: option_chain_snapshots
-- Stores historical option chain data captured every 5 minutes
CREATE TABLE IF NOT EXISTS option_chain_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  captured_at TIMESTAMPTZ NOT NULL,
  symbol VARCHAR(50) NOT NULL,
  expiry_date VARCHAR(50) NOT NULL,
  nifty_spot DECIMAL(10, 2),
  option_chain_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicate snapshots for same symbol/expiry at same time
  CONSTRAINT unique_option_chain_snapshot UNIQUE (symbol, expiry_date, captured_at)
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_option_chain_snapshots_time ON option_chain_snapshots(captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_option_chain_snapshots_symbol_time ON option_chain_snapshots(symbol, expiry_date, captured_at DESC);

-- Enable RLS on option_chain_snapshots
ALTER TABLE option_chain_snapshots ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access on option_chain_snapshots"
  ON option_chain_snapshots FOR SELECT
  USING (true);

-- Allow service role to insert (for cron job)
CREATE POLICY "Allow service role insert on option_chain_snapshots"
  ON option_chain_snapshots FOR INSERT
  WITH CHECK (true);

-- =====================================================

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
CREATE POLICY "Allow public read access on oi_trendline"
  ON oi_trendline FOR SELECT
  USING (true);

-- Allow service role to insert (for cron job)
CREATE POLICY "Allow service role insert on oi_trendline"
  ON oi_trendline FOR INSERT
  WITH CHECK (true);

-- =====================================================
-- Data Retention Policy (Optional)
-- =====================================================

-- Function to delete snapshots older than 90 days
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

-- Schedule cleanup to run daily (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-old-snapshots', '0 2 * * *', 'SELECT cleanup_old_snapshots()');
