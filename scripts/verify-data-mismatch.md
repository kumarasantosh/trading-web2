# Data Verification: Database vs UI Display

## Issue Identified

The **database** stores `change_percent` calculated from **previous_close**, but the **UI** calculates change from **open** price.

### Database Calculation:
```sql
change_percent = ((last_price - previous_close) / previous_close) * 100
```

### UI Calculation (for '1D' range):
```typescript
getChangePercent = ((last - open) / open) * 100
```

## Example (Realty):

**Database:**
- `previous_close`: 885.30
- `open`: 886.55
- `last`: 897.60
- `change_percent`: 1.39% (from previous_close)

**UI Calculation:**
- `changePercent`: (897.60 - 886.55) / 886.55 * 100 = **1.25%** (from open)

## Verification Query

Run this in Supabase to verify:

```sql
SELECT 
    sector_name,
    last_price,
    open_price,
    previous_close,
    change_percent as db_change_percent,
    -- Calculate what UI shows (from open to last)
    ROUND(((last_price - open_price) / open_price * 100)::numeric, 2) as ui_calculated_change,
    -- Verify database change_percent (from previous_close to last)
    ROUND(((last_price - previous_close) / previous_close * 100)::numeric, 2) as db_calculated_change
FROM sector_snapshots
WHERE captured_at = '2026-01-02 07:40:00+00:00'
ORDER BY sector_name;
```

## Conclusion

**This is expected behavior** - the UI intentionally calculates change from `open` price for the '1D' view, while the database stores change from `previous_close`. Both are valid metrics:

- **Database `change_percent`**: Day's total change (from previous day's close)
- **UI `getChangePercent()`**: Change from today's open price

The data is being saved correctly - the difference is just in which baseline is used for calculation.

