'use client'

import { useState, useEffect, useRef } from 'react'
import { UserButton, SignInButton, SignedIn, SignedOut } from '@clerk/nextjs'
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



        if (shouldUseDB) {
          // After market close or before market open - try to use saved data from database first

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

                  // Filter out SMALLCAP indices
                  const filteredIndices = result.indices.filter((idx: any) =>
                    !idx.name.toUpperCase().includes('SMALLCAP')
                  )
                  setMarketIndices(filteredIndices)
                  setDataSource('database')
                  return
                } else {

                }
              } else {

              }
            } else {

            }
          } catch (error) {
            console.error('[TopNavigation] Error fetching from database:', error)
          }
          // If saved data not available or invalid, fall through to live fetch

        }

        // During market hours (9:15 AM - 3:30 PM IST) or if saved data unavailable - fetch live data

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

    // Always use 10 second refresh interval for real-time updates
    const refreshInterval = 10000
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



          {/* Right: User Authentication */}
          <div className="flex items-center space-x-2 sm:space-x-3 order-2 lg:order-3">
            <SignedIn>
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: "w-8 h-8 sm:w-10 sm:h-10"
                  }
                }}
              />
            </SignedIn>
            <SignedOut>
              <SignInButton>
                <button className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:from-green-600 hover:to-emerald-600 transition-all duration-200 font-semibold text-sm shadow-md hover:shadow-lg">
                  Sign In
                </button>
              </SignInButton>
            </SignedOut>
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

