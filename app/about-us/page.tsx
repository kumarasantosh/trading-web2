import Header from '@/components/Header'
import Footer from '@/components/Footer'
import Link from 'next/link'

export default function AboutUs() {
  return (
    <main className="min-h-screen">
      <Header />
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-4xl">
          <h1 className="text-4xl font-bold text-black mb-8">About Us</h1>
          <div className="prose prose-lg max-w-none">
            <div className="space-y-6 text-gray-700">
              <p>
                Welcome to India's Best Toolkit for Trading. We are dedicated to
                providing traders and investors with the most comprehensive and
                user-friendly trading platform in India.
              </p>
              <div>
                <h2 className="text-2xl font-bold text-black mb-3">Our Mission</h2>
                <p>
                  Our mission is to democratize trading and investment by making
                  professional-grade tools and information accessible to
                  everyone, regardless of their experience level.
                </p>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-black mb-3">What We Offer</h2>
                <ul className="list-disc list-inside space-y-2">
                  <li>Real-time market data and analytics</li>
                  <li>Advanced charting and technical analysis tools</li>
                  <li>Comprehensive portfolio management</li>
                  <li>Risk management features</li>
                  <li>24/7 customer support</li>
                </ul>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-black mb-3">Our Team</h2>
                <p>
                  Our team consists of experienced traders, developers, and
                  financial experts who are passionate about creating the best
                  trading experience for our users.
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

