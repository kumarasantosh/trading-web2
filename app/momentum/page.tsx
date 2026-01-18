'use client'

import { useState, useEffect } from 'react'
import TopNavigation from '@/components/momentum/TopNavigation'
import SectorPerformance from '@/components/momentum/SectorPerformance'
import StockTable from '@/components/momentum/StockTable'
import DisclaimerModal from '@/components/momentum/DisclaimerModal'
import Footer from '@/components/Footer'

export default function MomentumPage() {
  const [showDisclaimer, setShowDisclaimer] = useState(false)
  const [selectedSector, setSelectedSector] = useState<string | null>(null)
  const [isReplayMode, setIsReplayMode] = useState(false)
  const [selectedTime, setSelectedTime] = useState(new Date())
  const [isStockTableExpanded, setIsStockTableExpanded] = useState(false) // Collapsed by default

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
    setIsStockTableExpanded(true) // Auto-expand when sector is clicked
  }

  const handleReplayModeChange = (enabled: boolean) => {
    setIsReplayMode(enabled)
  }

  const handleTimeChange = (time: Date) => {
    setSelectedTime(time)
  }

  const handleStockTableToggle = (expanded: boolean) => {
    setIsStockTableExpanded(expanded)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      {/* Top Navigation with Market Indices */}
      <div className="relative z-50">
        <TopNavigation />
      </div>

      {/* Main Content Area - Scrollable */}
      <div className="w-full py-4 sm:py-6 lg:py-8">
        <div className="px-2 sm:px-4 lg:px-6">
          {/* Sector Performance and Stock Table - Flex layout */}
          <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">
            {/* Left Panel: Sector Performance - Takes remaining space */}
            <div className={`flex-1 flex flex-col transition-all duration-300`}>
              <SectorPerformance
                onSectorClick={handleSectorClick}
                selectedSector={selectedSector}
                isReplayMode={isReplayMode}
                replayTime={selectedTime}
                onTimeChange={handleTimeChange}
                onReplayModeChange={handleReplayModeChange}
              />
            </div>

            {/* Right Panel: Stock Table - Dynamic width */}
            <div className={`flex flex-col transition-all duration-300 ${isStockTableExpanded ? 'lg:w-[400px]' : 'lg:w-auto'}`}>
              <StockTable
                selectedSector={selectedSector}
                isReplayMode={isReplayMode}
                replayTime={selectedTime}
                isExpanded={isStockTableExpanded}
                onToggleExpand={handleStockTableToggle}
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
      <Footer />
    </div>
  )
}
