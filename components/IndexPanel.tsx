'use client'

import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, PieChart, Pie, Cell, LineChart, Line } from 'recharts'
import { useIndexData } from '@/hooks/useIndexData'

interface IndexPanelProps {
    symbol: string
}

// Collapsible widget wrapper
function Widget({ title, dotColor, children, defaultOpen = true, rightContent }: {
    title: string
    dotColor: string
    children: React.ReactNode
    defaultOpen?: boolean
    rightContent?: React.ReactNode
}) {
    const [open, setOpen] = useState(defaultOpen)
    return (
        <div className="bg-[#161b22] rounded-lg border border-gray-700/50">
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-[#1c2128] transition-colors rounded-t-lg"
            >
                <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${dotColor} inline-block`}></span>
                    {title}
                </h3>
                <div className="flex items-center gap-2">
                    {rightContent && <div onClick={(e) => e.stopPropagation()}>{rightContent}</div>}
                    <svg
                        className={`w-3.5 h-3.5 text-gray-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </button>
            <div className={`overflow-hidden transition-all duration-300 ease-in-out ${open ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="px-3 pb-3">
                    {children}
                </div>
            </div>
        </div>
    )
}

export default function IndexPanel({ symbol }: IndexPanelProps) {
    const {
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
    } = useIndexData(symbol)

    // Custom label for donut
    const renderDonutLabel = ({ name, percent }: any) => {
        return `${(percent * 100).toFixed(0)}%`
    }

    // Custom tick for vertical X-axis labels
    const CustomXAxisTick = (props: any) => {
        const { x, y, payload } = props
        const isATM = payload.value === atmStrike
        return (
            <g transform={`translate(${x},${y})`}>
                <text
                    x={0} y={0} dy={3} dx={-10}
                    textAnchor="end"
                    fill={isATM ? "#f59e0b" : "#e6edf3"}
                    transform="rotate(-90)"
                    fontSize={isATM ? 11 : 10}
                    fontWeight="bold"
                >
                    {payload.value}
                </text>
            </g>
        )
    }

    const accentClass =
        symbol === 'NIFTY'
            ? 'bg-blue-500'
            : symbol === 'BANKNIFTY'
                ? 'bg-purple-500'
                : symbol === 'SENSEX'
                    ? 'bg-amber-500'
                    : 'bg-cyan-500'
    const borderAccent =
        symbol === 'NIFTY'
            ? 'border-blue-500/30'
            : symbol === 'BANKNIFTY'
                ? 'border-purple-500/30'
                : symbol === 'SENSEX'
                    ? 'border-amber-500/30'
                    : 'border-cyan-500/30'

    const trendColor = trend === 'BULLISH' ? 'text-emerald-400' : trend === 'BEARISH' ? 'text-red-400' : 'text-yellow-400'
    const trendBg = trend === 'BULLISH' ? 'bg-emerald-500/10 border-emerald-500/30' : trend === 'BEARISH' ? 'bg-red-500/10 border-red-500/30' : 'bg-yellow-500/10 border-yellow-500/30'
    const trendEmoji = trend === 'BULLISH' ? '🟢' : trend === 'BEARISH' ? '🔴' : '🟡'
    const trendLabel =
        trend === 'BULLISH'
            ? 'HIGHLY BULLISH'
            : trend === 'BEARISH'
                ? 'HIGHLY BEARISH'
                : trendReason.includes('Sellers Day')
                    ? 'NEUTRAL SELLERS DAY'
                    : 'NEUTRAL'

    return (
        <div className={`bg-[#0d1117] rounded-2xl border ${borderAccent} overflow-hidden`}>
            {/* Panel Header */}
            <div className="bg-[#161b22] border-b border-gray-700/50 px-4 py-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className={`w-3 h-3 rounded-full ${accentClass} inline-block animate-pulse`}></span>
                        <h2 className="text-base font-bold text-white tracking-wider">{symbol}</h2>
                    </div>
                    <div className="flex items-center gap-2">
                        {dataCaptureTime && (
                            <span className="text-[10px] text-gray-500">
                                {dataCaptureTime.toLocaleTimeString('en-IN', {
                                    timeZone: 'Asia/Kolkata',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    hour12: true
                                })}
                            </span>
                        )}
                        {availableExpiries.length > 0 && (
                            <select
                                value={expiryDate}
                                onChange={(e) => setExpiryDate(e.target.value)}
                                className="bg-[#21262d] text-gray-300 text-[10px] px-2 py-1 rounded border border-gray-600 focus:outline-none focus:border-blue-500"
                            >
                                {availableExpiries.map(exp => (
                                    <option key={exp} value={exp}>{exp}</option>
                                ))}
                            </select>
                        )}
                    </div>
                </div>
            </div>

            {/* Spot / PCR / Levels Bar */}
            <div className="bg-[#161b22]/60 border-b border-gray-800/50 px-4 py-2">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
                    <span className="text-gray-400">
                        Spot: <span className="text-white font-bold">{niftySpot.toFixed(2)}</span>
                    </span>
                    <span className="text-gray-400">
                        PCR: <span className={`font-bold ${pcr >= 1 ? 'text-emerald-400' : 'text-red-400'}`}>{pcr.toFixed(4)}</span>
                    </span>
                    <span className={`font-bold ${pcr >= 1 ? 'text-emerald-400' : pcr >= 0.7 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {pcr >= 1 ? '🟢 Bull' : pcr >= 0.7 ? '🟡 Neutral' : '🔴 Bear'}
                    </span>
                    <span className="text-gray-400">
                        MP: <span className="text-white font-bold">{maxPain}</span>
                    </span>
                    <span className="text-gray-400">
                        R1: <span className="text-red-400 font-bold">{resistance1}</span>
                    </span>
                    <span className="text-gray-400">
                        S1: <span className="text-emerald-400 font-bold">{support1}</span>
                    </span>
                </div>
            </div>

            {/* Trend Indicator + Market Levels Bar */}
            <div className={`border-b border-gray-800/50 px-4 py-2 ${trendBg}`}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]">
                    {/* Trend Badge */}
                    <span className={`font-extrabold ${trendColor} text-xs`}>
                        {trendEmoji} {trendLabel}
                    </span>
                    <span className="text-gray-400 italic text-[9px]">{trendReason}</span>
                    <span className="text-gray-600">|</span>
                    {/* Market Levels */}
                    <span className="text-gray-400">
                        YH: <span className="text-orange-300 font-bold">{marketLevels.ydayHigh > 0 ? marketLevels.ydayHigh.toFixed(2) : '—'}</span>
                    </span>
                    <span className="text-gray-400">
                        YL: <span className="text-orange-300 font-bold">{marketLevels.ydayLow > 0 ? marketLevels.ydayLow.toFixed(2) : '—'}</span>
                    </span>
                    <span className="text-gray-400">
                        OR↑: <span className="text-sky-300 font-bold">{marketLevels.openingRangeHigh > 0 ? marketLevels.openingRangeHigh.toFixed(2) : '—'}</span>
                    </span>
                    <span className="text-gray-400">
                        OR↓: <span className="text-sky-300 font-bold">{marketLevels.openingRangeLow > 0 ? marketLevels.openingRangeLow.toFixed(2) : '—'}</span>
                    </span>
                </div>
            </div>

            {/* Main Content */}
            <div className="p-3">
                {loading && data.length === 0 ? (
                    <div className="flex items-center justify-center h-48">
                        <div className="text-center">
                            <div className="inline-block w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mb-3"></div>
                            <p className="text-gray-400 text-xs">Loading {symbol}...</p>
                        </div>
                    </div>
                ) : data.length === 0 ? (
                    <div className="flex items-center justify-center h-48">
                        <p className="text-gray-500 text-xs">No data available</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {/* OI Analysis — Open Interest */}
                        <Widget title="Open Interest" dotColor="bg-blue-400" rightContent={
                            <div className="flex items-center gap-3 text-[9px]">
                                <span className="flex items-center gap-1">
                                    <span className="w-2 h-1 rounded bg-red-500 inline-block"></span>
                                    <span className="text-gray-400">Call</span>
                                </span>
                                <span className="flex items-center gap-1">
                                    <span className="w-2 h-1 rounded bg-emerald-500 inline-block"></span>
                                    <span className="text-gray-400">Put</span>
                                </span>
                            </div>
                        }>
                            <ResponsiveContainer width="100%" height={200}>
                                <BarChart data={compassData} margin={{ top: 10, right: 5, left: 0, bottom: 0 }} barGap={2}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#21262d" vertical={false} />
                                    <XAxis dataKey="strikePrice" tick={false} axisLine={{ stroke: '#30363d' }} height={5} />
                                    <YAxis
                                        tick={{ fontSize: 9, fill: '#6b7280' }}
                                        tickFormatter={(value) => `${(Math.abs(value) / 100000).toFixed(0)}L`}
                                        axisLine={{ stroke: '#30363d' }}
                                        width={35}
                                    />
                                    <Tooltip
                                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                        content={({ active, payload, label }: any) => {
                                            if (!active || !payload || payload.length === 0) return null
                                            const isATM = Number(label) === atmStrike
                                            return (
                                                <div className="bg-[#1c2128] border border-[#30363d] rounded-lg p-2 shadow-xl z-50 text-[10px]">
                                                    <p className={`font-bold mb-1 ${isATM ? 'text-amber-400' : 'text-gray-200'}`}>
                                                        {label}{isATM ? ' (ATM)' : ''}
                                                    </p>
                                                    {payload.map((entry: any, i: number) => (
                                                        <p key={i} className="flex items-center gap-1 mb-0.5">
                                                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: entry.color }}></span>
                                                            <span className="text-gray-400">{entry.name}:</span>
                                                            <span className="font-mono" style={{ color: entry.color }}>
                                                                {(Math.abs(entry.value) / 100000).toFixed(2)}L
                                                            </span>
                                                        </p>
                                                    ))}
                                                </div>
                                            )
                                        }}
                                    />
                                    <ReferenceLine x={atmStrike} stroke="#f59e0b" strokeDasharray="3 3" />
                                    <Bar dataKey="callOI" name="Call OI" fill="#ef4444" radius={[2, 2, 0, 0]} barSize={6} />
                                    <Bar dataKey="putOI" name="Put OI" fill="#10b981" radius={[2, 2, 0, 0]} barSize={6} />
                                </BarChart>
                            </ResponsiveContainer>
                        </Widget>

                        {/* Change in OI */}
                        <Widget title="Change in OI" dotColor="bg-orange-400">
                            <ResponsiveContainer width="100%" height={200}>
                                <BarChart data={compassData} margin={{ top: 10, right: 5, left: 0, bottom: 0 }} barGap={2}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#21262d" vertical={false} />
                                    <XAxis
                                        dataKey="strikePrice"
                                        tick={<CustomXAxisTick />}
                                        interval={0}
                                        axisLine={{ stroke: '#30363d' }}
                                        height={50}
                                    />
                                    <YAxis
                                        tick={{ fontSize: 9, fill: '#6b7280' }}
                                        tickFormatter={(value) => `${(Math.abs(value) / 100000).toFixed(0)}L`}
                                        axisLine={{ stroke: '#30363d' }}
                                        width={35}
                                    />
                                    <Tooltip
                                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                        content={({ active, payload, label }: any) => {
                                            if (!active || !payload || payload.length === 0) return null
                                            const isATM = Number(label) === atmStrike
                                            return (
                                                <div className="bg-[#1c2128] border border-[#30363d] rounded-lg p-2 shadow-xl z-50 text-[10px]">
                                                    <p className={`font-bold mb-1 ${isATM ? 'text-amber-400' : 'text-gray-200'}`}>
                                                        {label}{isATM ? ' (ATM)' : ''}
                                                    </p>
                                                    {payload.map((entry: any, i: number) => (
                                                        <p key={i} className="flex items-center gap-1 mb-0.5">
                                                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: entry.color }}></span>
                                                            <span className="text-gray-400">{entry.name}:</span>
                                                            <span className="font-mono" style={{ color: entry.color }}>
                                                                {(Math.abs(entry.value) / 100000).toFixed(2)}L
                                                            </span>
                                                        </p>
                                                    ))}
                                                </div>
                                            )
                                        }}
                                    />
                                    <ReferenceLine x={atmStrike} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'ATM', position: 'top', fill: '#f59e0b', fontSize: 9 }} />
                                    <ReferenceLine y={0} stroke="#484f58" />
                                    <Bar dataKey="callOIChange" name="Call OI Chg" fill="#ef4444" radius={[2, 2, 0, 0]} barSize={6}>
                                        {compassData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.callOIChange >= 0 ? '#ef4444' : '#ef444480'} />
                                        ))}
                                    </Bar>
                                    <Bar dataKey="putOIChange" name="Put OI Chg" fill="#10b981" radius={[2, 2, 0, 0]} barSize={6}>
                                        {compassData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.putOIChange >= 0 ? '#10b981' : '#10b98180'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </Widget>

                        {/* PVC Analysis + ATM Widget Row */}
                        <div className="grid grid-cols-2 gap-3">
                            {/* PVC Analysis */}
                            <Widget title="PVC Analysis" dotColor="bg-purple-400">
                                <div className="grid grid-cols-2 gap-2">
                                    {/* Change in PVC */}
                                    <div>
                                        <h4 className="text-[9px] font-semibold text-gray-400 mb-1">Chg PVC</h4>
                                        {(pvcDonutData[0].value > 0 || pvcDonutData[1].value > 0) ? (
                                            <>
                                                <ResponsiveContainer width="100%" height={100}>
                                                    <PieChart margin={{ top: 0, bottom: 0 }}>
                                                        <Pie
                                                            data={pvcDonutData}
                                                            cx="50%"
                                                            cy="50%"
                                                            innerRadius={25}
                                                            outerRadius={40}
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
                                                                        padding: '6px',
                                                                        fontSize: '10px',
                                                                        color: '#e6edf3',
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
                                                <div className="mt-1 space-y-0.5">
                                                    <div className="flex items-center justify-between text-[9px]">
                                                        <span className="text-gray-400">Put</span>
                                                        <span className="text-emerald-400 font-semibold">{formatLakhs(oiChangeTotals.putOIChange)}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between text-[9px]">
                                                        <span className="text-gray-400">Call</span>
                                                        <span className="text-red-400 font-semibold">{formatLakhs(oiChangeTotals.callOIChange)}</span>
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="text-center text-gray-500 text-[9px] py-6">No data</div>
                                        )}
                                    </div>

                                    {/* Net PVC Ratio */}
                                    <div className="border-l border-gray-700/50 pl-2">
                                        <h4 className="text-[9px] font-semibold text-gray-400 mb-1">Net PVC</h4>
                                        {(oiTotals.putOI > 0 || oiTotals.callOI > 0) ? (
                                            <>
                                                <ResponsiveContainer width="100%" height={100}>
                                                    <BarChart
                                                        data={[
                                                            { name: 'Put', value: oiTotals.putOI, fill: '#10b981' },
                                                            { name: 'Call', value: oiTotals.callOI, fill: '#ef4444' },
                                                        ]}
                                                        margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
                                                    >
                                                        <CartesianGrid strokeDasharray="3 3" stroke="#21262d" vertical={false} />
                                                        <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={{ stroke: '#30363d' }} interval={0} />
                                                        <YAxis tick={{ fontSize: 8, fill: '#6b7280' }} tickFormatter={(v) => `${(v / 100000).toFixed(0)}L`} axisLine={{ stroke: '#30363d' }} width={30} />
                                                        <Tooltip
                                                            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                                            wrapperStyle={{ zIndex: 1000 }}
                                                            content={({ active, payload, label }: any) => {
                                                                if (!active || !payload || payload.length === 0) return null
                                                                return (
                                                                    <div style={{ backgroundColor: '#1c2128', border: '1px solid #30363d', borderRadius: '8px', padding: '6px', fontSize: '10px', color: '#e6edf3' }}>
                                                                        <span style={{ color: payload[0]?.payload?.fill, fontWeight: 'bold' }}>{label}:</span>{' '}
                                                                        {formatLakhs(payload[0]?.value)}
                                                                    </div>
                                                                )
                                                            }}
                                                        />
                                                        <Bar dataKey="value" radius={[3, 3, 0, 0]} barSize={30}>
                                                            {[{ fill: '#10b981' }, { fill: '#ef4444' }].map((entry, index) => (
                                                                <Cell key={`cell-${index}`} fill={entry.fill} />
                                                            ))}
                                                        </Bar>
                                                    </BarChart>
                                                </ResponsiveContainer>
                                                <div className="mt-1 text-[9px] space-y-0.5">
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-500">PCR</span>
                                                        <span className={`font-bold ${pcr >= 1 ? 'text-emerald-400' : 'text-red-400'}`}>{pcr.toFixed(2)}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-500">Diff</span>
                                                        <span className={`font-bold ${oiTotals.putOI - oiTotals.callOI > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                            {formatLakhs(oiTotals.putOI - oiTotals.callOI)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="text-center text-gray-500 text-[9px] py-6">No data</div>
                                        )}
                                    </div>
                                </div>
                            </Widget>

                            {/* ATM ±2 Widget */}
                            <Widget title={`ATM - ${atmStrike || '...'}`} dotColor="bg-sky-400" rightContent={
                                <div className="flex bg-[#21262d] rounded-md p-0.5">
                                    <button
                                        onClick={() => setAtmViewMode('oiChange')}
                                        className={`px-2 py-0.5 text-[8px] font-medium rounded transition-all ${atmViewMode === 'oiChange'
                                            ? 'bg-blue-500/20 text-blue-400'
                                            : 'text-gray-400 hover:text-gray-200'
                                            }`}
                                    >
                                        OI
                                    </button>
                                    <button
                                        onClick={() => setAtmViewMode('volume')}
                                        className={`px-2 py-0.5 text-[8px] font-medium rounded transition-all ${atmViewMode === 'volume'
                                            ? 'bg-blue-500/20 text-blue-400'
                                            : 'text-gray-400 hover:text-gray-200'
                                            }`}
                                    >
                                        Vol
                                    </button>
                                </div>
                            }>
                                {(() => {
                                    if (data.length === 0 || niftySpot === 0) {
                                        return <div className="text-center text-gray-500 text-[9px] py-6">No data</div>
                                    }

                                    const sorted = [...data].sort((a, b) =>
                                        Math.abs(a.strikePrice - niftySpot) - Math.abs(b.strikePrice - niftySpot)
                                    )
                                    const localAtmStrike = sorted[0]?.strikePrice || 0
                                    const allStrikes = Array.from(new Set(data.map(d => d.strikePrice))).sort((a, b) => a - b)
                                    const atmIdx = allStrikes.indexOf(localAtmStrike)
                                    if (atmIdx === -1) return <div className="text-center text-gray-500 text-[9px] py-6">No ATM</div>

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
                                            isATM: strike === localAtmStrike,
                                        }
                                    })

                                    const totalPutVal = chartData.reduce((s, d) => s + d.putVal, 0)
                                    const totalCallVal = chartData.reduce((s, d) => s + d.callVal, 0)
                                    const label = atmViewMode === 'oiChange' ? 'OI Chg' : 'Vol'

                                    return (
                                        <>
                                            <ResponsiveContainer width="100%" height={120}>
                                                <BarChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#21262d" vertical={false} />
                                                    <XAxis
                                                        dataKey="strike"
                                                        tick={(props: any) => {
                                                            const { x, y, payload } = props
                                                            const item = chartData.find(d => d.strike === payload.value)
                                                            const isATM = item?.isATM
                                                            return (
                                                                <text x={x} y={y + 10} textAnchor="middle" fontSize={7}
                                                                    fill={isATM ? '#22d3ee' : '#6b7280'}
                                                                    fontWeight={isATM ? 'bold' : 'normal'}>
                                                                    {payload.value}{isATM ? '★' : ''}
                                                                </text>
                                                            )
                                                        }}
                                                        axisLine={{ stroke: '#30363d' }}
                                                    />
                                                    <YAxis tick={{ fontSize: 7, fill: '#6b7280' }} tickFormatter={(v) => `${(v / 100000).toFixed(0)}L`} axisLine={{ stroke: '#30363d' }} width={30} />
                                                    <Tooltip
                                                        wrapperStyle={{ zIndex: 1000 }}
                                                        content={({ active, payload, label: ttLabel }: any) => {
                                                            if (!active || !payload || payload.length === 0) return null
                                                            return (
                                                                <div style={{ backgroundColor: '#1c2128', border: '1px solid #30363d', borderRadius: '6px', padding: '6px', fontSize: '10px', color: '#e6edf3' }}>
                                                                    <p style={{ margin: 0, fontWeight: 'bold', marginBottom: '4px' }}>Strike {ttLabel}</p>
                                                                    {payload.map((item: any, i: number) => (
                                                                        <p key={i} style={{ margin: '2px 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: item.color, display: 'inline-block' }}></span>
                                                                            <span style={{ color: '#9ca3af' }}>{item.dataKey === 'putVal' ? `Put` : `Call`}:</span>
                                                                            <span style={{ fontWeight: 'bold', color: item.color }}>{(item.value / 100000).toFixed(2)}L</span>
                                                                        </p>
                                                                    ))}
                                                                </div>
                                                            )
                                                        }}
                                                    />
                                                    <ReferenceLine y={0} stroke="#30363d" />
                                                    <Bar dataKey="putVal" fill="#10b981" barSize={8} radius={[2, 2, 0, 0]} name={`Put ${label}`} />
                                                    <Bar dataKey="callVal" fill="#ef4444" barSize={8} radius={[2, 2, 0, 0]} name={`Call ${label}`} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                            <div className="mt-1 space-y-0.5 text-[9px]">
                                                <div className="flex justify-between">
                                                    <span className="flex items-center gap-1">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                                                        <span className="text-gray-400">Put</span>
                                                    </span>
                                                    <span className="text-emerald-400 font-bold">{(totalPutVal / 100000).toFixed(2)}L</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="flex items-center gap-1">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block"></span>
                                                        <span className="text-gray-400">Call</span>
                                                    </span>
                                                    <span className="text-red-400 font-bold">{(totalCallVal / 100000).toFixed(2)}L</span>
                                                </div>
                                                <div className="flex justify-between pt-0.5 border-t border-gray-700/50">
                                                    <span className="text-gray-500">P/C</span>
                                                    <span className={`font-bold ${totalCallVal > 0 && (totalPutVal / totalCallVal) >= 1 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                        {totalCallVal !== 0 ? (totalPutVal / totalCallVal).toFixed(2) : '—'}
                                                    </span>
                                                </div>
                                            </div>
                                        </>
                                    )
                                })()}
                            </Widget>
                        </div>

                        {/* OI Addition / Volume Trend */}
                        <Widget title={oiTrendMode === 'oi' ? 'OI Addition' : 'Volume Trend'} dotColor="bg-cyan-400" rightContent={
                            <div className="flex items-center gap-2">
                                <div className="flex bg-[#21262d] rounded-md p-0.5">
                                    <button
                                        onClick={() => setOiTrendMode('oi')}
                                        className={`px-2 py-0.5 text-[8px] font-medium rounded transition-all ${oiTrendMode === 'oi'
                                            ? 'bg-blue-500/20 text-blue-400'
                                            : 'text-gray-400 hover:text-gray-200'
                                            }`}
                                    >
                                        OI
                                    </button>
                                    <button
                                        onClick={() => setOiTrendMode('volume')}
                                        className={`px-2 py-0.5 text-[8px] font-medium rounded transition-all ${oiTrendMode === 'volume'
                                            ? 'bg-blue-500/20 text-blue-400'
                                            : 'text-gray-400 hover:text-gray-200'
                                            }`}
                                    >
                                        Vol
                                    </button>
                                </div>
                                <select
                                    value={oiTrendWindow}
                                    onChange={(e) => setOiTrendWindow(Number(e.target.value))}
                                    className="bg-[#0d1117] border border-gray-700 rounded text-[8px] text-gray-300 px-1.5 py-0.5 focus:outline-none cursor-pointer"
                                >
                                    <option value={15}>15m</option>
                                    <option value={30}>30m</option>
                                    <option value={60}>1h</option>
                                    <option value={120}>2h</option>
                                    <option value={240}>4h</option>
                                </select>
                            </div>
                        }>
                            {oiTrendData.length > 0 ? (() => {
                                const totalPutAdd = oiTrendData.reduce((sum, d) => sum + d.putOI, 0)
                                const totalCallAdd = oiTrendData.reduce((sum, d) => sum + d.callOI, 0)
                                const summaryBarData = [
                                    { name: 'Put', value: totalPutAdd, fill: '#10b981' },
                                    { name: 'Call', value: totalCallAdd, fill: '#ef4444' },
                                ]
                                return (
                                    <>
                                        <div className="flex gap-2">
                                            <div style={{ width: '78%' }} className="min-w-0">
                                                <ResponsiveContainer width="100%" height={140}>
                                                    <LineChart data={oiTrendData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                                                        <XAxis dataKey="label" tick={{ fontSize: 7, fill: '#6b7280' }} axisLine={{ stroke: '#30363d' }} />
                                                        <YAxis
                                                            tick={{ fontSize: 7, fill: '#6b7280' }}
                                                            tickFormatter={(v) => `${(v / 100000).toFixed(0)}L`}
                                                            axisLine={{ stroke: '#30363d' }}
                                                            width={30}
                                                            domain={[(dataMin: number) => Math.floor(dataMin * 0.95), (dataMax: number) => Math.ceil(dataMax * 1.05)]}
                                                        />
                                                        <Tooltip
                                                            wrapperStyle={{ zIndex: 1000 }}
                                                            content={({ active, payload, label }: any) => {
                                                                if (!active || !payload || payload.length === 0) return null
                                                                return (
                                                                    <div style={{ backgroundColor: '#1c2128', border: '1px solid #30363d', borderRadius: '6px', padding: '6px', fontSize: '10px', color: '#e6edf3' }}>
                                                                        <p style={{ margin: 0, fontWeight: 'bold', marginBottom: '4px' }}>🕐 {label}</p>
                                                                        {payload.map((item: any, i: number) => {
                                                                            const val = item.value
                                                                            const arrow = val > 0 ? '▲' : val < 0 ? '▼' : '—'
                                                                            return (
                                                                                <p key={i} style={{ margin: '2px 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: item.color, display: 'inline-block' }}></span>
                                                                                    <span style={{ color: '#9ca3af' }}>{item.dataKey === 'putOI' ? 'Put' : 'Call'}:</span>
                                                                                    <span style={{ fontWeight: 'bold', color: val > 0 ? '#10b981' : val < 0 ? '#ef4444' : '#6b7280' }}>{arrow} {formatLakhs(val)}</span>
                                                                                </p>
                                                                            )
                                                                        })}
                                                                    </div>
                                                                )
                                                            }}
                                                        />
                                                        <Line type="monotone" dataKey="putOI" stroke="#10b981" strokeWidth={1.5} dot={{ r: 2 }} name="Put OI" />
                                                        <Line type="monotone" dataKey="callOI" stroke="#ef4444" strokeWidth={1.5} dot={{ r: 2 }} name="Call OI" />
                                                    </LineChart>
                                                </ResponsiveContainer>
                                            </div>
                                            <div style={{ width: '22%' }} className="flex-shrink-0">
                                                <ResponsiveContainer width="100%" height={140}>
                                                    <BarChart data={summaryBarData} margin={{ top: 5, right: 5, left: 0, bottom: 25 }}>
                                                        <XAxis
                                                            dataKey="name"
                                                            axisLine={{ stroke: '#30363d' }}
                                                            tick={({ x, y, payload }) => {
                                                                const item = summaryBarData.find(d => d.name === payload.value)
                                                                const val = item?.value || 0
                                                                const color = item?.fill || '#9ca3af'
                                                                return (
                                                                    <g transform={`translate(${x},${y})`}>
                                                                        <text x={0} y={12} textAnchor="middle" fill={color} fontSize={9} fontWeight="bold">
                                                                            {val < 0 ? '-' : ''}{formatLakhs(val)}
                                                                        </text>
                                                                        <text x={0} y={24} textAnchor="middle" fill="#9ca3af" fontSize={8}>
                                                                            {payload.value}
                                                                        </text>
                                                                    </g>
                                                                )
                                                            }}
                                                        />
                                                        <YAxis hide />
                                                        <Bar dataKey="value" barSize={20} radius={[3, 3, 0, 0]}>
                                                            {summaryBarData.map((entry, index) => (
                                                                <Cell key={`cell-${index}`} fill={entry.fill} />
                                                            ))}
                                                        </Bar>
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>
                                        <div className="mt-1 flex items-center justify-between text-[9px] text-gray-500">
                                            <div className="flex items-center gap-2">
                                                <span className="flex items-center gap-1">
                                                    <span className="w-2 h-0.5 bg-emerald-500 inline-block rounded"></span>
                                                    Put
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <span className="w-2 h-0.5 bg-red-500 inline-block rounded"></span>
                                                    Call
                                                </span>
                                            </div>
                                            <span>{oiTrendData.length} pts</span>
                                        </div>
                                    </>
                                )
                            })() : (
                                <div className="text-center text-gray-500 text-[9px] py-6">No trend data</div>
                            )}
                        </Widget>
                    </div>
                )}
            </div>
        </div>
    )
}
