'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Stock {
    symbol: string
    open_price: number
    last_price: number
    percent_change: number
    volume: number
}

export default function TopMovers() {
    const router = useRouter()
    const [gainers, setGainers] = useState<Stock[]>([])
    const [losers, setLosers] = useState<Stock[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [updatedAt, setUpdatedAt] = useState<string>('')

    useEffect(() => {
        const fetchTopMovers = async (isBackground = false) => {
            if (!isBackground) setIsLoading(true)

            try {
                const response = await fetch('/api/top-movers', {
                    cache: 'no-store',
                })

                if (!response.ok) {
                    throw new Error('Failed to fetch top movers')
                }

                const data = await response.json()

                if (data.success) {
                    setGainers(data.gainers || [])
                    setLosers(data.losers || [])
                    setUpdatedAt(data.updated_at || '')
                }
            } catch (error) {
                console.error('Failed to fetch top movers:', error)
            } finally {
                if (!isBackground) setIsLoading(false)
            }
        }

        fetchTopMovers() // Initial load (shows spinner)
        const interval = setInterval(() => fetchTopMovers(true), 10000) // Background refresh every 10 seconds (no spinner)

        return () => clearInterval(interval)
    }, [])

    const handleStockClick = (symbol: string) => {
        // Decode first in case it's already encoded, then encode for URL
        const decodedSymbol = decodeURIComponent(symbol)
        window.open(`https://in.tradingview.com/chart/?symbol=NSE:${encodeURIComponent(decodedSymbol)}`, '_blank')
    }

    const renderStockRow = (stock: Stock, index: number, isGainer: boolean) => {
        return (
            <div
                key={stock.symbol}
                onClick={() => handleStockClick(stock.symbol)}
                className={`relative flex items-center gap-2 sm:gap-4 p-2 sm:p-2 rounded-lg transition-colors group cursor-pointer ${isGainer ? 'hover:bg-green-50' : 'hover:bg-red-50'
                    }`}
            >
                <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                    <span className="text-xs font-bold text-gray-400 w-5 sm:w-6 flex-shrink-0">{index + 1}</span>
                    <div className="min-w-0 flex-1">
                        <div className="font-semibold text-xs sm:text-sm text-gray-900 flex items-center gap-1">
                            {decodeURIComponent(stock.symbol)}
                        </div>
                        <div className="text-[10px] sm:text-xs text-gray-500">
                            Open: ₹{stock.open_price.toFixed(2)}
                        </div>
                    </div>
                </div>
                <div className="text-right flex-shrink-0">
                    <div className="font-semibold text-xs sm:text-sm text-gray-900">₹{stock.last_price.toFixed(2)}</div>
                    <div className={`text-[10px] sm:text-xs font-bold ${isGainer ? 'text-green-600' : 'text-red-600'}`}>
                        {isGainer ? '+' : ''}{stock.percent_change.toFixed(2)}%
                    </div>
                </div>
            </div>
        )
    }

    if (isLoading) {
        return (
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl border border-gray-200/50 shadow-xl p-6">
                <div className="flex items-center justify-center py-8">
                    <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Top Gainers and Losers */}
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl border border-gray-200/50 shadow-xl p-4 sm:p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 max-w-7xl mx-auto">
                    {/* Top Gainers */}
                    <div className="max-w-md lg:max-w-none">
                        <div className="flex items-center gap-2 mb-3 sm:mb-4">
                            <h3 className="text-base sm:text-lg font-bold text-gray-900">Top 10 Gainers</h3>
                            <div className="w-6 sm:w-8 h-1 bg-green-500 rounded-full"></div>
                        </div>
                        <div className="space-y-1.5 sm:space-y-2">
                            {gainers.length > 0 ? (
                                gainers.map((stock, index) => renderStockRow(stock, index, true))
                            ) : (
                                <div className="text-center text-gray-500 py-4">No gainers found</div>
                            )}
                        </div>
                    </div>

                    {/* Top Losers */}
                    <div className="max-w-md lg:max-w-none">
                        <div className="flex items-center gap-2 mb-3 sm:mb-4">
                            <h3 className="text-base sm:text-lg font-bold text-gray-900">Top 10 Losers</h3>
                            <div className="w-6 sm:w-8 h-1 bg-red-500 rounded-full"></div>
                        </div>
                        <div className="space-y-1.5 sm:space-y-2">
                            {losers.length > 0 ? (
                                losers.map((stock, index) => renderStockRow(stock, index, false))
                            ) : (
                                <div className="text-center text-gray-500 py-4">No losers found</div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Last Updated */}
                {updatedAt && (
                    <div className="text-center text-xs text-gray-400 mt-4">
                        Last updated: {new Date(updatedAt).toLocaleTimeString()}
                    </div>
                )}
            </div>
        </div>
    )
}


