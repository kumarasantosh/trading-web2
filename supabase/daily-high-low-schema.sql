-- =====================================================
-- Daily High-Low Tracking & Breakout/Breakdown Detection Schema
-- =====================================================

-- Table: daily_high_low
-- Stores yesterday's high and low for each stock (captured at EOD 3:35 PM IST)
-- This data is used as reference for next trading day's breakout/breakdown detection
CREATE TABLE IF NOT EXISTS daily_high_low (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol VARCHAR(50) NOT NULL,
  sector VARCHAR(100),
  today_high DECIMAL(10, 2) NOT NULL,
  today_low DECIMAL(10, 2) NOT NULL,
  captured_date DATE NOT NULL, -- Date when this was captured (becomes "yesterday" for next session)
  captured_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure only one record per stock per date
  CONSTRAINT unique_daily_high_low UNIQUE (symbol, captured_date)
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_daily_high_low_symbol ON daily_high_low(symbol);
CREATE INDEX IF NOT EXISTS idx_daily_high_low_date ON daily_high_low(captured_date DESC);

-- =====================================================

-- Table: breakout_stocks
-- Tracks stocks where current LTP > yesterday's high
-- Each stock appears only once per day (first breakout detection)
CREATE TABLE IF NOT EXISTS breakout_stocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol VARCHAR(50) NOT NULL,
  sector VARCHAR(100),
  ltp DECIMAL(10, 2) NOT NULL,
  yesterday_high DECIMAL(10, 2) NOT NULL,
  breakout_percent DECIMAL(10, 4), -- ((LTP - yesterday_high) / yesterday_high) * 100
  breakout_date DATE NOT NULL,
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure each stock appears only once per day
  CONSTRAINT unique_breakout_per_day UNIQUE (symbol, breakout_date)
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_breakout_stocks_date ON breakout_stocks(breakout_date DESC);
CREATE INDEX IF NOT EXISTS idx_breakout_stocks_symbol ON breakout_stocks(symbol);
CREATE INDEX IF NOT EXISTS idx_breakout_stocks_detected_at ON breakout_stocks(detected_at DESC);

-- =====================================================

-- Table: breakdown_stocks
-- Tracks stocks where current LTP < yesterday's low
-- Each stock appears only once per day (first breakdown detection)
CREATE TABLE IF NOT EXISTS breakdown_stocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol VARCHAR(50) NOT NULL,
  sector VARCHAR(100),
  ltp DECIMAL(10, 2) NOT NULL,
  yesterday_low DECIMAL(10, 2) NOT NULL,
  breakdown_percent DECIMAL(10, 4), -- ((yesterday_low - LTP) / yesterday_low) * 100
  breakdown_date DATE NOT NULL,
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure each stock appears only once per day
  CONSTRAINT unique_breakdown_per_day UNIQUE (symbol, breakdown_date)
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_breakdown_stocks_date ON breakdown_stocks(breakdown_date DESC);
CREATE INDEX IF NOT EXISTS idx_breakdown_stocks_symbol ON breakdown_stocks(symbol);
CREATE INDEX IF NOT EXISTS idx_breakdown_stocks_detected_at ON breakdown_stocks(detected_at DESC);

-- =====================================================
-- Row Level Security (RLS) Policies
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE daily_high_low ENABLE ROW LEVEL SECURITY;
ALTER TABLE breakout_stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE breakdown_stocks ENABLE ROW LEVEL SECURITY;

-- Allow public read access (for authenticated and anonymous users)
CREATE POLICY "Allow public read access on daily_high_low"
  ON daily_high_low FOR SELECT
  USING (true);

CREATE POLICY "Allow public read access on breakout_stocks"
  ON breakout_stocks FOR SELECT
  USING (true);

CREATE POLICY "Allow public read access on breakdown_stocks"
  ON breakdown_stocks FOR SELECT
  USING (true);

-- Allow service role to insert/update/delete (for cron jobs)
CREATE POLICY "Allow service role full access on daily_high_low"
  ON daily_high_low FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow service role full access on breakout_stocks"
  ON breakout_stocks FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow service role full access on breakdown_stocks"
  ON breakdown_stocks FOR ALL
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- Helper Functions
-- =====================================================

-- Function to clean up old breakout/breakdown records (optional, for maintenance)
CREATE OR REPLACE FUNCTION cleanup_old_breakout_breakdown()
RETURNS void AS $$
BEGIN
  -- Delete breakout/breakdown records older than 7 days
  DELETE FROM breakout_stocks
  WHERE breakout_date < CURRENT_DATE - INTERVAL '7 days';
  
  DELETE FROM breakdown_stocks
  WHERE breakdown_date < CURRENT_DATE - INTERVAL '7 days';
  
  -- Keep only latest daily_high_low (delete records older than 2 days)
  DELETE FROM daily_high_low
  WHERE captured_date < CURRENT_DATE - INTERVAL '2 days';
END;
$$ LANGUAGE plpgsql;

-- =====================================================
