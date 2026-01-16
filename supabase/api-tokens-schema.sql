-- API Tokens Table
-- Stores API tokens for external services (e.g., Groww API)
-- Used for persistence across serverless function invocations

CREATE TABLE IF NOT EXISTS public.api_tokens (
    id TEXT PRIMARY KEY,
    token TEXT NOT NULL,
    expiry TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.api_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Allow service role full access
CREATE POLICY "Allow service role full access" 
    ON public.api_tokens 
    FOR ALL 
    USING (true)
    WITH CHECK (true);

-- Grant permissions
GRANT ALL ON public.api_tokens TO service_role;

-- Comments
COMMENT ON TABLE public.api_tokens IS 'Stores API tokens for external services with expiry tracking';
COMMENT ON COLUMN public.api_tokens.id IS 'Unique identifier for the token (e.g., groww_api_token)';
COMMENT ON COLUMN public.api_tokens.token IS 'The actual API token/access token';
COMMENT ON COLUMN public.api_tokens.expiry IS 'Token expiry timestamp';
