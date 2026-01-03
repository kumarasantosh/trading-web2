'use client'

export default function Partners() {
  const partners = [
    { name: 'NSE', logo: 'NSE' },
    { name: 'BSE', logo: 'BSE' },
    { name: 'Zerodha', logo: 'Zerodha' },
    { name: 'Upstox', logo: 'Upstox' },
    { name: 'Groww', logo: 'Groww' },
    { name: 'Paytm', logo: 'Paytm' },
  ]

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-gray-50 to-white">
      <div className="container mx-auto">
        <div className="text-center mb-16">
          <div className="inline-block mb-4">
            <span className="px-4 py-2 bg-black text-white rounded-full text-sm font-semibold">
              Partners
            </span>
          </div>
          <h2 className="text-4xl sm:text-5xl font-extrabold text-black mb-6">
            Trusted by Industry Leaders
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            The largest banks, funds and exchanges from all over the world
            cooperate with us.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 items-center">
          {partners.map((partner, index) => (
            <div
              key={index}
              className="group flex items-center justify-center p-8 bg-white rounded-2xl border-2 border-gray-100 hover:border-black transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
            >
              <span className="text-2xl font-bold text-gray-700 group-hover:text-black transition-colors">
                {partner.logo}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

