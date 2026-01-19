'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { hasSectorStocks } from '@/constants/sector-stocks-mapping'
import TimelineSlider from './TimelineSlider'

interface SectorData {
  name: string
  previousClose: number
  changePercent: number
  open: number
  last: number
  variation: number
  oneWeekAgoVal: number
  oneMonthAgoVal: number
  oneYearAgoVal: number
  previousHigh: number
  previousLow: number
}

interface SectorPerformanceProps {
  onSectorClick: (sectorName: string) => void
  selectedSector: string | null
  isReplayMode?: boolean
  replayTime?: Date
  onTimeChange?: (time: Date) => void
  onReplayModeChange?: (enabled: boolean) => void
}

export default function SectorPerformance({
  onSectorClick,
  selectedSector,
  isReplayMode = false,
  replayTime,
  onTimeChange,
  onReplayModeChange
}: SectorPerformanceProps) {
  const [selectedRange, setSelectedRange] = useState<'1D' | '7D' | '30D' | '52W'>('1D')
  const [sectorData, setSectorData] = useState<SectorData[]>([])
  const [noDataForTime, setNoDataForTime] = useState(false)
  const [isLoadingData, setIsLoadingData] = useState(false)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [dataCaptureTime, setDataCaptureTime] = useState<Date | null>(null)

  // Track replay mode state to prevent live data from showing in replay mode
  // Update ref IMMEDIATELY (synchronously) when prop changes, not in useEffect
  const isReplayModeRef = useRef(isReplayMode)
  isReplayModeRef.current = isReplayMode // Sync update on every render

  // Fetch live sector data (ONLY when NOT in replay mode)
  const fetchLiveSectors = useCallback(async () => {
    // CRITICAL: Don't fetch or set live data if we're in replay mode
    // This prevents live data from overwriting "no data" state
    if (isReplayModeRef.current) {
      console.log('[SectorPerformance] ❌ Skipping live fetch - in replay mode')
      return
    }

    // Fetching live data

    try {
      setIsLoadingData(true)
      setNoDataForTime(false)
      const { fetchSectorData } = await import('@/services/momentumApi')
      const data = await fetchSectorData()

      // CRITICAL: Double-check we're still not in replay mode after async fetch
      // This prevents live data from showing when user switched to historical view
      if (isReplayModeRef.current) {
        console.log('[SectorPerformance] ❌ Discarding live data - switched to replay mode during fetch')
        setIsLoadingData(false)
        return
      }

      // Setting live sector data
      // Transform to SectorData format with required properties
      const transformedData: SectorData[] = data.map((item: any) => ({
        ...item,
        previousHigh: item.previousHigh || item.last || 0,
        previousLow: item.previousLow || item.last || 0,
      }))
      const sortedData = transformedData.sort((a, b) => b.changePercent - a.changePercent)
      setSectorData(sortedData)
    } catch (error) {
      console.error('Failed to fetch sector data', error)
      // On error, clear data to prevent showing stale data
      setSectorData([])
    } finally {
      setIsLoadingData(false)
    }
  }, [])

  // Fetch historical data for a specific time (similar to option chain)
  const fetchHistoricalDataForTime = useCallback(async (time: Date) => {
    try {
      setIsLoadingData(true)
      setNoDataForTime(false)
      setSectorData([]) // Clear data immediately

      // Calculate time range around the selected time (±3 minutes)
      // API will only return data if it's within ±2.5 minutes of the target
      const start = new Date(time)
      start.setMinutes(start.getMinutes() - 3)
      const end = new Date(time)
      end.setMinutes(end.getMinutes() + 3)

      console.log('[SectorPerformance] Fetching historical data for time:', time.toISOString())
      console.log('[SectorPerformance] Query range:', start.toISOString(), 'to', end.toISOString())

      const response = await fetch(
        `/api/snapshots?type=sector&start=${start.toISOString()}&end=${end.toISOString()}`
      )

      if (!response.ok) {
        console.error('[SectorPerformance] API response not OK:', response.status)
        setNoDataForTime(true)
        setSectorData([])
        setIsLoadingData(false)
        return
      }

      const result = await response.json()
      console.log('[SectorPerformance] API response:', { snapshotCount: result.snapshots?.length || 0 })
      const { snapshots } = result

      if (!snapshots || snapshots.length === 0) {
        console.log('[SectorPerformance] No snapshots found for time range')
        setNoDataForTime(true)
        setSectorData([])
        setDataCaptureTime(null)
        setIsLoadingData(false)
        return
      }

      // Transform snapshot data to SectorData format
      const transformedData: SectorData[] = snapshots.map((snap: any) => ({
        name: snap.sector_name,
        previousClose: snap.previous_close,
        changePercent: snap.change_percent,
        open: snap.open_price,
        last: snap.last_price,
        variation: snap.variation,
        oneWeekAgoVal: snap.one_week_ago_val,
        oneMonthAgoVal: snap.one_month_ago_val,
        oneYearAgoVal: snap.one_year_ago_val,
        previousHigh: snap.previous_high || snap.last_price || 0,
        previousLow: snap.previous_low || snap.last_price || 0,
      }))

      const sortedData = transformedData.sort((a, b) => b.changePercent - a.changePercent)
      console.log('[SectorPerformance] Setting sector data:', sortedData.length, 'sectors')
      console.log('[SectorPerformance] Sample data:', sortedData.slice(0, 3).map(s => ({ name: s.name, last: s.last, change: s.changePercent })))

      // Get the actual captured_at time from snapshots
      // The API returns snapshots with captured_at, get the most common one (they should all be the same)
      if (snapshots.length > 0) {
        const captureTimes = snapshots.map((s: any) => s.captured_at).filter(Boolean)
        if (captureTimes.length > 0) {
          // Get the most common captured_at (should all be the same, but just in case)
          const timeCounts = new Map<string, number>()
          captureTimes.forEach((t: string) => {
            timeCounts.set(t, (timeCounts.get(t) || 0) + 1)
          })
          const mostCommonTime = Array.from(timeCounts.entries())
            .sort((a, b) => b[1] - a[1])[0]?.[0]

          if (mostCommonTime) {
            setDataCaptureTime(new Date(mostCommonTime))
            console.log('[SectorPerformance] Data capture time:', mostCommonTime)
          }
        }
      }

      setSectorData(sortedData)
      setNoDataForTime(false)
    } catch (error) {
      console.error('Error fetching historical data:', error)
      setNoDataForTime(true)
      setSectorData([])
    } finally {
      setIsLoadingData(false)
    }
  }, [])

  useEffect(() => {
    console.log('[SectorPerformance] useEffect triggered:', { isReplayMode, replayTime: replayTime?.toISOString() })

    // Clear any interval from previous render
    let interval: NodeJS.Timeout | null = null

    if (isReplayMode && replayTime) {
      // REPLAY MODE - Fetching historical data
      // CRITICAL: Clear any existing data immediately when entering replay mode
      // This prevents stale live data from showing
      setSectorData([])
      setNoDataForTime(false)
      setDataCaptureTime(null)
      fetchHistoricalDataForTime(replayTime)
    } else {
      // LIVE MODE - Fetching live data
      setNoDataForTime(false) // Reset when exiting replay mode
      setDataCaptureTime(null)
      fetchLiveSectors()
      // Auto-refresh every 1 minute for live data (ONLY in live mode)
      interval = setInterval(() => {
        if (!isReplayModeRef.current) {
          fetchLiveSectors()
        }
      }, 60000)
    }

    return () => {
      if (interval) {
        clearInterval(interval)
      }
    }
  }, [isReplayMode, replayTime?.getTime(), fetchHistoricalDataForTime, fetchLiveSectors])


  // Calculate percentage change based on selected range
  const getChangePercent = (sector: SectorData) => {
    const current = sector.last
    let baseValue = sector.open // Changed from previousClose to open

    switch (selectedRange) {
      case '7D':
        baseValue = sector.oneWeekAgoVal || sector.previousClose
        break
      case '30D':
        baseValue = sector.oneMonthAgoVal || sector.previousClose
        break
      case '52W':
        baseValue = sector.oneYearAgoVal || sector.previousClose
        break
      default: // '1D'
        baseValue = sector.open // Changed to use open instead of previousClose
    }

    if (baseValue === 0) return 0
    return ((current - baseValue) / baseValue) * 100
  }

  const ranges: Array<'1D' | '7D' | '30D' | '52W'> = ['1D', '7D', '30D', '52W']

  // DEBUG: Log state on every render (only in development)
  if (process.env.NODE_ENV === 'development') {
    console.log('[SectorPerformance] RENDER STATE:', {
      isReplayMode,
      noDataForTime,
      sectorDataLength: sectorData.length,
      isLoadingData,
      replayTime: replayTime?.toISOString()
    })
  }

  // CRITICAL: In replay mode, we should NEVER show live data
  // Only show data that was explicitly fetched for the selected historical time
  // We use a ref to track if we're currently in a valid historical data state
  const hasValidHistoricalData = isReplayMode && sectorData.length > 0 && !noDataForTime && !isLoadingData

  // In live mode, show data if available
  const hasLiveData = !isReplayMode && sectorData.length > 0

  const shouldShowData = hasValidHistoricalData || hasLiveData

  const sortedSectorData = shouldShowData
    ? [...sectorData].sort((a, b) => {
      const changeA = getChangePercent(a)
      const changeB = getChangePercent(b)
      if (sortOrder === 'desc') {
        return changeB - changeA
      } else {
        return changeA - changeB
      }
    })
    : []

  // Calculate min and max for better bar distribution using selected range
  const changeValues = sortedSectorData.map(s => getChangePercent(s)).filter(v => v !== 0)
  const minChange = changeValues.length > 0 ? Math.min(...changeValues) : 0
  const maxChange = changeValues.length > 0 ? Math.max(...changeValues) : 0
  const range = Math.max(Math.abs(minChange), Math.abs(maxChange), 0.1) // Minimum range of 0.1

  const toggleSortOrder = () => {
    setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')
  }

  // Removed verbose logging for performance

  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-2xl border border-gray-200/50 shadow-xl p-3 sm:p-4 hover:shadow-2xl transition-all duration-300">
      {/* Header */}
      <div className="mb-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <h2 className="text-xl sm:text-2xl font-extrabold text-black">Sector Performance</h2>
            {isReplayMode && replayTime ? (
              <div className="flex items-center gap-2 px-2 sm:px-3 py-1 bg-blue-50 rounded-lg border border-blue-200">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                <span className="text-xs font-semibold text-blue-700">
                  {replayTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-2 sm:px-3 py-1 bg-green-50 rounded-lg border border-green-200">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                <span className="text-xs font-semibold text-green-700">LIVE</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <button
              onClick={toggleSortOrder}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl font-semibold text-xs sm:text-sm transition-all duration-300 hover:bg-green-600 bg-green-500 text-white shadow-md flex-1 sm:flex-initial"
            >
              <span className="hidden sm:inline">Sort by Change</span>
              <span className="sm:hidden">Sort</span>
              {sortOrder === 'desc' ? (
                <span className="text-xs">↓ Desc</span>
              ) : (
                <span className="text-xs">↑ Asc</span>
              )}
            </button>
            <div className="hidden sm:block w-12 h-1 bg-green-500 rounded-full"></div>
          </div>
        </div>

        {/* Range Selector
        <div className="flex items-center space-x-3">
          <span className="text-sm font-semibold text-gray-700">Range:</span>
          <div className="flex space-x-2">
            {ranges.map((range) => (
              <button
                key={range}
                onClick={() => setSelectedRange(range)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${selectedRange === range
                  ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg'
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                  }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div> */}
      </div>

      {/* Bar Chart */}
      <div className="space-y-1">
        {isLoadingData ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-green-200 border-t-green-600 rounded-full animate-spin"></div>
            </div>
            <p className="mt-4 text-sm text-gray-600 font-semibold">Loading sector data...</p>
          </div>
        ) : noDataForTime && isReplayMode ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="text-4xl mb-4">📊</div>
            <div className="text-sm text-gray-500 text-center max-w-md">
              No sector data was captured for {replayTime?.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}.
              Data is only available for times when snapshots were saved.
            </div>
          </div>
        ) : sortedSectorData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="text-4xl mb-4">📊</div>
            <div className="text-lg font-bold text-gray-700 mb-2">No Data Available</div>
            <div className="text-sm text-gray-500">No sector data found.</div>
          </div>
        ) : (
          sortedSectorData.map((sector, index) => {
            const changePercent = getChangePercent(sector)
            const isPositive = changePercent >= 0
            // Calculate bar width as percentage of the range
            const barWidth = Math.min((Math.abs(changePercent) / range) * 100, 100)
            const isClickable = hasSectorStocks(sector.name)
            const isSelected = selectedSector === sector.name

            return (
              <div
                key={index}
                onClick={() => isClickable && onSectorClick(sector.name)}
                className={`relative flex flex-col sm:grid sm:grid-cols-[minmax(120px,200px)_1fr] gap-2 items-stretch p-2 sm:p-1 rounded-lg transition-all duration-200 group ${isClickable ? 'cursor-pointer hover:bg-blue-50 hover:shadow-md' : 'hover:bg-gray-50'
                  } ${isSelected ? 'bg-blue-100 shadow-md ring-2 ring-blue-400' : ''}`}
              >
                {/* Hover Tooltip - positioned just before center line */}
                <div className="hidden sm:block absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-full mr-2 z-50 bg-gray-900 text-white text-xs px-4 py-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
                  <div className="font-bold mb-1 text-xs">{isPositive ? '+' : ''}{changePercent.toFixed(2)}%</div>
                  <div className="space-y-0.5 text-[10px]">
                    <div>Prev: {sector.previousClose.toFixed(2)}</div>
                    <div>Open: {sector.open.toFixed(2)}</div>
                    <div>Last: {sector.last.toFixed(2)}</div>
                    <div>Diff: {isPositive ? '+' : ''}{(sector.last - sector.open).toFixed(2)}</div>
                    <div>{isPositive ? '+' : ''}{sector.variation.toFixed(2)}</div>
                  </div>
                </div>

                {/* Sector Name - Responsive width */}
                <div className={`text-left text-xs sm:text-sm font-semibold truncate flex-shrink-0 sm:w-auto max-h-8 transition-colors ${isSelected ? 'text-blue-700' : 'text-gray-800 group-hover:text-black'
                  }`}>
                  {sector.name}
                  {isClickable && (
                    <span className="ml-2 text-xs text-blue-600">●</span>
                  )}
                </div>

                {/* Bar Container with Center Line - Full width on mobile */}
                <div className="relative w-full flex-1 min-w-0">
                  <div className="flex items-center h-8 sm:h-8">
                    {/* Left side (for negative bars) - exactly 50% */}
                    <div className="w-1/2 flex justify-end">
                      {!isPositive && (
                        <div
                          className="h-full bg-red-500 rounded-l-lg flex items-center justify-start px-1 sm:px-2 transition-all duration-500"
                          style={{ width: `${barWidth}%`, minWidth: '50px' }}
                        >
                          <span className="text-[10px] sm:text-xs font-bold text-white whitespace-nowrap">
                            {changePercent.toFixed(2)}%
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Center line */}
                    <div className="w-0.5 h-full bg-gray-400"></div>

                    {/* Right side (for positive bars) - exactly 50% */}
                    <div className="w-1/2">
                      {isPositive && (
                        <div
                          className="h-full bg-green-500 rounded-r-lg flex items-center justify-end px-1 sm:px-2 transition-all duration-500"
                          style={{ width: `${barWidth}%`, minWidth: '50px' }}
                        >
                          <span className="text-[10px] sm:text-xs font-bold text-white whitespace-nowrap">
                            +{changePercent.toFixed(2)}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Additional Data
              <div className="flex items-center space-x-2 text-xs whitespace-nowrap">
                <div className="text-gray-500">
                  Prev: {sector.previousClose.toFixed(2)}
                </div>
                <div className="text-gray-600 font-semibold">
                  Open: {sector.open.toFixed(2)}
                </div>
                <div className="text-gray-700 font-semibold">
                  Last: {sector.last.toFixed(2)}
                </div>
                <div className={`font-semibold ${(sector.last - sector.open) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  Diff: {(sector.last - sector.open) >= 0 ? '+' : ''}{(sector.last - sector.open).toFixed(2)}
                </div>
                <div className={`font-semibold ${sector.variation >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {sector.variation >= 0 ? '+' : ''}{sector.variation.toFixed(2)}
                </div>
              </div> */}
              </div>
            )
          })
        )}
      </div>

      {/* Timeline Slider - Moved below bars */}
      {onTimeChange && onReplayModeChange && replayTime && (
        <div className="mt-6">
          <TimelineSlider
            selectedTime={replayTime}
            onTimeChange={onTimeChange}
            isReplayMode={isReplayMode}
            onReplayModeChange={onReplayModeChange}
          />
        </div>
      )}
    </div>
  )
}
