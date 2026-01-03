import Header from '@/components/Header'
import Footer from '@/components/Footer'
import Link from 'next/link'

export default function Disclaimers() {
  return (
    <main className="min-h-screen">
      <Header />
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-4xl">
          <h1 className="text-4xl font-bold text-black mb-8">Disclaimers</h1>
          <div className="prose prose-lg max-w-none">
            <p className="text-gray-700 mb-4">
              Last updated: {new Date().toLocaleDateString()}
            </p>
            <div className="space-y-6 text-gray-700">
              <p>
                The information provided on this platform is for general
                informational purposes only. All investment and trading
                activities carry inherent risks, and you may lose some or all of
                your invested capital.
              </p>
              <p>
                Past performance is not indicative of future results. The value
                of investments can go down as well as up, and you may not get
                back the amount you invested.
              </p>
              <p>
                We do not provide financial, investment, or trading advice. All
                trading decisions should be made after careful consideration and
                consultation with qualified financial advisors.
              </p>
              <p>
                Market data and information provided on this platform are
                sourced from third parties and are provided "as is" without
                warranty of any kind.
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

