'use client'

import { useState, useEffect, useRef } from 'react'
import { fetchYahooStockData } from '@/services/yahooFinance'
import { SECTOR_STOCKS } from '@/constants/sector-stocks-mapping'

interface Stock {
    symbol: string
    name: string
    ltp: number
    dayChange: number
    dayChangePerc: number
    open?: number
    prevDayHigh?: number
    prevDayLow?: number
}

interface PrevDayData {
    high: number
    low: number
    open: number
    close: number
}

interface TopGainersListProps {
    onStockClick?: (symbol: string) => void
}

export default function TopGainersList({ onStockClick }: TopGainersListProps) {
    const [gainers, setGainers] = useState<Stock[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [prevDayData, setPrevDayData] = useState<Record<string, PrevDayData>>({})
    const fetchedSymbolsRef = useRef<Set<string>>(new Set())

    const getAllMappedStocks = (): Set<string> => {
        const allStocks = new Set<string>()
        Object.values(SECTOR_STOCKS).forEach(stocks => {
            stocks.forEach(stock => allStocks.add(stock))
        })
        return allStocks
    }

    useEffect(() => {
        const mappedStocksSet = getAllMappedStocks()

        const fetchTopGainers = async (isBackground = false) => {
            if (!isBackground) setIsLoading(true)

            try {
                const gainersRes = await fetch('/api/groww/top-movers?moverType=TOP_GAINERS')
                const gainersData = await gainersRes.json()

                const filteredGainers = gainersData.success && gainersData.stocks
                    ? gainersData.stocks.filter((stock: Stock) => mappedStocksSet.has(stock.symbol))
                    : []

                setGainers(filteredGainers)

                const symbolsToFetch = filteredGainers
                    .map((s: Stock) => s.symbol)
                    .filter((symbol: string) => !fetchedSymbolsRef.current.has(symbol))

                if (symbolsToFetch.length > 0) {
                    symbolsToFetch.forEach((s: string) => fetchedSymbolsRef.current.add(s))
                    const yahooPromises = symbolsToFetch.map((symbol: string) => fetchYahooStockData(symbol))
                    const yahooResults = await Promise.all(yahooPromises)

                    setPrevDayData(prev => {
                        const newData = { ...prev }
                        yahooResults.forEach(result => {
                            if (result) {
                                const baseSymbol = result.symbol.replace('.NS', '').replace('.BO', '')
                                newData[baseSymbol] = {
                                    high: result.high,
                                    low: result.low,
                                    open: result.open,
                                    close: result.close,
                                }
                            }
                        })
                        return newData
                    })
                }
            } catch (error) {
                console.error('Failed to fetch top gainers:', error)
            } finally {
                if (!isBackground) setIsLoading(false)
            }
        }

        fetchTopGainers()
        const interval = setInterval(() => fetchTopGainers(true), 60000)
        return () => clearInterval(interval)
    }, [])

    const handleStockClick = (symbol: string) => {
        if (onStockClick) {
            onStockClick(symbol)
        } else {
            window.open(`https://in.tradingview.com/chart/?symbol=NSE:${symbol}`, '_blank')
        }
    }

    const renderStockRow = (stock: Stock, index: number) => {
        const prevDay = prevDayData[stock.symbol]
        const isAbovePrevClose = prevDay && stock.ltp > prevDay.close
        const isAbovePrevHigh = prevDay && stock.ltp > prevDay.high
        const isBelowPrevLow = prevDay && stock.ltp < prevDay.low
        const prevDayCloseVsOpen = prevDay && prevDay.close !== undefined && prevDay.open !== undefined
            ? (prevDay.close > prevDay.open ? 'green' : prevDay.close < prevDay.open ? 'red' : null)
            : null

        return (
            <div
                key={stock.symbol}
                onClick={() => handleStockClick(stock.symbol)}
                className="relative flex items-center gap-2 sm:gap-4 p-2 rounded-lg transition-colors group cursor-pointer hover:bg-green-50"
            >
                {/* Hover Tooltip */}
                {prevDay && (
                    <div className="absolute left-0 top-full mt-2 z-[100] bg-gray-900 text-white text-xs rounded-lg shadow-xl p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap min-w-[150px]">
                        <div className="font-bold mb-2 text-sm border-b border-gray-700 pb-1">Previous Day</div>
                        <div className="space-y-1">
                            <div className="flex justify-between gap-4">
                                <span className="text-gray-400">High:</span>
                                <span className="font-semibold text-green-400">₹{prevDay.high.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between gap-4">
                                <span className="text-gray-400">Low:</span>
                                <span className="font-semibold text-red-400">₹{prevDay.low.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between gap-4">
                                <span className="text-gray-400">Close:</span>
                                <span className="font-semibold">₹{prevDay.close.toFixed(2)}</span>
                            </div>
                            {isAbovePrevHigh && (
                                <div className="mt-2 pt-2 border-t border-gray-700 text-green-400 font-bold flex items-center gap-1">
                                    <span>🚀</span> Breakout!
                                </div>
                            )}
                            {isBelowPrevLow && (
                                <div className="mt-2 pt-2 border-t border-gray-700 text-red-400 font-bold flex items-center gap-1">
                                    <span>🔻</span> Breakdown!
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div className="flex items-center justify-between gap-2 sm:gap-3 flex-1 min-w-0">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <span className="text-xs font-bold text-gray-400 w-5 sm:w-6 flex-shrink-0">{index + 1}</span>
                        {prevDayCloseVsOpen === 'green' && (
                            <div className="w-2 h-2 rounded-full flex-shrink-0 bg-green-500"
                                title={`Yesterday close (₹${prevDay.close.toFixed(2)}) > open (₹${prevDay.open.toFixed(2)})`}></div>
                        )}
                        {prevDayCloseVsOpen === 'red' && (
                            <div className="w-2 h-2 rounded-full flex-shrink-0 bg-red-500"
                                title={`Yesterday close (₹${prevDay.close.toFixed(2)}) < open (₹${prevDay.open.toFixed(2)})`}></div>
                        )}
                        <div className="font-semibold text-xs sm:text-sm text-gray-900 flex items-center gap-1">
                            {stock.symbol}
                            {isAbovePrevHigh && <span className="text-green-600 text-xs" title="Above Previous Day High">🚀</span>}
                            {isBelowPrevLow && <span className="text-red-600 text-xs" title="Below Previous Day Low">🔻</span>}
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                        <div className="font-semibold text-xs sm:text-sm text-gray-900">₹{stock.ltp.toFixed(2)}</div>
                        <div className="text-[10px] sm:text-xs font-bold text-green-600">
                            +{stock.dayChangePerc.toFixed(2)}%
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-8">
                <div className="w-8 h-8 border-4 border-green-200 border-t-green-600 rounded-full animate-spin"></div>
            </div>
        )
    }

    return (
        <div className="space-y-1.5 sm:space-y-2">
            {gainers.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">No gainers data available</div>
            ) : (
                gainers.map((stock, index) => renderStockRow(stock, index))
            )}
        </div>
    )
}

