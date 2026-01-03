import Header from '@/components/Header'
import Footer from '@/components/Footer'
import Link from 'next/link'

export default function TermsConditions() {
  return (
    <main className="min-h-screen">
      <Header />
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-4xl">
          <h1 className="text-4xl font-bold text-black mb-8">
            Terms & Conditions
          </h1>
          <div className="prose prose-lg max-w-none">
            <p className="text-gray-700 mb-4">
              Last updated: {new Date().toLocaleDateString()}
            </p>
            <div className="space-y-6 text-gray-700">
              <div>
                <h2 className="text-2xl font-bold text-black mb-3">
                  Acceptance of Terms
                </h2>
                <p>
                  By accessing and using this platform, you agree to be bound by
                  these Terms and Conditions. If you do not agree, please do not
                  use our services.
                </p>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-black mb-3">
                  User Responsibilities
                </h2>
                <p>
                  You are responsible for maintaining the confidentiality of your
                  account credentials and for all activities that occur under
                  your account.
                </p>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-black mb-3">
                  Service Availability
                </h2>
                <p>
                  We strive to maintain service availability but do not guarantee
                  uninterrupted access. We reserve the right to modify or
                  discontinue services at any time.
                </p>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-black mb-3">
                  Limitation of Liability
                </h2>
                <p>
                  We shall not be liable for any indirect, incidental, special,
                  or consequential damages arising from your use of the platform.
                </p>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-black mb-3">
                  Modifications
                </h2>
                <p>
                  We reserve the right to modify these terms at any time. Your
                  continued use of the platform constitutes acceptance of
                  modified terms.
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

