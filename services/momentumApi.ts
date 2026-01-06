// API Service for Momentum Dashboard
// This service handles all API calls to the Groww API

interface WidgetConfig {
  title: string
  description?: string
  filters?: Array<{
    id: string
    label: string
    type: 'dropdown' | 'radio' | 'date'
    options?: { value: string; label: string }[]
  }>
  columns: string[]
}

interface ApiResponse {
  config: WidgetConfig
  data: Record<string, any>[]
}

interface GrowwQuote {
  average_price?: number
  bid_quantity?: number
  bid_price?: number
  day_change?: number
  day_change_perc?: number
  upper_circuit_limit?: number
  lower_circuit_limit?: number
  ohlc?: {
    open: number
    high: number
    low: number
    close: number
  }
  last_price?: number
  volume?: number
  week_52_high?: number
  week_52_low?: number
}

interface GrowwLTP {
  [key: string]: {
    open: number
    close: number
    ltp: number
    high?: number
    low?: number
    dayChange?: number
    dayChangePerc?: number
  } | number  // Keep number for backwards compatibility with indices
}

interface GrowwOHLC {
  [key: string]: {
    open: number
    dayOpen: number
    high: number
    low: number
    close: number
  }
}

// Mock data generators for different tools
const generateMockData = (toolId: string): ApiResponse => {
  switch (toolId) {
    case 'intraday-gainers':
      return {
        config: {
          title: 'Intraday Gainers (Top 16)',
          description: 'Top 16 FNO stocks with highest intraday gains',
          columns: ['Direction', 'Stock Name', 'Percentage Change', 'Time', 'Sector'],
        },
        data: Array.from({ length: 16 }, (_, i) => ({
          'Direction': 'Bullish',
          'Stock Name': `STOCK${i + 1}`,
          'Percentage Change': (Math.random() * 10 + 2).toFixed(2),
          'Time': `${9 + Math.floor(Math.random() * 6)}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`,
          'Sector': ['IT', 'Banking', 'Pharma', 'Auto', 'FMCG'][Math.floor(Math.random() * 5)],
        })),
      }

    case 'intraday-losers':
      return {
        config: {
          title: 'Intraday Losers (Top 16)',
          description: 'Top 16 FNO stocks with highest intraday losses',
          columns: ['Direction', 'Stock Name', 'Percentage Change', 'Time', 'Sector'],
        },
        data: Array.from({ length: 16 }, (_, i) => ({
          'Direction': 'Bearish',
          'Stock Name': `STOCK${i + 1}`,
          'Percentage Change': (-(Math.random() * 10 + 2)).toFixed(2),
          'Time': `${9 + Math.floor(Math.random() * 6)}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`,
          'Sector': ['IT', 'Banking', 'Pharma', 'Auto', 'FMCG'][Math.floor(Math.random() * 5)],
        })),
      }

    case 'high-breakout':
      return {
        config: {
          title: 'Previous Day High Breakout',
          description: 'Stocks breaking previous day\'s high',
          filters: [
            {
              id: 'sector',
              label: 'Sector',
              type: 'dropdown',
              options: [
                { value: 'all', label: 'All Sectors' },
                { value: 'IT', label: 'IT' },
                { value: 'Banking', label: 'Banking' },
                { value: 'Pharma', label: 'Pharma' },
              ],
            },
            {
              id: 'direction',
              label: 'Direction',
              type: 'radio',
              options: [
                { value: 'all', label: 'All' },
                { value: 'bullish', label: 'Bullish' },
                { value: 'bearish', label: 'Bearish' },
              ],
            },
          ],
          columns: ['Stock Name', 'Percentage Change', 'Sector', 'Breakout Time'],
        },
        data: Array.from({ length: 20 }, (_, i) => ({
          'Stock Name': `STOCK${i + 1}`,
          'Percentage Change': (Math.random() * 5 + 1).toFixed(2),
          'Sector': ['IT', 'Banking', 'Pharma', 'Auto', 'FMCG'][Math.floor(Math.random() * 5)],
          'Breakout Time': `${9 + Math.floor(Math.random() * 6)}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`,
        })),
      }

    case 'low-breakdown':
      return {
        config: {
          title: 'Previous Day Low Breakdown',
          description: 'Stocks breaking previous day\'s low',
          filters: [
            {
              id: 'sector',
              label: 'Sector',
              type: 'dropdown',
              options: [
                { value: 'all', label: 'All Sectors' },
                { value: 'IT', label: 'IT' },
                { value: 'Banking', label: 'Banking' },
                { value: 'Pharma', label: 'Pharma' },
              ],
            },
          ],
          columns: ['Stock Name', 'Percentage Change', 'Sector', 'Breakdown Time'],
        },
        data: Array.from({ length: 20 }, (_, i) => ({
          'Stock Name': `STOCK${i + 1}`,
          'Percentage Change': (-(Math.random() * 5 + 1)).toFixed(2),
          'Sector': ['IT', 'Banking', 'Pharma', 'Auto', 'FMCG'][Math.floor(Math.random() * 5)],
          'Breakdown Time': `${9 + Math.floor(Math.random() * 6)}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`,
        })),
      }

    case 'sectoral-indices':
      return {
        config: {
          title: 'Sectoral Indices',
          description: 'Performance of various sectoral indices',
          columns: ['Sector Name', 'Percentage Change', 'Direction', 'Current Value'],
        },
        data: [
          { 'Sector Name': 'Banking', 'Percentage Change': 1.25, 'Direction': 'Bullish', 'Current Value': 45234.56 },
          { 'Sector Name': 'IT', 'Percentage Change': -0.45, 'Direction': 'Bearish', 'Current Value': 32145.67 },
          { 'Sector Name': 'Pharma', 'Percentage Change': 2.15, 'Direction': 'Bullish', 'Current Value': 23456.78 },
          { 'Sector Name': 'Auto', 'Percentage Change': 0.89, 'Direction': 'Bullish', 'Current Value': 18923.45 },
          { 'Sector Name': 'FMCG', 'Percentage Change': -0.23, 'Direction': 'Bearish', 'Current Value': 15678.90 },
          { 'Sector Name': 'Energy', 'Percentage Change': 1.67, 'Direction': 'Bullish', 'Current Value': 21234.56 },
          { 'Sector Name': 'Metals', 'Percentage Change': -1.12, 'Direction': 'Bearish', 'Current Value': 17890.12 },
          { 'Sector Name': 'Realty', 'Percentage Change': 0.56, 'Direction': 'Bullish', 'Current Value': 14567.89 },
        ],
      }

    default:
      return {
        config: {
          title: 'Market Data',
          description: 'Market data for selected tool',
          columns: ['Name', 'Value'],
        },
        data: [],
      }
  }
}

