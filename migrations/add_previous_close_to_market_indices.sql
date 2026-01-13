-- Add previous_close and open_price columns to market_indices_snapshots table
ALTER TABLE market_indices_snapshots 
ADD COLUMN IF NOT EXISTS previous_close DECIMAL(10, 2) DEFAULT 0;

ALTER TABLE market_indices_snapshots 
ADD COLUMN IF NOT EXISTS open_price DECIMAL(10, 2) DEFAULT 0;

-- Update existing records to calculate previous_close from value and change
UPDATE market_indices_snapshots 
SET previous_close = value - change 
WHERE previous_close IS NULL OR previous_close = 0;
