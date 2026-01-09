-- Stock Snapshots Table
-- Stores pre-calculated stock data updated every 3 minutes
-- Used for fast top gainers/losers queries

-- Drop existing table if needed (for clean setup)
-- DROP TABLE IF EXISTS public.stock_snapshots CASCADE;

-- Create stock_snapshots table
CREATE TABLE IF NOT EXISTS public.stock_snapshots (
    id BIGSERIAL PRIMARY KEY,
    symbol TEXT NOT NULL UNIQUE,
    open_price NUMERIC(10, 2) NOT NULL,
    last_price NUMERIC(10, 2) NOT NULL,
    percent_change NUMERIC(10, 4) NOT NULL,
    volume BIGINT DEFAULT 0,
    day_high NUMERIC(10, 2),
    day_low NUMERIC(10, 2),
    prev_close NUMERIC(10, 2),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_stock_snapshots_percent_change 
    ON public.stock_snapshots(percent_change DESC);

CREATE INDEX IF NOT EXISTS idx_stock_snapshots_symbol 
    ON public.stock_snapshots(symbol);

CREATE INDEX IF NOT EXISTS idx_stock_snapshots_updated_at 
    ON public.stock_snapshots(updated_at DESC);

-- Enable Row Level Security
ALTER TABLE public.stock_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Allow public read access
CREATE POLICY "Allow public read access" 
    ON public.stock_snapshots 
    FOR SELECT 
    USING (true);

-- Allow service role to insert/update
CREATE POLICY "Allow service role to insert" 
    ON public.stock_snapshots 
    FOR INSERT 
    WITH CHECK (true);

CREATE POLICY "Allow service role to update" 
    ON public.stock_snapshots 
    FOR UPDATE 
    USING (true);

-- Helper function to get top gainers
CREATE OR REPLACE FUNCTION get_top_gainers(limit_count INT DEFAULT 10)
RETURNS TABLE (
    symbol TEXT,
    open_price NUMERIC,
    last_price NUMERIC,
    percent_change NUMERIC,
    volume BIGINT,
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.symbol,
        s.open_price,
        s.last_price,
        s.percent_change,
        s.volume,
        s.updated_at
    FROM stock_snapshots s
    WHERE s.percent_change > 0
    ORDER BY s.percent_change DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- Helper function to get top losers
CREATE OR REPLACE FUNCTION get_top_losers(limit_count INT DEFAULT 10)
RETURNS TABLE (
    symbol TEXT,
    open_price NUMERIC,
    last_price NUMERIC,
    percent_change NUMERIC,
    volume BIGINT,
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.symbol,
        s.open_price,
        s.last_price,
        s.percent_change,
        s.volume,
        s.updated_at
    FROM stock_snapshots s
    WHERE s.percent_change < 0
    ORDER BY s.percent_change ASC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- Helper function to cleanup old snapshots (optional - for maintenance)
CREATE OR REPLACE FUNCTION cleanup_old_stock_snapshots()
RETURNS void AS $$
BEGIN
    -- Delete snapshots older than 7 days
    DELETE FROM stock_snapshots
    WHERE updated_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT ON public.stock_snapshots TO anon, authenticated;
GRANT ALL ON public.stock_snapshots TO service_role;
GRANT USAGE, SELECT ON SEQUENCE stock_snapshots_id_seq TO service_role;

-- Comments
COMMENT ON TABLE public.stock_snapshots IS 'Stores pre-calculated stock snapshots updated every 3 minutes for fast top movers queries';
COMMENT ON COLUMN public.stock_snapshots.symbol IS 'Stock symbol (unique)';
COMMENT ON COLUMN public.stock_snapshots.open_price IS 'Opening price of the day';
COMMENT ON COLUMN public.stock_snapshots.last_price IS 'Last traded price (LTP)';
COMMENT ON COLUMN public.stock_snapshots.percent_change IS 'Pre-calculated percent change from open: ((LTP - Open) / Open) * 100';
COMMENT ON COLUMN public.stock_snapshots.updated_at IS 'Last update timestamp';