/**
 * Fetches widget data for a specific tool
 * TODO: Replace with actual Groww API integration
 */
export async function fetchWidgetData(
  toolId: string,
  filters: Record<string, string> = {}
): Promise<{
  title: string
  description?: string
  filters?: any[]
  columns: string[]
  data: Record<string, any>[]
}> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 500))

  // TODO: Replace with actual API call
  // Example:
  // const response = await fetch(`/api/momentum/${toolId}?${new URLSearchParams(filters)}`)
  // return await response.json()

  const mockResponse = generateMockData(toolId)

  // Apply filters if needed (in real implementation, this would be done on backend)
  let filteredData = mockResponse.data
  if (filters.sector && filters.sector !== 'all') {
    filteredData = filteredData.filter((row) => row['Sector'] === filters.sector)
  }

  return {
    title: mockResponse.config.title,
    description: mockResponse.config.description,
    filters: mockResponse.config.filters,
    columns: mockResponse.config.columns,
    data: filteredData,
  }
}

/**
 * Fetches market carousel data from NSE API (more accurate percentChange)
 */
export async function fetchMarketData(): Promise<any[]> {
  try {
    // Try to fetch from database first (has correct previous close values)
    try {
      const response = await fetch('/api/market-indices', {
        cache: 'no-store',
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success && result.indices && Array.isArray(result.indices) && result.indices.length > 0) {
          const hasValidData = result.indices.some((idx: any) => idx.value && idx.value > 0)
          if (hasValidData) {

            return result.indices
          }
        }
      }
    } catch (dbError) {

    }

    // Fallback to Groww API
    return await fetchMarketDataFromGroww()
  } catch (error) {
    console.error('Error fetching market data:', error)
    // Return fallback data on error
    return [
      { name: 'NIFTY 50', value: 0, change: 0, changePercent: 0 },
      { name: 'NIFTY BANK', value: 0, change: 0, changePercent: 0 },
      { name: 'SENSEX', value: 0, change: 0, changePercent: 0 },
      { name: 'FINNIFTY', value: 0, change: 0, changePercent: 0 },
      { name: 'NIFTY MIDCAP', value: 0, change: 0, changePercent: 0 },
      { name: 'INDIA_VIX', value: 0, change: 0, changePercent: 0 },
    ]
  }
}

/**
 * Fallback function to fetch market data from Groww API
 * Used when NSE API fails or returns no data
 */
