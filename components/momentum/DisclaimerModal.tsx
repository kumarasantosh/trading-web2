'use client'

import { useEffect } from 'react'

interface DisclaimerModalProps {
  isOpen: boolean
  onAccept: () => void
}

export default function DisclaimerModal({ isOpen, onAccept }: DisclaimerModalProps) {
  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-2 sm:p-4">
      <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto mx-2 sm:mx-4 p-4 sm:p-6 lg:p-8">
        <div className="mb-4 sm:mb-6">
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-black mb-3 sm:mb-4">Important Disclaimer</h2>
          <div className="prose max-w-none text-gray-700 space-y-3 sm:space-y-4">
            <p className="text-sm sm:text-base lg:text-lg leading-relaxed">
              <strong>Risk Warning:</strong> Trading in securities involves substantial risk of loss. 
              Past performance is not indicative of future results. The value of investments can go 
              down as well as up, and you may lose some or all of your invested capital.
            </p>
            <p className="text-sm sm:text-base lg:text-lg leading-relaxed">
              <strong>Not Financial Advice:</strong> The information provided on this platform is 
              for educational and informational purposes only. It does not constitute financial, 
              investment, or trading advice. All trading decisions should be made after careful 
              consideration and consultation with qualified financial advisors.
            </p>
            <p className="text-sm sm:text-base lg:text-lg leading-relaxed">
              <strong>Market Data:</strong> Market data and information provided on this platform 
              are sourced from third parties and are provided "as is" without warranty of any kind. 
              We do not guarantee the accuracy, completeness, or timeliness of any information.
            </p>
            <p className="text-sm sm:text-base lg:text-lg leading-relaxed">
              <strong>Your Responsibility:</strong> You are solely responsible for your trading 
              decisions and any losses that may result. We are not liable for any financial losses 
              incurred as a result of using this platform.
            </p>
            <p className="text-sm sm:text-base lg:text-lg font-semibold text-black mt-4 sm:mt-6">
              By clicking "Accept", you acknowledge that you have read, understood, and agree to 
              the terms of this disclaimer.
            </p>
          </div>
        </div>

        <div className="flex justify-end sticky bottom-0 bg-white pt-4 pb-2 sm:pt-0 sm:pb-0">
          <button
            onClick={onAccept}
            className="w-full sm:w-auto bg-black text-white px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-semibold text-base sm:text-lg hover:bg-gray-900 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
          >
            Accept & Continue
          </button>
        </div>
      </div>
    </div>
  )
}

