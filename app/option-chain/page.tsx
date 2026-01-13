'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, Legend, LineChart, Line } from 'recharts'
import TimelineSlider from '@/components/momentum/TimelineSlider'
import TopNavigation from '@/components/momentum/TopNavigation'
import Footer from '@/components/Footer'

interface OptionChainData {
    strikePrice: number
    callOI: number
    putOI: number
    callOIChange: number
    putOIChange: number
}

interface Snapshot {
    captured_at: string
    nifty_spot: number
    option_chain_data: any
}



interface PcrData {
    time: string
    timestamp: number
    pcr: number
    spot?: number
}

export default function OptionChainPage() {
    const [data, setData] = useState<OptionChainData[]>([])
    const [niftySpot, setNiftySpot] = useState<number>(0)
    const [pcr, setPcr] = useState<number>(0)
    const [loading, setLoading] = useState(true)
    const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false)
    const hasDataRef = useRef(false) // Track if we've ever had data to prevent showing "No data" during refresh
    const [chartType, setChartType] = useState<'1x1' | '2x2' | '1x4' | '4x4'>('2x2')
    const [symbol, setSymbol] = useState('NIFTY')
    const [expiryDate, setExpiryDate] = useState('')
    const [availableExpiries, setAvailableExpiries] = useState<string[]>([])
    const [selectedTime, setSelectedTime] = useState<Date>(new Date())
    const [isReplayMode, setIsReplayMode] = useState(false)
    const [snapshots, setSnapshots] = useState<Snapshot[]>([])
    const [noDataForTime, setNoDataForTime] = useState(false)
    const [dataCaptureTime, setDataCaptureTime] = useState<Date | null>(null)

    // Trendline state

    const lastResetDateRef = useRef<string | null>(null)


    // PCR chart state
    const [pcrData, setPcrData] = useState<PcrData[]>([])
    const pcrHistoryRef = useRef<PcrData[]>([])
    const [oiTotals, setOiTotals] = useState<{ callOI: number, putOI: number }>({ callOI: 0, putOI: 0 })
    const [maxPain, setMaxPain] = useState<number>(0)

    const intervalRef = useRef<NodeJS.Timeout | null>(null)

    // Track replay mode state to prevent live data from showing in replay mode
    // Update ref IMMEDIATELY (synchronously) when prop changes, not in useEffect
    const isReplayModeRef = useRef(isReplayMode)
    isReplayModeRef.current = isReplayMode // Sync update on every render

    // Check if we need to reset trendline (new trading day after 9:15 AM IST)
    const shouldResetTrendLine = useCallback((timestamp: Date): boolean => {
        // Convert to IST (Asia/Kolkata)
        const istDate = new Date(timestamp.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
        const today = istDate.toISOString().split('T')[0] // YYYY-MM-DD format

        // Check if we've already reset today
        if (lastResetDateRef.current === today) {
            return false
        }

        // Check if it's after 9:15 AM IST
        const hour = istDate.getHours()
        const minute = istDate.getMinutes()
        const isAfterMarketOpen = hour > 9 || (hour === 9 && minute >= 15)

        if (isAfterMarketOpen) {
            lastResetDateRef.current = today
            return true
        }

        return false
    }, [])

    // Update PCR chart data
    const updatePcrChart = useCallback((pcrValue: number, spotValue: number, timestamp: Date) => {
        // Check if we need to reset for new trading day
        if (shouldResetTrendLine(timestamp)) {
            console.log('[PCR Chart] Resetting for new trading day')
            pcrHistoryRef.current = []
        }

        // Format time string for display (IST)
        const timeStr = timestamp.toLocaleTimeString('en-IN', {
            timeZone: 'Asia/Kolkata',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        })

        const newPcrPoint: PcrData = {
            time: timeStr,
            timestamp: timestamp.getTime(),
            pcr: pcrValue,
            spot: spotValue
        }

        // Add to history
        pcrHistoryRef.current = [...pcrHistoryRef.current, newPcrPoint]

        // Keep only last 1000 points to prevent memory issues
        if (pcrHistoryRef.current.length > 1000) {
            pcrHistoryRef.current = pcrHistoryRef.current.slice(-1000)
        }

        setPcrData([...pcrHistoryRef.current])
    }, [shouldResetTrendLine])

    // Fetch trendline data for the full day
    const fetchTrendlineData = useCallback(async () => {
        try {
            const response = await fetch(`/api/pcr-trendline?symbol=${symbol}`)
            if (!response.ok) {
                console.error('Failed to fetch trendline data')
                return
            }

            const result = await response.json()
            if (result.success && Array.isArray(result.data)) {
                const mappedData = result.data.map((item: any) => {
                    const timestamp = new Date(item.time)
                    // Extract HH:mm from ISO string (e.g. 2026-01-12T12:56:00.000Z -> 12:56)
                    // If stored correctly as UTC (07:26), this would show 07:26.
                    // If stored shifted (12:56), this shows 12:56.
                    // To handle both, we should ideally use the local time from the Date object 
                    // BUT without the shift if it was already shifted.

                    // Let's use a more robust way:
                    const istTime = timestamp.toLocaleTimeString('en-IN', {
                        timeZone: 'Asia/Kolkata',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false
                    })

                    // If the time is after 15:30 IST but before 21:00 IST, it's likely a double-shifted record
                    // In that case, we subtract 5.30 hours to show the intended time.
                    // This is a heuristic for existing bad data.
                    const [h, m] = istTime.split(':').map(Number)
                    const totalMinutes = h * 60 + m
                    let displayTime = istTime

                    if (totalMinutes > 15 * 60 + 30 && totalMinutes < 21 * 60) {
                        const correctedMinutes = totalMinutes - (5 * 60 + 30)
                        const ch = Math.floor(correctedMinutes / 60)
                        const cm = correctedMinutes % 60
                        displayTime = `${ch.toString().padStart(2, '0')}:${cm.toString().padStart(2, '0')}`
                    }

                    return {
                        time: displayTime,
                        timestamp: timestamp.getTime(),
                        pcr: item.pcr,
                        spot: item.spot
                    }
                })

                console.log(`[PCR Chart] Loaded ${mappedData.length} points from pcr-trendline API`)
                setPcrData(mappedData)
                pcrHistoryRef.current = mappedData
            }
        } catch (error) {
            console.error('Error fetching trendline data:', error)
        }
    }, [symbol])

    // Calculate net seller volume delta
    // delta_t = (Total Put Sellers Volume_t) - (Total Call Sellers Volume_t)
    // Positive OI change = sellers entering (new short positions)


    // Update trendline and alpha arc
    // trendline_t = trendline_{t-1} + delta_t
    // alpha_arc_t = α × trendline_t + (1 - α) × alpha_arc_{t-1}


    // Fetch expiry dates from dropdown API
    const fetchExpiryDates = useCallback(async () => {
        try {
            const response = await fetch(`/api/option-chain/expiries?symbol=${symbol}`)
            if (!response.ok) {
                console.error('Failed to fetch expiry dates')
                return
            }
            const result = await response.json()
            if (result.expiries && Array.isArray(result.expiries)) {
                setAvailableExpiries(result.expiries)
                // Set first expiry as default if none is selected
                setExpiryDate(prev => prev || (result.expiries.length > 0 ? result.expiries[0] : ''))
            }
        } catch (error) {
            console.error('Error fetching expiry dates:', error)
        }
    }, [symbol])

    // Process option chain data from NSE API
    const processOptionChainData = useCallback((apiData: any, currentExpiry?: string, timestamp?: Date) => {
        try {
            console.log('[OptionChain] Processing data, structure:', {
                hasRecords: !!apiData?.records,
                hasData: !!apiData?.data,
                hasRecordsData: !!apiData?.records?.data,
                keys: Object.keys(apiData || {}),
            })

            // Get underlying value (spot price) from records or root level
            const underlyingValue = apiData?.records?.underlyingValue || apiData?.underlyingValue || 0
            setNiftySpot(underlyingValue)

            // Get the data array - NSE API returns data in records.data
            let dataArray = apiData?.records?.data || apiData?.data || []

            console.log('[OptionChain] Raw data array length:', dataArray.length)

            // If no data found, log the structure for debugging
            if (!Array.isArray(dataArray) || dataArray.length === 0) {
                console.warn('[OptionChain] No data found in response. Structure:', {
                    hasRecords: !!apiData?.records,
                    hasData: !!apiData?.data,
                    hasRecordsData: !!apiData?.records?.data,
                    recordsKeys: apiData?.records ? Object.keys(apiData.records) : null,
                    topLevelKeys: Object.keys(apiData || {}),
                })
            }

            // Filter by expiry date if specified
            const expiryToFilter = currentExpiry || expiryDate
            if (expiryToFilter && Array.isArray(dataArray) && dataArray.length > 0) {
                const beforeFilter = dataArray.length
                dataArray = dataArray.filter((item: any) => {
                    // NSE API uses expiryDate field, not expiryDates
                    const itemExpiry = item.expiryDate || item.expiryDates
                    // If no expiry filter matches, include all items
                    if (!itemExpiry) return true
                    return itemExpiry === expiryToFilter
                })
                console.log('[OptionChain] After expiry filter:', dataArray.length, 'items (was', beforeFilter, ')')
            }

            const processedData: OptionChainData[] = []
            let totalPutOI = 0
            let totalCallOI = 0

            // Process each strike price entry
            if (Array.isArray(dataArray) && dataArray.length > 0) {
                dataArray.forEach((item: any) => {
                    if (!item) return;

                    const strikePrice = item.strikePrice || 0
                    const ceData = item.CE || {}
                    const peData = item.PE || {}

                    const callOI = ceData.openInterest || 0
                    const putOI = peData.openInterest || 0
                    const callOIChange = ceData.changeinOpenInterest || 0
                    const putOIChange = peData.changeinOpenInterest || 0

                    totalCallOI += callOI
                    totalPutOI += putOI

                    if (strikePrice > 0) {
                        processedData.push({
                            strikePrice: Number(strikePrice),
                            callOI: Number(callOI),
                            putOI: Number(putOI),
                            callOIChange: Number(callOIChange),
                            putOIChange: Number(putOIChange),
                        })
                    }
                })
                console.log('[OptionChain] Processed', processedData.length, 'strike prices')
            } else {
                console.warn('[OptionChain] No data to process after filtering')
            }

            // Calculate PCR (Put Call Ratio)
            const calculatedPCR = totalCallOI > 0 ? totalPutOI / totalCallOI : 0
            setPcr(calculatedPCR)
            setPcr(calculatedPCR)
            setOiTotals({ callOI: totalCallOI, putOI: totalPutOI })

            // Calculate Max Pain
            let minPain = Infinity
            let maxPainStrike = 0

            if (processedData.length > 0) {
                processedData.forEach(candidate => {
                    const expirationPrice = candidate.strikePrice
                    let totalPain = 0

                    processedData.forEach(option => {
                        const strike = option.strikePrice
                        const callOI = option.callOI
                        const putOI = option.putOI

                        // Call Pain: if expires at expirationPrice, Call writer pays max(0, expirationPrice - strike)
                        if (expirationPrice > strike) {
                            totalPain += (expirationPrice - strike) * callOI
                        }

                        // Put Pain: if expires at expirationPrice, Put writer pays max(0, strike - expirationPrice)
                        if (expirationPrice < strike) {
                            totalPain += (strike - expirationPrice) * putOI
                        }
                    })

                    if (totalPain < minPain) {
                        minPain = totalPain
                        maxPainStrike = expirationPrice
                    }
                })
            }
            setMaxPain(maxPainStrike)

            // Sort by strike price and filter around spot
            processedData.sort((a, b) => a.strikePrice - b.strikePrice)

            // Filter to show strikes around current spot (±500 points)
            let filteredData = processedData;
            if (underlyingValue > 0 && processedData.length > 0) {
                filteredData = processedData.filter(item =>
                    Math.abs(item.strikePrice - underlyingValue) <= 500
                )
                if (filteredData.length === 0) {
                    filteredData = processedData
                }
            }

            // Set data first - this triggers chart rendering
            console.log('[OptionChain] 📊 Setting data:', filteredData.length, 'items')
            console.log('[OptionChain] Sample data (first 3):', filteredData.slice(0, 3))
            console.log('[OptionChain] Spot price:', underlyingValue)
            console.log('[OptionChain] PCR:', calculatedPCR)
            console.log('[OptionChain] Total Put OI:', totalPutOI)
            console.log('[OptionChain] Total Call OI:', totalCallOI)

            setData(filteredData)
            console.log('[OptionChain] ✅ Data state updated')

            // Mark that we have data if filteredData has items
            if (filteredData.length > 0) {
                hasDataRef.current = true
                console.log('[OptionChain] ✅ Has data ref set to true')
            } else {
                console.warn('[OptionChain] ⚠️ No data items, hasDataRef remains:', hasDataRef.current)
            }

            // Get timestamp for chart updates
            const dataTime = timestamp || new Date()

            // Update PCR chart
            console.log('[OptionChain] Updating PCR chart with value:', calculatedPCR)
            updatePcrChart(calculatedPCR, underlyingValue, dataTime)



            console.log('[OptionChain] ✅ Processing complete')
        } catch (error) {
            console.error('Error processing option chain data:', error)
            setData([])
            setHasAttemptedLoad(true)
        }
    }, [expiryDate, updatePcrChart])

    // Fetch option chain data (ONLY when NOT in replay mode)
    const fetchOptionChainData = useCallback(async () => {
        console.log('[OptionChain] ========== FETCH START ==========')
        console.log('[OptionChain] Symbol:', symbol)
        console.log('[OptionChain] Expiry Date:', expiryDate)
        console.log('[OptionChain] Is Replay Mode:', isReplayModeRef.current)
        console.log('[OptionChain] Has Data Ref:', hasDataRef.current)

        // CRITICAL: Don't fetch or set live data if we're in replay mode
        // This prevents live data from overwriting "no data" state
        if (isReplayModeRef.current) {
            console.log('[OptionChain] ❌ Skipping live fetch - in replay mode')
            return
        }

        // Fetching live option chain data
        const isInitialLoad = !hasDataRef.current
        console.log('[OptionChain] Is Initial Load:', isInitialLoad)

        try {
            // Always show loading on initial load, but not during refresh
            if (isInitialLoad) {
                console.log('[OptionChain] Setting loading state to true')
                setLoading(true)
                setHasAttemptedLoad(false)
            }
            setNoDataForTime(false)

            const url = `/api/option-chain?symbol=${symbol}${expiryDate ? `&expiryDate=${expiryDate}` : ''}`
            console.log('[OptionChain] 📡 Fetching data from:', url)
            const response = await fetch(url)

            console.log('[OptionChain] Response status:', response.status, response.statusText)

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                console.error('[OptionChain] ❌ API Error:', response.status, errorData)
                throw new Error(errorData.error || `Failed to fetch data: ${response.statusText}`)
            }

            const result = await response.json()
            console.log('[OptionChain] ✅ Response received')
            console.log('[OptionChain] Response keys:', Object.keys(result || {}))
            console.log('[OptionChain] Has records:', !!result?.records)
            console.log('[OptionChain] Has data:', !!result?.data)
            console.log('[OptionChain] Records.data length:', result?.records?.data?.length || 'N/A')
            console.log('[OptionChain] Data length:', Array.isArray(result?.data) ? result.data.length : 'N/A')
            console.log('[OptionChain] Full response structure:', JSON.stringify(result).substring(0, 500))

            // CRITICAL: Double-check we're still not in replay mode after async fetch
            if (isReplayModeRef.current) {
                console.log('[OptionChain] ❌ Discarding live data - switched to replay mode during fetch')
                if (isInitialLoad) {
                    setLoading(false)
                }
                return
            }

            // Setting live option chain data
            const currentTime = new Date()
            console.log('[OptionChain] Processing data at:', currentTime.toISOString())
            // Process data - this will update all state including data, PCR, and trendline
            processOptionChainData(result, expiryDate, currentTime)
            // Set current time as data capture time for live data
            setDataCaptureTime(currentTime)
            // Mark that we have data
            hasDataRef.current = true
            setHasAttemptedLoad(true)

            console.log('[OptionChain] ✅ Data processing complete')
            console.log('[OptionChain] Setting loading to false')
            // Set loading to false immediately after processing
            setLoading(false)
            console.log('[OptionChain] ========== FETCH END ==========')
        } catch (error: any) {
            console.error('[OptionChain] ❌ Error fetching option chain:', error)
            console.error('[OptionChain] Error message:', error.message)
            console.error('[OptionChain] Error stack:', error.stack)
            setHasAttemptedLoad(true)
            setLoading(false)

            // Only clear data on initial load error
            if (isInitialLoad) {
                console.log('[OptionChain] Clearing data due to initial load error')
                setData([])
                hasDataRef.current = false
            }
            console.log('[OptionChain] ========== FETCH END (ERROR) ==========')
        }
    }, [symbol, expiryDate, processOptionChainData])

    // Format number with L suffix (Lakhs)
    const formatLakhs = (value: number): string => {
        const lakhs = Math.abs(value) / 100000
        return `${lakhs.toFixed(2)}L`
    }

    // Get strike range
    const getStrikeRange = () => {
        if (data.length === 0) return ''
        const min = Math.min(...data.map(d => d.strikePrice))
        const max = Math.max(...data.map(d => d.strikePrice))
        return `${min} - ${max}`
    }

    // Fetch expiry dates when symbol changes (defer initial load to prioritize main data)
    useEffect(() => {
        // Defer expiry fetch slightly to let main option chain data load first
        const timeoutId = setTimeout(() => {
            fetchExpiryDates()
        }, 500)
        return () => clearTimeout(timeoutId)
    }, [fetchExpiryDates])

    // Initialize and auto-refresh every 5 minutes
    useEffect(() => {
        // Clear any interval from previous render
        if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
        }

        if (isReplayMode) {
            // REPLAY MODE - Skipping live fetch
            // Don't fetch live data in replay mode
            // Data will be fetched by handleTimeChange when slider moves
        } else {
            // LIVE MODE - Fetching live data
            // Fetch immediately for live mode (user expects to see data)
            fetchOptionChainData()

            // Auto-refresh every 5 minutes (300000 ms) when not in replay mode
            intervalRef.current = setInterval(() => {
                if (!isReplayModeRef.current) {
                    fetchOptionChainData()
                }
            }, 300000) // 5 minutes

            // Support full historical trendline fetch
            fetchTrendlineData()
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current)
                intervalRef.current = null
            }
        }
    }, [fetchOptionChainData, fetchTrendlineData, isReplayMode])

    // Reset expiry when symbol changes
    useEffect(() => {
        setExpiryDate('')
        setAvailableExpiries([])
        // Reset loading state when symbol changes
        setLoading(true)
        setHasAttemptedLoad(false)
        setData([])
        hasDataRef.current = false // Reset data flag when symbol changes
    }, [symbol])

    // Fetch data when expiry date changes (if not in replay mode)
    useEffect(() => {
        if (expiryDate && !isReplayMode && symbol) {
            console.log('[OptionChain] Expiry date changed, fetching data for:', expiryDate)
            fetchOptionChainData()
        }
    }, [expiryDate, isReplayMode, symbol, fetchOptionChainData])

    // Fetch historical data for a specific time
    const fetchHistoricalDataForTime = useCallback(async (time: Date) => {
        try {
            setLoading(true)
            setNoDataForTime(false)
            setData([]) // Clear data immediately
            setDataCaptureTime(null)

            // Calculate time range around the selected time (±3 minutes for 3-minute capture interval)
            // Similar to sectors - only return data if it's close to the target
            const start = new Date(time)
            start.setMinutes(start.getMinutes() - 2) // Reduced to ±2 minutes for 3-minute interval
            const end = new Date(time)
            end.setMinutes(end.getMinutes() + 2)

            const startISO = start.toISOString()
            const endISO = end.toISOString()
            const targetTimestamp = time.getTime()
            const MAX_TIME_DIFF_MS = 1.5 * 60 * 1000 // 1.5 minutes (half of 3-minute interval)

            console.log('[OptionChain] Fetching historical data for time:', time.toISOString())
            console.log('[OptionChain] Query range:', startISO, 'to', endISO)

            const response = await fetch(
                `/api/option-chain/save?symbol=${symbol}&expiryDate=${expiryDate}&start=${startISO}&end=${endISO}`
            )

            if (!response.ok) {
                console.log('[OptionChain] API response not OK:', response.status)
                setNoDataForTime(true)
                setData([])
                setDataCaptureTime(null)
                // Only set hasAttemptedLoad if we're actually in replay mode
                if (isReplayMode) {
                    setHasAttemptedLoad(true)
                }
                setLoading(false)
                return
            }

            const result = await response.json()
            if (result.snapshots && result.snapshots.length > 0) {
                // Find the closest snapshot to the selected time
                const closest = result.snapshots.reduce((prev: Snapshot, curr: Snapshot) => {
                    const prevDiff = Math.abs(new Date(prev.captured_at).getTime() - targetTimestamp)
                    const currDiff = Math.abs(new Date(curr.captured_at).getTime() - targetTimestamp)
                    return currDiff < prevDiff ? curr : prev
                })

                // Check if closest snapshot is within allowed time range
                const timeDiff = Math.abs(new Date(closest.captured_at).getTime() - targetTimestamp)
                if (timeDiff > MAX_TIME_DIFF_MS) {
                    console.log(`[OptionChain] Closest snapshot (${closest.captured_at}) is ${timeDiff / 1000 / 60} minutes away, exceeds ${MAX_TIME_DIFF_MS / 1000 / 60} min limit`)
                    setNoDataForTime(true)
                    setData([])
                    setDataCaptureTime(null)
                    // Only set hasAttemptedLoad if we're actually in replay mode
                    if (isReplayMode) {
                        setHasAttemptedLoad(true)
                    }
                    setLoading(false)
                    return
                }

                console.log('[OptionChain] ✅ Found snapshot at:', closest.captured_at)
                const snapshotTime = new Date(closest.captured_at)
                processOptionChainData(closest.option_chain_data, expiryDate, snapshotTime)
                setNiftySpot(closest.nifty_spot || 0)
                setNoDataForTime(false)
                // Set the capture time from the snapshot
                setDataCaptureTime(snapshotTime)
                setHasAttemptedLoad(true)
            } else {
                // No snapshots found for this time
                console.log('[OptionChain] No snapshots found for time range')
                setNoDataForTime(true)
                setData([])
                setDataCaptureTime(null)
                // Only set hasAttemptedLoad if we're actually in replay mode
                // This prevents showing "No data available" when historical fetch fails in live mode
                if (isReplayMode) {
                    setHasAttemptedLoad(true)
                }
            }
        } catch (error) {
            console.error('[OptionChain] Error fetching historical data:', error)
            setNoDataForTime(true)
            setData([])
            setDataCaptureTime(null)
            // Only set hasAttemptedLoad if we're actually in replay mode
            if (isReplayMode) {
                setHasAttemptedLoad(true)
            }
        } finally {
            setLoading(false)
        }
    }, [symbol, expiryDate, processOptionChainData, isReplayMode])

    // Handle time change from timeline slider
    const handleTimeChange = useCallback((time: Date) => {
        setSelectedTime(time)
        // Only fetch historical data if replay mode is enabled
        // Don't fetch if not in replay mode - this prevents "no data" messages in live mode
        if (isReplayMode) {
            console.log('[OptionChain] Time changed in replay mode, fetching historical data')
            fetchHistoricalDataForTime(time)
        } else {
            console.log('[OptionChain] Time changed but not in replay mode, skipping historical fetch')
        }
    }, [fetchHistoricalDataForTime, isReplayMode])

    // Handle replay mode change
    const handleReplayModeChange = useCallback((enabled: boolean) => {
        setIsReplayMode(enabled)
        if (enabled) {
            // Entering replay mode - clear live data immediately
            console.log('[OptionChain] Entering replay mode - clearing data')
            setData([])
            setNoDataForTime(false)
            setDataCaptureTime(null)
            setHasAttemptedLoad(false)
        } else {
            // Exiting replay mode - fetch live data
            console.log('[OptionChain] Exiting replay mode - fetching live data')
            setNoDataForTime(false) // Reset noDataForTime when exiting replay mode
            setDataCaptureTime(null)
            setHasAttemptedLoad(false)
            fetchOptionChainData()
        }
    }, [fetchOptionChainData])

    // Reset noDataForTime when not in replay mode
    useEffect(() => {
        if (!isReplayMode) {
            console.log('[OptionChain] Not in replay mode, resetting noDataForTime to false')
            setNoDataForTime(false)
        }
    }, [isReplayMode])

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
            {/* Top Navigation with Market Indices */}
            <div className="relative z-50">
                <TopNavigation hideTopMovers={true} />
            </div>

            <div className="w-full py-8 min-h-[calc(100vh-200px)]">
                <div className="px-4 lg:px-6">
                    {/* Header Section */}
                    <div className="bg-white/95 backdrop-blur-sm rounded-2xl border border-gray-200/50 shadow-xl p-6 mb-6">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h1 className="text-3xl font-extrabold bg-gradient-to-r from-black to-gray-700 bg-clip-text text-transparent">
                                    Nifty Open Interest
                                </h1>
                                {dataCaptureTime && (
                                    <div className="mt-2 text-sm text-gray-600">
                                        <span className="font-semibold">Data Time:</span>{' '}
                                        <span className="text-gray-800">
                                            {dataCaptureTime.toLocaleString('en-IN', {
                                                timeZone: 'Asia/Kolkata',
                                                day: '2-digit',
                                                month: 'short',
                                                year: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit',
                                                second: '2-digit',
                                                hour12: true
                                            })}
                                        </span>
                                        {isReplayMode && (
                                            <span className="ml-2 text-xs text-blue-600 font-medium">(Historical)</span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            {/* Instrument Selection */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Select Instrument</label>
                                <select
                                    value={symbol}
                                    onChange={(e) => setSymbol(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-white hover:border-gray-300 transition-all duration-200 font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                                >
                                    <option value="NIFTY">NIFTY 50</option>
                                    <option value="BANKNIFTY">BANKNIFTY</option>
                                    <option value="FINNIFTY">FINNIFTY</option>
                                </select>
                                <div className="mt-2 text-sm font-semibold text-gray-700">
                                    {symbol} 50 Ltp: <span className="text-black">{niftySpot.toFixed(2)}</span> & PCR = <span className="text-black">{pcr.toFixed(2)}</span>
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                    (Strike Range: {getStrikeRange()})
                                </div>
                            </div>

                            {/* Expiry Dates */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Expirys</label>
                                <div className="flex flex-wrap gap-2">
                                    {availableExpiries.length > 0 ? (
                                        availableExpiries.map((exp) => (
                                            <button
                                                key={exp}
                                                onClick={() => setExpiryDate(exp)}
                                                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200 ${expiryDate === exp
                                                    ? 'bg-black text-white shadow-md hover:bg-gray-900'
                                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-black'
                                                    }`}
                                            >
                                                {exp}
                                            </button>
                                        ))
                                    ) : (
                                        <input
                                            type="text"
                                            value={expiryDate}
                                            onChange={(e) => setExpiryDate(e.target.value)}
                                            placeholder="Expiry Date"
                                            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black"
                                        />
                                    )}
                                </div>
                            </div>

                            {/* Chart Type */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Chart Type</label>
                                <div className="flex gap-2 flex-wrap">
                                    <button
                                        onClick={() => setChartType('1x1')}
                                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${chartType === '1x1'
                                            ? 'bg-black text-white shadow-md hover:bg-gray-900'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-black'
                                            }`}
                                    >
                                        1x1
                                    </button>
                                    <button
                                        onClick={() => setChartType('2x2')}
                                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${chartType === '2x2'
                                            ? 'bg-black text-white shadow-md hover:bg-gray-900'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-black'
                                            }`}
                                    >
                                        2x2
                                    </button>
                                    <button
                                        onClick={() => setChartType('1x4')}
                                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${chartType === '1x4'
                                            ? 'bg-black text-white shadow-md hover:bg-gray-900'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-black'
                                            }`}
                                    >
                                        1x4
                                    </button>
                                    <button
                                        onClick={() => setChartType('4x4')}
                                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${chartType === '4x4'
                                            ? 'bg-black text-white shadow-md hover:bg-gray-900'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-black'
                                            }`}
                                    >
                                        4x4
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* Charts Section */}
                    {(() => {
                        const renderState = {
                            loading,
                            dataLength: data.length,
                            hasAttemptedLoad,
                            noDataForTime,
                            isReplayMode,
                            hasDataRef: hasDataRef.current
                        }
                        console.log('[OptionChain] 🎨 RENDERING CHECK:', renderState)

                        if (loading && data.length === 0) {
                            console.log('[OptionChain] 🎨 Rendering: Loading state')
                            return (
                                <div className="bg-white/95 backdrop-blur-sm rounded-2xl border border-gray-200/50 shadow-xl p-12 text-center">
                                    <div className="text-gray-500 font-medium">Loading chart data...</div>
                                </div>
                            )
                        }
                        if (noDataForTime && isReplayMode) {
                            console.log('[OptionChain] 🎨 Rendering: No data for time (replay mode)')
                            return (
                                <div className="bg-white/95 backdrop-blur-sm rounded-2xl border border-gray-200/50 shadow-xl p-12 text-center">
                                    <div className="text-gray-500 font-medium">No data saved for this time.</div>
                                </div>
                            )
                        }
                        if (hasAttemptedLoad && data.length === 0) {
                            console.log('[OptionChain] 🎨 Rendering: No data available message')
                            return (
                                <div className="bg-white/95 backdrop-blur-sm rounded-2xl border border-gray-200/50 shadow-xl p-12 text-center">
                                    <div className="text-gray-500 font-medium">No data available. Please check the symbol and expiry date.</div>
                                </div>
                            )
                        }
                        if (data.length > 0) {
                            console.log('[OptionChain] 🎨 Rendering: Charts with', data.length, 'data items')
                            return (
                                <div className={`grid gap-6 ${chartType === '1x4'
                                    ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-4'
                                    : chartType === '4x4'
                                        ? 'grid-cols-1'
                                        : chartType === '2x2'
                                            ? 'grid-cols-1 lg:grid-cols-2'
                                            : 'grid-cols-1'
                                    }`}>
                                    {/* Open Interest Chart */}
                                    <div className="bg-white/95 backdrop-blur-sm rounded-2xl border border-gray-200/50 shadow-xl p-6">
                                        <div className="mb-4 flex items-center justify-between">
                                            <h2 className="text-xl font-extrabold text-gray-900">Open Interest</h2>
                                            {dataCaptureTime && (
                                                <div className="text-xs text-gray-600">
                                                    {dataCaptureTime.toLocaleString('en-IN', {
                                                        timeZone: 'Asia/Kolkata',
                                                        day: '2-digit',
                                                        month: 'short',
                                                        year: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                        second: '2-digit',
                                                        hour12: true
                                                    })}
                                                    {isReplayMode && (
                                                        <span className="ml-2 text-blue-600 font-medium">(Historical)</span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <ResponsiveContainer width="100%" height={500}>
                                            <BarChart
                                                data={data}
                                                margin={{ top: 20, right: 30, left: 60, bottom: 30 }}
                                            >
                                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                                                <XAxis
                                                    dataKey="strikePrice"
                                                    type="number"
                                                    scale="linear"
                                                    domain={['dataMin', 'dataMax']}
                                                    tick={{ fontSize: 11, fill: '#666' }}
                                                    interval="preserveStartEnd"
                                                />
                                                <YAxis
                                                    label={{ value: 'Open Interest', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fontSize: 12 } }}
                                                    tick={{ fontSize: 11, fill: '#666' }}
                                                    tickFormatter={(value) => {
                                                        const lakhs = Math.abs(value) / 100000
                                                        return `${lakhs.toFixed(0)}L`
                                                    }}
                                                />
                                                <Tooltip
                                                    formatter={(value: number, name: string) => {
                                                        const lakhs = Math.abs(value) / 100000
                                                        return [`${lakhs.toFixed(2)}L`, name]
                                                    }}
                                                />
                                                <Legend />
                                                <ReferenceLine
                                                    x={niftySpot}
                                                    stroke="#666"
                                                    strokeDasharray="3 3"
                                                    label={{
                                                        value: `₹ ${niftySpot.toFixed(2)}`,
                                                        position: 'top',
                                                        fill: '#666',
                                                        fontSize: 11
                                                    }}
                                                />
                                                <Bar dataKey="putOI" fill="#14b8a6" name="Put OI" />
                                                <Bar dataKey="callOI" fill="#ef4444" name="Call OI" />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>

                                    {/* Today OI Change Chart */}
                                    <div className="bg-white/95 backdrop-blur-sm rounded-2xl border border-gray-200/50 shadow-xl p-6">
                                        <div className="mb-4 flex items-center justify-between">
                                            <h2 className="text-xl font-extrabold text-gray-900">Today OI Change</h2>
                                            {dataCaptureTime && (
                                                <div className="text-xs text-gray-600">
                                                    {dataCaptureTime.toLocaleString('en-IN', {
                                                        timeZone: 'Asia/Kolkata',
                                                        day: '2-digit',
                                                        month: 'short',
                                                        year: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                        second: '2-digit',
                                                        hour12: true
                                                    })}
                                                    {isReplayMode && (
                                                        <span className="ml-2 text-blue-600 font-medium">(Historical)</span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <ResponsiveContainer width="100%" height={500}>
                                            <BarChart
                                                data={data}
                                                margin={{ top: 20, right: 30, left: 60, bottom: 30 }}
                                            >
                                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                                                <XAxis
                                                    dataKey="strikePrice"
                                                    type="number"
                                                    scale="linear"
                                                    domain={['dataMin', 'dataMax']}
                                                    tick={{ fontSize: 11, fill: '#666' }}
                                                    interval="preserveStartEnd"
                                                />
                                                <YAxis
                                                    label={{ value: 'Open Interest', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fontSize: 12 } }}
                                                    tick={{ fontSize: 11, fill: '#666' }}
                                                    tickFormatter={(value) => {
                                                        const lakhs = Math.abs(value) / 100000
                                                        return `${value >= 0 ? '+' : ''}${lakhs.toFixed(0)}L`
                                                    }}
                                                />
                                                <Tooltip
                                                    formatter={(value: number, name: string) => {
                                                        const lakhs = Math.abs(value) / 100000
                                                        return [`${value >= 0 ? '+' : ''}${lakhs.toFixed(2)}L`, name]
                                                    }}
                                                />
                                                <Legend />
                                                <ReferenceLine
                                                    x={niftySpot}
                                                    stroke="#666"
                                                    strokeDasharray="3 3"
                                                    label={{
                                                        value: `₹ ${niftySpot.toFixed(2)}`,
                                                        position: 'top',
                                                        fill: '#666',
                                                        fontSize: 11
                                                    }}
                                                />
                                                <Bar dataKey="putOIChange" fill="#14b8a6" name="Put OI Change" />
                                                <Bar dataKey="callOIChange" fill="#ef4444" name="Call OI Change" />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>



                                    {/* PCR Chart - Show in 1x4 or 4x4 layout */}
                                    {(chartType === '1x4' || chartType === '4x4') && pcrData.length > 0 && (
                                        <div className="bg-white rounded-2xl border border-gray-200 shadow-xl p-6">
                                            <div className="flex items-center justify-between mb-6">
                                                <div className="flex items-center gap-8">
                                                    <div>
                                                        <div className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">PCR</div>
                                                        <div className="text-xl font-bold text-gray-900">{pcr.toFixed(4)}</div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-xs text-gray-500 font-medium mb-1">PCR Trend</div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex items-center gap-1">
                                                            <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                                                            <span className="text-xs font-semibold text-gray-700">PCR</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <ResponsiveContainer width="100%" height={500}>
                                                <LineChart
                                                    data={pcrData}
                                                    margin={{ top: 20, right: 30, left: 10, bottom: 20 }}
                                                >
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                                    <XAxis
                                                        dataKey="time"
                                                        axisLine={false}
                                                        tickLine={false}
                                                        tick={{ fontSize: 11, fill: '#9ca3af' }}
                                                        minTickGap={60}
                                                    />
                                                    <YAxis
                                                        axisLine={false}
                                                        tickLine={false}
                                                        tick={{ fontSize: 11, fill: '#9ca3af' }}
                                                        domain={['auto', 'auto']}
                                                        tickFormatter={(val) => val.toFixed(2)}
                                                    />
                                                    <Tooltip
                                                        contentStyle={{
                                                            borderRadius: '12px',
                                                            border: 'none',
                                                            boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                                                            padding: '12px'
                                                        }}
                                                        formatter={(value: number, name: string) => {
                                                            return [value.toFixed(4), name]
                                                        }}
                                                        labelStyle={{ color: '#111827', fontWeight: '600', marginBottom: '4px' }}
                                                    />
                                                    <Line
                                                        type="monotone"
                                                        dataKey="pcr"
                                                        stroke="#f97316"
                                                        strokeWidth={2.5}
                                                        dot={false}
                                                        name="PCR"
                                                        activeDot={{ r: 6, strokeWidth: 0 }}
                                                    />
                                                </LineChart>
                                            </ResponsiveContainer>

                                            <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between">
                                                <div className="flex gap-4">
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                                                        <span className="text-xs text-gray-500 font-medium">PCR</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Total OI Chart - Show in 1x4 or 4x4 layout */}
                                    {(chartType === '1x4' || chartType === '4x4') && (oiTotals.putOI > 0 || oiTotals.callOI > 0) && (
                                        <div className="bg-white/95 backdrop-blur-sm rounded-2xl border border-gray-200/50 shadow-xl p-6">
                                            <div className="mb-4 flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <h2 className="text-xl font-extrabold text-gray-900">PUT VS CALL</h2>
                                                    <span className="text-sm font-semibold text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
                                                        Max Pain: <span className="text-black">{maxPain}</span>
                                                    </span>
                                                </div>
                                                {dataCaptureTime && (
                                                    <div className="text-xs text-gray-600">
                                                        {dataCaptureTime.toLocaleString('en-IN', {
                                                            timeZone: 'Asia/Kolkata',
                                                            day: '2-digit',
                                                            month: 'short',
                                                            year: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit',
                                                            second: '2-digit',
                                                            hour12: true
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex justify-between items-center mb-4 text-sm font-medium">
                                                <div className="text-teal-600">Put: {formatLakhs(oiTotals.putOI)}</div>
                                                <div className="text-red-500">Call: {formatLakhs(oiTotals.callOI)}</div>
                                            </div>
                                            <ResponsiveContainer width="100%" height={400}>
                                                <BarChart
                                                    data={[{ name: 'Total', putOI: oiTotals.putOI, callOI: oiTotals.callOI }]}
                                                    margin={{ top: 20, right: 30, left: 40, bottom: 20 }}
                                                >
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                                                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#666' }} />
                                                    <YAxis
                                                        tick={{ fontSize: 11, fill: '#666' }}
                                                        tickFormatter={(value) => {
                                                            const lakhs = Math.abs(value) / 100000
                                                            return `${lakhs.toFixed(0)}L`
                                                        }}
                                                    />
                                                    <Tooltip
                                                        formatter={(value: number, name: string) => {
                                                            const lakhs = Math.abs(value) / 100000
                                                            return [`${lakhs.toFixed(2)}L`, name]
                                                        }}
                                                    />
                                                    <Legend />
                                                    <Bar dataKey="putOI" fill="#14b8a6" name="Total Put OI" barSize={60} />
                                                    <Bar dataKey="callOI" fill="#ef4444" name="Total Call OI" barSize={60} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    )}
                                </div>
                            )
                        }
                        console.log('[OptionChain] 🎨 Rendering: null (no condition matched)')
                        return null
                    })()}

                    {/* PCR Chart - Layout depends on chart type */}
                    {!loading && data.length > 0 && pcrData.length > 0 && chartType !== '1x4' && chartType !== '4x4' && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                            {/* PCR Chart */}
                            {pcrData.length > 0 && (
                                <div className="bg-white rounded-2xl border border-gray-200 shadow-xl p-6">
                                    <div className="flex items-center justify-between mb-6">
                                        <div className="flex items-center gap-8">
                                            <div>
                                                <div className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">PCR</div>
                                                <div className="text-xl font-bold text-gray-900">{pcr.toFixed(4)}</div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xs text-gray-500 font-medium mb-1">Trend</div>
                                            <div className="flex items-center gap-2">
                                                <div className="flex items-center gap-1">
                                                    <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                                                    <span className="text-xs font-semibold text-gray-700">PCR</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <ResponsiveContainer width="100%" height={500}>
                                        <LineChart
                                            data={pcrData}
                                            margin={{ top: 20, right: 30, left: 10, bottom: 20 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                            <XAxis
                                                dataKey="time"
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fontSize: 11, fill: '#9ca3af' }}
                                                minTickGap={30}
                                            />
                                            <YAxis
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fontSize: 11, fill: '#9ca3af' }}
                                                domain={['auto', 'auto']}
                                                tickFormatter={(val) => val.toFixed(2)}
                                            />
                                            <Tooltip
                                                contentStyle={{
                                                    borderRadius: '12px',
                                                    border: 'none',
                                                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                                                    padding: '12px'
                                                }}
                                                formatter={(value: number, name: string) => {
                                                    return [value.toFixed(4), name]
                                                }}
                                                labelStyle={{ color: '#111827', fontWeight: '600', marginBottom: '4px' }}
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="pcr"
                                                stroke="#f97316"
                                                strokeWidth={2.5}
                                                dot={false}
                                                name="PCR"
                                                activeDot={{ r: 6, strokeWidth: 0 }}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>

                                    <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between">
                                        <div className="flex gap-4">
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                                                <span className="text-xs text-gray-500 font-medium">PCR</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Total OI Chart - Beside PCR Chart */}
                            {(oiTotals.putOI > 0 || oiTotals.callOI > 0) && (
                                <div className="bg-white rounded-2xl border border-gray-200 shadow-xl p-6">
                                    <div className="mb-4 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <h2 className="text-xl font-extrabold text-gray-900">PUT VS CALL</h2>
                                            <span className="text-sm font-semibold text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
                                                Max Pain: <span className="text-black">{maxPain}</span>
                                            </span>
                                        </div>
                                        {dataCaptureTime && (
                                            <div className="text-xs text-gray-600">
                                                {dataCaptureTime.toLocaleString('en-IN', {
                                                    timeZone: 'Asia/Kolkata',
                                                    day: '2-digit',
                                                    month: 'short',
                                                    year: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                    second: '2-digit',
                                                    hour12: true
                                                })}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex justify-between items-center mb-6 text-sm font-medium">
                                        <div className="text-teal-600">Put: {formatLakhs(oiTotals.putOI)}</div>
                                        <div className="text-red-500">Call: {formatLakhs(oiTotals.callOI)}</div>
                                    </div>
                                    <ResponsiveContainer width="100%" height={500}>
                                        <BarChart
                                            data={[{ name: 'Total', putOI: oiTotals.putOI, callOI: oiTotals.callOI }]}
                                            margin={{ top: 20, right: 30, left: 40, bottom: 20 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                                            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#666' }} />
                                            <YAxis
                                                tick={{ fontSize: 11, fill: '#666' }}
                                                tickFormatter={(value) => {
                                                    const lakhs = Math.abs(value) / 100000
                                                    return `${lakhs.toFixed(0)}L`
                                                }}
                                            />
                                            <Tooltip
                                                formatter={(value: number, name: string) => {
                                                    const lakhs = Math.abs(value) / 100000
                                                    return [`${lakhs.toFixed(2)}L`, name]
                                                }}
                                            />
                                            <Legend />
                                            <Bar dataKey="putOI" fill="#14b8a6" name="Total Put OI" barSize={80} />
                                            <Bar dataKey="callOI" fill="#ef4444" name="Total Call OI" barSize={80} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Timeline Slider Section */}
                    <div className="mt-6">
                        <TimelineSlider
                            selectedTime={selectedTime}
                            onTimeChange={handleTimeChange}
                            isReplayMode={isReplayMode}
                            onReplayModeChange={handleReplayModeChange}
                            intervalMinutes={3}
                        />
                    </div>
                </div>
            </div>
            <Footer />
        </div >
    )
}
