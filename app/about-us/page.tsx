import Header from '@/components/Header'
import Footer from '@/components/Footer'
import Link from 'next/link'

export default function AboutUs() {
  return (
    <main className="min-h-screen">
      <Header forceDarkText />
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-4xl">
          <h1 className="text-4xl font-bold text-black mb-8">About Us</h1>
          <div className="prose prose-lg max-w-none">
            <div className="space-y-6 text-gray-700">
              <p className="text-lg leading-relaxed">
                <strong className="text-black">E C Trade</strong> is a stock market analytical platform (tool) that provides some views of the market. It is an advanced screener with pre-defined strategies from the traders' view. So the traders get actionable insights.
              </p>

              <div>
                <h2 className="text-2xl font-bold text-black mb-3">What We Offer</h2>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li><strong>Momentum Analysis</strong> - Find top stocks that move intraday in futures and options segments under various sectors</li>
                  <li><strong>Options Intelligence</strong> - Open Interest and Change in Open Interest to identify institutional and big player positions</li>
                  <li><strong>Breakout Identification</strong> - Various kinds of breakout stock lists to help identify stock structure</li>
                </ul>
              </div>

              <div>
                <h2 className="text-2xl font-bold text-black mb-3">Our Approach</h2>
                <p>
                  We provide traders with pre-defined strategies and actionable insights based on market data analysis. Our platform is designed to help traders make informed decisions by presenting complex market information in an accessible format.
                </p>
              </div>

              <div className="bg-gray-50 border-l-4 border-black p-6 my-6">
                <p className="font-semibold text-black mb-2">
                  Educational Platform
                </p>
                <p className="text-sm">
                  ectrade.in is an independent technology platform providing educational tools and market analytics. We are not a SEBI registered adviser, analyst, or broker. All information is for educational purposes only.
                </p>
              </div>
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
