'use client'

import { useState, useEffect } from 'react'
import TopNavigation from '@/components/momentum/TopNavigation'
import VideoTutorial from '@/components/VideoTutorial'

import DisclaimerModal from '@/components/momentum/DisclaimerModal'
import Footer from '@/components/Footer'

export default function MomentumPage() {
  const [showDisclaimer, setShowDisclaimer] = useState(false)

  useEffect(() => {
    // Check if disclaimer was accepted today
    const disclaimerAccepted = localStorage.getItem('disclaimer_accepted_date')
    const today = new Date().toDateString()

    if (disclaimerAccepted !== today) {
      setShowDisclaimer(true)
    }
  }, [])

  const handleDisclaimerAccept = () => {
    const today = new Date().toDateString()
    localStorage.setItem('disclaimer_accepted_date', today)
    setShowDisclaimer(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      {/* Top Navigation with Market Indices */}
      <div className="relative z-50">
        <TopNavigation />
      </div>

      {/* Disclaimer Modal */}
      <DisclaimerModal
        isOpen={showDisclaimer}
        onAccept={handleDisclaimerAccept}
      />
      <VideoTutorial />
      <Footer />
    </div>
  )
}
