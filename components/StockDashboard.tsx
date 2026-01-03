'use client';

import { useState } from 'react';
import { TrendingUp, TrendingDown, Search, RefreshCw, AlertCircle } from 'lucide-react';

interface StockData {
    symbol: string;
    date: string;
    data: {
        open: number;
        high: number;
        low: number;
        close: number;
        volume: number;
        change: number;
        changePercent: number;
    };
}

export default function StockDashboard() {
    const [symbol, setSymbol] = useState('RELIANCE');
    const [exchange, setExchange] = useState('NSE');
    const [loading, setLoading] = useState(false);
    const [stockData, setStockData] = useState<StockData | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Yahoo Finance API endpoint (public, no auth needed)
    const fetchStockData = async (symbolOverride?: string) => {
        setLoading(true);
        setError(null);
        setStockData(null);

        const targetSymbol = symbolOverride || symbol;

        try {
            // Format symbol for Yahoo Finance
            const suffix = exchange === 'NSE' ? '.NS' : '.BO';
            const yahooSymbol = targetSymbol.toUpperCase().endsWith('.NS') || targetSymbol.toUpperCase().endsWith('.BO')
                ? targetSymbol.toUpperCase()
                : `${targetSymbol.toUpperCase()}${suffix}`;

            // Yahoo Finance public API endpoint
            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=5d`;

            const response = await fetch(url);

            if (!response.ok) {
                throw new Error('Failed to fetch stock data. Possible CORS issue or invalid symbol.');
            }

            const data = await response.json();

            // Check if data exists
            if (!data.chart?.result?.[0]) {
                throw new Error('No data found for this symbol');
            }

            const result = data.chart.result[0];
            const quote = result.indicators.quote[0];
            const timestamps = result.timestamp;

            // Get the last trading day data
            // Filter out any null values which can happen in Yahoo Finance data
            let lastIndex = timestamps.length - 1;
            while (lastIndex >= 0 && (quote.open[lastIndex] === null || quote.close[lastIndex] === null)) {
                lastIndex--;
            }

            if (lastIndex < 0) {
                throw new Error('No valid trading data found');
            }

            const lastTimestamp = timestamps[lastIndex];
            const lastDate = new Date(lastTimestamp * 1000);

            const lastDayData = {
                open: quote.open[lastIndex],
                high: quote.high[lastIndex],
                low: quote.low[lastIndex],
                close: quote.close[lastIndex],
                volume: quote.volume[lastIndex]
            };

            // Calculate change
            const dayChange = lastDayData.close - lastDayData.open;
            const dayChangePercent = (dayChange / lastDayData.open) * 100;

            setStockData({
                symbol: yahooSymbol,
                date: lastDate.toISOString().split('T')[0],
                data: {
                    open: lastDayData.open,
                    high: lastDayData.high,
                    low: lastDayData.low,
                    close: lastDayData.close,
                    volume: lastDayData.volume,
                    change: parseFloat(dayChange.toFixed(2)),
                    changePercent: parseFloat(dayChangePercent.toFixed(2))
                }
            });

        } catch (err: any) {
            console.error('Error:', err);
            setError(err.message || 'Failed to fetch stock data. Please check the symbol and try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            fetchStockData();
        }
    };

    const isPositive = stockData?.data?.change !== undefined ? stockData.data.change >= 0 : false;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 md:p-8">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 md:p-8 mb-6 border border-white/20">
                    <div className="flex items-center gap-3 mb-4">
                        <TrendingUp className="w-8 md:w-10 h-8 md:h-10 text-emerald-400" />
                        <h1 className="text-2xl md:text-4xl font-bold text-white">
                            Stock Market Dashboard
                        </h1>
                    </div>

                    <p className="text-white/70 text-sm md:text-base">
                        Get previous day high values - 100% Client-Side, No Backend Required! 🚀
                    </p>
                </div>

                {/* Input Section */}
                <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 mb-6 border border-white/20">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-white/80 mb-2">
                                Stock Symbol
                            </label>
                            <input
                                type="text"
                                value={symbol}
                                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                                onKeyPress={handleKeyPress}
                                className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                placeholder="RELIANCE, TCS, INFY"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-white/80 mb-2">
                                Exchange
                            </label>
                            <select
                                value={exchange}
                                onChange={(e) => setExchange(e.target.value)}
                                className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            >
                                <option value="NSE">NSE</option>
                                <option value="BSE">BSE</option>
                            </select>
                        </div>

                        <div className="flex items-end">
                            <button
                                onClick={() => fetchStockData()}
                                disabled={loading}
                                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 rounded-lg transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <>
                                        <RefreshCw className="w-5 h-5 animate-spin" />
                                        Loading...
                                    </>
                                ) : (
                                    <>
                                        <Search className="w-5 h-5" />
                                        Fetch Data
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 mb-6 flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-red-200 font-medium">Error</p>
                            <p className="text-red-200/80 text-sm mt-1">{error}</p>
                        </div>
                    </div>
                )}

                {/* Stock Data Display */}
                {stockData && (
                    <div className="space-y-6">
                        {/* Main Card */}
                        <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-lg rounded-2xl p-6 md:p-8 border border-white/20">
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
                                <div>
                                    <h2 className="text-2xl md:text-3xl font-bold text-white">
                                        {stockData.symbol}
                                    </h2>
                                    <p className="text-white/60 mt-1 text-sm md:text-base">
                                        Previous Trading Day: {stockData.date}
                                    </p>
                                </div>

                                <div className={`flex items-center gap-2 px-4 py-2 rounded-lg self-start ${isPositive
                                    ? 'bg-emerald-500/20 text-emerald-400'
                                    : 'bg-red-500/20 text-red-400'
                                    }`}>
                                    {isPositive ? (
                                        <TrendingUp className="w-5 h-5" />
                                    ) : (
                                        <TrendingDown className="w-5 h-5" />
                                    )}
                                    <span className="font-semibold">
                                        {stockData.data.changePercent > 0 ? '+' : ''}
                                        {stockData.data.changePercent.toFixed(2)}%
                                    </span>
                                </div>
                            </div>

                            {/* OHLC Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                                    <div className="text-white/60 text-xs md:text-sm mb-1">Open</div>
                                    <div className="text-xl md:text-2xl font-bold text-white">
                                        ₹{stockData.data.open.toFixed(2)}
                                    </div>
                                </div>

                                <div className="bg-emerald-500/10 rounded-xl p-4 border border-emerald-500/30">
                                    <div className="text-emerald-400 text-xs md:text-sm mb-1">High ⬆️</div>
                                    <div className="text-xl md:text-2xl font-bold text-emerald-400">
                                        ₹{stockData.data.high.toFixed(2)}
                                    </div>
                                </div>

                                <div className="bg-red-500/10 rounded-xl p-4 border border-red-500/30">
                                    <div className="text-red-400 text-xs md:text-sm mb-1">Low ⬇️</div>
                                    <div className="text-xl md:text-2xl font-bold text-red-400">
                                        ₹{stockData.data.low.toFixed(2)}
                                    </div>
                                </div>

                                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                                    <div className="text-white/60 text-xs md:text-sm mb-1">Close</div>
                                    <div className="text-xl md:text-2xl font-bold text-white">
                                        ₹{stockData.data.close.toFixed(2)}
                                    </div>
                                </div>
                            </div>

                            {/* Additional Info */}
                            <div className="mt-6 pt-6 border-t border-white/10">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <div className="text-white/60 text-sm">Volume</div>
                                        <div className="text-lg md:text-xl font-semibold text-white mt-1">
                                            {stockData.data.volume.toLocaleString()}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-white/60 text-sm">Day Change</div>
                                        <div className={`text-lg md:text-xl font-semibold mt-1 ${isPositive ? 'text-emerald-400' : 'text-red-400'
                                            }`}>
                                            {stockData.data.change > 0 ? '+' : ''}₹{stockData.data.change.toFixed(2)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Success Info */}
                        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
                            <p className="text-emerald-200 text-sm">
                                <strong>✅ 100% Client-Side:</strong> Data fetched directly from Yahoo Finance API.
                                No backend server required! Works in any React/Next.js app.
                            </p>
                        </div>
                    </div>
                )}

                {/* Quick Examples */}
                {!stockData && !loading && (
                    <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-6 md:p-8 border border-white/20">
                        <h3 className="text-xl font-bold text-white mb-4">
                            💡 Try These Popular Stocks
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ITC', 'WIPRO', 'SBIN', 'TATAMOTORS'].map(stock => (
                                <button
                                    key={stock}
                                    onClick={() => {
                                        setSymbol(stock);
                                        setExchange('NSE');
                                        fetchStockData(stock);
                                    }}
                                    className="bg-white/5 hover:bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white font-medium transition-colors text-sm md:text-base"
                                >
                                    {stock}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Features */}
                <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                    <h3 className="text-lg font-bold text-white mb-4">🎯 Features</h3>
                    <div className="grid md:grid-cols-2 gap-3 text-sm">
                        <div className="flex items-start gap-2">
                            <span className="text-emerald-400">✓</span>
                            <span className="text-white/70">No backend server required</span>
                        </div>
                        <div className="flex items-start gap-2">
                            <span className="text-emerald-400">✓</span>
                            <span className="text-white/70">100% client-side React</span>
                        </div>
                        <div className="flex items-start gap-2">
                            <span className="text-emerald-400">✓</span>
                            <span className="text-white/70">FREE Yahoo Finance data</span>
                        </div>
                        <div className="flex items-start gap-2">
                            <span className="text-emerald-400">✓</span>
                            <span className="text-white/70">No API key needed</span>
                        </div>
                        <div className="flex items-start gap-2">
                            <span className="text-emerald-400">✓</span>
                            <span className="text-white/70">NSE & BSE support</span>
                        </div>
                        <div className="flex items-start gap-2">
                            <span className="text-emerald-400">✓</span>
                            <span className="text-white/70">Real-time data</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
