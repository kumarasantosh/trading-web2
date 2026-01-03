# Debug: Random Data Showing When DB is Empty

## Issue
Even when the entire database is empty, selecting 13:40 shows random data.

## Fixes Applied

1. **Clear data when entering replay mode** - Added `setSectorData([])` in useEffect when entering replay mode
2. **Return empty array when no data** - `sortedSectorData` returns `[]` when `isReplayMode && noDataForTime` is true
3. **Clear data on error** - Added `setSectorData([])` in catch block of `fetchLiveSectors`

## How to Verify

1. **Check browser console** - Look for these logs:
   - `[SectorPerformance] Fetching historical data for time:`
   - `[SectorPerformance] No snapshots found for time range`
   - `[SectorPerformance] API response: { snapshotCount: 0 }`

2. **Check the render logic** - When `isReplayMode && noDataForTime` is true:
   - `sortedSectorData` should be `[]`
   - Should show "No sector data was captured" message
   - Should NOT render any sector bars

3. **Verify state** - In React DevTools:
   - `sectorData` should be `[]`
   - `noDataForTime` should be `true`
   - `isReplayMode` should be `true`

## If Still Showing Data

Check if:
- API is returning empty array `[]` vs `null` or `undefined`
- `noDataForTime` is being set correctly
- There's a race condition between state updates
- Browser cache is showing old data (hard refresh: Cmd+Shift+R)

