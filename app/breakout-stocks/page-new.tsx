import { useState, useEffect } from 'react'
import { fetchYahooStockData } from '@/services/yahooFinance'

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

    const getAllMappedStocks = () => {
        const { SECTOR_STOCKS } = require('@/constants/sector-stocks-mapping')
        const allStocks = new Set<string>()
        Object.values(SECTOR_STOCKS).forEach((stocks: any) => {
            stocks.forEach((stock: string) => allStocks.add(stock))
        })
        return allStocks
    }

    useEffect(() => {
        const fetchBreakoutStocks = async () => {
            setIsLoading(true)
            setGainers([])
            setLosers([])

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

                // Show initial results from top movers
                setGainers([...breakoutStocks].sort((a, b) => b.dayChangePerc - a.dayChangePerc))
                setLosers([...breakdownStocks].sort((a, b) => a.dayChangePerc - b.dayChangePerc))
                setIsLoading(false)

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
                    setLosers([...breakdownStocks].sort((a, b) => a.dayChangePerc - b.dayChangePerc))

                    if (i + BATCH_SIZE < validStocks.length) {
                        await new Promise(resolve => setTimeout(resolve, 200))
                    }
                }
            } catch (error) {
                console.error('Failed to fetch breakout stocks:', error)
                setIsLoading(false)
            }
        }

        fetchBreakoutStocks()
        const interval = setInterval(fetchBreakoutStocks, 300000)
        return () => clearInterval(interval)
    }, [])

    const handleStockClick = (symbol: string) => {
        window.open(`https://in.tradingview.com/chart/?symbol=NSE:${encodeURIComponent(symbol)}`, '_blank')
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
            {/* Rest of the JSX remains the same */}
        </div>
    )
}
