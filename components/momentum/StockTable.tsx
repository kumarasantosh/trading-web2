'use client'

import { useState, useEffect } from 'react'
import { getStocksForSector } from '@/constants/sector-stocks-mapping'
import { fetchYahooStockData } from '@/services/yahooFinance'

interface Stock {
  symbol: string
  price: number
  changePercent: number
  close: number
  open: number
  ltp: number
  logo?: string
}

interface StockTableProps {
  selectedSector: string | null
  isReplayMode?: boolean
  replayTime?: Date
}

export default function StockTable({ selectedSector, isReplayMode = false, replayTime }: StockTableProps) {
  const [stocks, setStocks] = useState<Stock[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [prevDayData, setPrevDayData] = useState<Record<string, { close: number; open: number }>>({})

  useEffect(() => {
    let isMounted = true
    const BATCH_SIZE = 5 // Load first 5 stocks immediately, then rest in background

    const fetchStocksBatch = async (symbolsBatch: string[], isReplay: boolean, time?: Date): Promise<Stock[]> => {
      if (isReplay && time) {
        // Fetch historical snapshot from Supabase
        const roundedTime = new Date(time)
        const minutes = roundedTime.getMinutes()
        const roundedMinutes = Math.floor(minutes / 5) * 5
        roundedTime.setMinutes(roundedMinutes, 0, 0)

        const endTime = new Date(roundedTime)
        endTime.setMinutes(endTime.getMinutes() + 5)

        const response = await fetch(
          `/api/snapshots?type=stock&start=${roundedTime.toISOString()}&end=${endTime.toISOString()}${selectedSector ? `&sector=${selectedSector}` : ''}`
        )

        if (response.ok) {
          const { snapshots } = await response.json()
          if (snapshots && snapshots.length > 0) {
            return snapshots
              .filter((snap: any) => symbolsBatch.includes(snap.symbol))
              .map((snap: any) => ({
                symbol: snap.symbol,
                price: snap.ltp,
                changePercent: snap.change_percent,
                close: snap.close_price,
                open: snap.open_price,
                ltp: snap.ltp,
              }))
          }
        }
        return []
      } else {
        // Fetch live data
        const { fetchStockData } = await import('@/services/momentumApi')
        return await fetchStockData(symbolsBatch)
      }
    }

    const fetchStocks = async (isBackground = false) => {
      // Get symbols based on selected sector, or use default Financial Services stocks
      // Using reliable symbols that are known to work with the API
      const allSymbols = selectedSector
        ? getStocksForSector(selectedSector)
        : ['SBILIFE', 'LICHSGFIN', 'BAJAJFINSV', 'SBIN', 'ICICIBANK', 'SBICARD', 'AXISBANK', 'HDFCBANK', 'KOTAKBANK']

      if (allSymbols.length === 0) return

      // Only show loading for sector change/initial load
      if (!isBackground) setIsLoading(true)

      try {
        // Split symbols into batches
        const firstBatch = allSymbols.slice(0, BATCH_SIZE)
        const remainingBatches = allSymbols.slice(BATCH_SIZE)

        // Fetch first batch immediately
        const firstBatchData = await fetchStocksBatch(firstBatch, isReplayMode, replayTime)

        // Filter out invalid data (symbols with 0 or null values)
        const validFirstBatch = firstBatchData.filter(stock =>
          stock.ltp > 0 && stock.symbol && !isNaN(stock.changePercent)
        )

        if (isMounted && validFirstBatch.length > 0) {
          setStocks(validFirstBatch)
          setIsLoading(false) // Hide loading after first batch
        }

        // Fetch remaining stocks in background
        if (remainingBatches.length > 0) {
          // Process remaining stocks in smaller batches to avoid overwhelming the API
          const processRemainingBatches = async () => {
            for (let i = 0; i < remainingBatches.length; i += BATCH_SIZE) {
              if (!isMounted) break

              const batch = remainingBatches.slice(i, i + BATCH_SIZE)
              const batchData = await fetchStocksBatch(batch, isReplayMode, replayTime)

              // Filter out invalid data
              const validBatch = batchData.filter(stock =>
                stock.ltp > 0 && stock.symbol && !isNaN(stock.changePercent)
              )

              if (isMounted && validBatch.length > 0) {
                setStocks(prev => {
                  // Merge new data with existing, avoiding duplicates
                  const existingSymbols = new Set(prev.map(s => s.symbol))
                  const newStocks = validBatch.filter(s => !existingSymbols.has(s.symbol))
                  return [...prev, ...newStocks]
                })
              }

              // Small delay between batches to avoid rate limiting
              if (i + BATCH_SIZE < remainingBatches.length) {
                await new Promise(resolve => setTimeout(resolve, 200))
              }
            }
          }

          // Start processing remaining batches asynchronously
          processRemainingBatches()
        } else if (validFirstBatch.length === 0) {
          // No data at all
          if (isMounted) setStocks([])
          setIsLoading(false)
        }
      } catch (error) {
        console.error('Failed to fetch stock data', error)
        if (isMounted && !isBackground) setIsLoading(false)
      }
    }

    // Initial fetch
    fetchStocks()

    // Background refresh
    let interval: NodeJS.Timeout
    if (!isReplayMode) {
      interval = setInterval(() => fetchStocks(true), 60000) // Refresh every 1 minute
    }

    return () => {
      isMounted = false
      if (interval) clearInterval(interval)
    }
  }, [selectedSector, isReplayMode, replayTime?.getTime()])

  useEffect(() => {
    const fetchPrevDayData = async () => {
      if (stocks.length === 0) return

      const symbolsToFetch = stocks
        .filter(s => !prevDayData[s.symbol])
        .map(s => s.symbol)

      if (symbolsToFetch.length === 0) return

      // Process in batches to avoid rate limiting
      const BATCH_SIZE = 5
      for (let i = 0; i < symbolsToFetch.length; i += BATCH_SIZE) {
        const batch = symbolsToFetch.slice(i, i + BATCH_SIZE)
        const promises = batch.map(symbol => fetchYahooStockData(symbol))

        const results = await Promise.all(promises)

        setPrevDayData(prev => {
          const newData = { ...prev }
          results.forEach((result, index) => {
            if (result) {
              newData[batch[index]] = {
                close: result.close,
                open: result.open,
              }
            }
          })
          return newData
        })

        // Small delay between batches
        if (i + BATCH_SIZE < symbolsToFetch.length) {
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      }
    }

    if (!isReplayMode) {
      fetchPrevDayData()
    }
  }, [stocks, isReplayMode])

  const getInitials = (symbol: string) => {
    if (symbol.length <= 2) return symbol
    return symbol.substring(0, 2).toUpperCase()
  }

  const getLogoColor = (symbol: string) => {
    const colors = ['bg-blue-500', 'bg-red-500', 'bg-green-500', 'bg-purple-500', 'bg-yellow-500']
    const index = symbol.charCodeAt(0) % colors.length
    return colors[index]
  }

  // Sort stocks based on changePercent
  const sortedStocks = [...stocks].sort((a, b) => {
    if (sortOrder === 'desc') {
      return b.changePercent - a.changePercent
    } else {
      return a.changePercent - b.changePercent
    }
  })

  const toggleSortOrder = () => {
    setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')
  }

  const handleStockClick = (symbol: string) => {
    window.open(`https://in.tradingview.com/chart/?symbol=NSE:${encodeURIComponent(symbol)}`, '_blank')
  }

  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-2xl border border-gray-200/50 shadow-xl p-3 sm:p-4 lg:p-6 h-full hover:shadow-2xl transition-all duration-300">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-3">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <h2 className="text-base sm:text-lg lg:text-xl font-extrabold text-black">
            {selectedSector ? `${selectedSector} Stocks` : 'Nifty Financial Services 25/50 Stocks'}
          </h2>
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
        <button
          onClick={toggleSortOrder}
          className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl font-semibold text-xs sm:text-sm transition-all duration-300 hover:bg-green-600 bg-green-500 text-white shadow-md w-full sm:w-auto"
        >
          {sortOrder === 'desc' ? (
            <span className="text-xs">↓ Desc</span>
          ) : (
            <span className="text-xs">↑ Asc</span>
          )}
        </button>
      </div>

      <div className="overflow-x-auto overflow-y-auto max-h-[600px] -mx-3 sm:mx-0 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent pr-2">
        {isLoading && stocks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            </div>
            <p className="mt-4 text-sm text-gray-600 font-semibold">Loading stocks...</p>
          </div>
        ) : sortedStocks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="text-4xl mb-4">📊</div>
            <div className="text-lg font-bold text-gray-700 mb-2">No Stocks Available</div>
            <div className="text-sm text-gray-500">No stock data found for the selected criteria.</div>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <table className="w-full hidden md:table">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-semibold text-gray-700">Symbol</th>
                  <th className="px-3 sm:px-4 py-3 text-right text-xs sm:text-sm font-semibold text-gray-700">Change</th>
                  <th className="px-3 sm:px-4 py-3 text-right text-xs sm:text-sm font-semibold text-gray-700">Close</th>
                  <th className="px-3 sm:px-4 py-3 text-right text-xs sm:text-sm font-semibold text-gray-700">Open</th>
                  <th className="px-3 sm:px-4 py-3 text-right text-xs sm:text-sm font-semibold text-gray-700">LTP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedStocks.map((stock, index) => {
                  const isPositive = stock.changePercent >= 0

                  return (
                    <tr
                      key={index}
                      onClick={() => handleStockClick(stock.symbol)}
                      className="hover:bg-gradient-to-r hover:from-gray-50 hover:to-white transition-all duration-200 group cursor-pointer"
                    >
                      <td className="px-3 sm:px-4 py-2">
                        <div className="flex items-center gap-2">
                          {prevDayData[stock.symbol] && (
                            <>
                              {prevDayData[stock.symbol].close > prevDayData[stock.symbol].open && (
                                <div
                                  className="w-2 h-2 rounded-full flex-shrink-0 bg-green-500"
                                  title={`Yesterday close (₹${prevDayData[stock.symbol].close.toFixed(2)}) > open (₹${prevDayData[stock.symbol].open.toFixed(2)})`}
                                />
                              )}
                              {prevDayData[stock.symbol].close < prevDayData[stock.symbol].open && (
                                <div
                                  className="w-2 h-2 rounded-full flex-shrink-0 bg-red-500"
                                  title={`Yesterday close (₹${prevDayData[stock.symbol].close.toFixed(2)}) < open (₹${prevDayData[stock.symbol].open.toFixed(2)})`}
                                />
                              )}
                            </>
                          )}
                          <span className="font-bold text-gray-900 group-hover:text-black transition-colors">{stock.symbol}</span>
                        </div>
                      </td>
                      <td className="px-3 sm:px-4 py-2 text-right">
                        <div className={`inline-flex items-center justify-end gap-1.5 font-bold px-2 sm:px-3 py-1.5 rounded-lg transition-all duration-200 ${isPositive
                          ? 'text-green-700 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200/50'
                          : 'text-red-700 bg-gradient-to-r from-red-50 to-rose-50 border border-red-200/50'
                          }`}>
                          <span className={`text-xs sm:text-sm ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                            {isPositive ? '▲' : '▼'}
                          </span>
                          <span className="text-xs sm:text-sm font-extrabold">
                            {isPositive ? '+' : ''}{stock.changePercent.toFixed(2)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-3 sm:px-4 py-2 text-right">
                        <span className="font-semibold text-gray-700 text-xs sm:text-sm">
                          {stock.close.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="px-3 sm:px-4 py-2 text-right">
                        <span className="font-semibold text-gray-700 text-xs sm:text-sm">
                          {stock.open.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="px-3 sm:px-4 py-2 text-right">
                        <span className="font-bold text-gray-900 text-xs sm:text-sm">
                          {stock.ltp.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3 px-3">
              {sortedStocks.map((stock, index) => {
                const isPositive = stock.changePercent >= 0

                return (
                  <div
                    key={index}
                    onClick={() => handleStockClick(stock.symbol)}
                    className="bg-gray-50 rounded-lg p-3 border border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {prevDayData[stock.symbol] && (
                          <>
                            {prevDayData[stock.symbol].close > prevDayData[stock.symbol].open && (
                              <div
                                className="w-2 h-2 rounded-full flex-shrink-0 bg-green-500"
                                title={`Yesterday close (₹${prevDayData[stock.symbol].close.toFixed(2)}) > open (₹${prevDayData[stock.symbol].open.toFixed(2)})`}
                              />
                            )}
                            {prevDayData[stock.symbol].close < prevDayData[stock.symbol].open && (
                              <div
                                className="w-2 h-2 rounded-full flex-shrink-0 bg-red-500"
                                title={`Yesterday close (₹${prevDayData[stock.symbol].close.toFixed(2)}) < open (₹${prevDayData[stock.symbol].open.toFixed(2)})`}
                              />
                            )}
                          </>
                        )}
                        <span className="font-bold text-gray-900 text-sm">{stock.symbol}</span>
                      </div>
                      <div className={`inline-flex items-center gap-1.5 font-bold px-2 py-1 rounded-lg ${isPositive
                        ? 'text-green-700 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200/50'
                        : 'text-red-700 bg-gradient-to-r from-red-50 to-rose-50 border border-red-200/50'
                        }`}>
                        <span className={`text-xs ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                          {isPositive ? '▲' : '▼'}
                        </span>
                        <span className="text-xs font-extrabold">
                          {isPositive ? '+' : ''}{stock.changePercent.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <div className="text-gray-500">Close</div>
                        <div className="font-semibold text-gray-700">{stock.close.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
                      </div>
                      <div>
                        <div className="text-gray-500">Open</div>
                        <div className="font-semibold text-gray-700">{stock.open.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
                      </div>
                      <div>
                        <div className="text-gray-500">LTP</div>
                        <div className="font-bold text-gray-900">{stock.ltp.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
