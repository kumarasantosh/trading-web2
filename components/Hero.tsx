'use client'

export default function Hero() {
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden gradient-hero pt-20 px-4 sm:px-6 lg:px-8">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 right-20 w-96 h-96 bg-white opacity-5 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-white opacity-5 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      <div className="container mx-auto relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left Content */}
          <div className="text-center lg:text-left space-y-8">
            <div className="space-y-6">
              <div className="inline-block">
                <span className="px-4 py-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full text-white text-sm font-medium">
                  India's #1 Trading Platform
                </span>
              </div>
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-white leading-tight">
                India's Best
                <br />
                <span className="bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                  Toolkit for Trading
                </span>
              </h1>
              <p className="text-xl sm:text-2xl text-gray-300 max-w-2xl leading-relaxed">
                Empower your trading journey with real-time data, advanced analytics, 
                and professional-grade tools designed for modern investors.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <button
                onClick={() => scrollToSection('subscribe')}
                className="group relative bg-white text-black px-8 py-4 rounded-xl font-semibold text-lg overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-2xl"
              >
                <span className="relative z-10">Get Started</span>
                <div className="absolute inset-0 bg-gradient-to-r from-gray-100 to-white opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </button>
              <button
                onClick={() => scrollToSection('explore')}
                className="group bg-transparent border-2 border-white/30 text-white px-8 py-4 rounded-xl font-semibold text-lg backdrop-blur-sm hover:bg-white/10 hover:border-white/50 transition-all duration-300"
              >
                Explore Features
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-8 pt-8 border-t border-white/10">
              <div>
                <div className="text-3xl font-bold text-white">50K+</div>
                <div className="text-sm text-gray-400 mt-1">Active Users</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-white">₹100Cr+</div>
                <div className="text-sm text-gray-400 mt-1">Traded Volume</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-white">4.8★</div>
                <div className="text-sm text-gray-400 mt-1">User Rating</div>
              </div>
            </div>
          </div>

          {/* Right Content - Modern Dashboard Preview */}
          <div className="relative hidden lg:block">
            {/* Main Dashboard Card */}
            <div className="relative z-10 bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8 transform rotate-2 hover:rotate-0 transition-transform duration-500">
              <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between pb-4 border-b border-gray-200">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold">T</span>
                    </div>
                    <div>
                      <div className="font-bold text-black">Trading Dashboard</div>
                      <div className="text-xs text-gray-500">Live Market Data</div>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-xs text-gray-600">Live</span>
                  </div>
                </div>

                {/* Chart Area - Candlestick Chart */}
                <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl p-6 border border-gray-100">
                  <div className="relative h-40">
                    {(() => {
                      // Candlestick data: [open, high, low, close]
                      const candles = [
                        [65, 75, 60, 70],
                        [70, 78, 68, 72],
                        [72, 80, 70, 65],
                        [65, 72, 62, 68],
                        [68, 75, 66, 73],
                        [73, 82, 71, 78],
                        [78, 85, 76, 80],
                        [80, 88, 78, 85],
                        [85, 90, 83, 88],
                        [88, 95, 86, 92],
                        [92, 98, 90, 95],
                        [95, 100, 93, 98],
                      ]
                      
                      // Find global min and max for proper normalization
                      const allPrices = candles.flat()
                      const globalMin = Math.min(...allPrices)
                      const globalMax = Math.max(...allPrices)
                      const priceRange = globalMax - globalMin
                      
                      // Normalize price to chart height percentage
                      const normalize = (price: number) => {
                        return ((price - globalMin) / priceRange) * 100
                      }
                      
                      return (
                        <div className="absolute inset-0 flex items-end justify-between gap-0.5">
                          {candles.map((candle, i) => {
                            const [open, high, low, close] = candle
                            const isBullish = close > open
                            
                            const highPos = normalize(high)
                            const lowPos = normalize(low)
                            const openPos = normalize(open)
                            const closePos = normalize(close)
                            
                            const candleTop = Math.max(openPos, closePos)
                            const candleBottom = Math.min(openPos, closePos)
                            const candleHeight = Math.max(candleTop - candleBottom, 2)
                            
                            return (
                              <div key={i} className="flex-1 flex items-center justify-center relative h-full max-w-[8%]">
                                <div className="relative w-full h-full flex flex-col items-center justify-end">
                                  {/* Top wick (high to candle top) */}
                                  {highPos > candleTop && (
                                    <div 
                                      className={`absolute w-0.5 ${isBullish ? 'bg-green-500' : 'bg-red-500'}`}
                                      style={{ 
                                        bottom: `${candleTop}%`,
                                        height: `${highPos - candleTop}%`
                                      }}
                                    />
                                  )}
                                  
                                  {/* Candle body */}
                                  <div
                                    className={`absolute w-3/4 rounded-sm shadow-sm ${
                                      isBullish 
                                        ? 'bg-green-500 border border-green-600' 
                                        : 'bg-red-500 border border-red-600'
                                    }`}
                                    style={{ 
                                      bottom: `${candleBottom}%`,
                                      height: `${candleHeight}%`,
                                      minHeight: '3px'
                                    }}
                                  />
                                  
                                  {/* Bottom wick (candle bottom to low) */}
                                  {lowPos < candleBottom && (
                                    <div 
                                      className={`absolute w-0.5 ${isBullish ? 'bg-green-500' : 'bg-red-500'}`}
                                      style={{ 
                                        bottom: `${lowPos}%`,
                                        height: `${candleBottom - lowPos}%`
                                      }}
                                    />
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )
                    })()}
                  </div>
                  <div className="mt-4 flex justify-between text-xs text-gray-500">
                    <span>9:30 AM</span>
                    <span>3:30 PM</span>
                  </div>
                </div>

                {/* Stock List */}
                <div className="space-y-3">
                  {[
                    { name: 'NIFTY 50', price: '19,234.50', change: '+1.25%', positive: true },
                    { name: 'SENSEX', price: '64,123.45', change: '+0.89%', positive: true },
                    { name: 'RELIANCE', price: '2,456.78', change: '-0.45%', positive: false },
                  ].map((stock, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <div className="font-semibold text-black text-sm">{stock.name}</div>
                        <div className="text-xs text-gray-500">₹{stock.price}</div>
                      </div>
                      <div className={`font-semibold ${stock.positive ? 'text-green-600' : 'text-red-600'}`}>
                        {stock.change}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Background Card */}
            <div className="absolute top-8 left-8 -z-10 bg-gray-800/50 backdrop-blur-xl rounded-3xl shadow-2xl p-8 transform -rotate-3 w-full h-full"></div>
            
            {/* Floating Elements */}
            <div className="absolute -top-4 -right-4 w-24 h-24 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20"></div>
            <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-white/5 backdrop-blur-sm rounded-full border border-white/10"></div>
          </div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
        <button
          onClick={() => scrollToSection('explore')}
          className="text-white/60 hover:text-white transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </button>
      </div>
    </section>
  )
}

