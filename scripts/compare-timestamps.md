# How to Verify if Data is Different at Different Times

## Quick Check via API

Visit: `http://localhost:3000/api/test-snapshots?limit=5`

This will show you the most recent 5 timestamps. Compare the values:
- If all `last_price` and `change_percent` values are identical → Market data hasn't changed
- If values are different → Data is being captured correctly, and the slider should show different data

## Detailed Check via SQL

Run this in Supabase SQL Editor to compare values across timestamps:

```sql
-- Compare values for a specific sector across different timestamps
SELECT 
    captured_at,
    sector_name,
    last_price,
    change_percent
FROM sector_snapshots
WHERE sector_name = 'Realty'  -- or any other sector
ORDER BY captured_at DESC
LIMIT 10;
```

If all rows show the same `last_price` and `change_percent`, the market data hasn't changed between captures.

## Expected Behavior

- **If market data is the same**: All timestamps will show identical values (this is normal if the market hasn't moved)
- **If market data is different**: Different timestamps will show different values, and the slider will display different data

## Testing

1. Wait for a few more captures (13:15, 13:20, etc.)
2. Check if the values change over time
3. If values remain the same, the market data API might be returning cached/stale data, or the market is not moving much

The slider functionality is working correctly - it's just that the underlying data values are identical.

