'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
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

export default function TopMovers() {
    const router = useRouter()
    const [gainers, setGainers] = useState<Stock[]>([])
    const [losers, setLosers] = useState<Stock[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [prevDayData, setPrevDayData] = useState<Record<string, PrevDayData>>({})

    // Use ref to track fetched symbols to avoid stale closure issues in setInterval
    const fetchedSymbolsRef = useRef<Set<string>>(new Set())

    // Get all unique stock symbols from mapped sectors
    const getAllMappedStocks = (): Set<string> => {
        const allStocks = new Set<string>()
        Object.values(SECTOR_STOCKS).forEach(stocks => {
            stocks.forEach(stock => allStocks.add(stock))
        })
        return allStocks
    }

    useEffect(() => {
        const mappedStocksSet = getAllMappedStocks()

        const fetchTopMovers = async (isBackground = false) => {
            if (!isBackground) setIsLoading(true)

            try {
                const [gainersRes, losersRes] = await Promise.all([
                    fetch('/api/groww/top-movers?moverType=TOP_GAINERS'),
                    fetch('/api/groww/top-movers?moverType=TOP_LOSERS'),
                ])

                const gainersData = await gainersRes.json()
                const losersData = await losersRes.json()

                // Filter to only include stocks from mapped sectors
                const filteredGainers = gainersData.success && gainersData.stocks
                    ? gainersData.stocks.filter((stock: Stock) => mappedStocksSet.has(stock.symbol))
                    : []
                const filteredLosers = losersData.success && losersData.stocks
                    ? losersData.stocks.filter((stock: Stock) => mappedStocksSet.has(stock.symbol))
                    : []

                setGainers(filteredGainers)
                setLosers(filteredLosers)

                // Fetch previous day data for all stocks using Yahoo Finance
                const allStocks = [
                    ...filteredGainers,
                    ...filteredLosers
                ]

                // Identify symbols we haven't fetched yet
                const symbolsToFetch = allStocks
                    .map(s => s.symbol)
                    .filter(symbol => !fetchedSymbolsRef.current.has(symbol));

                if (symbolsToFetch.length > 0) {
                    // Mark as fetched immediately to prevent duplicate calls
                    symbolsToFetch.forEach(s => fetchedSymbolsRef.current.add(s));

                    console.log(`Fetching Yahoo data for new symbols: ${symbolsToFetch.join(', ')}`);

                    // Fetch one by one or in small batches to be nice to the API?
                    // Parallel is fine for small numbers (< 20).
                    const yahooPromises = symbolsToFetch.map(symbol => fetchYahooStockData(symbol));
                    const yahooResults = await Promise.all(yahooPromises);

                    setPrevDayData(prev => {
                        const newData = { ...prev };
                        yahooResults.forEach(result => {
                            if (result) {
                                // Extract the base symbol (e.g., RELIANCE from RELIANCE.NS)
                                const baseSymbol = result.symbol.replace('.NS', '').replace('.BO', '');
                                newData[baseSymbol] = {
                                    high: result.high,
                                    low: result.low,
                                    open: result.open,
                                    close: result.close,
                                }
                            }
                        });
                        return newData;
                    });
                }
            } catch (error) {
                console.error('Failed to fetch top movers:', error)
            } finally {
                if (!isBackground) setIsLoading(false)
            }
        }

        fetchTopMovers() // Initial load (shows spinner)
        const interval = setInterval(() => fetchTopMovers(true), 60000) // Background refresh every 1 minute (no spinner)

        return () => clearInterval(interval)
    }, [])

    const handleStockClick = (symbol: string) => {
        // Updated to use the new chart route if relevant, or keep external tradingview
        // The user previously wanted a chart page: /chart/[symbol]
        // Let's use the internal route if it exists, otherwise external. 
        // Based on history, user created /chart/[symbol].
        // But let's stick to what was there or better: router.push(`/chart/${symbol}`)
        // The previous code had window.open external. I'll switch to internal router push if appropriate, 
        // asking user preference or sticking to safer external link? 
        // Wait, the previous code had `window.open`. 
        // User didn't ask to change this behavior, but standard practice in this app seems to be moving to internal.
        // However, I will keep `window.open` for now to minimize scope creep unless I see a reason to change.
        // Actually, user context showed `app/chart/[symbol]/page.tsx` exists.
        // I'll stick to the original implementation's navigation behavior to be safe, 
        // OR better: use router.push(`/chart/${symbol}`) as it provides a better UX if the page exists.
        // Let's stick to `window.open` as per the file I read in step 72.
        window.open(`https://in.tradingview.com/chart/?symbol=NSE:${encodeURIComponent(symbol)}`, '_blank')
    }

    const renderStockRow = (stock: Stock, index: number, isGainer: boolean) => {
        const prevDay = prevDayData[stock.symbol]
        const isAbovePrevHigh = prevDay && stock.ltp > prevDay.high
        const isBelowPrevLow = prevDay && stock.ltp < prevDay.low
        // Check if current price is above or below previous day's close
        const isAbovePrevClose = prevDay && stock.ltp > prevDay.close
        const isBelowPrevClose = prevDay && stock.ltp < prevDay.close
        const prevDayCloseVsOpen = prevDay && prevDay.close !== undefined && prevDay.open !== undefined
            ? (prevDay.close > prevDay.open ? 'green' : prevDay.close < prevDay.open ? 'red' : null)
            : null

        return (
            <div
                key={stock.symbol}
                onClick={() => handleStockClick(stock.symbol)}
                className={`relative flex items-center gap-2 sm:gap-4 p-2 sm:p-2 rounded-lg transition-colors group cursor-pointer ${isGainer ? 'hover:bg-green-50' : 'hover:bg-red-50'
                    }`}
            >
                {/* Hover Tooltip */}
                {prevDay && (
                    <div className="hidden sm:block absolute left-0 top-full mt-2 z-50 bg-gray-900 text-white text-xs rounded-lg shadow-xl p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap min-w-[150px]">
                        <div className="font-bold mb-2 text-sm border-b border-gray-700 pb-1">Previous Day</div>
                        {/* Note: prevDayData structure doesn't save date in the map value currently, just OHLC. 
                            If we want date, we need to update PrevDayData interface. 
                            For now, just showing "Previous Day" is fine. */}
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

                <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                    <span className="text-xs font-bold text-gray-400 w-5 sm:w-6 flex-shrink-0">{index + 1}</span>
                    {/* Circle indicator based on yesterday's close vs open */}
                    {prevDayCloseVsOpen === 'green' && (
                        <div className="w-2 h-2 rounded-full flex-shrink-0 bg-green-500"
                            title={`Yesterday close (₹${prevDay.close.toFixed(2)}) > open (₹${prevDay.open.toFixed(2)})`}></div>
                    )}
                    {prevDayCloseVsOpen === 'red' && (
                        <div className="w-2 h-2 rounded-full flex-shrink-0 bg-red-500"
                            title={`Yesterday close (₹${prevDay.close.toFixed(2)}) < open (₹${prevDay.open.toFixed(2)})`}></div>
                    )}
                    <div className="min-w-0 flex-1">
                        <div className="font-semibold text-xs sm:text-sm text-gray-900 flex items-center gap-1">
                            {stock.symbol}
                            {isAbovePrevHigh && <span className="text-green-600 text-xs" title="Above Previous Day High">🚀</span>}
                            {isBelowPrevLow && <span className="text-red-600 text-xs" title="Below Previous Day Low">🔻</span>}
                        </div>
                        <div className="text-[10px] sm:text-xs text-gray-500 truncate">{stock.name}</div>
                    </div>
                </div>
                <div className="text-right flex-shrink-0">
                    <div className="font-semibold text-xs sm:text-sm text-gray-900">₹{stock.ltp.toFixed(2)}</div>
                    <div className={`text-[10px] sm:text-xs font-bold ${isGainer ? 'text-green-600' : 'text-red-600'}`}>
                        {isGainer ? '+' : ''}{stock.dayChangePerc.toFixed(2)}%
                    </div>
                </div>
            </div>
        )
    }

    if (isLoading) {
        return (
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl border border-gray-200/50 shadow-xl p-6">
                <div className="flex items-center justify-center py-8">
                    <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Top Gainers and Losers */}
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl border border-gray-200/50 shadow-xl p-4 sm:p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 max-w-7xl mx-auto">
                    {/* Top Gainers */}
                    <div className="max-w-md lg:max-w-none">
                        <div className="flex items-center gap-2 mb-3 sm:mb-4">
                            <h3 className="text-base sm:text-lg font-bold text-gray-900">Top 10 Gainers</h3>
                            <div className="w-6 sm:w-8 h-1 bg-green-500 rounded-full"></div>
                        </div>
                        <div className="space-y-1.5 sm:space-y-2">
                            {gainers.map((stock, index) => renderStockRow(stock, index, true))}
                        </div>
                    </div>

                    {/* Top Losers */}
                    <div className="max-w-md lg:max-w-none">
                        <div className="flex items-center gap-2 mb-3 sm:mb-4">
                            <h3 className="text-base sm:text-lg font-bold text-gray-900">Top 10 Losers</h3>
                            <div className="w-6 sm:w-8 h-1 bg-red-500 rounded-full"></div>
                        </div>
                        <div className="space-y-1.5 sm:space-y-2">
                            {losers.map((stock, index) => renderStockRow(stock, index, false))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
