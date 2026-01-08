-- =====================================================
-- PCR (Put-Call Ratio) Data Storage Schema
-- =====================================================

-- Table: pcr_data
-- Stores PCR calculations for NIFTY, BANKNIFTY, and FINNIFTY
-- Calculated every 1 minute during market hours using ATM ±10 strikes
CREATE TABLE IF NOT EXISTS pcr_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  index_name VARCHAR(20) NOT NULL, -- NIFTY, BANKNIFTY, FINNIFTY
  total_put_oi BIGINT NOT NULL, -- Total Put Open Interest
  total_call_oi BIGINT NOT NULL, -- Total Call Open Interest
  pcr_value DECIMAL(10, 4) NOT NULL, -- Put-Call Ratio = Put OI / Call OI
  sentiment VARCHAR(10) NOT NULL, -- Bullish, Neutral, Bearish
  spot_price DECIMAL(10, 2), -- Current spot price of the index
  atm_strike DECIMAL(10, 2), -- ATM strike used for calculation
  strikes_used INTEGER DEFAULT 21, -- Number of strikes used (ATM ±10)
  captured_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure only one record per index per minute
  CONSTRAINT unique_pcr_per_minute UNIQUE (index_name, captured_at)
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_pcr_data_index_time ON pcr_data(index_name, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_pcr_data_time ON pcr_data(captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_pcr_data_sentiment ON pcr_data(sentiment);

-- =====================================================
-- Row Level Security (RLS) Policies
-- =====================================================

-- Enable RLS
ALTER TABLE pcr_data ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access on pcr_data"
  ON pcr_data FOR SELECT
  USING (true);

-- Allow service role to insert (for cron jobs)
CREATE POLICY "Allow service role insert on pcr_data"
  ON pcr_data FOR INSERT
  WITH CHECK (true);

-- =====================================================
-- Helper Functions
-- =====================================================

-- Function to get latest PCR for all indices
CREATE OR REPLACE FUNCTION get_latest_pcr()
RETURNS TABLE (
  index_name VARCHAR,
  total_put_oi BIGINT,
  total_call_oi BIGINT,
  pcr_value DECIMAL,
  sentiment VARCHAR,
  spot_price DECIMAL,
  atm_strike DECIMAL,
  captured_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (p.index_name)
    p.index_name,
    p.total_put_oi,
    p.total_call_oi,
    p.pcr_value,
    p.sentiment,
    p.spot_price,
    p.atm_strike,
    p.captured_at
  FROM pcr_data p
  ORDER BY p.index_name, p.captured_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old PCR data (optional, for maintenance)
CREATE OR REPLACE FUNCTION cleanup_old_pcr_data()
RETURNS void AS $$
BEGIN
  -- Delete PCR records older than 7 days
  DELETE FROM pcr_data
  WHERE captured_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- =====================================================
