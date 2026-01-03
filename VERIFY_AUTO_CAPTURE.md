# Quick Verification Guide

## Option 1: Use the Verification API (Easiest)

1. Make sure your dev server is running: `npm run dev`
2. Visit in browser: `http://localhost:3000/api/verify-capture`
3. This will show you:
   - ✅ Timestamp rounding status
   - ✅ Data consistency check
   - ✅ Recent captures summary
   - ✅ Recommendations

## Option 2: Use the Shell Script

```bash
./scripts/verify-capture.sh
```

This script will:
- Check if dev server is running
- Call the verification API
- Display recent snapshots
- Show recommendations

## Option 3: Manual SQL Checks

See `scripts/verify-capture-logic.md` for detailed SQL queries to run in Supabase.

## What to Look For

✅ **Good Signs:**
- Timestamps are rounded (end in :00, :05, :10, etc.)
- 10 sectors captured per timestamp
- Recent captures show up in the database

⚠️ **Common Issues:**
- Unrounded timestamps → Run SQL normalization script
- All data values identical → Normal if market hasn't moved
- No data found → Check if auto-capture is running

