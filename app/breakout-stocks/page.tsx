'use client'

import { useState, useEffect, useRef } from 'react'
import TopNavigation from '@/components/momentum/TopNavigation'
import Footer from '@/components/Footer'

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
  const isLoadingRef = useRef(false) // Track if loading is in progress

  useEffect(() => {
    const fetchBreakoutStocks = async () => {
      // Prevent concurrent fetches
      if (isLoadingRef.current) {
        return
      }

      isLoadingRef.current = true
      const isInitialLoad = gainers.length === 0 && losers.length === 0

      // Only show loading spinner on initial load
      if (isInitialLoad) {
        setIsLoading(true)
      }

      try {
        console.time('[BREAKOUT] Fetch from new breakout snapshots API')
        const newApiRes = await fetch('/api/breakouts', { cache: 'no-store' })

        if (newApiRes.ok) {
          const newApiData = await newApiRes.json()
          console.timeEnd('[BREAKOUT] Fetch from new breakout snapshots API')

          if (newApiData.success) {
            console.log('✅ Using database breakout snapshots')

            // Map to existing format
            const mappedBreakouts: BreakoutStock[] = (newApiData.breakouts || []).map((s: any) => ({
              symbol: s.symbol,
              name: s.symbol,
              ltp: parseFloat(s.ltp),
              dayChange: parseFloat(s.ltp) - parseFloat(s.yesterday_high || s.ltp),
              dayChangePerc: parseFloat(s.breakout_percent),
              volume: s.volume || 0,
              prevDayHigh: parseFloat(s.yesterday_high),
              prevDayLow: parseFloat(s.yesterday_low || s.yesterday_high),
              prevDayClose: s.today_close || parseFloat(s.yesterday_high),
              prevDayOpen: s.today_open || parseFloat(s.yesterday_high),
              isBreakout: true,
            }))

            const mappedBreakdowns: BreakoutStock[] = (newApiData.breakdowns || []).map((s: any) => ({
              symbol: s.symbol,
              name: s.symbol,
              ltp: parseFloat(s.ltp),
              dayChange: parseFloat(s.yesterday_low) - parseFloat(s.ltp),
              dayChangePerc: parseFloat(s.breakdown_percent),
              volume: s.volume || 0,
              prevDayHigh: parseFloat(s.yesterday_low), // For breakdowns, we care about yesterday_low
              prevDayLow: parseFloat(s.yesterday_low),
              prevDayClose: s.today_close || parseFloat(s.yesterday_low),
              prevDayOpen: s.today_open || parseFloat(s.yesterday_low),
              isBreakout: false,
            }))

            setGainers(mappedBreakouts)
            setLosers(mappedBreakdowns)
          }
        }
      } catch (error) {
        console.error('Failed to fetch breakout stocks:', error)
      } finally {
        setIsLoading(false)
        isLoadingRef.current = false
      }
    }

    fetchBreakoutStocks()
    const interval = setInterval(fetchBreakoutStocks, 60000) // Refresh every 1 minute
    return () => clearInterval(interval)
  }, [])

  const handleStockClick = (symbol: string) => {
    window.open(`https://in.tradingview.com/chart/?symbol=NSE:${encodeURIComponent(symbol)}`, '_blank')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      {/* Top Navigation with Market Indices */}
      <div className="relative z-50">
        <TopNavigation hideTopMovers={true} />
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
                  Stocks breaking previous day high/low (using saved database data)
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
                        {gainers.map((stock) => (
                          <tr
                            key={stock.symbol}
                            onClick={() => handleStockClick(stock.symbol)}
                            className="hover:bg-green-50 cursor-pointer transition-colors duration-150"
                          >
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                {/* Previous Day Sentiment Circle */}
                                {(() => {
                                  const isGreen = stock.prevDayClose > stock.prevDayOpen;
                                  const isRed = stock.prevDayClose < stock.prevDayOpen;
                                  if (!isGreen && !isRed) return null;

                                  return (
                                    <div
                                      className={`w-2 h-2 rounded-full flex-shrink-0 ${isGreen ? 'bg-green-500' : 'bg-red-500'}`}
                                      title={`Yesterday close (₹${stock.prevDayClose.toFixed(2)}) ${isGreen ? '>' : '<'} open (₹${stock.prevDayOpen.toFixed(2)})`}
                                    ></div>
                                  );
                                })()}
                                <div className="text-sm font-bold text-gray-900">{stock.symbol}</div>
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
                        ))}
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
                        {losers.map((stock) => (
                          <tr
                            key={stock.symbol}
                            onClick={() => handleStockClick(stock.symbol)}
                            className="hover:bg-red-50 cursor-pointer transition-colors duration-150"
                          >
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                {/* Previous Day Sentiment Circle */}
                                {(() => {
                                  const isGreen = stock.prevDayClose > stock.prevDayOpen;
                                  const isRed = stock.prevDayClose < stock.prevDayOpen;
                                  if (!isGreen && !isRed) return null;

                                  return (
                                    <div
                                      className={`w-2 h-2 rounded-full flex-shrink-0 ${isGreen ? 'bg-green-500' : 'bg-red-500'}`}
                                      title={`Yesterday close (₹${stock.prevDayClose.toFixed(2)}) ${isGreen ? '>' : '<'} open (₹${stock.prevDayOpen.toFixed(2)})`}
                                    ></div>
                                  );
                                })()}
                                <div className="text-sm font-bold text-gray-900">{stock.symbol}</div>
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
                        ))}
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
