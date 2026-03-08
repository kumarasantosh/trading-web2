'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'

const REFRESH_INTERVAL_MS = 180000 // 3 minutes

export interface OptionChainData {
    strikePrice: number
    callOI: number
    putOI: number
    callOIChange: number
    putOIChange: number
    callVolume: number
    putVolume: number
}

export interface OiTrendPoint {
    time: string
    putOI: number
    callOI: number
    pcr: number
    label: string
}

export interface MarketLevels {
    ydayHigh: number
    ydayLow: number
    ydayClose: number
    todayOpen: number
    openingRangeHigh: number
    openingRangeLow: number
}

export type TrendDirection = 'BULLISH' | 'BEARISH' | 'NEUTRAL'

export interface IndexData {
    data: OptionChainData[]
    niftySpot: number
    pcr: number
    loading: boolean
    expiryDate: string
    setExpiryDate: (date: string) => void
    availableExpiries: string[]
    oiTotals: { callOI: number; putOI: number }
    oiChangeTotals: { callOIChange: number; putOIChange: number }
    dataCaptureTime: Date | null
    maxPain: number
    support1: number
    support2: number
    resistance1: number
    resistance2: number
    atmStrike: number
    compassData: Array<{
        strikePrice: number
        callOIChange: number
        putOIChange: number
        callOI: number
        putOI: number
        isATM: boolean
    }>
    pvcDonutData: Array<{ name: string; value: number; color: string }>
    pvrNetData: Array<{ name: string; value: number; color: string }>
    oiTrendData: OiTrendPoint[]
    oiTrendWindow: number
    setOiTrendWindow: (window: number) => void
    oiTrendMode: 'oi' | 'volume'
    setOiTrendMode: (mode: 'oi' | 'volume') => void
    atmViewMode: 'volume' | 'oiChange'
    setAtmViewMode: (mode: 'volume' | 'oiChange') => void
    formatLakhs: (value: number) => string
    marketLevels: MarketLevels
    trend: TrendDirection
    trendReason: string
}

