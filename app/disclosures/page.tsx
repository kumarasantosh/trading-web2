import Header from '@/components/Header'
import Footer from '@/components/Footer'
import Link from 'next/link'

export default function Disclosures() {
  return (
    <main className="min-h-screen">
      <Header />
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-4xl">
          <h1 className="text-4xl font-bold text-black mb-8">Disclosures</h1>
          <div className="prose prose-lg max-w-none">
            <p className="text-gray-700 mb-4">
              Last updated: {new Date().toLocaleDateString()}
            </p>
            <div className="space-y-6 text-gray-700">
              <div>
                <h2 className="text-2xl font-bold text-black mb-3">
                  Regulatory Compliance
                </h2>
                <p>
                  This platform operates in compliance with applicable Indian
                  financial regulations. We are committed to maintaining
                  transparency and adhering to all regulatory requirements.
                </p>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-black mb-3">
                  Data Security
                </h2>
                <p>
                  We implement industry-standard security measures to protect
                  your personal and financial information. All data is encrypted
                  and stored securely.
                </p>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-black mb-3">
                  Third-Party Services
                </h2>
                <p>
                  We may use third-party services for payment processing, data
                  analytics, and other operational functions. These services are
                  bound by their own privacy policies and terms of service.
                </p>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-black mb-3">
                  Conflict of Interest
                </h2>
                <p>
                  We maintain strict policies to avoid conflicts of interest. We
                  do not trade on behalf of users or provide investment advice
                  that could create conflicts.
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