async function fetchMarketDataFromGroww(): Promise<any[]> {
  try {
    // Market indices symbols
    const marketSymbols = [
      'NSE_NIFTY 50',
      'BSE_SENSEX',
      'NSE_NIFTY BANK',
      'NSE_NIFTY FIN SERVICE',
      'NSE_NIFTY MIDCAP 100',
      'NSE_INDIA VIX',
    ]

    // Fetch LTP
    const url = new URL('/api/groww/ltp', window.location.origin)
    url.searchParams.append('segment', 'CASH')
    url.searchParams.append('exchange_symbols', marketSymbols.join(','))
    url.searchParams.append('_t', Date.now().toString())

    const ltpResponse = await fetch(url.toString(), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
      cache: 'no-store',
    })

    if (!ltpResponse.ok) {
      throw new Error('Failed to fetch LTP data')
    }

    const ltpData: GrowwLTP = await ltpResponse.json()

    // Fetch OHLC
    const ohlcUrl = new URL('/api/groww/ohlc', window.location.origin)
    ohlcUrl.searchParams.append('segment', 'CASH')
    ohlcUrl.searchParams.append('exchange_symbols', marketSymbols.join(','))
    ohlcUrl.searchParams.append('_t', Date.now().toString())

    const ohlcResponse = await fetch(ohlcUrl.toString(), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
      cache: 'no-store',
    })

    const ohlcData: GrowwOHLC = ohlcResponse.ok ? await ohlcResponse.json() : {}

    // Map symbols to display names
    const symbolMap: Record<string, string> = {
      'NSE_NIFTY 50': 'NIFTY 50',
      'BSE_SENSEX': 'SENSEX',
      'NSE_NIFTY BANK': 'NIFTY BANK',
      'NSE_NIFTY FIN SERVICE': 'FINNIFTY',
      'NSE_NIFTY MIDCAP 100': 'NIFTY MIDCAP',
      'NSE_INDIA VIX': 'INDIA_VIX',
    }

    // Process data
    const indices = marketSymbols.map((symbol) => {
      const ltpResponse = ltpData[symbol]
      const ohlc = ohlcData[symbol]

      // Handle LTP - indices return numbers, stocks return objects
      let ltp: number = 0
      if (typeof ltpResponse === 'number' && ltpResponse > 0) {
        ltp = ltpResponse
      } else if (typeof ltpResponse === 'object' && ltpResponse !== null && ltpResponse.ltp) {
        ltp = ltpResponse.ltp
      } else if (ohlc?.close) {
        // Fallback to OHLC close if LTP is not available
        ltp = ohlc.close
      }

      // Get previous close from OHLC data
      // For intraday change, we use dayOpen or close from yesterday
      const previousClose = ohlc?.dayOpen || ohlc?.open || ohlc?.close || 0

      // Calculate change only if we have valid data
      const change = previousClose > 0 && ltp > 0 ? ltp - previousClose : 0
      const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0

      return {
        name: symbolMap[symbol] || symbol,
        value: ltp,
        change: change,
        changePercent: changePercent,
      }
    }).filter(idx => idx.value > 0) // Only return indices with valid data

    // Return in preferred order
    const order = ['NIFTY 50', 'NIFTY BANK', 'FINNIFTY', 'NIFTY MIDCAP', 'SENSEX', 'INDIA_VIX']
    const sorted = order.map(name =>
      indices.find(idx => idx.name === name)
    ).filter(Boolean) as any[]

    // Special handling for SENSEX - fetch previous day close from Yahoo Finance
    const sensexIndex = sorted.findIndex(idx => idx.name === 'SENSEX')
    if (sensexIndex !== -1 && sorted[sensexIndex]) {
      try {
        const { fetchYahooStockData } = await import('@/services/yahooFinance')
        const yahooData = await fetchYahooStockData('^BSESN') // SENSEX symbol on Yahoo Finance

        if (yahooData && yahooData.close > 0) {
          const currentValue = sorted[sensexIndex].value
          const prevClose = yahooData.close
          const change = currentValue - prevClose
          const changePercent = (change / prevClose) * 100

          console.log(`[Groww] SENSEX corrected with Yahoo Finance: current=${currentValue}, prevClose=${prevClose}, change=${change}, changePercent=${changePercent}`)

          sorted[sensexIndex] = {
            ...sorted[sensexIndex],
            change: change,
            changePercent: changePercent,
          }
        }
      } catch (yahooError) {
        // Silently fail - will use Groww data
      }
    }

    return sorted.length > 0 ? sorted : indices
  } catch (error) {
    console.error('Error in fetchMarketDataFromGroww:', error)
    throw error
  }
}

