'use client'

import { useState, useEffect } from 'react'
import TopNavigation from '@/components/momentum/TopNavigation'
import Footer from '@/components/Footer'
import { fetchYahooStockData } from '@/services/yahooFinance'
import { SECTOR_STOCKS } from '@/constants/sector-stocks-mapping'

interface BreakoutStock {
  symbol: string
  name: string
  ltp: number
  dayChange: number
  dayChangePerc: number
  volume: number
  prevDayHigh: number
  prevDayLow: number
  prevDayClose: number
  prevDayOpen: number
  is52WeekHigh?: boolean
  isBreakout?: boolean
}

export default function BreakoutStocksPage() {
  const [gainers, setGainers] = useState<BreakoutStock[]>([])
  const [losers, setLosers] = useState<BreakoutStock[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingPhase2, setIsLoadingPhase2] = useState(false)

  // Get all unique stock symbols from mapped sectors
  const getAllMappedStocks = (): Set<string> => {
    const allStocks = new Set<string>()
    Object.values(SECTOR_STOCKS).forEach(stocks => {
      stocks.forEach(stock => allStocks.add(stock))
    })
    return allStocks
  }

  useEffect(() => {
    const fetchBreakoutStocks = async (isBackground = false) => {
      if (!isBackground) setIsLoading(true)
      // Don't clear lists immediately if background refresh to avoid flash
      if (!isBackground) {
        setGainers([])
        setLosers([])
      }

      const breakoutStocks: BreakoutStock[] = []
      const breakdownStocks: BreakoutStock[] = []

      try {
        // PHASE 1: Quick load from top gainers/losers (fast)
        const [gainersRes, losersRes] = await Promise.all([
          fetch('/api/groww/top-movers?moverType=TOP_GAINERS'),
          fetch('/api/groww/top-movers?moverType=TOP_LOSERS')
        ])

        const gainersData = await gainersRes.json()
        const losersData = await losersRes.json()
        const topMoversSymbols = new Set<string>()

        // Process top gainers for breakouts
        if (gainersData.success && gainersData.stocks) {
          const topGainers = gainersData.stocks.slice(0, 50)
          for (const stock of topGainers) {
            topMoversSymbols.add(stock.symbol)
            try {
              const yahooData = await fetchYahooStockData(stock.symbol)
              if (yahooData && yahooData.high > 0 && stock.ltp > yahooData.high) {
                const dayChange = stock.ltp - yahooData.close
                const dayChangePerc = yahooData.close > 0 ? (dayChange / yahooData.close) * 100 : 0

                breakoutStocks.push({
                  symbol: stock.symbol,
                  name: stock.symbol,
                  ltp: stock.ltp,
                  dayChange,
                  dayChangePerc,
                  volume: 0,
                  prevDayHigh: yahooData.high,
                  prevDayLow: yahooData.low,
                  prevDayClose: yahooData.close,
                  prevDayOpen: yahooData.open,
                  is52WeekHigh: stock.ltp > yahooData.high,
                  isBreakout: true,
                })
              }
            } catch (error) {
              // Skip
            }
          }
        }

        // Process top losers for breakdowns
        if (losersData.success && losersData.stocks) {
          const topLosers = losersData.stocks.slice(0, 50)
          for (const stock of topLosers) {
            topMoversSymbols.add(stock.symbol)
            try {
              const yahooData = await fetchYahooStockData(stock.symbol)
              if (yahooData && yahooData.low > 0 && stock.ltp < yahooData.low) {
                const dayChange = stock.ltp - yahooData.close
                const dayChangePerc = yahooData.close > 0 ? (dayChange / yahooData.close) * 100 : 0

                breakdownStocks.push({
                  symbol: stock.symbol,
                  name: stock.symbol,
                  ltp: stock.ltp,
                  dayChange,
                  dayChangePerc,
                  volume: 0,
                  prevDayHigh: yahooData.high,
                  prevDayLow: yahooData.low,
                  prevDayClose: yahooData.close,
                  prevDayOpen: yahooData.open,
                  is52WeekHigh: false,
                  isBreakout: false,
                })
              }
            } catch (error) {
              // Skip
            }
          }
        }

        // Show initial results from top movers (descending order)
        setGainers([...breakoutStocks].sort((a, b) => b.dayChangePerc - a.dayChangePerc))
        setLosers([...breakdownStocks].sort((a, b) => Math.abs(b.dayChangePerc) - Math.abs(a.dayChangePerc)))
        setIsLoading(false)
        setIsLoadingPhase2(true)

        // PHASE 2: Progressive load from all sector stocks
        const mappedStocksSet = getAllMappedStocks()
        const allStockSymbols = Array.from(mappedStocksSet).filter(s => !topMoversSymbols.has(s))

        const { fetchStockData } = await import('@/services/momentumApi')
        const liveStockData = await fetchStockData(allStockSymbols)
        const validStocks = liveStockData.filter(stock => stock.ltp && stock.ltp > 0)

        const BATCH_SIZE = 20
        for (let i = 0; i < validStocks.length; i += BATCH_SIZE) {
          const batch = validStocks.slice(i, i + BATCH_SIZE)

          const batchPromises = batch.map(async (stock) => {
            try {
              const yahooData = await fetchYahooStockData(stock.symbol)
              if (yahooData && yahooData.high > 0 && yahooData.low > 0) {
                const dayChange = stock.ltp - yahooData.close
                const dayChangePerc = yahooData.close > 0 ? (dayChange / yahooData.close) * 100 : 0

                return {
                  symbol: stock.symbol,
                  name: stock.symbol,
                  ltp: stock.ltp,
                  dayChange,
                  dayChangePerc,
                  volume: 0,
                  prevDayHigh: yahooData.high,
                  prevDayLow: yahooData.low,
                  prevDayClose: yahooData.close,
                  prevDayOpen: yahooData.open,
                  is52WeekHigh: stock.ltp > yahooData.high,
                  isBreakout: stock.ltp > yahooData.high,
                }
              }
            } catch (error) {
              // Skip
            }
            return null
          })

          const batchResults = await Promise.all(batchPromises)
          const validResults = batchResults.filter((s) => s !== null) as BreakoutStock[]

          validResults.forEach(stock => {
            if (stock.ltp > stock.prevDayHigh) {
              breakoutStocks.push(stock)
            } else if (stock.ltp < stock.prevDayLow) {
              breakdownStocks.push(stock)
            }
          })

          setGainers([...breakoutStocks].sort((a, b) => b.dayChangePerc - a.dayChangePerc))
          setLosers([...breakdownStocks].sort((a, b) => Math.abs(b.dayChangePerc) - Math.abs(a.dayChangePerc)))

          if (i + BATCH_SIZE < validStocks.length) {
            await new Promise(resolve => setTimeout(resolve, 200))
          }
        }
        setIsLoadingPhase2(false)
      } catch (error) {
        console.error('Failed to fetch breakout stocks:', error)
        setIsLoading(false)
        setIsLoadingPhase2(false)
      }
    }

    fetchBreakoutStocks()
    const interval = setInterval(() => fetchBreakoutStocks(true), 300000)
    return () => clearInterval(interval)
  }, [])

  const handleStockClick = (symbol: string) => {
    window.open(`https://in.tradingview.com/chart/?symbol=NSE:${encodeURIComponent(symbol)}`, '_blank')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      {/* Top Navigation with Market Indices */}
      <div className="relative z-50">
        <TopNavigation />
      </div>

      <div className="w-full py-8 min-h-[calc(100vh-200px)]">
        <div className="px-4 lg:px-6">
          {/* Header */}
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl border border-gray-200/50 shadow-xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-3xl font-extrabold bg-gradient-to-r from-black to-gray-700 bg-clip-text text-transparent">
                  Breakout Stocks
                </h1>
                <p className="mt-2 text-sm text-gray-600">
                  Stocks breaking previous day high/low from mapped sectors
                </p>
              </div>

            </div>

          </div>

          {/* Stocks Tables - Side by Side */}
          {isLoading ? (
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl border border-gray-200/50 shadow-xl p-12 text-center">
              <div className="inline-block w-16 h-16 border-4 border-green-200 border-t-green-600 rounded-full animate-spin"></div>
              <p className="mt-4 text-gray-600 font-medium">Loading stocks...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Breakout Stocks */}
              <div className="bg-white/95 backdrop-blur-sm rounded-2xl border border-gray-200/50 shadow-xl overflow-hidden">
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-6 py-4 border-b border-green-200">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-extrabold text-black">Breakout Stocks</h3>
                    <div className="w-8 h-1 bg-green-500 rounded-full"></div>
                    <span className="text-xs bg-green-500 text-white px-2 py-1 rounded-full font-bold shadow-md">
                      {gainers.length}
                    </span>
                  </div>
                </div>
                {gainers.length === 0 ? (
                  <div className="p-12 text-center">
                    <div className="text-gray-500 font-medium">No breakout stocks found.</div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Stock
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            LTP
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Change %
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Breakout
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {gainers.map((stock) => {
                          return (
                            <tr
                              key={stock.symbol}
                              onClick={() => handleStockClick(stock.symbol)}
                              className="hover:bg-green-50 cursor-pointer transition-colors duration-150"
                            >
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  {stock.prevDayClose > stock.prevDayOpen && (
                                    <div
                                      className="w-2 h-2 rounded-full flex-shrink-0 bg-green-500"
                                      title={`Yesterday close w(₹${stock.prevDayClose.toFixed(2)}) > open (₹${stock.prevDayOpen.toFixed(2)})`}
                                    />
                                  )}
                                  {stock.prevDayClose < stock.prevDayOpen && (
                                    <div
                                      className="w-2 h-2 rounded-full flex-shrink-0 bg-red-500"
                                      title={`Yesterday close (₹${stock.prevDayClose.toFixed(2)}) < open (₹${stock.prevDayOpen.toFixed(2)})`}
                                    />
                                  )}
                                  <div>
                                    <div className="text-sm font-bold text-gray-900">{stock.symbol}</div>

                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="text-sm font-semibold text-gray-900">
                                  ₹{stock.ltp.toFixed(2)}
                                </div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="text-sm font-bold text-green-600">
                                  +{stock.dayChangePerc.toFixed(2)}%
                                </div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                {stock.prevDayHigh > 0 && (
                                  <div className="text-sm flex flex-row items-center gap-1 font-semibold text-green-600">
                                    <div>
                                      +₹{(stock.ltp - stock.prevDayHigh).toFixed(2)}
                                    </div>
                                    <div className="text-xs">
                                      (+{(((stock.ltp - stock.prevDayHigh) / stock.prevDayHigh) * 100).toFixed(2)}%)
                                    </div>
                                  </div>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                        {isLoadingPhase2 && (
                          <tr>
                            <td colSpan={4} className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
                                <div className="w-4 h-4 border-2 border-green-200 border-t-green-600 rounded-full animate-spin"></div>
                                <span>Loading more breakout stocks...</span>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Breakdown Stocks */}
              <div className="bg-white/95 backdrop-blur-sm rounded-2xl border border-gray-200/50 shadow-xl overflow-hidden">
                <div className="bg-gradient-to-r from-red-50 to-rose-50 px-6 py-4 border-b border-red-200">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-extrabold text-black">Breakdown Stocks</h3>
                    <div className="w-8 h-1 bg-red-500 rounded-full"></div>
                    <span className="text-xs bg-red-500 text-white px-2 py-1 rounded-full font-bold shadow-md">
                      {losers.length}
                    </span>
                  </div>
                </div>
                {losers.length === 0 ? (
                  <div className="p-12 text-center">
                    <div className="text-gray-500 font-medium">No breakdown stocks found.</div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Stock
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            LTP
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Change %
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Breakdown
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {losers.map((stock) => {
                          return (
                            <tr
                              key={stock.symbol}
                              onClick={() => handleStockClick(stock.symbol)}
                              className="hover:bg-red-50 cursor-pointer transition-colors duration-150"
                            >
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  {stock.prevDayClose > stock.prevDayOpen && (
                                    <div
                                      className="w-2 h-2 rounded-full flex-shrink-0 bg-green-500"
                                      title={`Yesterday close (₹${stock.prevDayClose.toFixed(2)}) > open (₹${stock.prevDayOpen.toFixed(2)})`}
                                    />
                                  )}
                                  {stock.prevDayClose < stock.prevDayOpen && (
                                    <div
                                      className="w-2 h-2 rounded-full flex-shrink-0 bg-red-500"
                                      title={`Yesterday close (₹${stock.prevDayClose.toFixed(2)}) < open (₹${stock.prevDayOpen.toFixed(2)})`}
                                    />
                                  )}
                                  <div>
                                    <div className="text-sm font-bold text-gray-900">{stock.symbol}</div>

                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="text-sm font-semibold text-gray-900">
                                  ₹{stock.ltp.toFixed(2)}
                                </div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="text-sm font-bold text-red-600">
                                  {stock.dayChangePerc.toFixed(2)}%
                                </div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                {stock.prevDayLow > 0 && (
                                  <div className="text-sm flex flex-row items-center gap-1 font-semibold text-red-600">
                                    <div>
                                      -₹{(stock.prevDayLow - stock.ltp).toFixed(2)}
                                    </div>
                                    <div className="text-xs">
                                      (-{(((stock.prevDayLow - stock.ltp) / stock.prevDayLow) * 100).toFixed(2)}%)
                                    </div>
                                  </div>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                        {isLoadingPhase2 && (
                          <tr>
                            <td colSpan={4} className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
                                <div className="w-4 h-4 border-2 border-red-200 border-t-red-600 rounded-full animate-spin"></div>
                                <span>Loading more breakdown stocks...</span>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  )
}

