'use client'

export default function Explore() {
  const features = [
    {
      title: 'Momentum',
      description:
        'This help to find the top stocks that moves intraday in the future and option segment  under various sectors',
      icon: '🚀',
      href: '/momentum',
    },
    {
      title: 'Options',
      description:
        'Open interest and Change in Open Interest will help to find the institutional and big players positions.',
      icon: '📊',
      href: '/option-chain',
    },
    {
      title: 'Breakout',
      description:
        'Various kinds of breakout stocks lists help identify the structure of a stock.',
      icon: '📈',
      href: '/breakout-stocks',
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <a
              key={index}
              href={feature.href}
              className="group bg-white rounded-2xl p-8 border border-gray-100 hover:border-black transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 cursor-pointer block"
            >
              <div className="w-16 h-16 bg-black rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <span className="text-3xl">{feature.icon}</span>
              </div>
              <h3 className="text-2xl font-bold text-black mb-4">
                {feature.title}
              </h3>
              <p className="text-gray-600 leading-relaxed">{feature.description}</p>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}