/**
 * Symbol mapping for stocks that might have different names in the API
 * Maps common symbol variations to the correct API symbol
 */
const SYMBOL_ALIASES: Record<string, string> = {
  'ICICIPRULI': 'ICICIPRULI', // Keep original, but can be changed if needed
  'JIOFIN': 'JIOFIN', // Keep original, but can be changed if needed
}

/**
 * Fetches LTP data for a list of stocks
 */
export async function fetchStockData(symbols: string[]): Promise<{ symbol: string; price: number; changePercent: number; close: number; open: number; ltp: number }[]> {
  try {
    // Map symbols through aliases if needed
    const mappedSymbols = symbols.map(s => SYMBOL_ALIASES[s] || s)
    const formattedSymbols = mappedSymbols.map(s => s.includes(':') ? s.replace(':', '_') : `NSE_${s}`)
    const symbolsString = formattedSymbols.join(',')

    const url = new URL('/api/groww/ltp', window.location.origin)
    url.searchParams.append('segment', 'CASH')
    url.searchParams.append('exchange_symbols', symbolsString)

    const ltpResponse = await fetch(url.toString(), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    })

    if (!ltpResponse.ok) throw new Error('Failed to fetch LTP data')
    const ltpData: GrowwLTP = await ltpResponse.json()

    const ohlcUrl = new URL('/api/groww/ohlc', window.location.origin)
    ohlcUrl.searchParams.append('segment', 'CASH')
    ohlcUrl.searchParams.append('exchange_symbols', symbolsString)

    const ohlcResponse = await fetch(ohlcUrl.toString(), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    })

    const ohlcData: GrowwOHLC = ohlcResponse.ok ? await ohlcResponse.json() : {}

    return symbols.map(originalSymbol => {
      // Map through aliases
      const mappedSymbol = SYMBOL_ALIASES[originalSymbol] || originalSymbol
      const formattedSymbol = mappedSymbol.includes(':')
        ? mappedSymbol.replace(':', '_')
        : `NSE_${mappedSymbol}`

      const ltpResponse = ltpData[formattedSymbol]

      // Handle both object and number responses (indices return numbers, stocks return objects)
      let ltp: number, open: number, close: number

      if (typeof ltpResponse === 'object' && ltpResponse !== null) {
        // Stock response - full object
        ltp = ltpResponse.ltp || 0
        open = ltpResponse.open || 0
        close = ltpResponse.close || 0
      } else if (typeof ltpResponse === 'number' && ltpResponse > 0) {
        // Index response - just a number, fallback to OHLC
        ltp = ltpResponse
        const ohlc = ohlcData[formattedSymbol]
        close = ohlc?.close || 0
        open = ohlc?.dayOpen || ohlc?.open || 0
      } else {
        // No valid data for this symbol - return zeros
        ltp = 0
        open = 0
        close = 0
      }

      const baseValue = open || close || ltp // Use open as base, fallback to close
      const change = ltp - baseValue
      const changePercent = baseValue !== 0 ? (change / baseValue) * 100 : 0

      return {
        symbol: originalSymbol,
        price: ltp,
        changePercent,
        close,
        open,
        ltp
      }
    }).filter(stock => stock.ltp > 0) // Filter out stocks with invalid data
  } catch (error) {
    console.error('Error fetching stock data:', error)
    return []
  }
}

/**
 * Fetches data for sectoral indices
 */
