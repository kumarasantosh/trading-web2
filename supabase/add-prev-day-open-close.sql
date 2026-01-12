-- Add today_open and today_close columns to daily_high_low table
-- This allows us to show the sentiment indicator (green/red dot) based on whether
-- the day closed higher or lower than it opened

ALTER TABLE daily_high_low 
ADD COLUMN IF NOT EXISTS today_open DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS today_close DECIMAL(10, 2);

-- Add comment to explain the columns
COMMENT ON COLUMN daily_high_low.today_open IS 'Opening price for the captured trading day';
COMMENT ON COLUMN daily_high_low.today_close IS 'Closing price for the captured trading day';
