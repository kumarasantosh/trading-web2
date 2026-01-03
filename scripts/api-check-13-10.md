# Check Data at 13:10 (Historical) via API

## Quick Check via Browser

Since 13:10 IST = 07:40 UTC, you can check via API:

```
http://localhost:3000/api/snapshots?type=sector&start=2026-01-02T07:35:00.000Z&end=2026-01-02T07:45:00.000Z
```

Or use the test query API:

```
http://localhost:3000/api/test-query?time=2026-01-02T07:40:00.000Z
```

## Time Conversion Reference

- **13:10 IST** = **07:40 UTC** (IST is UTC+5:30)
- So when querying, use UTC time: `07:40:00`

## SQL Query (Supabase)

```sql
SELECT 
    captured_at,
    sector_name,
    last_price,
    change_percent
FROM sector_snapshots
WHERE captured_at = '2026-01-02 07:40:00+00:00'
ORDER BY sector_name;
```

This will show all 10 sectors at 13:10 IST (07:40 UTC).

