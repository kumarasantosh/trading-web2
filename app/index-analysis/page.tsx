'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, PieChart, Pie, Cell, Legend, Rectangle, LineChart, Line } from 'recharts'
import TopNavigation from '@/components/momentum/TopNavigation'
import Footer from '@/components/Footer'

interface OptionChainData {
    strikePrice: number
    callOI: number
    putOI: number
    callOIChange: number
    putOIChange: number
    callVolume: number
    putVolume: number
}

export default function IndexAnalysisPage() {
    const [data, setData] = useState<OptionChainData[]>([])
    const [niftySpot, setNiftySpot] = useState<number>(0)
    const [pcr, setPcr] = useState<number>(0)
    const [loading, setLoading] = useState(true)
    const [symbol, setSymbol] = useState('NIFTY')
    const [expiryDate, setExpiryDate] = useState('')
    const [availableExpiries, setAvailableExpiries] = useState<string[]>([])
    const [oiTotals, setOiTotals] = useState<{ callOI: number, putOI: number }>({ callOI: 0, putOI: 0 })
    const [oiChangeTotals, setOiChangeTotals] = useState<{ callOIChange: number, putOIChange: number }>({ callOIChange: 0, putOIChange: 0 })
    const [dataCaptureTime, setDataCaptureTime] = useState<Date | null>(null)
    const hasDataRef = useRef(false)
    const [selectedTime, setSelectedTime] = useState<Date>(new Date())
    const [isReplayMode, setIsReplayMode] = useState(false)
    const [noDataForTime, setNoDataForTime] = useState(false)
    const [oiTrendData, setOiTrendData] = useState<{ time: string, putOI: number, callOI: number, pcr: number, label: string }[]>([])
    const [oiTrendWindow, setOiTrendWindow] = useState<number>(15) // minutes
    const isReplayModeRef = useRef(isReplayMode)
    isReplayModeRef.current = isReplayMode
    const [atmViewMode, setAtmViewMode] = useState<'volume' | 'oiChange'>('oiChange')
    // Add state for OI Compass View Mode
    const [oiCompassMode, setOiCompassMode] = useState<'change' | 'total'>('change')
    const intervalRef = useRef<NodeJS.Timeout | null>(null)

    const indices = ['NIFTY', 'BANKNIFTY', 'FINNIFTY']

    // Calculate Max Pain, Support, and Resistance
    const { maxPain, support1, support2, resistance1, resistance2 } = useMemo(() => {
        if (data.length === 0) return { maxPain: 0, support1: 0, support2: 0, resistance1: 0, resistance2: 0 }

        // Max Pain Calculation
        let minTotalLoss = Number.MAX_VALUE
        let maxPainStrike = 0

        // Use all available strikes for calculation to be accurate
        data.forEach(candidate => {
            let totalLoss = 0
            const candidatePrice = candidate.strikePrice
            data.forEach(item => {
                const callLoss = Math.max(0, candidatePrice - item.strikePrice) * item.callOI
                const putLoss = Math.max(0, item.strikePrice - candidatePrice) * item.putOI
                totalLoss += callLoss + putLoss
            })

            if (totalLoss < minTotalLoss) {
                minTotalLoss = totalLoss
                maxPainStrike = candidatePrice
            }
        })

        // Support and Resistance
        const sortedByCallOI = [...data].sort((a, b) => b.callOI - a.callOI)
        const sortedByPutOI = [...data].sort((a, b) => b.putOI - a.putOI)

        return {
            maxPain: maxPainStrike,
            resistance1: sortedByCallOI[0]?.strikePrice || 0,
            resistance2: sortedByCallOI[1]?.strikePrice || 0,
            support1: sortedByPutOI[0]?.strikePrice || 0,
            support2: sortedByPutOI[1]?.strikePrice || 0
        }
    }, [data])

    // Format number with L suffix (Lakhs)
    const formatLakhs = (value: number): string => {
        const lakhs = Math.abs(value) / 100000
        if (lakhs >= 100) return `${(lakhs / 100).toFixed(1)}Cr`
        return `${lakhs.toFixed(2)}L`
    }

    // Fetch expiry dates
    const fetchExpiryDates = useCallback(async () => {
        try {
            const response = await fetch(`/api/option-chain/expiries?symbol=${symbol}`)
            if (!response.ok) return
            const result = await response.json()
            if (result.expiries && Array.isArray(result.expiries) && result.expiries.length > 0) {
                setAvailableExpiries(result.expiries)
                setExpiryDate(prev => prev || result.expiries[0])
            }
        } catch (error) {
            console.error('Error fetching expiry dates:', error)
        }
    }, [symbol])

    // Process option chain data
    const processOptionChainData = useCallback((apiData: any, currentExpiry?: string) => {
        try {
            const underlyingValue = apiData?.records?.underlyingValue || apiData?.underlyingValue || apiData?.spotPrice || 0
            setNiftySpot(underlyingValue)

            let dataArray = apiData?.records?.data || apiData?.data || []

            // If data is in optionChain format (keyed by strike), convert to array
            if ((!Array.isArray(dataArray) || dataArray.length === 0) && apiData?.optionChain) {
                dataArray = Object.values(apiData.optionChain)
            }

            if (!Array.isArray(dataArray) || dataArray.length === 0) {
                console.warn('[IndexAnalysis] No data array found in response')
                setData([])
                return
            }

            // Extract available expiry dates from data if not already set
            const expirySet = new Set<string>()
            dataArray.forEach((item: any) => {
                const exp = item.expiryDate || item.expiryDates
                if (exp) expirySet.add(exp)
            })
            const expiries = Array.from(expirySet).sort()
            if (expiries.length > 0 && availableExpiries.length === 0) {
                setAvailableExpiries(expiries)
            }

            // Determine which expiry to filter by
            const expiryToFilter = currentExpiry || expiryDate || (expiries.length > 0 ? expiries[0] : '')

            // Auto-set expiry if not yet selected
            if (!expiryDate && expiryToFilter) {
                setExpiryDate(expiryToFilter)
            }

            // Filter by expiry
            if (expiryToFilter && dataArray.length > 0) {
                const filtered = dataArray.filter((item: any) => {
                    const itemExpiry = item.expiryDate || item.expiryDates
                    if (!itemExpiry) return true
                    return itemExpiry === expiryToFilter
                })
                if (filtered.length > 0) dataArray = filtered
            }

            const processedData: OptionChainData[] = []
            let totalPutOI = 0
            let totalCallOI = 0
            let totalPutOIChange = 0
            let totalCallOIChange = 0

            dataArray.forEach((item: any) => {
                if (!item) return
                const strikePrice = item.strikePrice || 0
                const ceData = item.CE || {}
                const peData = item.PE || {}

                const callOI = ceData.openInterest || 0
                const putOI = peData.openInterest || 0
                const callOIChange = ceData.changeinOpenInterest || 0
                const putOIChange = peData.changeinOpenInterest || 0
                const callVolume = ceData.totalTradedVolume || 0
                const putVolume = peData.totalTradedVolume || 0

                totalCallOI += callOI
                totalPutOI += putOI
                totalCallOIChange += callOIChange
                totalPutOIChange += putOIChange

                if (strikePrice > 0) {
                    processedData.push({
                        strikePrice: Number(strikePrice),
                        callOI: Number(callOI),
                        putOI: Number(putOI),
                        callOIChange: Number(callOIChange),
                        putOIChange: Number(putOIChange),
                        callVolume: Number(callVolume),
                        putVolume: Number(putVolume),
                    })
                }
            })

            const calculatedPCR = totalCallOI > 0 ? totalPutOI / totalCallOI : 0
            setPcr(calculatedPCR)
            setOiTotals({ callOI: totalCallOI, putOI: totalPutOI })
            setOiChangeTotals({ callOIChange: totalCallOIChange, putOIChange: totalPutOIChange })

            processedData.sort((a, b) => a.strikePrice - b.strikePrice)

            let filteredData = processedData
            if (underlyingValue > 0 && processedData.length > 0) {
                filteredData = processedData.filter(item =>
                    Math.abs(item.strikePrice - underlyingValue) <= 800
                )
                if (filteredData.length === 0) filteredData = processedData
            }

            setData(filteredData)
            if (filteredData.length > 0) hasDataRef.current = true
        } catch (error) {
            console.error('Error processing option chain data:', error)
            setData([])
        }
    }, [expiryDate, availableExpiries.length])

    // Fetch option chain data
    const fetchOptionChainData = useCallback(async () => {
        if (isReplayModeRef.current) return
        try {
            const isInitialLoad = !hasDataRef.current
            if (isInitialLoad) setLoading(true)

            const url = `/api/option-chain?symbol=${symbol}${expiryDate ? `&expiryDate=${expiryDate}` : ''}`
            const response = await fetch(url)

            if (!response.ok) {
                throw new Error(`Failed to fetch data: ${response.statusText}`)
            }

            const result = await response.json()
            if (isReplayModeRef.current) { setLoading(false); return }
            processOptionChainData(result, expiryDate)
            setDataCaptureTime(new Date())
            hasDataRef.current = true
        } catch (error) {
            console.error('Error fetching option chain:', error)
            if (!hasDataRef.current) setData([])
        } finally {
            setLoading(false)
        }
    }, [symbol, expiryDate, processOptionChainData])

    // Fetch historical data for a specific time (replay mode)
    const fetchHistoricalDataForTime = useCallback(async (time: Date) => {
        try {
            setLoading(true)
            setNoDataForTime(false)
            setData([])
            setDataCaptureTime(null)

            const start = new Date(time)
            start.setMinutes(start.getMinutes() - 10)
            const end = new Date(time)
            end.setMinutes(end.getMinutes() + 2)

            const startISO = start.toISOString()
            const endISO = end.toISOString()
            const targetTimestamp = time.getTime()
            const MAX_TIME_DIFF_MS = 1.5 * 60 * 1000

            const response = await fetch(
                `/api/option-chain/save?symbol=${symbol}&expiryDate=${expiryDate}&start=${startISO}&end=${endISO}`
            )

            if (!response.ok) {
                setNoDataForTime(true)
                setData([])
                setLoading(false)
                return
            }

            const result = await response.json()
            if (result.snapshots && result.snapshots.length > 0) {
                const sorted = result.snapshots.sort((a: any, b: any) =>
                    new Date(a.captured_at).getTime() - new Date(b.captured_at).getTime()
                )

                const closest = sorted.reduce((prev: any, curr: any) => {
                    const prevDiff = Math.abs(new Date(prev.captured_at).getTime() - targetTimestamp)
                    const currDiff = Math.abs(new Date(curr.captured_at).getTime() - targetTimestamp)
                    return currDiff < prevDiff ? curr : prev
                })

                const timeDiff = Math.abs(new Date(closest.captured_at).getTime() - targetTimestamp)
                if (timeDiff > MAX_TIME_DIFF_MS) {
                    setNoDataForTime(true)
                    setData([])
                    setLoading(false)
                    return
                }

                const closestIdx = sorted.findIndex((s: any) => s.captured_at === closest.captured_at)
                const prevSnapshot = closestIdx > 0 ? sorted[closestIdx - 1] : null

                if (prevSnapshot) {
                    const currentData = closest.option_chain_data
                    const prevData = prevSnapshot.option_chain_data

                    const currentArray = currentData?.records?.data || currentData?.data || (currentData?.optionChain ? Object.values(currentData.optionChain) : [])
                    const prevArray = prevData?.records?.data || prevData?.data || (prevData?.optionChain ? Object.values(prevData.optionChain) : [])

                    const prevOIMap: Record<number, { callOI: number; putOI: number }> = {}
                    if (Array.isArray(prevArray)) {
                        prevArray.forEach((item: any) => {
                            if (!item) return
                            const strike = item.strikePrice || 0
                            prevOIMap[strike] = {
                                callOI: item.CE?.openInterest || 0,
                                putOI: item.PE?.openInterest || 0,
                            }
                        })
                    }

                    if (Array.isArray(currentArray)) {
                        currentArray.forEach((item: any) => {
                            if (!item) return
                            const strike = item.strikePrice || 0
                            const prev = prevOIMap[strike]
                            if (prev) {
                                if (item.CE) item.CE.changeinOpenInterest = (item.CE.openInterest || 0) - prev.callOI
                                if (item.PE) item.PE.changeinOpenInterest = (item.PE.openInterest || 0) - prev.putOI
                            }
                        })
                    }
                }

                const snapshotTime = new Date(closest.captured_at)
                processOptionChainData(closest.option_chain_data)
                setNiftySpot(closest.nifty_spot || 0)
                setDataCaptureTime(snapshotTime)
                setNoDataForTime(false)
            } else {
                setNoDataForTime(true)
                setData([])
            }
        } catch (error) {
            console.error('Error fetching historical data:', error)
            setNoDataForTime(true)
            setData([])
        } finally {
            setLoading(false)
        }
    }, [symbol, expiryDate, processOptionChainData])

    // Handle time change from timeline slider
    const handleTimeChange = useCallback((time: Date) => {
        setSelectedTime(time)
        if (isReplayMode) {
            fetchHistoricalDataForTime(time)
        }
    }, [fetchHistoricalDataForTime, isReplayMode])

    // Handle replay mode change
    const handleReplayModeChange = useCallback((enabled: boolean) => {
        setIsReplayMode(enabled)
        if (enabled) {
            setData([])
            setNoDataForTime(false)
            setDataCaptureTime(null)
        } else {
            setNoDataForTime(false)
            setDataCaptureTime(null)
            fetchOptionChainData()
        }
    }, [fetchOptionChainData])

    // Fetch expiry dates on symbol change
    useEffect(() => {
        const timeoutId = setTimeout(() => fetchExpiryDates(), 500)
        return () => clearTimeout(timeoutId)
    }, [fetchExpiryDates])

    // Reset on symbol change
    useEffect(() => {
        setExpiryDate('')
        setAvailableExpiries([])
        setLoading(true)
        setData([])
        hasDataRef.current = false
    }, [symbol])

    // Fetch data on mount and auto-refresh
    useEffect(() => {
        if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
        if (!isReplayMode) {
            fetchOptionChainData()
            intervalRef.current = setInterval(() => {
                if (!isReplayModeRef.current) fetchOptionChainData()
            }, 300000)
        }
        return () => { if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null } }
    }, [fetchOptionChainData, isReplayMode])

    // Fetch OI trendline data (fallback to last saved data if market closed)
    const fetchOiTrendline = useCallback(async () => {
        try {
            const todayStr = new Date().toISOString().split('T')[0]
            const res = await fetch(`/api/oi-trendline?symbol=${symbol}&date=${todayStr}`)
            if (!res.ok) return
            const json = await res.json()
            if (json.success && Array.isArray(json.data) && json.data.length > 1) {
                const computeDeltas = (entries: any[]) => {
                    return entries.slice(1).map((d: any, i: number) => ({
                        time: d.time,
                        putOI: d.putOI - entries[i].putOI,
                        callOI: d.callOI - entries[i].callOI,
                        pcr: d.pcr,
                        label: new Date(d.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }),
                    }))
                }

                const now = new Date()
                const cutoff = new Date(now.getTime() - oiTrendWindow * 60 * 1000)
                const recentRaw = json.data.filter((d: any) => new Date(d.time) >= cutoff)

                if (recentRaw.length > 1) {
                    setOiTrendData(computeDeltas(recentRaw))
                } else {
                    const snapshotCount = Math.ceil(oiTrendWindow / 3) + 1
                    const lastRaw = json.data.slice(-snapshotCount)
                    if (lastRaw.length > 1) {
                        setOiTrendData(computeDeltas(lastRaw))
                    }
                }
            }
        } catch (e) {
            console.error('Error fetching OI trendline:', e)
        }
    }, [symbol, oiTrendWindow])

    useEffect(() => {
        fetchOiTrendline()
        const trendInterval = setInterval(fetchOiTrendline, 180000) // refresh every 3 min
        return () => clearInterval(trendInterval)
    }, [fetchOiTrendline])

    // Fetch on expiry change
    useEffect(() => {
        if (expiryDate && symbol) fetchOptionChainData()
    }, [expiryDate, symbol, fetchOptionChainData])

    // Find ATM strike (closest to spot price)
    const atmStrike = useMemo(() => {
        if (data.length === 0 || niftySpot === 0) return 0
        return data.reduce((prev, curr) =>
            Math.abs(curr.strikePrice - niftySpot) < Math.abs(prev.strikePrice - niftySpot) ? curr : prev
        ).strikePrice
    }, [data, niftySpot])

    // Prepare chart data: positive change = right (buildup), negative = left (unwinding)
    // Sort strikes descending so highest appears at top
    // For Total OI, we just map callOI and putOI.
    const compassData = [...data]
        .sort((a, b) => b.strikePrice - a.strikePrice)
        .map(d => ({
            strikePrice: d.strikePrice,
            callOIChange: d.callOIChange,
            putOIChange: d.putOIChange,
            callOI: d.callOI,
            putOI: d.putOI,
            isATM: d.strikePrice === atmStrike,
        }))

    // Prepare donut chart data for Change in PVC
    const pvcDonutData = [
        { name: 'Change Pt O', value: Math.abs(oiChangeTotals.putOIChange), color: '#10b981' },
        { name: 'Change Cl O', value: Math.abs(oiChangeTotals.callOIChange), color: '#ef4444' },
    ]

    // Prepare data for PVC Ratio Net
    const pvrNetData = [
        { name: 'Total Pt O', value: oiTotals.putOI, color: '#10b981' },
        { name: 'Total Cl O', value: oiTotals.callOI, color: '#ef4444' },
    ]

    // Custom label for donut
    const renderDonutLabel = ({ name, percent }: any) => {
        return `${(percent * 100).toFixed(0)}%`
    }

    return (
        <div className="min-h-screen bg-[#0d1117] text-gray-200">
            {/* Top Navigation */}
            <div className="relative z-50">
                <TopNavigation hideTopMovers={true} />
            </div>

            {/* Header Bar */}
            <div className="bg-[#161b22] border-b border-gray-700/50">
                <div className="px-4 lg:px-8 py-3 flex items-center justify-between">
                    <h1 className="text-lg font-bold tracking-wider text-white uppercase">
                        Index Analysis
                    </h1>
                    <div className="flex items-center gap-4">
                        {dataCaptureTime && (
                            <span className="text-xs text-gray-400">
                                Last updated: {dataCaptureTime.toLocaleTimeString('en-IN', {
                                    timeZone: 'Asia/Kolkata',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    second: '2-digit',
                                    hour12: true
                                })}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Index Tabs */}
            <div className="bg-[#161b22] border-b border-gray-700/50">
                <div className="px-4 lg:px-8 flex items-center gap-1">
                    {indices.map((idx) => (
                        <button
                            key={idx}
                            onClick={() => setSymbol(idx)}
                            className={`px-5 py-2.5 text-sm font-semibold transition-all duration-200 border-b-2 ${symbol === idx
                                ? 'text-blue-400 border-blue-400 bg-blue-400/10'
                                : 'text-gray-400 border-transparent hover:text-gray-200 hover:bg-gray-700/30'
                                }`}
                        >
                            {idx}
                        </button>
                    ))}

                    {/* Expiry selector */}
                    {availableExpiries.length > 0 && (
                        <div className="ml-auto flex items-center gap-2">
                            <span className="text-xs text-gray-500">Expiry:</span>
                            <select
                                value={expiryDate}
                                onChange={(e) => setExpiryDate(e.target.value)}
                                className="bg-[#21262d] text-gray-300 text-xs px-3 py-1.5 rounded border border-gray-600 focus:outline-none focus:border-blue-500"
                            >
                                {availableExpiries.map(exp => (
                                    <option key={exp} value={exp}>{exp}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
            </div>

            {/* Spot Price Bar */}
            <div className="bg-[#161b22]/60 border-b border-gray-800/50">
                <div className="px-4 lg:px-8 py-2 flex items-center gap-6 text-sm overflow-x-auto whitespace-nowrap">
                    <span className="text-gray-400">
                        {symbol} Spot: <span className="text-white font-bold">{niftySpot.toFixed(2)}</span>
                    </span>
                    <span className="text-gray-400">
                        PCR: <span className={`font-bold ${pcr >= 1 ? 'text-emerald-400' : 'text-red-400'}`}>{pcr.toFixed(4)}</span>
                    </span>
                    <span className="text-gray-400">
                        Sentiment: <span className={`font-bold ${pcr >= 1 ? 'text-emerald-400' : pcr >= 0.7 ? 'text-yellow-400' : 'text-red-400'}`}>
                            {pcr >= 1 ? '🟢 Bullish' : pcr >= 0.7 ? '🟡 Neutral' : '🔴 Bearish'}
                        </span>
                    </span>
                    <div className="w-px h-4 bg-gray-700 mx-2 hidden lg:block"></div>
                    <span className="text-gray-400">
                        Max Pain: <span className="text-white font-bold">{maxPain}</span>
                    </span>
                    <span className="text-gray-400">
                        R1: <span className="text-red-400 font-bold">{resistance1}</span>
                    </span>
                    <span className="text-gray-400">
                        R2: <span className="text-red-400 font-bold">{resistance2}</span>
                    </span>
                    <span className="text-gray-400">
                        S1: <span className="text-emerald-400 font-bold">{support1}</span>
                    </span>
                    <span className="text-gray-400">
                        S2: <span className="text-emerald-400 font-bold">{support2}</span>
                    </span>
                </div>
            </div>

            {/* Main Content */}
            <div className="px-4 lg:px-8 py-6">
                {loading && data.length === 0 ? (
                    <div className="flex items-center justify-center h-96">
                        <div className="text-center">
                            <div className="inline-block w-10 h-10 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mb-4"></div>
                            <p className="text-gray-400 text-sm">Loading {symbol} data...</p>
                        </div>
                    </div>
                ) : data.length === 0 ? (
                    <div className="flex items-center justify-center h-96">
                        <p className="text-gray-500 text-sm">No data available. Please check the symbol and expiry date.</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-6">
                        {/* ROW 1: 3 columns — 60% / 20% / 20% */}
                        <div className="grid grid-cols-1 xl:grid-cols-[3fr_2fr] gap-6">
                            {/* OI Compass — Main Chart (60%) */}
                            <div className="bg-[#161b22] rounded-xl border border-gray-700/50 p-5">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-4">
                                        <h2 className="text-base font-bold text-white flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-blue-400 inline-block"></span>
                                            OI Compass
                                            <span className="text-xs text-gray-500 font-normal ml-1">
                                                ({oiCompassMode === 'change' ? 'Change in OI' : 'Total OI'})
                                            </span>
                                        </h2>
                                        {/* Compass Mode Toggle */}
                                        <div className="flex bg-[#21262d] rounded-lg p-0.5 ml-2">
                                            <button
                                                onClick={() => setOiCompassMode('change')}
                                                className={`px-3 py-1 text-[10px] font-medium rounded-md transition-all ${oiCompassMode === 'change'
                                                    ? 'bg-blue-500/20 text-blue-400 shadow-sm'
                                                    : 'text-gray-400 hover:text-gray-200'
                                                    }`}
                                            >
                                                Change in OI
                                            </button>
                                            <button
                                                onClick={() => setOiCompassMode('total')}
                                                className={`px-3 py-1 text-[10px] font-medium rounded-md transition-all ${oiCompassMode === 'total'
                                                    ? 'bg-blue-500/20 text-blue-400 shadow-sm'
                                                    : 'text-gray-400 hover:text-gray-200'
                                                    }`}
                                            >
                                                Total OI
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4 text-xs">
                                        <span className="flex items-center gap-1.5">
                                            <span className="w-3 h-1.5 rounded bg-red-500 inline-block"></span>
                                            <span className="text-gray-400">{oiCompassMode === 'change' ? 'Call OI Chg' : 'Call OI'}</span>
                                        </span>
                                        <span className="flex items-center gap-1.5">
                                            <span className="w-3 h-1.5 rounded bg-emerald-500 inline-block"></span>
                                            <span className="text-gray-400">{oiCompassMode === 'change' ? 'Put OI Chg' : 'Put OI'}</span>
                                        </span>
                                        <span className="flex items-center gap-1.5">
                                            <span className="w-5 h-3 rounded bg-amber-500/20 border border-amber-500/40 inline-block"></span>
                                            <span className="text-gray-400">ATM</span>
                                        </span>
                                        {oiCompassMode === 'change' && (
                                            "")}
                                    </div>
                                </div>

                                <ResponsiveContainer width="100%" height={550}>
                                    <BarChart
                                        data={compassData}
                                        layout="vertical"
                                        margin={{ top: 10, right: 30, left: 60, bottom: 10 }}
                                        stackOffset="sign" // Important for handling negative values in 'change' mode correctly if needed, though here we use separate bars usually
                                    >
                                        <CartesianGrid strokeDasharray="3 3" stroke="#21262d" horizontal={false} />
                                        <XAxis
                                            type="number"
                                            tick={{ fontSize: 10, fill: '#6b7280' }}
                                            tickFormatter={(value) => {
                                                const lakhs = Math.abs(value) / 100000
                                                return `${value < 0 ? '-' : ''}${lakhs.toFixed(0)}L`
                                            }}
                                            axisLine={{ stroke: '#30363d' }}
                                        />
                                        <YAxis
                                            type="category"
                                            dataKey="strikePrice"
                                            tick={({ x, y, payload }: any) => {
                                                const isATM = payload.value === atmStrike
                                                return (
                                                    <text
                                                        x={x}
                                                        y={y}
                                                        textAnchor="end"
                                                        dominantBaseline="middle"
                                                        fill={isATM ? '#f59e0b' : '#8b949e'}
                                                        fontSize={isATM ? 12 : 10}
                                                        fontWeight={isATM ? 'bold' : 'normal'}
                                                    >
                                                        {isATM ? `▶ ${payload.value}` : payload.value}
                                                    </text>
                                                )
                                            }}
                                            width={65}
                                            axisLine={{ stroke: '#30363d' }}
                                            interval={0}
                                        />
                                        <Tooltip
                                            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                            wrapperStyle={{ zIndex: 1000 }}
                                            content={({ active, payload, label }: any) => {
                                                if (!active || !payload || payload.length === 0) return null
                                                const isATM = Number(label) === atmStrike
                                                return (
                                                    <div style={{
                                                        backgroundColor: '#1c2128',
                                                        border: '1px solid #30363d',
                                                        borderRadius: '8px',
                                                        padding: '10px 14px',
                                                        fontSize: '12px',
                                                        color: '#e6edf3',
                                                        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                                                        minWidth: '180px',
                                                    }}>
                                                        <p style={{ fontWeight: 'bold', marginBottom: '6px', color: isATM ? '#f59e0b' : '#e6edf3' }}>
                                                            Strike: {label}{isATM ? ' ⭐ ATM' : ''}
                                                        </p>
                                                        {payload.map((item: any, i: number) => {
                                                            const val = item.value
                                                            const lakhs = Math.abs(val) / 100000
                                                            // Direction only relevant for change mode usually, but valid for all
                                                            const direction = oiCompassMode === 'change'
                                                                ? (val > 0 ? '📈 Buildup' : val < 0 ? '📉 Unwinding' : '—')
                                                                : ''
                                                            const color = (item.dataKey === 'callOIChange' || item.dataKey === 'callOI') ? '#ef4444' : '#10b981'
                                                            const name = oiCompassMode === 'change'
                                                                ? (item.dataKey === 'callOIChange' ? 'Call OI Chg' : 'Put OI Chg')
                                                                : (item.dataKey === 'callOI' ? 'Total Call OI' : 'Total Put OI')

                                                            return (
                                                                <p key={i} style={{ margin: '3px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: color, display: 'inline-block', flexShrink: 0 }}></span>
                                                                    <span style={{ color: '#9ca3af' }}>{name}:</span>
                                                                    <span style={{ fontWeight: 'bold', color }}>{val < 0 ? '-' : ''}{lakhs.toFixed(2)}L</span>
                                                                    {direction && <span style={{ color: '#6b7280', fontSize: '10px' }}>{direction}</span>}
                                                                </p>
                                                            )
                                                        })}
                                                    </div>
                                                )
                                            }}
                                        />
                                        <ReferenceLine
                                            x={0}
                                            stroke="#484f58"
                                            strokeWidth={1}
                                        />
                                        <ReferenceLine
                                            y={atmStrike.toString()}
                                            stroke="#f59e0b"
                                            strokeDasharray="5 5"
                                            strokeWidth={2}
                                            label={{ value: 'ATM', fill: '#f59e0b', fontSize: 10, position: 'right' }}
                                        />
                                        <Bar
                                            dataKey={oiCompassMode === 'change' ? "callOIChange" : "callOI"}
                                            barSize={7}
                                            radius={[2, 2, 2, 2]}
                                            fill="#ef4444"
                                        >
                                            {compassData.map((entry, index) => (
                                                <Cell
                                                    key={`call-${index}`}
                                                    fill={
                                                        oiCompassMode === 'change'
                                                            ? (entry.callOIChange >= 0 ? '#ef4444' : '#ef444480')
                                                            : '#ef4444'
                                                    }
                                                    stroke={entry.isATM ? '#f59e0b' : 'none'}
                                                    strokeWidth={entry.isATM ? 1 : 0}
                                                />
                                            ))}
                                        </Bar>
                                        <Bar
                                            dataKey={oiCompassMode === 'change' ? "putOIChange" : "putOI"}
                                            barSize={7}
                                            radius={[2, 2, 2, 2]}
                                            fill="#10b981"
                                        >
                                            {compassData.map((entry, index) => (
                                                <Cell
                                                    key={`put-${index}`}
                                                    fill={
                                                        oiCompassMode === 'change'
                                                            ? (entry.putOIChange >= 0 ? '#10b981' : '#10b98180')
                                                            : '#10b981'
                                                    }
                                                    stroke={entry.isATM ? '#f59e0b' : 'none'}
                                                    strokeWidth={entry.isATM ? 1 : 0}
                                                />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div >


                            {/* Column 2 (40%): Merged PVC Widget + ATM + Sentiment */}
                            <div className="flex flex-col gap-6">
                                {/* Merged PVC Widget (Change in PVC + PVC Ratio Net) */}
                                <div className="bg-[#161b22] rounded-xl border border-gray-700/50 p-5">
                                    <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-purple-400 inline-block"></span>
                                        PVC Analysis
                                    </h3>

                                    <div className="grid grid-cols-2 gap-4">
                                        {/* Left: Change in PVC */}
                                        <div>
                                            <h4 className="text-xs font-semibold text-gray-400 mb-2">Change in PVC</h4>
                                            {(pvcDonutData[0].value > 0 || pvcDonutData[1].value > 0) ? (
                                                <>
                                                    <ResponsiveContainer width="100%" height={160}>
                                                        <PieChart margin={{ top: 0, bottom: 0 }}>
                                                            <Pie
                                                                data={pvcDonutData}
                                                                cx="50%"
                                                                cy="50%"
                                                                innerRadius={35}
                                                                outerRadius={55}
                                                                paddingAngle={3}
                                                                dataKey="value"
                                                                label={renderDonutLabel}
                                                                labelLine={false}
                                                            >
                                                                {pvcDonutData.map((entry, index) => (
                                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                                ))}
                                                            </Pie>
                                                            <Tooltip
                                                                wrapperStyle={{ zIndex: 1000 }}
                                                                content={({ active, payload }: any) => {
                                                                    if (!active || !payload || payload.length === 0) return null
                                                                    const item = payload[0]?.payload
                                                                    if (!item) return null
                                                                    return (
                                                                        <div style={{
                                                                            backgroundColor: '#1c2128',
                                                                            border: '1px solid #30363d',
                                                                            borderRadius: '8px',
                                                                            padding: '8px',
                                                                            fontSize: '11px',
                                                                            color: '#e6edf3',
                                                                            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                                                                        }}>
                                                                            <p style={{ margin: 0, fontWeight: 'bold', color: item.color }}>
                                                                                {item.name}: {formatLakhs(item.value)}
                                                                            </p>
                                                                        </div>
                                                                    )
                                                                }}
                                                            />
                                                        </PieChart>
                                                    </ResponsiveContainer>
                                                    <div className="mt-2 space-y-1">
                                                        <div className="flex items-center justify-between text-[10px]">
                                                            <span className="text-gray-400">Put Chg</span>
                                                            <span className="text-emerald-400 font-semibold">{formatLakhs(oiChangeTotals.putOIChange)}</span>
                                                        </div>
                                                        <div className="flex items-center justify-between text-[10px]">
                                                            <span className="text-gray-400">Call Chg</span>
                                                            <span className="text-red-400 font-semibold">{formatLakhs(oiChangeTotals.callOIChange)}</span>
                                                        </div>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="text-center text-gray-500 text-xs py-8">No data</div>
                                            )}
                                        </div>

                                        {/* Right: PVC Ratio Net */}
                                        <div className="border-l border-gray-700/50 pl-4">
                                            <h4 className="text-xs font-semibold text-gray-400 mb-2">Net PVC Ratio</h4>
                                            {(oiTotals.putOI > 0 || oiTotals.callOI > 0) ? (
                                                <>
                                                    <ResponsiveContainer width="100%" height={160}>
                                                        <BarChart
                                                            data={[
                                                                { name: 'Put OI', value: oiTotals.putOI, fill: '#10b981' },
                                                                { name: 'Call OI', value: oiTotals.callOI, fill: '#ef4444' },
                                                            ]}
                                                            margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
                                                        >
                                                            <CartesianGrid strokeDasharray="3 3" stroke="#21262d" vertical={false} />
                                                            <XAxis
                                                                dataKey="name"
                                                                tick={{ fontSize: 10, fill: '#9ca3af' }}
                                                                axisLine={{ stroke: '#30363d' }}
                                                                interval={0}
                                                            />
                                                            <YAxis
                                                                tick={{ fontSize: 9, fill: '#6b7280' }}
                                                                tickFormatter={(value) => `${(value / 100000).toFixed(0)}L`}
                                                                axisLine={{ stroke: '#30363d' }}
                                                                width={35}
                                                            />
                                                            <Tooltip
                                                                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                                                wrapperStyle={{ zIndex: 1000 }}
                                                                content={({ active, payload, label }: any) => {
                                                                    if (!active || !payload || payload.length === 0) return null
                                                                    return (
                                                                        <div style={{
                                                                            backgroundColor: '#1c2128',
                                                                            border: '1px solid #30363d',
                                                                            borderRadius: '8px',
                                                                            padding: '8px',
                                                                            fontSize: '11px',
                                                                            color: '#e6edf3',
                                                                        }}>
                                                                            <span style={{ color: payload[0]?.payload?.fill, fontWeight: 'bold' }}>
                                                                                {label}:
                                                                            </span>{' '}
                                                                            {formatLakhs(payload[0]?.value)}
                                                                        </div>
                                                                    )
                                                                }}
                                                            />
                                                            <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={40}>
                                                                {[
                                                                    { fill: '#10b981' },
                                                                    { fill: '#ef4444' },
                                                                ].map((entry, index) => (
                                                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                                                ))}
                                                            </Bar>
                                                        </BarChart>
                                                    </ResponsiveContainer>

                                                    <div className="mt-2 text-[10px] space-y-1">
                                                        <div className="flex justify-between">
                                                            <span className="text-gray-500">PCR</span>
                                                            <span className={`font-bold ${pcr >= 1 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                                {pcr.toFixed(2)}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-gray-500">Net Diff</span>
                                                            <span className={`font-bold ${oiTotals.putOI - oiTotals.callOI > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                                {formatLakhs(oiTotals.putOI - oiTotals.callOI)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="text-center text-gray-500 text-xs py-8">No data</div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* ATM ±2 Volume/OI Change Widget */}
                                <div className="bg-[#161b22] rounded-xl border border-gray-700/50 p-5">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-sky-400 inline-block"></span>
                                            ATM - {data.length > 0 && niftySpot > 0
                                                ? [...data].sort((a, b) => Math.abs(a.strikePrice - niftySpot) - Math.abs(b.strikePrice - niftySpot))[0]?.strikePrice
                                                : '...'
                                            }
                                        </h3>
                                        <div className="flex bg-[#21262d] rounded-lg p-0.5">
                                            <button
                                                onClick={() => setAtmViewMode('oiChange')}
                                                className={`px-3 py-1 text-[10px] font-medium rounded-md transition-all ${atmViewMode === 'oiChange'
                                                    ? 'bg-blue-500/20 text-blue-400 shadow-sm'
                                                    : 'text-gray-400 hover:text-gray-200'
                                                    }`}
                                            >
                                                Chg in OI
                                            </button>
                                            <button
                                                onClick={() => setAtmViewMode('volume')}
                                                className={`px-3 py-1 text-[10px] font-medium rounded-md transition-all ${atmViewMode === 'volume'
                                                    ? 'bg-blue-500/20 text-blue-400 shadow-sm'
                                                    : 'text-gray-400 hover:text-gray-200'
                                                    }`}
                                            >
                                                Volume
                                            </button>
                                        </div>
                                    </div>

                                    {
                                        (() => {
                                            if (data.length === 0 || niftySpot === 0) {
                                                return <div className="text-center text-gray-500 text-xs py-8">No data</div>
                                            }

                                            // Find ATM strike
                                            const sorted = [...data].sort((a, b) =>
                                                Math.abs(a.strikePrice - niftySpot) - Math.abs(b.strikePrice - niftySpot)
                                            )
                                            const atmStrike = sorted[0]?.strikePrice || 0
                                            const allStrikes = Array.from(new Set(data.map(d => d.strikePrice))).sort((a, b) => a - b)
                                            const atmIdx = allStrikes.indexOf(atmStrike)
                                            if (atmIdx === -1) return <div className="text-center text-gray-500 text-xs py-8">No ATM data</div>

                                            // Get ATM-2 to ATM+2
                                            const startIdx = Math.max(0, atmIdx - 4)
                                            const endIdx = Math.min(allStrikes.length - 1, atmIdx + 4)
                                            const nearStrikes = allStrikes.slice(startIdx, endIdx + 1)
                                            const strikeDataMap = new Map(data.map(d => [d.strikePrice, d]))

                                            const chartData = nearStrikes.map(strike => {
                                                const d = strikeDataMap.get(strike)
                                                return {
                                                    strike: String(strike),
                                                    putVal: atmViewMode === 'oiChange' ? (d?.putOIChange || 0) : (d?.putVolume || 0),
                                                    callVal: atmViewMode === 'oiChange' ? (d?.callOIChange || 0) : (d?.callVolume || 0),
                                                    isATM: strike === atmStrike,
                                                }
                                            })

                                            const totalPutVal = chartData.reduce((s, d) => s + d.putVal, 0)
                                            const totalCallVal = chartData.reduce((s, d) => s + d.callVal, 0)

                                            const label = atmViewMode === 'oiChange' ? 'OI Chg' : 'Vol'

                                            return (
                                                <>
                                                    <ResponsiveContainer width="100%" height={180}>
                                                        <BarChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                                                            <CartesianGrid strokeDasharray="3 3" stroke="#21262d" vertical={false} />
                                                            <XAxis
                                                                dataKey="strike"
                                                                tick={(props: any) => {
                                                                    const { x, y, payload } = props
                                                                    const item = chartData.find(d => d.strike === payload.value)
                                                                    const isATM = item?.isATM
                                                                    return (
                                                                        <text x={x} y={y + 12} textAnchor="middle" fontSize={9}
                                                                            fill={isATM ? '#22d3ee' : '#6b7280'}
                                                                            fontWeight={isATM ? 'bold' : 'normal'}>
                                                                            {payload.value}{isATM ? ' ★' : ''}
                                                                        </text>
                                                                    )
                                                                }}
                                                                axisLine={{ stroke: '#30363d' }}
                                                            />
                                                            <YAxis
                                                                tick={{ fontSize: 8, fill: '#6b7280' }}
                                                                tickFormatter={(v) => `${(v / 100000).toFixed(0)}L`}
                                                                axisLine={{ stroke: '#30363d' }}
                                                                width={35}
                                                            />
                                                            <Tooltip
                                                                wrapperStyle={{ zIndex: 1000 }}
                                                                content={({ active, payload, label }: any) => {
                                                                    if (!active || !payload || payload.length === 0) return null
                                                                    const isATM = payload[0]?.payload?.isATM
                                                                    return (
                                                                        <div style={{
                                                                            backgroundColor: '#1c2128',
                                                                            border: '1px solid #30363d',
                                                                            borderRadius: '8px',
                                                                            padding: '10px 14px',
                                                                            fontSize: '12px',
                                                                            color: '#e6edf3',
                                                                            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                                                                        }}>
                                                                            <p style={{ margin: 0, fontWeight: 'bold', marginBottom: '6px' }}>
                                                                                Strike {label} {isATM ? '(ATM)' : ''}
                                                                            </p>
                                                                            {payload.map((item: any, i: number) => (
                                                                                <p key={i} style={{ margin: '3px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: item.color, display: 'inline-block' }}></span>
                                                                                    <span style={{ color: '#9ca3af' }}>{item.dataKey === 'putVal' ? `Put ${label}` : `Call ${label}`}:</span>
                                                                                    <span style={{ fontWeight: 'bold', color: item.color }}>{(item.value / 100000).toFixed(2)}L</span>
                                                                                </p>
                                                                            ))}
                                                                        </div>
                                                                    )
                                                                }}
                                                            />
                                                            <ReferenceLine y={0} stroke="#30363d" />
                                                            <Bar dataKey="putVal" fill="#10b981" barSize={12} radius={[2, 2, 0, 0]} name={`Put ${label}`} />
                                                            <Bar dataKey="callVal" fill="#ef4444" barSize={12} radius={[2, 2, 0, 0]} name={`Call ${label}`} />
                                                        </BarChart>
                                                    </ResponsiveContainer>

                                                    <div className="mt-3 space-y-1.5">
                                                        <div className="flex items-center justify-between text-xs">
                                                            <span className="flex items-center gap-2">
                                                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                                                                <span className="text-gray-400">Total Put {label}</span>
                                                            </span>
                                                            <span className="text-emerald-400 font-bold">{(totalPutVal / 100000).toFixed(2)}L</span>
                                                        </div>
                                                        <div className="flex items-center justify-between text-xs">
                                                            <span className="flex items-center gap-2">
                                                                <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block"></span>
                                                                <span className="text-gray-400">Total Call {label}</span>
                                                            </span>
                                                            <span className="text-red-400 font-bold">{(totalCallVal / 100000).toFixed(2)}L</span>
                                                        </div>
                                                        <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-700/50">
                                                            <span className="text-gray-500">{label} Ratio (P/C)</span>
                                                            <span className={`font-bold ${totalCallVal > 0 && (totalPutVal / totalCallVal) >= 1 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                                {totalCallVal !== 0 ? (totalPutVal / totalCallVal).toFixed(2) : '—'}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Merged Sentiment Section */}

                                                </>
                                            )
                                        })()
                                    }
                                </div>
                            </div>
                        </div>

                        {/* ROW 2: OI Addition — Full Width */}
                        < div className="bg-[#161b22] rounded-xl border border-gray-700/50 p-5" >
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block"></span>
                                    OI Addition
                                </h3>
                                <select
                                    value={oiTrendWindow}
                                    onChange={(e) => setOiTrendWindow(Number(e.target.value))}
                                    className="bg-[#0d1117] border border-gray-700 rounded-md text-xs text-gray-300 px-2 py-1 focus:outline-none focus:border-cyan-500 cursor-pointer"
                                >
                                    <option value={15}>15 Min</option>
                                    <option value={30}>30 Min</option>
                                    <option value={60}>1 Hr</option>
                                    <option value={120}>2 Hr</option>
                                    <option value={240}>4 Hr</option>
                                    <option value={480}>8 Hr</option>
                                </select>
                            </div>

                            {
                                oiTrendData.length > 0 ? (() => {
                                    const totalPutAdd = oiTrendData.reduce((sum, d) => sum + d.putOI, 0)
                                    const totalCallAdd = oiTrendData.reduce((sum, d) => sum + d.callOI, 0)
                                    const summaryBarData = [
                                        { name: 'Put', value: totalPutAdd, fill: '#10b981' },
                                        { name: 'Call', value: totalCallAdd, fill: '#ef4444' },
                                    ]
                                    return (
                                        <>
                                            <div className="flex gap-2">
                                                {/* Line chart — per-interval deltas */}
                                                <div style={{ width: '80%' }} className="min-w-0">
                                                    <ResponsiveContainer width="100%" height={180}>
                                                        <LineChart data={oiTrendData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                                                            <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                                                            <XAxis
                                                                dataKey="label"
                                                                tick={{ fontSize: 8, fill: '#6b7280' }}
                                                                axisLine={{ stroke: '#30363d' }}
                                                            />
                                                            <YAxis
                                                                tick={{ fontSize: 8, fill: '#6b7280' }}
                                                                tickFormatter={(v) => `${(v / 100000).toFixed(0)}L`}
                                                                axisLine={{ stroke: '#30363d' }}
                                                                width={35}
                                                                domain={[(dataMin: number) => Math.floor(dataMin * 0.95), (dataMax: number) => Math.ceil(dataMax * 1.05)]}
                                                            />
                                                            <Tooltip
                                                                wrapperStyle={{ zIndex: 1000 }}
                                                                content={({ active, payload, label }: any) => {
                                                                    if (!active || !payload || payload.length === 0) return null
                                                                    return (
                                                                        <div style={{
                                                                            backgroundColor: '#1c2128',
                                                                            border: '1px solid #30363d',
                                                                            borderRadius: '8px',
                                                                            padding: '10px 14px',
                                                                            fontSize: '12px',
                                                                            color: '#e6edf3',
                                                                            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                                                                            minWidth: '150px',
                                                                        }}>
                                                                            <p style={{ margin: 0, fontWeight: 'bold', marginBottom: '6px' }}>🕐 {label}</p>
                                                                            {payload.map((item: any, i: number) => {
                                                                                const val = item.value
                                                                                const arrow = val > 0 ? '▲' : val < 0 ? '▼' : '—'
                                                                                return (
                                                                                    <p key={i} style={{ margin: '3px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: item.color, display: 'inline-block' }}></span>
                                                                                        <span style={{ color: '#9ca3af' }}>{item.dataKey === 'putOI' ? 'Put OI' : 'Call OI'}:</span>
                                                                                        <span style={{ fontWeight: 'bold', color: val > 0 ? '#10b981' : val < 0 ? '#ef4444' : '#6b7280' }}>{arrow} {val > 0 ? '+' : ''}{formatLakhs(val)}</span>
                                                                                    </p>
                                                                                )
                                                                            })}
                                                                        </div>
                                                                    )
                                                                }}
                                                            />
                                                            <Line type="monotone" dataKey="putOI" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} name="Put OI" />
                                                            <Line type="monotone" dataKey="callOI" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} name="Call OI" />
                                                        </LineChart>
                                                    </ResponsiveContainer>
                                                </div>

                                                {/* Summary bar — total additions */}
                                                <div style={{ width: '20%' }} className="flex-shrink-0">
                                                    <ResponsiveContainer width="100%" height={180}>
                                                        <BarChart data={summaryBarData} margin={{ top: 5, right: 5, left: 0, bottom: 30 }}>
                                                            <XAxis
                                                                dataKey="name"
                                                                axisLine={{ stroke: '#30363d' }}
                                                                tick={({ x, y, payload }) => {
                                                                    const item = summaryBarData.find(d => d.name === payload.value)
                                                                    const val = item?.value || 0
                                                                    const color = item?.fill || '#9ca3af'
                                                                    return (
                                                                        <g transform={`translate(${x},${y})`}>
                                                                            <text x={0} y={15} textAnchor="middle" fill={color} fontSize={12} fontWeight="bold">
                                                                                {val < 0 ? '-' : ''}{formatLakhs(val)}
                                                                            </text>
                                                                            <text x={0} y={30} textAnchor="middle" fill="#9ca3af" fontSize={11} fontWeight="bold">
                                                                                {payload.value}
                                                                            </text>
                                                                        </g>
                                                                    )
                                                                }}
                                                            />
                                                            <YAxis hide />
                                                            <Tooltip
                                                                wrapperStyle={{ zIndex: 1000 }}
                                                                content={({ active, payload }: any) => {
                                                                    if (!active || !payload || payload.length === 0) return null
                                                                    const d = payload[0]
                                                                    const val = d?.value || 0
                                                                    return (
                                                                        <div style={{
                                                                            backgroundColor: '#1c2128',
                                                                            border: '1px solid #30363d',
                                                                            borderRadius: '8px',
                                                                            padding: '8px 12px',
                                                                            fontSize: '11px',
                                                                            color: '#e6edf3',
                                                                            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                                                                        }}>
                                                                            <p style={{ margin: 0, color: d?.payload?.fill, fontWeight: 'bold' }}>
                                                                                {d?.payload?.name} OI: {val > 0 ? '+' : ''}{formatLakhs(val)}
                                                                                {val >= 0 ? ' ▲' : ' ▼'}
                                                                            </p>
                                                                        </div>
                                                                    )
                                                                }}
                                                            />
                                                            <Bar dataKey="value" barSize={28} radius={[4, 4, 0, 0]}>
                                                                {summaryBarData.map((entry, index) => (
                                                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                                                ))}
                                                            </Bar>
                                                        </BarChart>
                                                    </ResponsiveContainer>
                                                </div>
                                            </div>

                                            <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                                                <div className="flex items-center gap-3">
                                                    <span className="flex items-center gap-1">
                                                        <span className="w-3 h-0.5 bg-emerald-500 inline-block rounded"></span>
                                                        Put OI
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <span className="w-3 h-0.5 bg-red-500 inline-block rounded"></span>
                                                        Call OI
                                                    </span>
                                                </div>
                                                <span>{oiTrendData.length} snapshots</span>
                                            </div>
                                        </>
                                    )
                                })() : (
                                    <div className="text-center text-gray-500 text-xs py-8">No trend data available</div>
                                )
                            }
                        </div >
                    </div >
                )}
            </div >


            <Footer />
        </div >
    )
}
