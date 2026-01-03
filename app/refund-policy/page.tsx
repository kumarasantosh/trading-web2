import Header from '@/components/Header'
import Footer from '@/components/Footer'
import Link from 'next/link'

export default function RefundPolicy() {
  return (
    <main className="min-h-screen">
      <Header />
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-4xl">
          <h1 className="text-4xl font-bold text-black mb-8">Refund Policy</h1>
          <div className="prose prose-lg max-w-none">
            <p className="text-gray-700 mb-4">
              Last updated: {new Date().toLocaleDateString()}
            </p>
            <div className="space-y-6 text-gray-700">
              <div>
                <h2 className="text-2xl font-bold text-black mb-3">
                  Refund Eligibility
                </h2>
                <p>
                  Refunds may be requested within 7 days of subscription
                  purchase. To be eligible for a refund, you must not have
                  utilized premium features extensively.
                </p>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-black mb-3">
                  How to Request a Refund
                </h2>
                <p>
                  To request a refund, please contact our support team at
                  support@tradingtoolkit.in with your subscription details and
                  reason for refund.
                </p>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-black mb-3">
                  Processing Time
                </h2>
                <p>
                  Refunds will be processed within 5-7 business days after
                  approval. The refund will be credited to the original payment
                  method.
                </p>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-black mb-3">
                  Non-Refundable Items
                </h2>
                <p>
                  Services already consumed, premium features accessed, and
                  subscriptions older than 7 days are not eligible for refunds.
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

