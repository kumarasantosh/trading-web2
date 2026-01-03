'use client'

import { useState, useEffect } from 'react'
import TopNavigation from '@/components/momentum/TopNavigation'
import SectorPerformance from '@/components/momentum/SectorPerformance'
import StockTable from '@/components/momentum/StockTable'
import DisclaimerModal from '@/components/momentum/DisclaimerModal'

export default function MomentumPage() {
  const [showDisclaimer, setShowDisclaimer] = useState(false)
  const [selectedSector, setSelectedSector] = useState<string | null>(null)
  const [isReplayMode, setIsReplayMode] = useState(false)
  const [selectedTime, setSelectedTime] = useState(new Date())

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

  const handleSectorClick = (sectorName: string) => {
    setSelectedSector(sectorName)
  }

  const handleReplayModeChange = (enabled: boolean) => {
    setIsReplayMode(enabled)
  }

  const handleTimeChange = (time: Date) => {
    setSelectedTime(time)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      {/* Top Navigation with Market Indices */}
      <TopNavigation />

      {/* Main Content Area - Scrollable */}
      <div className="w-full py-4 sm:py-6 lg:py-8">
        <div className="px-2 sm:px-4 lg:px-6">
          {/* Sector Performance and Stock Table */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
            {/* Left Panel: Sector Performance - Wider */}
            <div className="lg:col-span-8 flex flex-col">
              <SectorPerformance
                onSectorClick={handleSectorClick}
                selectedSector={selectedSector}
                isReplayMode={isReplayMode}
                replayTime={selectedTime}
                onTimeChange={handleTimeChange}
                onReplayModeChange={handleReplayModeChange}
              />
            </div>

            {/* Right Panel: Stock Table - Narrower */}
            <div className="lg:col-span-4 flex flex-col">
              <StockTable
                selectedSector={selectedSector}
                isReplayMode={isReplayMode}
                replayTime={selectedTime}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Disclaimer Modal */}
      <DisclaimerModal
        isOpen={showDisclaimer}
        onAccept={handleDisclaimerAccept}
      />
    </div>
  )
}
