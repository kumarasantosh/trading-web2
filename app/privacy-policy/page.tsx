import Header from '@/components/Header'
import Footer from '@/components/Footer'
import Link from 'next/link'

export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen">
      <Header forceDarkText />
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-4xl">
          <h1 className="text-4xl font-bold text-black mb-8">Privacy Policy</h1>
          <div className="prose prose-lg max-w-none">
            <p className="text-gray-700 mb-4">
              Last updated: {new Date().toLocaleDateString()}
            </p>
            <div className="space-y-6 text-gray-700">
              <div>
                <h2 className="text-2xl font-bold text-black mb-3">
                  Information We Collect
                </h2>
                <p>We may collect:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Name, email address, and contact details (if provided)</li>
                  <li>Device, browser, IP address, and usage data</li>
                </ul>
              </div>

              <div>
                <h2 className="text-2xl font-bold text-black mb-3">
                  How We Use Your Information
                </h2>
                <p>Collected information is used to:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Provide and improve services</li>
                  <li>Communicate important updates</li>
                  <li>Ensure platform security</li>
                  <li>Comply with legal requirements</li>
                </ul>
                <div className="bg-blue-50 border-l-4 border-blue-400 p-4 my-4">
                  <p className="font-semibold text-blue-800">
                    We do not sell personal data.
                  </p>
                </div>
              </div>

              <div>
                <h2 className="text-2xl font-bold text-black mb-3">
                  Data Security
                </h2>
                <p>
                  Reasonable security measures are used to protect user data. However, no online system can be guaranteed to be completely secure.
                </p>
              </div>

              <div>
                <h2 className="text-2xl font-bold text-black mb-3">
                  Cookies
                </h2>
                <p>
                  Cookies may be used to improve user experience and analytics. Users can manage cookie settings via their browser.
                </p>
              </div>

              <div>
                <h2 className="text-2xl font-bold text-black mb-3">
                  Legal Compliance
                </h2>
                <p>
                  This platform complies with applicable Indian laws, including:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Information Technology Act, 2000</li>
                  <li>IT Rules, 2011</li>
                  <li>Digital Personal Data Protection Act, 2023 (as applicable)</li>
                </ul>
              </div>

              <div>
                <h2 className="text-2xl font-bold text-black mb-3">
                  Governing Law
                </h2>
                <p>
                  This privacy policy is governed by the laws of India. Any disputes shall be subject to Indian jurisdiction only.
                </p>
              </div>

              <div>
                <h2 className="text-2xl font-bold text-black mb-3">
                  Changes to Policy
                </h2>
                <p>
                  ectrade.in may update this policy from time to time. Continued use of the platform indicates acceptance of the updated policy.
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
