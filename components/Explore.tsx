'use client'

export default function Explore() {
  const features = [
    {
      title: 'Real-Time Market Data',
      description:
        'Get live updates on stocks, commodities, and currencies with real-time price tracking.',
      icon: '📊',
    },
    {
      title: 'Advanced Analytics',
      description:
        'Comprehensive charts, indicators, and technical analysis tools to make informed decisions.',
      icon: '📈',
    },
    {
      title: 'Portfolio Management',
      description:
        'Track and manage all your investments from one unified dashboard.',
      icon: '💼',
    },
    {
      title: 'Risk Management',
      description:
        'Built-in risk assessment tools and stop-loss features to protect your capital.',
      icon: '🛡️',
    },
    {
      title: 'Mobile Trading',
      description:
        'Trade on the go with our fully-featured mobile app for iOS and Android.',
      icon: '📱',
    },
    {
      title: '24/7 Support',
      description:
        'Round-the-clock customer support to help you with any trading queries.',
      icon: '💬',
    },
  ]

  return (
    <section
      id="explore"
      className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-white to-gray-50 scroll-mt-20"
    >
      <div className="container mx-auto">
        <div className="text-center mb-20">
          <div className="inline-block mb-4">
            <span className="px-4 py-2 bg-black text-white rounded-full text-sm font-semibold">
              Features
            </span>
          </div>
          <h2 className="text-5xl sm:text-6xl font-extrabold text-black mb-6">
            Everything You Need to
            <br />
            <span className="text-gray-600">Trade Successfully</span>
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Discover powerful tools designed to enhance your trading experience and maximize your returns
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-20">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group bg-white rounded-2xl p-8 border border-gray-100 hover:border-black transition-all duration-300 hover:shadow-2xl hover:-translate-y-2"
            >
              <div className="w-16 h-16 bg-black rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <span className="text-3xl">{feature.icon}</span>
              </div>
              <h3 className="text-2xl font-bold text-black mb-4">
                {feature.title}
              </h3>
              <p className="text-gray-600 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>

        {/* Modern Screenshot Placeholders */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="relative group">
            <div className="bg-gradient-to-br from-gray-900 to-black rounded-3xl p-8 shadow-2xl transform group-hover:scale-[1.02] transition-transform duration-500">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex space-x-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  </div>
                  <div className="text-white text-sm font-medium">Mobile App</div>
                </div>
                <div className="bg-gray-800 rounded-xl p-6 space-y-4">
                  <div className="h-4 bg-gray-700 rounded w-3/4"></div>
                  <div className="h-32 bg-gradient-to-br from-gray-700 to-gray-900 rounded-lg"></div>
                  <div className="flex space-x-2">
                    <div className="flex-1 h-8 bg-gray-700 rounded"></div>
                    <div className="flex-1 h-8 bg-gray-700 rounded"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="relative group">
            <div className="bg-white rounded-3xl p-8 shadow-2xl border border-gray-200 transform group-hover:scale-[1.02] transition-transform duration-500">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="text-black font-bold text-lg">Dashboard</div>
                  <div className="flex space-x-2">
                    <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-xl p-6 space-y-4">
                  <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                  <div className="h-40 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex items-end justify-center p-4">
                    <div className="w-full flex items-end space-x-1 h-24">
                      {[40, 60, 45, 70, 55, 80, 65, 90].map((h, i) => (
                        <div key={i} className="flex-1 bg-black rounded-t" style={{ height: `${h}%` }}></div>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="h-12 bg-gray-100 rounded-lg"></div>
                    <div className="h-12 bg-gray-100 rounded-lg"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

