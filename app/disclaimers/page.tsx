import Header from '@/components/Header'
import Footer from '@/components/Footer'
import Link from 'next/link'

export default function Disclaimers() {
  return (
    <main className="min-h-screen">
      <Header forceDarkText />
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-4xl">
          <h1 className="text-4xl font-bold text-black mb-8">Disclaimer</h1>
          <div className="prose prose-lg max-w-none">
            <p className="text-gray-700 mb-4">
              Last updated: {new Date().toLocaleDateString()}
            </p>
            <div className="space-y-6 text-gray-700">
              <p className="text-lg font-semibold text-black">
                ectrade.in is an independent technology platform that provides market tools, indicators, analytics, and educational content for traders.
              </p>

              <div>
                <h2 className="text-2xl font-bold text-black mb-3">We are NOT:</h2>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>A SEBI registered Investment Adviser</li>
                  <li>A SEBI registered Research Analyst</li>
                  <li>A Portfolio Manager or Stock Broker</li>
                </ul>
              </div>

              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 my-6">
                <p className="font-semibold text-yellow-800">
                  Nothing on this website should be considered as investment advice, trading advice, or a recommendation to buy, sell, or hold any security.
                </p>
              </div>

              <p>
                All content and tools provided on ectrade.in are for educational and informational purposes only. They are generic in nature and not tailored to individual financial situations.
              </p>

              <p>
                Users are solely responsible for their trading actions and decisions. We strongly recommend consulting with a SEBI-registered professional before making any trading or investment decisions.
              </p>
            </div>
            <div className="mt-8">
              <Link
                href="/"
                className="text-black hover:underline font-medium"
              >
                ← Back to Home
              </Link>
            </div>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  )
}