export function useIndexData(symbol: string): IndexData {
    const [data, setData] = useState<OptionChainData[]>([])
    const [niftySpot, setNiftySpot] = useState<number>(0)
    const [pcr, setPcr] = useState<number>(0)
    const [loading, setLoading] = useState(true)
    const [expiryDate, setExpiryDate] = useState('')
    const [availableExpiries, setAvailableExpiries] = useState<string[]>([])
    const [oiTotals, setOiTotals] = useState<{ callOI: number; putOI: number }>({ callOI: 0, putOI: 0 })
    const [oiChangeTotals, setOiChangeTotals] = useState<{ callOIChange: number; putOIChange: number }>({ callOIChange: 0, putOIChange: 0 })
    const [dataCaptureTime, setDataCaptureTime] = useState<Date | null>(null)
    const hasDataRef = useRef(false)
    const [oiTrendData, setOiTrendData] = useState<OiTrendPoint[]>([])
    const [oiTrendWindow, setOiTrendWindow] = useState<number>(15)
    const [oiTrendMode, setOiTrendMode] = useState<'oi' | 'volume'>('oi')
    const [atmViewMode, setAtmViewMode] = useState<'volume' | 'oiChange'>('oiChange')
    const [marketLevels, setMarketLevels] = useState<MarketLevels>({
        ydayHigh: 0, ydayLow: 0, ydayClose: 0, todayOpen: 0,
        openingRangeHigh: 0, openingRangeLow: 0,
    })
    const intervalRef = useRef<NodeJS.Timeout | null>(null)

    // Format number with L suffix (Lakhs)
    const formatLakhs = useCallback((value: number): string => {
        const lakhs = Math.abs(value) / 100000
        if (lakhs >= 100) return `${(lakhs / 100).toFixed(1)}Cr`
        return `${lakhs.toFixed(2)}L`
    }, [])

    // Calculate Max Pain, Support, and Resistance
    const { maxPain, support1, support2, resistance1, resistance2 } = useMemo(() => {
        if (data.length === 0) return { maxPain: 0, support1: 0, support2: 0, resistance1: 0, resistance2: 0 }

        let minTotalLoss = Number.MAX_VALUE
        let maxPainStrike = 0

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

    // Find ATM strike
    const atmStrike = useMemo(() => {
        if (data.length === 0 || niftySpot === 0) return 0
        return data.reduce((prev, curr) =>
            Math.abs(curr.strikePrice - niftySpot) < Math.abs(prev.strikePrice - niftySpot) ? curr : prev
        ).strikePrice
    }, [data, niftySpot])

    // Compass data
    const compassData = useMemo(() =>
        [...data]
            .sort((a, b) => a.strikePrice - b.strikePrice)
            .map(d => ({
                strikePrice: d.strikePrice,
                callOIChange: d.callOIChange,
                putOIChange: d.putOIChange,
                callOI: d.callOI,
                putOI: d.putOI,
                isATM: d.strikePrice === atmStrike,
            })),
        [data, atmStrike]
    )

    // Donut chart data
    const pvcDonutData = useMemo(() => [
        { name: 'Change Pt O', value: Math.abs(oiChangeTotals.putOIChange), color: '#10b981' },
        { name: 'Change Cl O', value: Math.abs(oiChangeTotals.callOIChange), color: '#ef4444' },
    ], [oiChangeTotals])

    const pvrNetData = useMemo(() => [
        { name: 'Total Pt O', value: oiTotals.putOI, color: '#10b981' },
        { name: 'Total Cl O', value: oiTotals.callOI, color: '#ef4444' },
    ], [oiTotals])

    // Compute trend from spot and market levels
    const { trend, trendReason } = useMemo((): { trend: TrendDirection; trendReason: string } => {
        if (niftySpot === 0) return { trend: 'NEUTRAL', trendReason: 'Waiting for data' }
        const { ydayHigh, ydayLow, openingRangeHigh, openingRangeLow } = marketLevels

        const hasAllLevels = ydayHigh > 0 && ydayLow > 0 && openingRangeHigh > 0 && openingRangeLow > 0
        if (!hasAllLevels) {
            return { trend: 'NEUTRAL', trendReason: 'Waiting for complete market levels' }
        }

        // Highly bullish only when price is above BOTH yesterday high and opening range high.
        if (niftySpot > ydayHigh && niftySpot > openingRangeHigh) {
            return { trend: 'BULLISH', trendReason: 'Trading above Yesterday High and Opening Range (Highly Bullish)' }
        }

        // Highly bearish only when price is below BOTH opening range low and yesterday low.
        if (niftySpot < openingRangeLow && niftySpot < ydayLow) {
            return { trend: 'BEARISH', trendReason: 'Trading below Opening Range and Yesterday Low (Highly Bearish)' }
        }

        const lowerBoundary = Math.min(openingRangeLow, ydayLow)
        const upperBoundary = Math.max(openingRangeHigh, ydayHigh)
        if (niftySpot >= lowerBoundary && niftySpot <= upperBoundary) {
            return { trend: 'NEUTRAL', trendReason: 'Trading between Opening and Yesterday range (Neutral Sellers Day)' }
        }

        return { trend: 'NEUTRAL', trendReason: 'Range transition' }
    }, [niftySpot, marketLevels])

    // Fetch market levels (yday high/low, opening range) from NSE indices API
    const fetchMarketLevels = useCallback(async () => {
        try {
            const nseIndex = symbol === 'NIFTY' ? 'NIFTY 50' : symbol === 'BANKNIFTY' ? 'NIFTY BANK' : 'NIFTY FIN SERVICE'

            // Fetch from NSE indices API
            const res = await fetch('/api/nse/indices', { cache: 'no-store' })
            if (!res.ok) return
            const nseData = await res.json()

            const allIndices = Array.isArray(nseData.data) ? nseData.data : []
            const indexData = allIndices.find((item: any) => item.index === nseIndex)

            if (indexData) {
                const todayOpen = indexData.open || 0
                const ydayClose = indexData.previousClose || 0
                // NSE returns yearHigh/yearLow but for yday we use previousClose-based values
                // We can also derive from the high/low of the current session for opening range
                const currentHigh = indexData.high || 0
                const currentLow = indexData.low || 0

                setMarketLevels(prev => ({
                    ...prev,
                    todayOpen,
                    ydayClose,
                    // If we don't have yday high/low from a separate source, estimate from previousClose
                    ydayHigh: prev.ydayHigh || ydayClose, // Will be overridden by snapshots if available
                    ydayLow: prev.ydayLow || ydayClose,
                }))
            }

            // Fetch opening range from earliest option chain snapshots (first 15 min: 9:15-9:30 IST)
            const todayStr = new Date().toISOString().split('T')[0]
            const orStart = `${todayStr}T03:45:00.000Z` // 9:15 IST = 03:45 UTC
            const orEnd = `${todayStr}T04:00:00.000Z`   // 9:30 IST = 04:00 UTC

            const orRes = await fetch(`/api/option-chain/save?symbol=${symbol}&start=${orStart}&end=${orEnd}`)
            if (orRes.ok) {
                const orData = await orRes.json()
                if (orData.success && Array.isArray(orData.snapshots) && orData.snapshots.length > 0) {
                    const spots = orData.snapshots
                        .map((s: any) => s.nifty_spot || 0)
                        .filter((v: number) => v > 0)
                    if (spots.length > 0) {
                        const orHigh = Math.max(...spots)
                        const orLow = Math.min(...spots)
                        setMarketLevels(prev => ({
                            ...prev,
                            openingRangeHigh: orHigh,
                            openingRangeLow: orLow,
                        }))
                    }
                }
            }

            // Fetch yesterday's snapshots to get yday high/low
            const yesterday = new Date()
            yesterday.setDate(yesterday.getDate() - 1)
            // Skip weekends
            if (yesterday.getDay() === 0) yesterday.setDate(yesterday.getDate() - 2)
            if (yesterday.getDay() === 6) yesterday.setDate(yesterday.getDate() - 1)
            const ydayStr = yesterday.toISOString().split('T')[0]
            const ydayStart = `${ydayStr}T03:45:00.000Z`
            const ydayEnd = `${ydayStr}T10:00:00.000Z`

            const ydayRes = await fetch(`/api/option-chain/save?symbol=${symbol}&start=${ydayStart}&end=${ydayEnd}`)
            if (ydayRes.ok) {
                const ydayData = await ydayRes.json()
                if (ydayData.success && Array.isArray(ydayData.snapshots) && ydayData.snapshots.length > 0) {
                    const ydaySpots = ydayData.snapshots
                        .map((s: any) => s.nifty_spot || 0)
                        .filter((v: number) => v > 0)
                    if (ydaySpots.length > 0) {
                        setMarketLevels(prev => ({
                            ...prev,
                            ydayHigh: Math.max(...ydaySpots),
                            ydayLow: Math.min(...ydaySpots),
                        }))
                    }
                }
            }
        } catch (e) {
            console.error(`[${symbol}] Error fetching market levels:`, e)
        }
    }, [symbol])

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
            console.error(`[${symbol}] Error fetching expiry dates:`, error)
        }
    }, [symbol])

    // Process option chain data
    const processOptionChainData = useCallback((apiData: any, currentExpiry?: string) => {
        try {
            const underlyingValue = apiData?.records?.underlyingValue || apiData?.underlyingValue || apiData?.spotPrice || 0
            setNiftySpot(underlyingValue)

            let dataArray = apiData?.records?.data || apiData?.data || []

            if ((!Array.isArray(dataArray) || dataArray.length === 0) && apiData?.optionChain) {
                dataArray = Object.values(apiData.optionChain)
            }

            if (!Array.isArray(dataArray) || dataArray.length === 0) {
                setData([])
                return
            }

            const expirySet = new Set<string>()
            dataArray.forEach((item: any) => {
                const exp = item.expiryDate || item.expiryDates
                if (exp) expirySet.add(exp)
            })
            const expiries = Array.from(expirySet).sort()
            if (expiries.length > 0 && availableExpiries.length === 0) {
                setAvailableExpiries(expiries)
            }

            const expiryToFilter = currentExpiry || expiryDate || (expiries.length > 0 ? expiries[0] : '')

            if (!expiryDate && expiryToFilter) {
                setExpiryDate(expiryToFilter)
            }

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
            console.error(`[${symbol}] Error processing option chain data:`, error)
            setData([])
        }
    }, [expiryDate, availableExpiries.length, symbol])

    // Fetch option chain data
    const fetchOptionChainData = useCallback(async () => {
        try {
            const isInitialLoad = !hasDataRef.current
            if (isInitialLoad) setLoading(true)

            const url = `/api/option-chain?symbol=${symbol}${expiryDate ? `&expiryDate=${expiryDate}` : ''}`
            const response = await fetch(url)

            if (!response.ok) {
                throw new Error(`Failed to fetch data: ${response.statusText}`)
            }

            const result = await response.json()
            processOptionChainData(result, expiryDate)
            setDataCaptureTime(new Date())
            hasDataRef.current = true
        } catch (error) {
            console.error(`[${symbol}] Error fetching option chain:`, error)
            if (!hasDataRef.current) setData([])
        } finally {
            setLoading(false)
        }
    }, [symbol, expiryDate, processOptionChainData])

    // Fetch OI trendline data
    const fetchOiTrendline = useCallback(async () => {
        try {
            const todayStr = new Date().toISOString().split('T')[0]
            if (oiTrendMode === 'oi') {
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
            } else {
                const now = new Date()
                const endISO = now.toISOString()
                const start = new Date(now.getTime() - oiTrendWindow * 60 * 1000 - 60 * 1000)
                const startISO = start.toISOString()
                try {
                    const res2 = await fetch(`/api/option-chain/save?symbol=${symbol}${expiryDate ? `&expiryDate=${encodeURIComponent(expiryDate)}` : ''}&start=${encodeURIComponent(startISO)}&end=${encodeURIComponent(endISO)}`)
                    if (!res2.ok) return
                    const json2 = await res2.json()
                    if (json2.success && Array.isArray(json2.snapshots) && json2.snapshots.length > 1) {
                        const totals = json2.snapshots.map((s: any) => {
                            const snapData = s.option_chain_data
                            let totalPutVol = 0
                            let totalCallVol = 0
                            const arr = snapData?.records?.data || snapData?.data || (snapData?.optionChain ? Object.values(snapData.optionChain) : [])
                            if (Array.isArray(arr)) {
                                arr.forEach((item: any) => {
                                    totalCallVol += Number(item.CE?.totalTradedVolume || 0)
                                    totalPutVol += Number(item.PE?.totalTradedVolume || 0)
                                })
                            }
                            return { time: s.captured_at, totalPutVol, totalCallVol, pcr: s.pcr || null }
                        })

                        const deltas = totals.slice(1).map((d: any, i: number) => ({
                            time: d.time,
                            putOI: d.totalPutVol - totals[i].totalPutVol,
                            callOI: d.totalCallVol - totals[i].totalCallVol,
                            pcr: d.pcr || 0,
                            label: new Date(d.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }),
                        }))
                        setOiTrendData(deltas)
                    }
                } catch (e) {
                    console.error(`[${symbol}] Error fetching volume trend:`, e)
                }
            }
        } catch (e) {
            console.error(`[${symbol}] Error fetching OI trendline:`, e)
        }
    }, [symbol, oiTrendWindow, oiTrendMode, expiryDate])

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
        setMarketLevels({ ydayHigh: 0, ydayLow: 0, ydayClose: 0, todayOpen: 0, openingRangeHigh: 0, openingRangeLow: 0 })
    }, [symbol])

    // Fetch market levels on mount
    useEffect(() => {
        fetchMarketLevels()
        const levelsInterval = setInterval(fetchMarketLevels, REFRESH_INTERVAL_MS)
        return () => clearInterval(levelsInterval)
    }, [fetchMarketLevels])

    // Fetch data on mount and auto-refresh
    useEffect(() => {
        if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
        fetchOptionChainData()
        intervalRef.current = setInterval(() => {
            fetchOptionChainData()
        }, REFRESH_INTERVAL_MS)
        return () => { if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null } }
    }, [fetchOptionChainData])

    // Fetch OI trendline
    useEffect(() => {
        fetchOiTrendline()
        const trendInterval = setInterval(fetchOiTrendline, REFRESH_INTERVAL_MS)
        return () => clearInterval(trendInterval)
    }, [fetchOiTrendline])

    // Fetch on expiry change
    useEffect(() => {
        if (expiryDate && symbol) fetchOptionChainData()
    }, [expiryDate, symbol, fetchOptionChainData])

    return {
        data,
        niftySpot,
        pcr,
        loading,
        expiryDate,
        setExpiryDate,
        availableExpiries,
        oiTotals,
        oiChangeTotals,
        dataCaptureTime,
        maxPain,
        support1,
        support2,
        resistance1,
        resistance2,
        atmStrike,
        compassData,
        pvcDonutData,
        pvrNetData,
        oiTrendData,
        oiTrendWindow,
        setOiTrendWindow,
        oiTrendMode,
        setOiTrendMode,
        atmViewMode,
        setAtmViewMode,
        formatLakhs,
        marketLevels,
        trend,
        trendReason,
    }
}
