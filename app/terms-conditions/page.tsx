import Header from '@/components/Header'
import Footer from '@/components/Footer'
import Link from 'next/link'

export default function TermsConditions() {
  return (
    <main className="min-h-screen">
      <Header forceDarkText />
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
                  Nature of Content and Tools
                </h2>
                <p>
                  All content and tools provided on ectrade.in are:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>For educational and informational purposes</li>
                  <li>Generic in nature</li>
                  <li>Not tailored to individual financial situations</li>
                </ul>
                <p className="mt-3">
                  Users are solely responsible for their trading actions.
                </p>
              </div>

              <div>
                <h2 className="text-2xl font-bold text-black mb-3">
                  Third-Party Services
                </h2>
                <p>
                  The platform may use or display:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Third-party market data</li>
                  <li>Charting tools</li>
                  <li>Broker or API integrations</li>
                </ul>
                <p className="mt-3">
                  ectrade.in is not responsible for data delays, errors, or service interruptions caused by third parties.
                </p>
              </div>

              <div>
                <h2 className="text-2xl font-bold text-black mb-3">
                  Limitation of Liability
                </h2>
                <p>
                  ectrade.in, its owners, and team members shall not be liable for:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Trading losses</li>
                  <li>Technical failures</li>
                  <li>Data inaccuracies</li>
                  <li>Any direct or indirect financial damage</li>
                </ul>
                <div className="bg-gray-100 border-l-4 border-gray-500 p-4 my-4">
                  <p className="font-semibold">
                    Use of the platform is entirely at the user's own risk.
                  </p>
                </div>
              </div>

              <div>
                <h2 className="text-2xl font-bold text-black mb-3">
                  User Responsibilities
                </h2>
                <p>
                  By using ectrade.in, users agree:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Not to misuse the platform</li>
                  <li>Not to copy, resell, or redistribute tools or content</li>
                  <li>To keep login credentials secure</li>
                </ul>
                <p className="mt-3">
                  Accounts may be suspended or terminated for violations.
                </p>
              </div>

              <div>
                <h2 className="text-2xl font-bold text-black mb-3">
                  Intellectual Property
                </h2>
                <p>
                  All content, tools, designs, code, and branding on ectrade.in are the property of ectrade.in and may not be used without written permission.
                </p>
              </div>

              <div>
                <h2 className="text-2xl font-bold text-black mb-3">
                  Governing Law
                </h2>
                <p>
                  These terms are governed by the laws of India. Any disputes shall be subject to Indian jurisdiction only.
                </p>
              </div>

              <div>
                <h2 className="text-2xl font-bold text-black mb-3">
                  Changes to Terms
                </h2>
                <p>
                  ectrade.in may update these terms from time to time. Continued use of the platform indicates acceptance of the updated terms.
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
