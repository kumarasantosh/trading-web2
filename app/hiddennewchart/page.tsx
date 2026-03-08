'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, Legend, Cell } from 'recharts'
import TopNavigation from '@/components/momentum/TopNavigation'
import Footer from '@/components/Footer'

interface OptionChainData {
    strikePrice: number
    callOI: number
    putOI: number
    callOIChange: number
    putOIChange: number
    callOIChangePercent?: number
    putOIChangePercent?: number
}

interface SellersAlert {
    strikePrice: number
    type: 'CALL' | 'PUT'
    changePercent: number
    oiChange: number
    sentiment: string
}

interface ResistanceSupport {
    strike: number
    volume: number
}

// Calculate sentiment based on option type and change percentage
const getSentiment = (type: 'CALL' | 'PUT', changePercent: number, isAddition: boolean): string => {
    const absPercent = Math.abs(changePercent)
    let intensity: string

    if (absPercent >= 50) {
        intensity = 'Highly'
    } else if (absPercent >= 25) {
        intensity = ''
    } else {
        intensity = 'Mild'
    }

    if (isAddition) {
        // Sellers adding positions
        if (type === 'CALL') {
            // Call sellers adding = Resistance building = Bearish
            return intensity ? `${intensity} Bearish` : 'Bearish'
        } else {
            // Put sellers adding = Support building = Bullish
            return intensity ? `${intensity} Bullish` : 'Bullish'
        }
    } else {
        // Sellers unwinding positions
        if (type === 'CALL') {
            // Call sellers unwinding = Resistance weakening = Bullish
            return intensity ? `${intensity} Bullish` : 'Bullish'
        } else {
            // Put sellers unwinding = Support weakening = Bearish
            return intensity ? `${intensity} Bearish` : 'Bearish'
        }
    }
}

