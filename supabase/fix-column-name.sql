-- Complete fix for stock_snapshots table
-- This will drop and recreate the table with the correct schema

-- Drop existing table and all dependencies
DROP TABLE IF EXISTS public.stock_snapshots CASCADE;

-- Create stock_snapshots table with correct schema
CREATE TABLE public.stock_snapshots (
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
CREATE INDEX idx_stock_snapshots_percent_change 
    ON public.stock_snapshots(percent_change DESC);

CREATE INDEX idx_stock_snapshots_symbol 
    ON public.stock_snapshots(symbol);

CREATE INDEX idx_stock_snapshots_updated_at 
    ON public.stock_snapshots(updated_at DESC);

-- Enable Row Level Security
ALTER TABLE public.stock_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow public read access" 
    ON public.stock_snapshots 
    FOR SELECT 
    USING (true);

CREATE POLICY "Allow service role to insert" 
    ON public.stock_snapshots 
    FOR INSERT 
    WITH CHECK (true);

CREATE POLICY "Allow service role to update" 
    ON public.stock_snapshots 
    FOR UPDATE 
    USING (true);

-- Grant permissions
GRANT SELECT ON public.stock_snapshots TO anon, authenticated;
GRANT ALL ON public.stock_snapshots TO service_role;
GRANT USAGE, SELECT ON SEQUENCE stock_snapshots_id_seq TO service_role;
