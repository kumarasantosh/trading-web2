-- Breakout Snapshots Table Schema
-- Stores pre-calculated breakout and breakdown data for stocks
-- Updated every 5 minutes by background job

-- Drop existing table if needed (for development)
DROP TABLE IF EXISTS breakout_snapshots CASCADE;

-- Create breakout_snapshots table
CREATE TABLE breakout_snapshots (
    id BIGSERIAL PRIMARY KEY,
    symbol TEXT NOT NULL UNIQUE,
    current_price NUMERIC(10, 2) NOT NULL,
    prev_day_high NUMERIC(10, 2) NOT NULL,
    prev_day_low NUMERIC(10, 2) NOT NULL,
    prev_day_close NUMERIC(10, 2) NOT NULL,
    prev_day_open NUMERIC(10, 2),
    breakout_percentage NUMERIC(10, 4) DEFAULT 0,
    breakdown_percentage NUMERIC(10, 4) DEFAULT 0,
    is_breakout BOOLEAN DEFAULT FALSE,
    is_breakdown BOOLEAN DEFAULT FALSE,
    volume BIGINT DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_breakout_snapshots_breakout_pct ON breakout_snapshots(breakout_percentage DESC) WHERE is_breakout = TRUE;
CREATE INDEX idx_breakout_snapshots_breakdown_pct ON breakout_snapshots(breakdown_percentage ASC) WHERE is_breakdown = TRUE;
CREATE INDEX idx_breakout_snapshots_symbol ON breakout_snapshots(symbol);
CREATE INDEX idx_breakout_snapshots_updated_at ON breakout_snapshots(updated_at DESC);

-- Enable Row Level Security
ALTER TABLE breakout_snapshots ENABLE ROW LEVEL SECURITY;

-- Create policies
-- Allow public read access
CREATE POLICY "Allow public read access"
    ON breakout_snapshots
    FOR SELECT
    TO public
    USING (true);

-- Allow service role to insert/update
CREATE POLICY "Allow service role to insert/update"
    ON breakout_snapshots
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Helper function: Get top breakouts
CREATE OR REPLACE FUNCTION get_top_breakouts(limit_count INT DEFAULT 10)
RETURNS TABLE (
    symbol TEXT,
    current_price NUMERIC,
    prev_day_high NUMERIC,
    breakout_percentage NUMERIC,
    volume BIGINT,
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        b.symbol,
        b.current_price,
        b.prev_day_high,
        b.breakout_percentage,
        b.volume,
        b.updated_at
    FROM breakout_snapshots b
    WHERE b.is_breakout = TRUE
    ORDER BY b.breakout_percentage DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Helper function: Get top breakdowns
CREATE OR REPLACE FUNCTION get_top_breakdowns(limit_count INT DEFAULT 10)
RETURNS TABLE (
    symbol TEXT,
    current_price NUMERIC,
    prev_day_low NUMERIC,
    breakdown_percentage NUMERIC,
    volume BIGINT,
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        b.symbol,
        b.current_price,
        b.prev_day_low,
        b.breakdown_percentage,
        b.volume,
        b.updated_at
    FROM breakout_snapshots b
    WHERE b.is_breakdown = TRUE
    ORDER BY b.breakdown_percentage ASC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Helper function: Cleanup old breakout snapshots (older than 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_breakout_snapshots()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM breakout_snapshots
    WHERE updated_at < NOW() - INTERVAL '7 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE breakout_snapshots IS 'Stores pre-calculated breakout and breakdown data for stocks, updated every 5 minutes';
COMMENT ON COLUMN breakout_snapshots.breakout_percentage IS 'Percentage above previous day high: ((current - prev_high) / prev_high) * 100';
COMMENT ON COLUMN breakout_snapshots.breakdown_percentage IS 'Percentage below previous day low: ((current - prev_low) / prev_low) * 100';
COMMENT ON COLUMN breakout_snapshots.is_breakout IS 'TRUE if current_price > prev_day_high';
COMMENT ON COLUMN breakout_snapshots.is_breakdown IS 'TRUE if current_price < prev_day_low';
