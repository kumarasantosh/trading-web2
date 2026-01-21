'use client'

import { useState, useEffect } from 'react'

interface MarketData {
  name: string
  value: number
  change: number
  changePercent: number
}

export default function MarketCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [markets, setMarkets] = useState<MarketData[]>([])

  useEffect(() => {
    // Fetch market data from API
    fetchMarketData()

    // Auto-scroll every 5 seconds
    const scrollInterval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % (markets.length || 1))
    }, 5000)

    // Refresh data every 5 seconds
    const dataInterval = setInterval(fetchMarketData, 5000)

    return () => {
      clearInterval(scrollInterval)
      clearInterval(dataInterval)
    }
  }, [markets.length])

  const fetchMarketData = async () => {
    try {
      const { fetchMarketData } = await import('@/services/momentumApi')
      const marketData = await fetchMarketData()
      setMarkets(marketData)
    } catch (error) {
      console.error('Error fetching market data:', error)
      // Fallback to empty array on error
      setMarkets([])
    }
  }

  const goToSlide = (index: number) => {
    setCurrentIndex(index)
  }

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + markets.length) % markets.length)
  }

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % markets.length)
  }

  if (markets.length === 0) {
    return (
      <div className="py-4 px-6 bg-gray-100">
        <div className="container mx-auto">
          <div className="h-16 flex items-center justify-center">
            <div className="text-gray-500">Loading market data...</div>
          </div>
        </div>
      </div>
    )
  }

  const currentMarket = markets[currentIndex]

  return (
    <div className="py-4 px-6 bg-gradient-to-r from-gray-900 to-black text-white">
      <div className="container mx-auto">
        <div className="flex items-center justify-between">
          {/* Previous Button */}
          <button
            onClick={goToPrevious}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            aria-label="Previous market"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Market Card */}
          <div className="flex-1 mx-8">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-400 mb-1">Market Index</div>
                <div className="text-2xl font-bold">{currentMarket.name}</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-400 mb-1">Current Value</div>
                <div className="text-2xl font-bold">{currentMarket.value.toLocaleString('en-IN')}</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-400 mb-1">Change</div>
                <div className={`text-2xl font-bold flex items-center ${currentMarket.change >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                  {currentMarket.change >= 0 ? '▲' : '▼'} {Math.abs(currentMarket.change).toFixed(2)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-400 mb-1">% Change</div>
                <div className={`text-2xl font-bold ${currentMarket.changePercent >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                  {currentMarket.changePercent >= 0 ? '+' : ''}{currentMarket.changePercent.toFixed(2)}%
                </div>
              </div>
            </div>
          </div>

          {/* Next Button */}
          <button
            onClick={goToNext}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            aria-label="Next market"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Dots Indicator */}
        <div className="flex justify-center mt-4 space-x-2">
          {markets.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`w-2 h-2 rounded-full transition-all ${index === currentIndex ? 'bg-white w-8' : 'bg-white/40'
                }`}
              aria-label={`Go to ${markets[index].name}`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

