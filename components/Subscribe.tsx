'use client'

import { useState } from 'react'
import Script from 'next/script'

declare global {
  interface Window {
    Razorpay: any
  }
}

interface ISDCode {
  code: string
  country: string
  dialCode: string
}

export default function Subscribe() {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    isdCode: '+91',
    mobile: '',
    plan: 'basic',
  })
  const [isLoading, setIsLoading] = useState(false)

  const isdCodes: ISDCode[] = [
    { code: 'IN', country: 'India', dialCode: '+91' },
    { code: 'US', country: 'United States', dialCode: '+1' },
    { code: 'UK', country: 'United Kingdom', dialCode: '+44' },
    { code: 'AE', country: 'UAE', dialCode: '+971' },
    { code: 'SG', country: 'Singapore', dialCode: '+65' },
  ]

  const plans = [
    { id: 'basic', name: 'Basic Plan', price: 999, duration: 'month' },
    { id: 'pro', name: 'Pro Plan', price: 1999, duration: 'month' },
    { id: 'premium', name: 'Premium Plan', price: 3999, duration: 'month' },
  ]

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      // Create order on server
      const response = await fetch('/api/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: plans.find((p) => p.id === formData.plan)?.price || 999,
          currency: 'INR',
          receipt: `receipt_${Date.now()}`,
        }),
      })

      const order = await response.json()

      if (!order.id) {
        throw new Error('Failed to create order')
      }

      // Initialize Razorpay
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_key',
        amount: order.amount,
        currency: order.currency,
        name: "India's Best Toolkit for Trading",
        description: `Subscription: ${plans.find((p) => p.id === formData.plan)?.name}`,
        order_id: order.id,
        prefill: {
          name: formData.fullName,
          email: formData.email,
          contact: `${formData.isdCode}${formData.mobile}`,
        },
        theme: {
          color: '#000000',
        },
        handler: async function (response: any) {
          // Verify payment on server
          const verifyResponse = await fetch('/api/verify-payment', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              userData: formData,
            }),
          })

          const result = await verifyResponse.json()

          if (result.success) {
            alert('Payment successful! Welcome to our platform.')
            // Reset form
            setFormData({
              fullName: '',
              email: '',
              isdCode: '+91',
              mobile: '',
              plan: 'basic',
            })
          } else {
            alert('Payment verification failed. Please contact support.')
          }
        },
        modal: {
          ondismiss: function () {
            setIsLoading(false)
          },
        },
      }

      const razorpay = new window.Razorpay(options)
      razorpay.open()
      setIsLoading(false)
    } catch (error) {
      console.error('Payment error:', error)
      alert('Payment failed. Please try again.')
      setIsLoading(false)
    }
  }

  const selectedPlan = plans.find((p) => p.id === formData.plan)

  return (
    <>
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="lazyOnload"
      />
      <section
        id="subscribe"
        className="relative py-24 px-4 sm:px-6 lg:px-8 gradient-hero scroll-mt-20 overflow-hidden"
      >
        {/* Background Elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white opacity-5 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-white opacity-5 rounded-full blur-3xl"></div>
        </div>

        <div className="container mx-auto max-w-5xl relative z-10">
          <div className="text-center mb-16">
            <div className="inline-block mb-6">
              <span className="px-4 py-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full text-white text-sm font-semibold">
                Get Started
              </span>
            </div>
            <h2 className="text-5xl sm:text-6xl font-extrabold text-white mb-6">
              Start Your Trading Journey
            </h2>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              Join thousands of successful traders and unlock the full potential of our platform
            </p>
          </div>

          <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8 sm:p-12 border border-white/20">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Full Name */}
              <div>
                <label
                  htmlFor="fullName"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Full Name *
                </label>
                <input
                  type="text"
                  id="fullName"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleInputChange}
                  required
                  className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-black focus:border-black outline-none transition-all duration-300 hover:border-gray-400"
                  placeholder="Enter your full name"
                />
              </div>

              {/* Email */}
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Email Address *
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-black focus:border-black outline-none transition-all duration-300 hover:border-gray-400"
                  placeholder="Enter your email address"
                />
              </div>

              {/* Mobile Number with ISD Code */}
              <div>
                <label
                  htmlFor="mobile"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Mobile Number *
                </label>
                <div className="flex gap-3">
                  <select
                    id="isdCode"
                    name="isdCode"
                    value={formData.isdCode}
                    onChange={handleInputChange}
                    className="px-5 py-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-black focus:border-black outline-none bg-white transition-all duration-300 hover:border-gray-400"
                  >
                    {isdCodes.map((code) => (
                      <option key={code.code} value={code.dialCode}>
                        {code.dialCode} ({code.country})
                      </option>
                    ))}
                  </select>
                  <input
                    type="tel"
                    id="mobile"
                    name="mobile"
                    value={formData.mobile}
                    onChange={handleInputChange}
                    required
                    pattern="[0-9]{10}"
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    placeholder="Enter mobile number"
                  />
                </div>
              </div>

              {/* Subscription Plan */}
              <div>
                <label
                  htmlFor="plan"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Subscription Plan *
                </label>
                <select
                  id="plan"
                  name="plan"
                  value={formData.plan}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-white"
                >
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name} - ₹{plan.price}/{plan.duration}
                    </option>
                  ))}
                </select>
                {selectedPlan && (
                  <p className="mt-2 text-sm text-gray-600">
                    Selected: {selectedPlan.name} - ₹{selectedPlan.price}/
                    {selectedPlan.duration}
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-black text-white py-5 rounded-xl hover:bg-gray-900 transition-all duration-300 font-semibold text-lg shadow-lg hover:shadow-xl hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {isLoading ? 'Processing...' : 'Proceed to Payment'}
              </button>
            </form>
          </div>
        </div>
      </section>
    </>
  )
}