export async function fetchSectorData(): Promise<{ name: string; previousClose: number; changePercent: number; open: number; last: number; variation: number; oneWeekAgoVal: number; oneMonthAgoVal: number; oneYearAgoVal: number }[]> {
  const sectors = [
    { name: 'Bank Nifty', nseIndex: 'NIFTY BANK' },
    { name: 'IT', nseIndex: 'NIFTY IT' },
    { name: 'Auto', nseIndex: 'NIFTY AUTO' },
    { name: 'Pharma', nseIndex: 'NIFTY PHARMA' },
    { name: 'FMCG', nseIndex: 'NIFTY FMCG' },
    { name: 'Metal', nseIndex: 'NIFTY METAL' },
    { name: 'Realty', nseIndex: 'NIFTY REALTY' },
    { name: 'Energy', nseIndex: 'NIFTY ENERGY' },
    { name: 'Financial Services', nseIndex: 'NIFTY FINANCIAL SERVICES' },
    { name: 'Private Bank', nseIndex: 'NIFTY PRIVATE BANK' },
    { name: 'PSU Bank', nseIndex: 'NIFTY PSU BANK' },
    { name: 'Infrastructure', nseIndex: 'NIFTY INFRASTRUCTURE' },
    { name: 'Consumer Durables', nseIndex: 'NIFTY CONSUMER DURABLES' },
    { name: 'Nifty MidSelect', nseIndex: 'NIFTY MIDCAP SELECT' },
    { name: 'Oil & Gas', nseIndex: 'NIFTY OIL & GAS' },
    { name: 'Consumption', nseIndex: 'NIFTY INDIA CONSUMPTION' },
  ]


  try {
    // Fetch all indices from NSE API
    const response = await fetch('/api/nse/indices', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    })

    if (!response.ok) throw new Error('Failed to fetch NSE indices')
    const nseData = await response.json()

    console.log('NSE API returned indices:', nseData.data?.map((d: any) => d.index).slice(0, 10))

    // NSE API returns data in format: { data: [ { index: "NIFTY 50", previousClose: 1413.6, percentChange: -0.15, open: 23750, last: 1419.75, variation: 6.15, ... }, ... ] }
    const indicesMap = new Map()
    if (nseData.data && Array.isArray(nseData.data)) {
      nseData.data.forEach((item: any) => {
        indicesMap.set(item.index, {
          previousClose: item.previousClose || 0,
          percentChange: item.percentChange || 0,
          open: item.open || 0,
          last: item.last || 0,
          variation: item.variation || 0,
          oneWeekAgoVal: item.oneWeekAgoVal || 0,
          oneMonthAgoVal: item.oneMonthAgoVal || 0,
          oneYearAgoVal: item.oneYearAgoVal || 0
        })
      })
    }

    const results = sectors.map(sector => {
      let data = indicesMap.get(sector.nseIndex)

      // Fallback: Try to find key by trimming if not found directly
      if (!data) {
        const matchingKey = Array.from(indicesMap.keys()).find(k => k.trim() === sector.nseIndex.trim())
        if (matchingKey) {
          data = indicesMap.get(matchingKey)
        }
      }

      data = data || { previousClose: 0, percentChange: 0, open: 0, last: 0, variation: 0, oneWeekAgoVal: 0, oneMonthAgoVal: 0, oneYearAgoVal: 0 }

      return {
        name: sector.name,
        previousClose: data.previousClose,
        changePercent: data.percentChange,
        open: data.open,
        last: data.last,
        variation: data.variation,
        oneWeekAgoVal: data.oneWeekAgoVal,
        oneMonthAgoVal: data.oneMonthAgoVal,
        oneYearAgoVal: data.oneYearAgoVal
      }
    })

    // Explicitly fetch Sensex data from Groww API since it's not in NSE indices
    let sensexData = {
      name: 'Sensex',
      previousClose: 0,
      changePercent: 0,
      open: 0,
      last: 0,
      variation: 0,
      oneWeekAgoVal: 0,
      oneMonthAgoVal: 0,
      oneYearAgoVal: 0
    }

    try {
      const sensexSymbol = 'BSE_SENSEX'

      const [ltpRes, ohlcRes] = await Promise.all([
        fetch(`/api/groww/ltp?exchange_symbols=${sensexSymbol}&segment=CASH`),
        fetch(`/api/groww/ohlc?exchange_symbols=${sensexSymbol}&segment=CASH`)
      ])

      if (ltpRes.ok && ohlcRes.ok) {
        const ltpData = await ltpRes.json()
        const ohlcData = await ohlcRes.json()

        const ltp = ltpData[sensexSymbol]?.ltp || ltpData[sensexSymbol] || 0
        const ohlc = ohlcData[sensexSymbol]

        if (ohlc) {
          sensexData = {
            name: 'Sensex',
            previousClose: ohlc.close,
            changePercent: ohlc.close ? ((ltp - ohlc.close) / ohlc.close) * 100 : 0,
            open: ohlc.open,
            last: ltp,
            variation: ltp - ohlc.close,
            oneWeekAgoVal: 0, // Not strictly needed for basic display
            oneMonthAgoVal: 0,
            oneYearAgoVal: 0
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch Sensex data:', err)
    }

    // Filter out empty NSE sectors and add Sensex
    const finalResults = results.filter(r => r.changePercent !== 0)
    if (sensexData.last !== 0) {
      finalResults.unshift(sensexData) // Add Sensex at the top
    }

    console.log('Sectors with data:', finalResults.length)
    return finalResults
  } catch (error) {
    console.error('Error fetching sector data from NSE:', error)
    return []
  }
}


