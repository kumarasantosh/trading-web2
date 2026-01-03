import Header from '@/components/Header'
import Footer from '@/components/Footer'
import Link from 'next/link'

export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen">
      <Header />
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
                <p>
                  We collect information that you provide directly to us,
                  including name, email address, phone number, and payment
                  information when you subscribe to our services.
                </p>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-black mb-3">
                  How We Use Your Information
                </h2>
                <p>
                  We use your information to provide, maintain, and improve our
                  services, process payments, send notifications, and communicate
                  with you about your account.
                </p>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-black mb-3">
                  Data Security
                </h2>
                <p>
                  We implement appropriate technical and organizational measures
                  to protect your personal information against unauthorized
                  access, alteration, disclosure, or destruction.
                </p>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-black mb-3">
                  Data Sharing
                </h2>
                <p>
                  We do not sell your personal information. We may share
                  information with service providers who assist us in operating
                  our platform, subject to confidentiality agreements.
                </p>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-black mb-3">
                  Your Rights
                </h2>
                <p>
                  You have the right to access, update, or delete your personal
                  information. You may also opt-out of marketing communications
                  at any time.
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

