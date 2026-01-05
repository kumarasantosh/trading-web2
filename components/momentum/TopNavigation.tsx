'use client'

import { useState, useEffect, useRef } from 'react'
import TopGainersList from './TopGainersList'
import TopLosersList from './TopLosersList'

interface MarketIndex {
  name: string
  value: number
  change: number
  changePercent: number
}

interface TopNavigationProps {
  hideTopMovers?: boolean
}

export default function TopNavigation({ hideTopMovers = false }: TopNavigationProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState('F&O')
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  // Load accordion states from localStorage or use defaults
  // Initialize with false to prevent flash, then load from localStorage in useEffect
  const [isMarketIndicesOpen, setIsMarketIndicesOpen] = useState(false)
  const [isTopMoversOpen, setIsTopMoversOpen] = useState(false)

  // Load saved states from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedMarketIndices = localStorage.getItem('accordion_marketIndices')
        if (savedMarketIndices !== null) {
          setIsMarketIndicesOpen(savedMarketIndices === 'true')
        } else {
          setIsMarketIndicesOpen(true) // Default to open if no saved value
        }

        const savedTopMovers = localStorage.getItem('accordion_topMovers')
        if (savedTopMovers !== null) {
          setIsTopMoversOpen(savedTopMovers === 'true')
        } else {
          setIsTopMoversOpen(true) // Default to open if no saved value
        }
      } catch (e) {
        console.error('Error reading localStorage:', e)
        // If error, default to all open
        setIsMarketIndicesOpen(true)
        setIsTopMoversOpen(true)
      }
    }
  }, []) // Only run once on mount

  const [marketIndices, setMarketIndices] = useState<MarketIndex[]>([])
  const [dataSource, setDataSource] = useState<'live' | 'database'>('live')

  // Wrapper functions to update state and save to localStorage
  const handleMarketIndicesToggle = (value: boolean) => {
    setIsMarketIndicesOpen(value)
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('accordion_marketIndices', String(value))
      } catch (e) {
        console.error('Failed to save accordion state:', e)
      }
    }
  }

  const handleTopMoversToggle = (value: boolean) => {
    setIsTopMoversOpen(value)
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('accordion_topMovers', String(value))
      } catch (e) {
        console.error('Failed to save accordion state:', e)
      }
    }
  }

  useEffect(() => {
    const loadMarketData = async () => {
      try {
        // Check if it's after 3:30 PM IST (15:30 IST = 10:00 UTC)
        const now = new Date()
        const utcHour = now.getUTCHours()
        const utcMinutes = now.getUTCMinutes()
        // 3:30 PM IST = 10:00 AM UTC (IST = UTC + 5:30)
        // Market closes at 3:30 PM IST, so after 10:00 UTC we should use DB
        const isAfter330PM = utcHour > 10 || (utcHour === 10 && utcMinutes >= 0)

        // Also check if it's before market open (9:15 AM IST = 3:45 AM UTC)
        // If before market hours, also use DB
        const isBeforeMarketOpen = utcHour < 3 || (utcHour === 3 && utcMinutes < 45)

        // Use DB if after market close OR before market open
        const shouldUseDB = isAfter330PM || isBeforeMarketOpen

        console.log(`[TopNavigation] Current UTC time: ${utcHour}:${utcMinutes.toString().padStart(2, '0')}, isAfter330PM: ${isAfter330PM}, isBeforeMarketOpen: ${isBeforeMarketOpen}, shouldUseDB: ${shouldUseDB}`)

        if (shouldUseDB) {
          // After market close or before market open - try to use saved data from database first
          console.log('[TopNavigation] Market closed - attempting to fetch saved market indices from database')
          try {
            const response = await fetch('/api/market-indices', {
              cache: 'no-store',
            })

            if (response.ok) {
              const result = await response.json()
              // Check if we have valid data (not null, not empty array)
              if (result.success && result.indices && Array.isArray(result.indices) && result.indices.length > 0) {
                // Verify the data has actual values (not all zeros)
                const hasValidData = result.indices.some((idx: any) => idx.value && idx.value > 0)
                if (hasValidData) {
                  console.log(`[TopNavigation] ✅ Loaded ${result.indices.length} indices from database`)
                  // Filter out SMALLCAP indices
                  const filteredIndices = result.indices.filter((idx: any) =>
                    !idx.name.toUpperCase().includes('SMALLCAP')
                  )
                  setMarketIndices(filteredIndices)
                  setDataSource('database')
                  return
                } else {
                  console.log('[TopNavigation] ⚠️ Database data exists but all values are zero/null')
                }
              } else {
                console.log('[TopNavigation] ⚠️ Database returned empty or invalid data:', result)
              }
            } else {
              console.log(`[TopNavigation] ⚠️ API error: ${response.status}`)
            }
          } catch (error) {
            console.error('[TopNavigation] Error fetching from database:', error)
          }
          // If saved data not available or invalid, fall through to live fetch
          console.log('[TopNavigation] ⚠️ No valid saved data found in database, falling back to live fetch')
        }

        // During market hours (9:15 AM - 3:30 PM IST) or if saved data unavailable - fetch live data
        console.log('[TopNavigation] Market hours - fetching live market data from NSE/Groww APIs')
        const { fetchMarketData } = await import('@/services/momentumApi')
        const data = await fetchMarketData()
        // Filter out SMALLCAP indices
        const filteredData = data.filter((idx: any) =>
          !idx.name.toUpperCase().includes('SMALLCAP')
        )
        setMarketIndices(filteredData)
        setDataSource('live')
      } catch (error) {
        console.error('Error loading market data:', error)
        // Fallback data
        setMarketIndices([
          { name: 'NIFTY 50', value: 0, change: 0, changePercent: 0 },
          { name: 'NIFTY BANK', value: 0, change: 0, changePercent: 0 },
          { name: 'SENSEX', value: 0, change: 0, changePercent: 0 },
        ])
      }
    }

    loadMarketData()

    // Determine refresh interval based on market hours
    const checkMarketHours = () => {
      const now = new Date()
      const utcHour = now.getUTCHours()
      const utcMinutes = now.getUTCMinutes()
      const isAfter330PM = utcHour > 10 || (utcHour === 10 && utcMinutes >= 0)
      const isBeforeMarketOpen = utcHour < 3 || (utcHour === 3 && utcMinutes < 45)
      return isAfter330PM || isBeforeMarketOpen
    }

    // Use longer interval when market is closed (using DB) - 60 seconds
    // Use shorter interval during market hours (live data) - 10 seconds
    const refreshInterval = checkMarketHours() ? 60000 : 10000
    const interval = setInterval(loadMarketData, refreshInterval)
    return () => clearInterval(interval)
  }, [])

  const navLinks = [
    { name: 'Momentum', href: '/momentum' },
    { name: 'Option Data', href: '/option-chain' },
    { name: 'Breakout Stocks', href: '/breakout-stocks' }
  ]

  return (
    <div className="bg-white/95 backdrop-blur-md border-b border-gray-200/50">
      {/* Main Navigation Bar - Sticky */}
      <div className="bg-white/80 backdrop-blur-sm px-3 sm:px-4 lg:px-6 py-3 sm:py-4 border-b border-gray-200/50 sticky top-0 z-40 shadow-sm">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 lg:gap-0">
          {/* Top Row: Logo and Mobile Menu */}
          <div className="flex items-center justify-between w-full lg:w-auto">
            <div className="text-lg sm:text-xl lg:text-2xl font-extrabold bg-gradient-to-r from-black to-gray-700 bg-clip-text text-transparent">
              INTRADAY SCREENER
            </div>
            {/* Hamburger Menu Button - Mobile Only */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Toggle menu"
            >
              <svg
                className="w-6 h-6 text-gray-700"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {isMobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>

          {/* Center: Search Bar - Hidden on Mobile */}
          <div className="hidden lg:flex lg:flex-1 lg:max-w-xs lg:mx-2 xl:mx-4 order-3 lg:order-2">
            <div className="relative w-full">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Q Stock Search"
                className="w-full px-2 sm:px-3 py-1.5 sm:py-2 pl-7 sm:pl-8 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-xs sm:text-sm bg-white/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-all duration-200"
              />
              <svg
                className="absolute left-2 top-1.5 sm:top-2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {/* Right: Icons and Buttons */}
          <div className="flex items-center space-x-2 sm:space-x-3 lg:space-x-4 order-2 lg:order-3 w-full lg:w-auto justify-between lg:justify-end">
            <div className="flex items-center space-x-1 sm:space-x-2">
              <button className="hidden sm:inline-block p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <span className="text-gray-700 font-medium text-xs sm:text-sm">Tools</span>
              </button>
              <button className="hidden md:inline-block p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </button>
              <button className="hidden lg:inline-block p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </button>
              <button className="hidden lg:inline-block p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              </button>
            </div>
            <div className="hidden lg:flex space-x-1 sm:space-x-2">
              <button
                onClick={() => setActiveTab('F&O')}
                className={`px-3 sm:px-4 lg:px-5 py-2 sm:py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition-all duration-300 transform ${activeTab === 'F&O'
                  ? 'bg-green-500 text-white shadow-md scale-105'
                  : 'bg-white border-2 border-gray-200 text-gray-700 hover:bg-gray-50 hover:scale-105'
                  }`}
              >
                F&O
              </button>
              <button
                onClick={() => setActiveTab('CASH')}
                className={`px-3 sm:px-4 lg:px-5 py-2 sm:py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition-all duration-300 transform ${activeTab === 'CASH'
                  ? 'bg-green-500 text-white shadow-md scale-105'
                  : 'bg-white border-2 border-gray-200 text-gray-700 hover:bg-gray-50 hover:scale-105'
                  }`}
              >
                CASH
              </button>
            </div>
          </div>
        </div>
        {/* Desktop Nav Links */}
        <nav className="hidden lg:flex items-center space-x-6 mt-2 lg:mt-0">
          {navLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              className="text-gray-700 hover:text-black transition-all duration-200 font-semibold text-sm relative group"
            >
              {link.name}
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-green-500 to-emerald-500 group-hover:w-full transition-all duration-300"></span>
            </a>
          ))}
        </nav>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="lg:hidden border-t border-gray-200/50 mt-3 pt-3">
            <nav className="flex flex-col space-y-2">
              {navLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-gray-700 hover:text-black hover:bg-gray-50 transition-all duration-200 font-semibold text-sm px-3 py-2 rounded-lg"
                >
                  {link.name}
                </a>
              ))}
              {/* F&O and CASH Buttons */}
              <div className="flex space-x-2 px-3 pt-2">
                <button
                  onClick={() => {
                    setActiveTab('F&O')
                    setIsMobileMenuOpen(false)
                  }}
                  className={`flex-1 px-4 py-2 rounded-xl font-semibold text-sm transition-all duration-300 ${activeTab === 'F&O'
                    ? 'bg-green-500 text-white shadow-md'
                    : 'bg-white border-2 border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                >
                  F&O
                </button>
                <button
                  onClick={() => {
                    setActiveTab('CASH')
                    setIsMobileMenuOpen(false)
                  }}
                  className={`flex-1 px-4 py-2 rounded-xl font-semibold text-sm transition-all duration-300 ${activeTab === 'CASH'
                    ? 'bg-green-500 text-white shadow-md'
                    : 'bg-white border-2 border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                >
                  CASH
                </button>
              </div>
            </nav>
          </div>
        )}
      </div>

      {/* Market Indices Accordion */}
      <div className="bg-white/95 backdrop-blur-sm border-b border-gray-200/50">
        <button
          onClick={() => handleMarketIndicesToggle(!isMarketIndicesOpen)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors bg-gradient-to-r from-gray-50 to-gray-100"
        >
          <div className="flex items-center gap-2">
            <div className="w-1 h-6 bg-blue-500 rounded-full"></div>
            <span className="text-sm font-semibold text-gray-700">Market Indices</span>
          </div>
          <svg
            className={`w-5 h-5 text-gray-600 transition-transform duration-300 ${isMarketIndicesOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isMarketIndicesOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-2 sm:px-4 py-2 sm:py-3">
            <div className="flex flex-nowrap sm:flex-wrap gap-1.5 sm:gap-2 overflow-x-auto thin-scrollbar pb-1">
              {marketIndices.map((index) => (
                <div key={index.name} className="flex flex-col items-start bg-white/60 backdrop-blur-sm px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg border border-gray-200/50 hover:bg-white hover:shadow-md transition-all duration-200 min-w-fit flex-shrink-0">
                  <div className="text-[9px] sm:text-[10px] font-semibold text-gray-600 uppercase tracking-wide truncate w-full">{index.name}</div>
                  <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5 w-full">
                    <div className="text-xs sm:text-sm font-bold text-black truncate">{index.value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
                    <div className={`flex items-center flex-wrap gap-0.5 sm:space-x-1 ${index.change >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                      <span className="text-[10px] sm:text-xs font-bold">{index.change >= 0 ? '▲' : '▼'}</span>
                      <span className="text-[10px] sm:text-xs font-bold">{Math.abs(index.change).toFixed(2)}</span>
                      <span className={`text-[9px] sm:text-[10px] font-semibold px-1 sm:px-1.5 py-0.5 rounded ${index.change >= 0 ? 'bg-green-50' : 'bg-red-50'
                        }`}>
                        ({index.changePercent >= 0 ? '+' : ''}{index.changePercent.toFixed(2)}%)
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Top Movers Accordion - Combined Gainers and Losers */}
      {!hideTopMovers && (
        <div className="bg-white/95 backdrop-blur-sm border-b border-gray-200/50">
          <button
            onClick={() => handleTopMoversToggle(!isTopMoversOpen)}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <div className="w-1 h-6 bg-gradient-to-b from-green-500 to-red-500 rounded-full"></div>
              <span className="text-sm font-semibold text-gray-700">Top Movers</span>
            </div>
            <svg
              className={`w-5 h-5 text-gray-600 transition-transform duration-300 ${isTopMoversOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <div className={`transition-all duration-300 ease-in-out ${isTopMoversOpen ? 'max-h-[2000px] opacity-100 overflow-visible' : 'max-h-0 opacity-0 overflow-hidden'}`}>
            <div className="px-2 sm:px-4 pb-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Top Gainers */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-1 bg-green-500 rounded-full"></div>
                    <h3 className="text-sm font-bold text-gray-700">Top Gainers</h3>
                  </div>
                  <TopGainersList />
                </div>
                {/* Top Losers */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-1 bg-red-500 rounded-full"></div>
                    <h3 className="text-sm font-bold text-gray-700">Top Losers</h3>
                  </div>
                  <TopLosersList />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