export default function HiddenNewChartPage() {
    const [data, setData] = useState<OptionChainData[]>([])
    const [atmData, setAtmData] = useState<OptionChainData[]>([])
    const [niftySpot, setNiftySpot] = useState<number>(0)
    const [atmStrike, setAtmStrike] = useState<number>(0)
    const [loading, setLoading] = useState(true)
    const [sellersAddition, setSellersAddition] = useState<SellersAlert[]>([])
    const [sellersUnwinding, setSellersUnwinding] = useState<SellersAlert[]>([])
    const [callSentiment, setCallSentiment] = useState<'Bullish' | 'Bearish' | 'Neutral'>('Neutral')
    const [putSentiment, setPutSentiment] = useState<'Bullish' | 'Bearish' | 'Neutral'>('Neutral')
    const [totalCallOIChange, setTotalCallOIChange] = useState<number>(0)
    const [totalPutOIChange, setTotalPutOIChange] = useState<number>(0)

    // Resistance and Support levels
    const [resistance1, setResistance1] = useState<ResistanceSupport | null>(null)
    const [resistance2, setResistance2] = useState<ResistanceSupport | null>(null)
    const [resistance3, setResistance3] = useState<ResistanceSupport | null>(null)
    const [support1, setSupport1] = useState<ResistanceSupport | null>(null)
    const [support2, setSupport2] = useState<ResistanceSupport | null>(null)
    const [support3, setSupport3] = useState<ResistanceSupport | null>(null)

    const intervalRef = useRef<NodeJS.Timeout | null>(null)

    // Calculate ATM strike (nearest strike to spot price with 50-point interval for NIFTY)
    const calculateATMStrike = useCallback((spotPrice: number, strikes: number[]): number => {
        if (strikes.length === 0) return 0
        // NIFTY has 50-point strike interval
        const strikeInterval = 50
        const nearestStrike = Math.round(spotPrice / strikeInterval) * strikeInterval
        // Find the closest actual strike
        return strikes.reduce((prev, curr) =>
            Math.abs(curr - nearestStrike) < Math.abs(prev - nearestStrike) ? curr : prev
        )
    }, [])

    // Process option chain data
    const processOptionChainData = useCallback((apiData: any) => {
        try {
            const underlyingValue = apiData?.records?.underlyingValue || apiData?.underlyingValue || 0
            setNiftySpot(underlyingValue)

            let dataArray = apiData?.records?.data || apiData?.data || []

            if (!Array.isArray(dataArray) || dataArray.length === 0) {
                console.warn('[HiddenChart] No data found')
                return
            }

            const processedData: OptionChainData[] = []
            let totalCallChange = 0
            let totalPutChange = 0

            dataArray.forEach((item: any) => {
                if (!item) return

                const strikePrice = item.strikePrice || 0
                const ceData = item.CE || {}
                const peData = item.PE || {}

                const callOI = ceData.openInterest || 0
                const putOI = peData.openInterest || 0
                const callOIChange = ceData.changeinOpenInterest || 0
                const putOIChange = peData.changeinOpenInterest || 0

                // Calculate percentage change (avoid division by zero)
                const prevCallOI = callOI - callOIChange
                const prevPutOI = putOI - putOIChange
                const callOIChangePercent = prevCallOI > 0 ? (callOIChange / prevCallOI) * 100 : 0
                const putOIChangePercent = prevPutOI > 0 ? (putOIChange / prevPutOI) * 100 : 0

                totalCallChange += callOIChange
                totalPutChange += putOIChange

                if (strikePrice > 0) {
                    processedData.push({
                        strikePrice: Number(strikePrice),
                        callOI: Number(callOI),
                        putOI: Number(putOI),
                        callOIChange: Number(callOIChange),
                        putOIChange: Number(putOIChange),
                        callOIChangePercent,
                        putOIChangePercent
                    })
                }
            })

            setTotalCallOIChange(totalCallChange)
            setTotalPutOIChange(totalPutChange)

            // Calculate sentiment
            // Call Sentiment: Bearish if sellers adding (OI increasing), Bullish if unwinding
            if (totalCallChange > 0) {
                setCallSentiment('Bearish')
            } else if (totalCallChange < 0) {
                setCallSentiment('Bullish')
            } else {
                setCallSentiment('Neutral')
            }

            // Put Sentiment: Bullish if sellers adding (support building), Bearish if unwinding
            if (totalPutChange > 0) {
                setPutSentiment('Bullish')
            } else if (totalPutChange < 0) {
                setPutSentiment('Bearish')
            } else {
                setPutSentiment('Neutral')
            }

            // Sort by strike price
            processedData.sort((a, b) => a.strikePrice - b.strikePrice)
            setData(processedData)

            // Calculate ATM and filter to ±5 strikes
            const strikes = processedData.map(d => d.strikePrice)
            const atm = calculateATMStrike(underlyingValue, strikes)
            setAtmStrike(atm)

            // Calculate Resistance levels (highest Call OI above ATM)
            const strikesAboveATM = processedData.filter(d => d.strikePrice > atm)
            const sortedByCallOI = [...strikesAboveATM].sort((a, b) => b.callOI - a.callOI)
            if (sortedByCallOI.length >= 1) {
                setResistance1({ strike: sortedByCallOI[0].strikePrice, volume: sortedByCallOI[0].callOI })
            }
            if (sortedByCallOI.length >= 2) {
                setResistance2({ strike: sortedByCallOI[1].strikePrice, volume: sortedByCallOI[1].callOI })
            }
            if (sortedByCallOI.length >= 3) {
                setResistance3({ strike: sortedByCallOI[2].strikePrice, volume: sortedByCallOI[2].callOI })
            }

            // Calculate Support levels (highest Put OI below ATM)
            const strikesBelowATM = processedData.filter(d => d.strikePrice < atm)
            const sortedByPutOI = [...strikesBelowATM].sort((a, b) => b.putOI - a.putOI)
            if (sortedByPutOI.length >= 1) {
                setSupport1({ strike: sortedByPutOI[0].strikePrice, volume: sortedByPutOI[0].putOI })
            }
            if (sortedByPutOI.length >= 2) {
                setSupport2({ strike: sortedByPutOI[1].strikePrice, volume: sortedByPutOI[1].putOI })
            }
            if (sortedByPutOI.length >= 3) {
                setSupport3({ strike: sortedByPutOI[2].strikePrice, volume: sortedByPutOI[2].putOI })
            }

            // Get ATM index and slice ±5 strikes (11 total)
            const atmIndex = processedData.findIndex(d => d.strikePrice === atm)
            if (atmIndex >= 0) {
                const startIdx = Math.max(0, atmIndex - 5)
                const endIdx = Math.min(processedData.length, atmIndex + 6)
                setAtmData(processedData.slice(startIdx, endIdx))
            } else {
                // Fallback to first 11 strikes around spot
                const filteredData = processedData.filter(item =>
                    Math.abs(item.strikePrice - underlyingValue) <= 300
                )
                setAtmData(filteredData.slice(0, 11))
            }

            // Find sellers addition (≥15% increase in OI) and unwinding (≥10% decrease)
            // Only consider ATM ±5 strikes
            const additions: SellersAlert[] = []
            const unwinding: SellersAlert[] = []

            // Use ATM ±5 strikes range (same as atmData)
            const atmStartIdx = Math.max(0, atmIndex - 5)
            const atmEndIdx = Math.min(processedData.length, atmIndex + 6)
            const atmRangeData = atmIndex >= 0 ? processedData.slice(atmStartIdx, atmEndIdx) : []

            atmRangeData.forEach(item => {
                // Check Call OI changes
                if (item.callOIChangePercent && item.callOIChangePercent >= 15) {
                    additions.push({
                        strikePrice: item.strikePrice,
                        type: 'CALL',
                        changePercent: item.callOIChangePercent,
                        oiChange: item.callOIChange,
                        sentiment: getSentiment('CALL', item.callOIChangePercent, true)
                    })
                }
                if (item.callOIChangePercent && item.callOIChangePercent <= -10) {
                    unwinding.push({
                        strikePrice: item.strikePrice,
                        type: 'CALL',
                        changePercent: item.callOIChangePercent,
                        oiChange: item.callOIChange,
                        sentiment: getSentiment('CALL', item.callOIChangePercent, false)
                    })
                }

                // Check Put OI changes
                if (item.putOIChangePercent && item.putOIChangePercent >= 15) {
                    additions.push({
                        strikePrice: item.strikePrice,
                        type: 'PUT',
                        changePercent: item.putOIChangePercent,
                        oiChange: item.putOIChange,
                        sentiment: getSentiment('PUT', item.putOIChangePercent, true)
                    })
                }
                if (item.putOIChangePercent && item.putOIChangePercent <= -10) {
                    unwinding.push({
                        strikePrice: item.strikePrice,
                        type: 'PUT',
                        changePercent: item.putOIChangePercent,
                        oiChange: item.putOIChange,
                        sentiment: getSentiment('PUT', item.putOIChangePercent, false)
                    })
                }
            })

            // Sort by absolute change percent
            additions.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
            unwinding.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))

            setSellersAddition(additions.slice(0, 5)) // Top 5 from ATM ±5
            setSellersUnwinding(unwinding.slice(0, 5)) // Top 5 from ATM ±5

        } catch (error) {
            console.error('[HiddenChart] Error processing data:', error)
        }
    }, [calculateATMStrike])

    // Fetch option chain data
    const fetchOptionChainData = useCallback(async () => {
        try {
            setLoading(true)
            const response = await fetch('/api/option-chain?symbol=NIFTY')

            if (!response.ok) {
                throw new Error('Failed to fetch data')
            }

            const result = await response.json()
            processOptionChainData(result)
        } catch (error) {
            console.error('[HiddenChart] Error fetching data:', error)
        } finally {
            setLoading(false)
        }
    }, [processOptionChainData])

    // Format number with L suffix (Lakhs)
    const formatLakhs = (value: number): string => {
        const lakhs = Math.abs(value) / 100000
        return `${lakhs.toFixed(2)}L`
    }

    // Initialize and auto-refresh
    useEffect(() => {
        fetchOptionChainData()

        // Auto-refresh every 5 minutes
        intervalRef.current = setInterval(() => {
            fetchOptionChainData()
        }, 300000)

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current)
            }
        }
    }, [fetchOptionChainData])

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
            {/* Top Navigation */}
            <div className="relative z-50">
                <TopNavigation hideTopMovers={true} />
            </div>

            <div className="w-full py-8 min-h-[calc(100vh-200px)]">
                <div className="px-4 lg:px-6">
                    {/* Header Section */}
                    <div className="bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-slate-700/50 shadow-2xl p-6 mb-6">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h1 className="text-3xl font-extrabold bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
                                    NIFTY Open Interest Analysis
                                </h1>
                                <p className="text-slate-400 text-sm mt-1">ATM ±5 Strikes with Sellers Volume Analysis</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="text-right">
                                    <div className="text-xs text-slate-500 uppercase tracking-wider">Spot Price</div>
                                    <div className="text-2xl font-bold text-white">₹{niftySpot.toFixed(2)}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs text-slate-500 uppercase tracking-wider">ATM Strike</div>
                                    <div className="text-2xl font-bold text-cyan-400">{atmStrike}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {loading ? (
                        <div className="bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-slate-700/50 shadow-2xl p-12 text-center">
                            <div className="text-slate-400 font-medium">Loading chart data...</div>
                        </div>
                    ) : (
                        <>
                            {/* Sentiment Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                {/* Call Sentiment */}
                                <div className={`rounded-2xl border shadow-2xl p-6 ${callSentiment === 'Bullish'
                                    ? 'bg-gradient-to-br from-emerald-900/50 to-emerald-950/50 border-emerald-600/30'
                                    : callSentiment === 'Bearish'
                                        ? 'bg-gradient-to-br from-red-900/50 to-red-950/50 border-red-600/30'
                                        : 'bg-slate-900/80 border-slate-700/50'
                                    }`}>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Call Sentiment</div>
                                            <div className={`text-3xl font-bold ${callSentiment === 'Bullish' ? 'text-emerald-400' :
                                                callSentiment === 'Bearish' ? 'text-red-400' : 'text-slate-400'
                                                }`}>
                                                {callSentiment}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xs text-slate-500">Net OI Change</div>
                                            <div className={`text-xl font-semibold ${totalCallOIChange >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                                {totalCallOIChange >= 0 ? '+' : ''}{formatLakhs(totalCallOIChange)}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-3 text-xs text-slate-500">
                                        {callSentiment === 'Bullish' ? 'Call sellers unwinding → Resistance weakening' :
                                            callSentiment === 'Bearish' ? 'Call sellers adding → Resistance building' : 'No significant change'}
                                    </div>
                                    {/* Resistance Levels */}
                                    <div className="mt-4 pt-4 border-t border-slate-700/50">
                                        <div className="grid grid-cols-3 gap-3">
                                            <div className="bg-slate-800/50 rounded-lg p-3">
                                                <div className="text-xs text-slate-500 uppercase tracking-wider">Resistance 1</div>
                                                <div className="text-lg font-bold text-red-400">
                                                    {resistance1 ? resistance1.strike : '-'}
                                                    {resistance1 && (
                                                        <span className="text-xs font-normal text-slate-400 ml-1">({formatLakhs(resistance1.volume)})</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="bg-slate-800/50 rounded-lg p-3">
                                                <div className="text-xs text-slate-500 uppercase tracking-wider">Resistance 2</div>
                                                <div className="text-lg font-bold text-red-400">
                                                    {resistance2 ? resistance2.strike : '-'}
                                                    {resistance2 && (
                                                        <span className="text-xs font-normal text-slate-400 ml-1">({formatLakhs(resistance2.volume)})</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="bg-slate-800/50 rounded-lg p-3">
                                                <div className="text-xs text-slate-500 uppercase tracking-wider">Resistance 3</div>
                                                <div className="text-lg font-bold text-red-400">
                                                    {resistance3 ? resistance3.strike : '-'}
                                                    {resistance3 && (
                                                        <span className="text-xs font-normal text-slate-400 ml-1">({formatLakhs(resistance3.volume)})</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Put Sentiment */}
                                <div className={`rounded-2xl border shadow-2xl p-6 ${putSentiment === 'Bullish'
                                    ? 'bg-gradient-to-br from-emerald-900/50 to-emerald-950/50 border-emerald-600/30'
                                    : putSentiment === 'Bearish'
                                        ? 'bg-gradient-to-br from-red-900/50 to-red-950/50 border-red-600/30'
                                        : 'bg-slate-900/80 border-slate-700/50'
                                    }`}>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Put Sentiment</div>
                                            <div className={`text-3xl font-bold ${putSentiment === 'Bullish' ? 'text-emerald-400' :
                                                putSentiment === 'Bearish' ? 'text-red-400' : 'text-slate-400'
                                                }`}>
                                                {putSentiment}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xs text-slate-500">Net OI Change</div>
                                            <div className={`text-xl font-semibold ${totalPutOIChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                {totalPutOIChange >= 0 ? '+' : ''}{formatLakhs(totalPutOIChange)}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-3 text-xs text-slate-500">
                                        {putSentiment === 'Bullish' ? 'Put sellers adding → Support building' :
                                            putSentiment === 'Bearish' ? 'Put sellers unwinding → Support weakening' : 'No significant change'}
                                    </div>
                                    {/* Support Levels */}
                                    <div className="mt-4 pt-4 border-t border-slate-700/50">
                                        <div className="grid grid-cols-3 gap-3">
                                            <div className="bg-slate-800/50 rounded-lg p-3">
                                                <div className="text-xs text-slate-500 uppercase tracking-wider">Support 1</div>
                                                <div className="text-lg font-bold text-teal-400">
                                                    {support1 ? support1.strike : '-'}
                                                    {support1 && (
                                                        <span className="text-xs font-normal text-slate-400 ml-1">({formatLakhs(support1.volume)})</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="bg-slate-800/50 rounded-lg p-3">
                                                <div className="text-xs text-slate-500 uppercase tracking-wider">Support 2</div>
                                                <div className="text-lg font-bold text-teal-400">
                                                    {support2 ? support2.strike : '-'}
                                                    {support2 && (
                                                        <span className="text-xs font-normal text-slate-400 ml-1">({formatLakhs(support2.volume)})</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="bg-slate-800/50 rounded-lg p-3">
                                                <div className="text-xs text-slate-500 uppercase tracking-wider">Support 3</div>
                                                <div className="text-lg font-bold text-teal-400">
                                                    {support3 ? support3.strike : '-'}
                                                    {support3 && (
                                                        <span className="text-xs font-normal text-slate-400 ml-1">({formatLakhs(support3.volume)})</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* ATM ±5 Strikes Chart */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                                {/* Open Interest Chart */}
                                <div className="bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-slate-700/50 shadow-2xl p-6">
                                    <h2 className="text-xl font-bold text-white mb-4">
                                        Open Interest - ATM ±5 Strikes
                                    </h2>
                                    <ResponsiveContainer width="100%" height={400}>
                                        <BarChart
                                            data={atmData}
                                            margin={{ top: 20, right: 30, left: 40, bottom: 30 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                            <XAxis
                                                dataKey="strikePrice"
                                                tick={{ fontSize: 11, fill: '#94a3b8' }}
                                                axisLine={{ stroke: '#475569' }}
                                            />
                                            <YAxis
                                                tick={{ fontSize: 11, fill: '#94a3b8' }}
                                                axisLine={{ stroke: '#475569' }}
                                                tickFormatter={(value) => `${(value / 100000).toFixed(0)}L`}
                                            />
                                            <Tooltip
                                                contentStyle={{
                                                    backgroundColor: '#1e293b',
                                                    border: '1px solid #475569',
                                                    borderRadius: '8px',
                                                    color: '#f1f5f9'
                                                }}
                                                formatter={(value: number, name: string) => [formatLakhs(value), name]}
                                            />
                                            <Legend />
                                            <ReferenceLine
                                                x={atmStrike}
                                                stroke="#fbbf24"
                                                strokeWidth={2}
                                                strokeDasharray="5 5"
                                                label={{
                                                    value: `ATM: ${atmStrike}`,
                                                    position: 'top',
                                                    fill: '#fbbf24',
                                                    fontSize: 11
                                                }}
                                            />
                                            <Bar dataKey="putOI" fill="#14b8a6" name="Put OI" />
                                            <Bar dataKey="callOI" fill="#ef4444" name="Call OI" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>

                                {/* OI Change Chart */}
                                <div className="bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-slate-700/50 shadow-2xl p-6">
                                    <h2 className="text-xl font-bold text-white mb-4">
                                        OI Change - ATM ±5 Strikes
                                    </h2>
                                    <ResponsiveContainer width="100%" height={400}>
                                        <BarChart
                                            data={atmData}
                                            margin={{ top: 20, right: 30, left: 40, bottom: 30 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                            <XAxis
                                                dataKey="strikePrice"
                                                tick={{ fontSize: 11, fill: '#94a3b8' }}
                                                axisLine={{ stroke: '#475569' }}
                                            />
                                            <YAxis
                                                tick={{ fontSize: 11, fill: '#94a3b8' }}
                                                axisLine={{ stroke: '#475569' }}
                                                tickFormatter={(value) => `${value >= 0 ? '+' : ''}${(value / 100000).toFixed(0)}L`}
                                            />
                                            <Tooltip
                                                contentStyle={{
                                                    backgroundColor: '#1e293b',
                                                    border: '1px solid #475569',
                                                    borderRadius: '8px',
                                                    color: '#f1f5f9'
                                                }}
                                                formatter={(value: number, name: string) => [
                                                    `${value >= 0 ? '+' : ''}${formatLakhs(value)}`,
                                                    name
                                                ]}
                                            />
                                            <Legend />
                                            <ReferenceLine y={0} stroke="#64748b" strokeWidth={1} />
                                            <ReferenceLine
                                                x={atmStrike}
                                                stroke="#fbbf24"
                                                strokeWidth={2}
                                                strokeDasharray="5 5"
                                            />
                                            <Bar dataKey="putOIChange" fill="#14b8a6" name="Put OI Change" />
                                            <Bar dataKey="callOIChange" fill="#ef4444" name="Call OI Change" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Sellers Addition and Unwinding Tables */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Sellers Addition (≥15%) */}
                                <div className="bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-emerald-700/30 shadow-2xl p-6">
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></div>
                                        <h2 className="text-xl font-bold text-emerald-400">
                                            Sellers Addition (≥15%)
                                        </h2>
                                    </div>
                                    {sellersAddition.length > 0 ? (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="border-b border-slate-700">
                                                        <th className="text-left py-2 px-3 text-slate-400 font-medium">Strike</th>
                                                        <th className="text-left py-2 px-3 text-slate-400 font-medium">Type</th>
                                                        <th className="text-left py-2 px-3 text-slate-400 font-medium">Sentiment</th>
                                                        <th className="text-right py-2 px-3 text-slate-400 font-medium">Change %</th>
                                                        <th className="text-right py-2 px-3 text-slate-400 font-medium">OI Change</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {sellersAddition.map((item, idx) => (
                                                        <tr key={idx} className="border-b border-slate-800 hover:bg-slate-800/50">
                                                            <td className="py-2 px-3 text-white font-semibold">{item.strikePrice}</td>
                                                            <td className="py-2 px-3">
                                                                <span className={`px-2 py-1 rounded text-xs font-bold ${item.type === 'PUT' ? 'bg-teal-900/50 text-teal-400' : 'bg-red-900/50 text-red-400'
                                                                    }`}>
                                                                    {item.type}
                                                                </span>
                                                            </td>
                                                            <td className="py-2 px-3">
                                                                <span className={`px-2 py-1 rounded text-xs font-semibold ${item.sentiment.includes('Bullish')
                                                                    ? 'bg-emerald-900/50 text-emerald-400'
                                                                    : 'bg-red-900/50 text-red-400'
                                                                    }`}>
                                                                    {item.sentiment}
                                                                </span>
                                                            </td>
                                                            <td className="py-2 px-3 text-right text-emerald-400 font-semibold">
                                                                +{item.changePercent.toFixed(1)}%
                                                            </td>
                                                            <td className="py-2 px-3 text-right text-slate-300">
                                                                +{formatLakhs(item.oiChange)}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <div className="text-center py-8 text-slate-500">
                                            No significant sellers addition detected
                                        </div>
                                    )}
                                </div>

                                {/* Sellers Unwinding (≥10%) */}
                                <div className="bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-red-700/30 shadow-2xl p-6">
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>
                                        <h2 className="text-xl font-bold text-red-400">
                                            Sellers Unwinding (≥10%)
                                        </h2>
                                    </div>
                                    {sellersUnwinding.length > 0 ? (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="border-b border-slate-700">
                                                        <th className="text-left py-2 px-3 text-slate-400 font-medium">Strike</th>
                                                        <th className="text-left py-2 px-3 text-slate-400 font-medium">Type</th>
                                                        <th className="text-left py-2 px-3 text-slate-400 font-medium">Sentiment</th>
                                                        <th className="text-right py-2 px-3 text-slate-400 font-medium">Change %</th>
                                                        <th className="text-right py-2 px-3 text-slate-400 font-medium">OI Change</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {sellersUnwinding.map((item, idx) => (
                                                        <tr key={idx} className="border-b border-slate-800 hover:bg-slate-800/50">
                                                            <td className="py-2 px-3 text-white font-semibold">{item.strikePrice}</td>
                                                            <td className="py-2 px-3">
                                                                <span className={`px-2 py-1 rounded text-xs font-bold ${item.type === 'PUT' ? 'bg-teal-900/50 text-teal-400' : 'bg-red-900/50 text-red-400'
                                                                    }`}>
                                                                    {item.type}
                                                                </span>
                                                            </td>
                                                            <td className="py-2 px-3">
                                                                <span className={`px-2 py-1 rounded text-xs font-semibold ${item.sentiment.includes('Bullish')
                                                                    ? 'bg-emerald-900/50 text-emerald-400'
                                                                    : 'bg-red-900/50 text-red-400'
                                                                    }`}>
                                                                    {item.sentiment}
                                                                </span>
                                                            </td>
                                                            <td className="py-2 px-3 text-right text-red-400 font-semibold">
                                                                {item.changePercent.toFixed(1)}%
                                                            </td>
                                                            <td className="py-2 px-3 text-right text-slate-300">
                                                                {formatLakhs(item.oiChange)}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <div className="text-center py-8 text-slate-500">
                                            No significant sellers unwinding detected
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
            <Footer />
        </div>
    )
}
