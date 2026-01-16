'use client'

import { useState, useEffect, useRef } from 'react'
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

interface DailyHighLow {
  symbol: string
  sector: string
  today_high: number
  today_low: number
  today_open?: number
  today_close?: number
}

export default function BreakoutStocksPage() {
  const [gainers, setGainers] = useState<BreakoutStock[]>([])
  const [losers, setLosers] = useState<BreakoutStock[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [usingDatabase, setUsingDatabase] = useState(true)
  const isLoadingRef = useRef(false) // Track if loading is in progress

  // Get all unique stock symbols from mapped sectors
  const getAllMappedStocks = (): string[] => {
    const allStocks = new Set<string>()
    Object.values(SECTOR_STOCKS).forEach(stocks => {
      stocks.forEach(stock => allStocks.add(stock))
    })
    return Array.from(allStocks)
  }

  useEffect(() => {
    const fetchBreakoutStocks = async () => {
      // Prevent concurrent fetches
      if (isLoadingRef.current) {
        console.log('[BREAKOUT] Skipping fetch - already in progress')
        return
      }

      isLoadingRef.current = true
      const isInitialLoad = gainers.length === 0 && losers.length === 0

      // Only show loading spinner on initial load
      if (isInitialLoad) {
        setIsLoading(true)
      }

      // Don't clear existing data on refresh
      if (!isInitialLoad) {
        // Keep existing data visible during background refresh
      } else {
        setGainers([])
        setLosers([])
      }

      const breakoutStocks: BreakoutStock[] = []
      const breakdownStocks: BreakoutStock[] = []

      try {
        console.time('[BREAKOUT] Total fetch time')

        // TRY NEW API FIRST (fast!)
        try {
          console.time('[BREAKOUT] Fetch from new breakout snapshots API')
          const newApiRes = await fetch('/api/breakouts', { cache: 'no-store' })

          if (newApiRes.ok) {
            const newApiData = await newApiRes.json()
            console.timeEnd('[BREAKOUT] Fetch from new breakout snapshots API')

            if (newApiData.success && (newApiData.breakouts.length > 0 || newApiData.breakdowns.length > 0)) {
              console.log('✅ Using NEW breakout snapshots API (instant!)')

              // Map to existing format
              const mappedBreakouts: BreakoutStock[] = newApiData.breakouts.map((s: any) => ({
                symbol: s.symbol,
                name: s.symbol,
                ltp: parseFloat(s.ltp),
                dayChange: parseFloat(s.ltp) - parseFloat(s.yesterday_high || s.ltp),
                dayChangePerc: parseFloat(s.breakout_percent),
                volume: 0,
                prevDayHigh: parseFloat(s.yesterday_high),
                prevDayLow: parseFloat(s.yesterday_low || s.yesterday_high),
                prevDayClose: s.today_close || parseFloat(s.yesterday_high),
                prevDayOpen: s.today_open || parseFloat(s.yesterday_high),
                isBreakout: true,
              }))

              const mappedBreakdowns: BreakoutStock[] = newApiData.breakdowns.map((s: any) => ({
                symbol: s.symbol,
                name: s.symbol,
                ltp: parseFloat(s.ltp),
                dayChange: parseFloat(s.yesterday_low) - parseFloat(s.ltp),
                dayChangePerc: parseFloat(s.breakdown_percent),
                volume: 0,
                prevDayHigh: parseFloat(s.yesterday_low), // For breakdowns, we care about yesterday_low
                prevDayLow: parseFloat(s.yesterday_low),
                prevDayClose: s.today_close || parseFloat(s.yesterday_low),
                prevDayOpen: s.today_open || parseFloat(s.yesterday_low),
                isBreakout: false,
              }))

              setGainers(mappedBreakouts)
              setLosers(mappedBreakdowns)
              setUsingDatabase(true)
              setIsLoading(false)
              isLoadingRef.current = false
              console.timeEnd('[BREAKOUT] Total fetch time')
              return // Exit early - we got the data!
            }
          }
        } catch (newApiError) {
          console.log('New API not available, falling back to old method')
        }

        // FALLBACK TO OLD METHOD if new API didn't work
        // STEP 1: Try to fetch yesterday's high-low data from database
        console.time('[BREAKOUT] Fetch daily high-low from DB')
        const dailyHighLowRes = await fetch('/api/daily-high-low')
        const dailyHighLowData = await dailyHighLowRes.json()
        console.timeEnd('[BREAKOUT] Fetch daily high-low from DB')
        console.log('[BREAKOUT] DB data count:', dailyHighLowData.count)

        const hasDbData = dailyHighLowData.success && dailyHighLowData.data && dailyHighLowData.data.length > 0

        // Check if database data is from today (won't work for breakouts)
        let isDataFromToday = false
        if (hasDbData && dailyHighLowData.data.length > 0) {
          const firstRecord = dailyHighLowData.data[0]
          const capturedDate = firstRecord.captured_date
          const today = new Date().toISOString().split('T')[0]
          isDataFromToday = capturedDate === today

          if (isDataFromToday) {
            console.log('⚠️ Database has today\'s data - need yesterday\'s data for breakouts. Falling back to Yahoo Finance.')
          }
        }

        if (hasDbData && !isDataFromToday) {
          // USE DATABASE DATA (preferred - fast!)
          console.log('✅ Using database data for breakout/breakdown detection')
          setUsingDatabase(true)

          // Create a map for quick lookup
          console.time('[BREAKOUT] Create high-low map')
          const highLowMap = new Map<string, DailyHighLow>()
          dailyHighLowData.data.forEach((item: DailyHighLow) => {
            highLowMap.set(item.symbol, item)
          })
          console.timeEnd('[BREAKOUT] Create high-low map')
          console.log('[BREAKOUT] Mapped stocks:', highLowMap.size)

          // Fetch live LTP data PROGRESSIVELY in batches for better UX
          const allSymbols = Array.from(highLowMap.keys())
          console.time('[BREAKOUT] Fetch live LTP for all stocks')
          console.log('[BREAKOUT] Starting progressive loading...')

          const BATCH_SIZE = 20 // Fetch 20 stocks at a time
          let totalFetched = 0

          for (let i = 0; i < allSymbols.length; i += BATCH_SIZE) {
            const batch = allSymbols.slice(i, i + BATCH_SIZE)

            // Show "loading more" indicator for batches after the first
            if (i > 0) {
              setIsLoadingMore(true)
            }

            // Fetch this batch
            const { fetchStockData } = await import('@/services/momentumApi')
            const batchData = await fetchStockData(batch)
            totalFetched += batchData.length

            console.log(`[BREAKOUT] Batch ${Math.floor(i / BATCH_SIZE) + 1}: fetched ${batchData.length} stocks (total: ${totalFetched}/${allSymbols.length})`)

            // Hide loading spinner after first batch to show progressive results
            if (i === 0 && isInitialLoad) {
              setIsLoading(false)
            }

            // Process this batch immediately
            const validStocks = batchData.filter(stock => stock.ltp && stock.ltp > 0)

            validStocks.forEach(stock => {
              const highLowData = highLowMap.get(stock.symbol)
              if (!highLowData) return

              const ltp = stock.ltp
              const prevDayHigh = highLowData.today_high
              const prevDayLow = highLowData.today_low

              const stockData: BreakoutStock = {
                symbol: stock.symbol,
                name: stock.symbol,
                ltp: ltp,
                dayChange: stock.price - stock.close,
                dayChangePerc: stock.changePercent,
                volume: 0,
                prevDayHigh: prevDayHigh,
                prevDayLow: prevDayLow,
                prevDayClose: highLowData.today_close || stock.close,
                prevDayOpen: highLowData.today_open || stock.open,
              }

              // Check for BREAKOUT (LTP > yesterday's high)
              if (ltp > prevDayHigh) {
                breakoutStocks.push(stockData)
                // Update UI immediately with sorted data
                setGainers([...breakoutStocks].sort((a, b) => b.dayChangePerc - a.dayChangePerc))
              }

              // Check for BREAKDOWN (LTP < yesterday's low)
              if (ltp < prevDayLow) {
                breakdownStocks.push(stockData)
                // Update UI immediately with sorted data
                setLosers([...breakdownStocks].sort((a, b) => Math.abs(b.dayChangePerc) - Math.abs(a.dayChangePerc)))
              }
            })
          }

          console.timeEnd('[BREAKOUT] Fetch live LTP for all stocks')
          console.log('[BREAKOUT] Live data fetched:', totalFetched)
          console.log('[BREAKOUT] Breakouts found:', breakoutStocks.length)
          console.log('[BREAKOUT] Breakdowns found:', breakdownStocks.length)
          setIsLoadingMore(false)

        } else {
          // FALLBACK TO YAHOO FINANCE (for testing when DB is empty)
          console.log('⚠️ No database data - falling back to Yahoo Finance API')
          console.time('[BREAKOUT] Yahoo Finance fallback')
          setUsingDatabase(false)

          const allStockSymbols = getAllMappedStocks()
          const { fetchStockData } = await import('@/services/momentumApi')
          const liveStockData = await fetchStockData(allStockSymbols)
          const validStocks = liveStockData.filter(stock => stock.ltp && stock.ltp > 0)

          setIsLoading(false) // Show progress

          // Process in batches
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

            // Update UI progressively
            setGainers([...breakoutStocks].sort((a, b) => b.dayChangePerc - a.dayChangePerc))
            setLosers([...breakdownStocks].sort((a, b) => Math.abs(b.dayChangePerc) - Math.abs(a.dayChangePerc)))

            if (i + BATCH_SIZE < validStocks.length) {
              await new Promise(resolve => setTimeout(resolve, 200))
            }
          }
          console.timeEnd('[BREAKOUT] Yahoo Finance fallback')
        }

        // Final sort to ensure everything is in order
        console.time('[BREAKOUT] Sort results')
        setGainers(prev => [...prev].sort((a, b) => b.dayChangePerc - a.dayChangePerc))
        setLosers(prev => [...prev].sort((a, b) => Math.abs(b.dayChangePerc) - Math.abs(a.dayChangePerc)))
        console.timeEnd('[BREAKOUT] Sort results')
        setIsLoading(false)

        console.timeEnd('[BREAKOUT] Total fetch time')
        console.log(`✅ Found ${breakoutStocks.length} breakouts and ${breakdownStocks.length} breakdowns`)

        // Reset loading ref to allow next fetch
        isLoadingRef.current = false

      } catch (error) {
        console.error('Failed to fetch breakout stocks:', error)
        setIsLoading(false)
        isLoadingRef.current = false // Reset on error too
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
                  {usingDatabase
                    ? 'Stocks breaking previous day high/low (using saved database data)'
                    : 'Stocks breaking previous day high/low (using Yahoo Finance - run EOD capture for faster loading)'}
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
                    {!usingDatabase && (
                      <div className="text-xs text-gray-400 mt-2">
                        Tip: Run the EOD capture at 3:35 PM to populate the database for faster loading
                      </div>
                    )}
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
                        {isLoadingMore && gainers.length > 0 && (
                          <tr>
                            <td colSpan={4} className="px-4 py-4 text-center">
                              <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                                <div className="w-4 h-4 border-2 border-green-200 border-t-green-600 rounded-full animate-spin"></div>
                                <span>Loading more stocks...</span>
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
                    {!usingDatabase && (
                      <div className="text-xs text-gray-400 mt-2">
                        Tip: Run the EOD capture at 3:35 PM to populate the database for faster loading
                      </div>
                    )}
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
                        {isLoadingMore && losers.length > 0 && (
                          <tr>
                            <td colSpan={4} className="px-4 py-4 text-center">
                              <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                                <div className="w-4 h-4 border-2 border-red-200 border-t-red-600 rounded-full animate-spin"></div>
                                <span>Loading more stocks...</span>
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
