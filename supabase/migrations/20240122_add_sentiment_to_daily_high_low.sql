-- Add sentiment column to daily_high_low table
ALTER TABLE daily_high_low ADD COLUMN IF NOT EXISTS sentiment TEXT;

-- Ensure today_open and today_close columns exist (if they were added manually before)
ALTER TABLE daily_high_low ADD COLUMN IF NOT EXISTS today_open DECIMAL(10, 2);
ALTER TABLE daily_high_low ADD COLUMN IF NOT EXISTS today_close DECIMAL(10, 2);

-- Comment on columns
COMMENT ON COLUMN daily_high_low.sentiment IS 'Market sentiment for the day: green (Close > PrevClose/Open) or red';
COMMENT ON COLUMN daily_high_low.today_open IS 'Opening price. Initially captured from previous day, then updated with live open next morning.';
