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
  is52WeekHigh?: boolean
  isBreakout?: boolean
}

export default function BreakoutStocksPage() {
  const [gainers, setGainers] = useState<BreakoutStock[]>([])
  const [losers, setLosers] = useState<BreakoutStock[]>([])
  const [isLoading, setIsLoading] = useState(true)

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
    
    const processStocks = async (stocks: any[]): Promise<BreakoutStock[]> => {
      const stocksWithData: BreakoutStock[] = []
      
      for (const stock of stocks) {
        // Only process stocks that belong to mapped sectors
        if (!mappedStocksSet.has(stock.symbol)) {
          continue
        }

        try {
          // Fetch previous day data from Yahoo Finance
          const yahooData = await fetchYahooStockData(stock.symbol)
          
          if (yahooData) {
            const currentPrice = stock.ltp || stock.dayChange + (stock.prevDayClose || 0)
            const isBreakingHigh = currentPrice > (yahooData.high || 0)
            
            stocksWithData.push({
              symbol: stock.symbol,
              name: stock.name || stock.symbol,
              ltp: stock.ltp || currentPrice,
              dayChange: stock.dayChange,
              dayChangePerc: stock.dayChangePerc,
              volume: stock.volume || 0,
              prevDayHigh: yahooData.high || 0,
              prevDayLow: yahooData.low || 0,
              prevDayClose: yahooData.close || 0,
              is52WeekHigh: isBreakingHigh,
              isBreakout: isBreakingHigh && (stock.volume || 0) > 500000,
            })
          } else {
            // Fallback if Yahoo data is not available
            stocksWithData.push({
              symbol: stock.symbol,
              name: stock.name || stock.symbol,
              ltp: stock.ltp,
              dayChange: stock.dayChange,
              dayChangePerc: stock.dayChangePerc,
              volume: stock.volume || 0,
              prevDayHigh: stock.prevDayHigh || 0,
              prevDayLow: stock.prevDayLow || 0,
              prevDayClose: stock.prevDayClose || 0,
              isBreakout: false,
            })
          }

          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100))
        } catch (error) {
          console.error(`Error fetching data for ${stock.symbol}:`, error)
        }
      }

      return stocksWithData.sort((a, b) => {
        return Math.abs(b.dayChangePerc) - Math.abs(a.dayChangePerc)
      })
    }

    const fetchBreakoutStocks = async () => {
      setIsLoading(true)
      try {
        // Fetch both top gainers and top losers
        const [gainersRes, losersRes] = await Promise.all([
          fetch('/api/groww/top-movers?moverType=TOP_GAINERS'),
          fetch('/api/groww/top-movers?moverType=TOP_LOSERS')
        ])

        const gainersData = await gainersRes.json()
        const losersData = await losersRes.json()

        if (gainersData.success && gainersData.stocks) {
          const processedGainers = await processStocks(gainersData.stocks.slice(0, 100))
          // Filter to only show breakout stocks (LTP > prev day high)
          const breakoutStocks = processedGainers.filter(stock => {
            return stock.prevDayHigh > 0 && stock.ltp > stock.prevDayHigh
          })
          setGainers(breakoutStocks)
        }

        if (losersData.success && losersData.stocks) {
          const processedLosers = await processStocks(losersData.stocks.slice(0, 100))
          // Filter to only show breakdown stocks (LTP < prev day low)
          const breakdownStocks = processedLosers.filter(stock => {
            return stock.prevDayLow > 0 && stock.ltp < stock.prevDayLow
          })
          setLosers(breakdownStocks)
        }
      } catch (error) {
        console.error('Failed to fetch breakout stocks:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchBreakoutStocks()
    const interval = setInterval(fetchBreakoutStocks, 300000) // Refresh every 5 minutes

    return () => clearInterval(interval)
  }, [])

  const handleStockClick = (symbol: string) => {
    window.open(`https://in.tradingview.com/chart/?symbol=NSE:${symbol}`, '_blank')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      {/* Top Navigation with Market Indices */}
      <TopNavigation />

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
                                  <div>
                                    <div className="text-sm font-bold text-gray-900">{stock.symbol}</div>
                                    <div className="text-xs text-gray-500 truncate max-w-[120px]">
                                      {stock.name}
                                    </div>
                                  </div>
                                  {stock.is52WeekHigh && (
                                    <span className="px-2 py-0.5 text-xs font-semibold bg-yellow-100 text-yellow-800 rounded">
                                      52W
                                    </span>
                                  )}
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
                                  <div className="text-sm">
                                    <div className="font-semibold text-green-600">
                                      +₹{(stock.ltp - stock.prevDayHigh).toFixed(2)}
                                    </div>
                                    <div className="text-xs text-green-600">
                                      (+{(((stock.ltp - stock.prevDayHigh) / stock.prevDayHigh) * 100).toFixed(2)}%)
                                    </div>
                                  </div>
                                )}
                              </td>
                            </tr>
                          )
                        })}
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
                                  <div>
                                    <div className="text-sm font-bold text-gray-900">{stock.symbol}</div>
                                    <div className="text-xs text-gray-500 truncate max-w-[120px]">
                                      {stock.name}
                                    </div>
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
                                  <div className="text-sm">
                                    <div className="font-semibold text-red-600">
                                      -₹{(stock.prevDayLow - stock.ltp).toFixed(2)}
                                    </div>
                                    <div className="text-xs text-red-600">
                                      (-{(((stock.prevDayLow - stock.ltp) / stock.prevDayLow) * 100).toFixed(2)}%)
                                    </div>
                                  </div>
                                )}
                              </td>
                            </tr>
                          )
                        })}
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

