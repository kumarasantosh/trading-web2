'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import TimelineSlider from '@/components/momentum/TimelineSlider'
import TopNavigation from '@/components/momentum/TopNavigation'

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

export default function OptionChainPage() {
    const [data, setData] = useState<OptionChainData[]>([])
    const [niftySpot, setNiftySpot] = useState<number>(0)
    const [pcr, setPcr] = useState<number>(0)
    const [loading, setLoading] = useState(true)
    const [chartType, setChartType] = useState<'1x1' | '2x2'>('2x2')
    const [symbol, setSymbol] = useState('NIFTY')
    const [expiryDate, setExpiryDate] = useState('')
    const [availableExpiries, setAvailableExpiries] = useState<string[]>([])
    const [selectedTime, setSelectedTime] = useState<Date>(new Date())
    const [isReplayMode, setIsReplayMode] = useState(false)
    const [snapshots, setSnapshots] = useState<Snapshot[]>([])
    const [noDataForTime, setNoDataForTime] = useState(false)
    const [dataCaptureTime, setDataCaptureTime] = useState<Date | null>(null)
    
    const intervalRef = useRef<NodeJS.Timeout | null>(null)
    
    // Track replay mode state to prevent live data from showing in replay mode
    // Update ref IMMEDIATELY (synchronously) when prop changes, not in useEffect
    const isReplayModeRef = useRef(isReplayMode)
    isReplayModeRef.current = isReplayMode // Sync update on every render

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
    const processOptionChainData = useCallback((apiData: any, currentExpiry?: string) => {
        try {
            // Get underlying value (spot price) from root level
            const underlyingValue = apiData?.underlyingValue || 0
            setNiftySpot(underlyingValue)
            
            // Get the data array directly from root level
            let dataArray = apiData?.data || []
            
            // Filter by expiry date if specified
            const expiryToFilter = currentExpiry || expiryDate
            if (expiryToFilter && Array.isArray(dataArray) && dataArray.length > 0) {
                dataArray = dataArray.filter((item: any) => {
                    return !item.expiryDates || item.expiryDates === expiryToFilter
                })
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
            }

            // Calculate PCR (Put Call Ratio)
            const calculatedPCR = totalCallOI > 0 ? totalPutOI / totalCallOI : 0
            setPcr(calculatedPCR)

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
            
            setData(filteredData)
        } catch (error) {
            console.error('Error processing option chain data:', error)
            setData([])
        }
    }, [expiryDate])

    // Fetch option chain data (ONLY when NOT in replay mode)
    const fetchOptionChainData = useCallback(async () => {
        // CRITICAL: Don't fetch or set live data if we're in replay mode
        // This prevents live data from overwriting "no data" state
        if (isReplayModeRef.current) {
            console.log('[OptionChain] ❌ Skipping live fetch - in replay mode')
            return
        }
        
        // Fetching live option chain data
        
        try {
            setLoading(true)
            setNoDataForTime(false)
            const url = `/api/option-chain?symbol=${symbol}${expiryDate ? `&expiryDate=${expiryDate}` : ''}`
            const response = await fetch(url)
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                console.error('API Error:', response.status, errorData)
                throw new Error(errorData.error || `Failed to fetch data: ${response.statusText}`)
            }
            
            const result = await response.json()
            
            // CRITICAL: Double-check we're still not in replay mode after async fetch
            // This prevents live data from showing when user switched to historical view
            if (isReplayModeRef.current) {
                console.log('[OptionChain] ❌ Discarding live data - switched to replay mode during fetch')
                setLoading(false)
                return
            }
            
            // Setting live option chain data
            processOptionChainData(result, expiryDate)
            // Set current time as data capture time for live data
            setDataCaptureTime(new Date())
        } catch (error: any) {
            console.error('Error fetching option chain:', error)
            setData([])
        } finally {
            setLoading(false)
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
        }
        
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current)
                intervalRef.current = null
            }
        }
    }, [fetchOptionChainData, isReplayMode])
    
    // Reset expiry when symbol changes
    useEffect(() => {
        setExpiryDate('')
        setAvailableExpiries([])
    }, [symbol])

    // Fetch historical data for a specific time
    const fetchHistoricalDataForTime = useCallback(async (time: Date) => {
        try {
            setLoading(true)
            setNoDataForTime(false)
            setData([]) // Clear data immediately
            setDataCaptureTime(null)
            
            // Calculate time range around the selected time (±3 minutes)
            // Similar to sectors - only return data if it's close to the target
            const start = new Date(time)
            start.setMinutes(start.getMinutes() - 3)
            const end = new Date(time)
            end.setMinutes(end.getMinutes() + 3)
            
            const startISO = start.toISOString()
            const endISO = end.toISOString()
            const targetTimestamp = time.getTime()
            const MAX_TIME_DIFF_MS = 2.5 * 60 * 1000 // 2.5 minutes
            
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
                    console.log(`[OptionChain] Closest snapshot (${closest.captured_at}) is ${timeDiff/1000/60} minutes away, exceeds ${MAX_TIME_DIFF_MS/1000/60} min limit`)
                    setNoDataForTime(true)
                    setData([])
                    setDataCaptureTime(null)
                    setLoading(false)
                    return
                }
                
                console.log('[OptionChain] ✅ Found snapshot at:', closest.captured_at)
                processOptionChainData(closest.option_chain_data, expiryDate)
                setNiftySpot(closest.nifty_spot || 0)
                setNoDataForTime(false)
                // Set the capture time from the snapshot
                setDataCaptureTime(new Date(closest.captured_at))
            } else {
                // No snapshots found for this time
                console.log('[OptionChain] No snapshots found for time range')
                setNoDataForTime(true)
                setData([])
                setDataCaptureTime(null)
            }
        } catch (error) {
            console.error('[OptionChain] Error fetching historical data:', error)
            setNoDataForTime(true)
            setData([])
            setDataCaptureTime(null)
        } finally {
            setLoading(false)
        }
    }, [symbol, expiryDate, processOptionChainData])

    // Handle time change from timeline slider
    const handleTimeChange = useCallback((time: Date) => {
        setSelectedTime(time)
        // Only fetch historical data if replay mode is enabled
        // The slider will enable replay mode when moved, so fetch data
        fetchHistoricalDataForTime(time)
    }, [fetchHistoricalDataForTime])

    // Handle replay mode change
    const handleReplayModeChange = useCallback((enabled: boolean) => {
        setIsReplayMode(enabled)
        if (enabled) {
            // Entering replay mode - clear live data immediately
            console.log('[OptionChain] Entering replay mode - clearing data')
            setData([])
            setNoDataForTime(false)
            setDataCaptureTime(null)
        } else {
            // Exiting replay mode - fetch live data
            console.log('[OptionChain] Exiting replay mode - fetching live data')
            setNoDataForTime(false)
            setDataCaptureTime(null)
            fetchOptionChainData()
        }
    }, [fetchOptionChainData])

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
            {/* Top Navigation with Market Indices */}
            <TopNavigation />
            
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
                                            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                                                expiryDate === exp
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
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setChartType('1x1')}
                                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                                        chartType === '1x1'
                                            ? 'bg-black text-white shadow-md hover:bg-gray-900'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-black'
                                    }`}
                                >
                                    1x1
                                </button>
                                <button
                                    onClick={() => setChartType('2x2')}
                                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                                        chartType === '2x2'
                                            ? 'bg-black text-white shadow-md hover:bg-gray-900'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-black'
                                    }`}
                                >
                                    2x2
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                {/* Charts Section */}
                {loading ? (
                    <div className="bg-white/95 backdrop-blur-sm rounded-2xl border border-gray-200/50 shadow-xl p-12 text-center">
                        <div className="text-gray-500 font-medium">Loading chart data...</div>
                    </div>
                ) : noDataForTime && isReplayMode ? (
                    <div className="bg-white/95 backdrop-blur-sm rounded-2xl border border-gray-200/50 shadow-xl p-12 text-center">
                        <div className="text-gray-500 font-medium">No data saved for this time.</div>
                    </div>
                ) : data.length === 0 ? (
                    <div className="bg-white/95 backdrop-blur-sm rounded-2xl border border-gray-200/50 shadow-xl p-12 text-center">
                        <div className="text-gray-500 font-medium">No data available. Please check the symbol and expiry date.</div>
                    </div>
                ) : (
                    <div className={`grid gap-6 ${chartType === '2x2' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
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
                    </div>
                )}

                {/* Timeline Slider Section */}
                <div className="mt-6">
                    <TimelineSlider
                        selectedTime={selectedTime}
                        onTimeChange={handleTimeChange}
                        isReplayMode={isReplayMode}
                        onReplayModeChange={handleReplayModeChange}
                    />
                </div>
                </div>
            </div>
        </div>
    )
}
