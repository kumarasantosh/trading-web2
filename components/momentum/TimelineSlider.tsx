'use client'

import { useState, useEffect } from 'react'

interface TimelineSliderProps {
    selectedTime: Date
    onTimeChange: (time: Date) => void
    isReplayMode: boolean
    onReplayModeChange: (enabled: boolean) => void
}

export default function TimelineSlider({
    selectedTime,
    onTimeChange,
    isReplayMode,
    onReplayModeChange
}: TimelineSliderProps) {
    const [sliderValue, setSliderValue] = useState(0)
    const [isUserDragging, setIsUserDragging] = useState(false)

    // Market hours: 9:15 AM to 3:30 PM (375 minutes = 125 intervals of 3 minutes)
    const intervals = 125 // Every 3 minutes

    // Get current time interval
    const getCurrentInterval = () => {
        const now = new Date()
        const minutes = (now.getHours() - 9) * 60 + now.getMinutes() - 15
        return Math.max(0, Math.min(Math.floor(minutes / 3), intervals))
    }

    // Convert slider value to time
    const sliderToTime = (value: number) => {
        const minutes = value * 3 + 9 * 60 + 15
        const hours = Math.floor(minutes / 60)
        const mins = minutes % 60

        const time = new Date()
        time.setHours(hours, mins, 0, 0)
        return time
    }

    // Convert time to slider value
    const timeToSlider = (time: Date) => {
        const hours = time.getHours()
        const minutes = time.getMinutes()
        const totalMinutes = (hours - 9) * 60 + minutes - 15
        return Math.max(0, Math.min(Math.floor(totalMinutes / 3), intervals))
    }

    // Initialize to current time
    useEffect(() => {
        const currentInterval = getCurrentInterval()
        setSliderValue(currentInterval)
        onTimeChange(sliderToTime(currentInterval))
    }, [])

    // Sync slider value with selectedTime prop (only when not user-initiated)
    useEffect(() => {
        if (!isUserDragging) {
            const sliderVal = timeToSlider(selectedTime)
            setSliderValue(sliderVal)
        }
    }, [selectedTime, isUserDragging])

    // Auto-update slider position every minute when in live mode
    useEffect(() => {
        const updateInterval = setInterval(() => {
            const currentInterval = getCurrentInterval()
            // If we're at current time (not in replay mode), update slider position
            if (!isReplayMode) {
                setSliderValue(currentInterval)
                onTimeChange(sliderToTime(currentInterval))
            }
        }, 60000) // Update every minute

        return () => clearInterval(updateInterval)
    }, [isReplayMode, onTimeChange])

    // Handle slider change
    const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setIsUserDragging(true)
        const value = parseInt(e.target.value)
        setSliderValue(value)
        const newTime = sliderToTime(value)
        onTimeChange(newTime)

        // Enable replay mode when slider is moved away from current time
        const currentInterval = getCurrentInterval()
        if (value !== currentInterval) {
            onReplayModeChange(true)
        } else {
            onReplayModeChange(false)
        }
    }

    // Handle mouse up to reset dragging state
    const handleMouseUp = () => {
        setIsUserDragging(false)
    }

    // Reset to live data
    const handleResetToLive = () => {
        setIsUserDragging(false)
        const currentInterval = getCurrentInterval()
        setSliderValue(currentInterval)
        onTimeChange(sliderToTime(currentInterval))
        onReplayModeChange(false)
    }

    // Format time for display
    const formatTime = (time: Date) => {
        return time.toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        })
    }

    const currentMaxInterval = getCurrentInterval()

    return (
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl border border-gray-200/50 shadow-xl p-4 sm:p-6 mb-4 sm:mb-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
                <h3 className="text-base sm:text-lg font-bold text-gray-900">
                    {isReplayMode ? '🎬 Replay Mode' : '📊 Live Data'}
                </h3>

                {isReplayMode && (
                    <button
                        onClick={handleResetToLive}
                        className="px-3 sm:px-4 py-2 rounded-lg font-semibold text-xs sm:text-sm bg-blue-500 text-white hover:bg-blue-600 transition-all duration-200 w-full sm:w-auto"
                    >
                        🔴 Back to Live
                    </button>
                )}
            </div>

            <div className="mb-4">
                <div className="flex items-center justify-between text-xs sm:text-sm text-gray-600 mb-2 gap-1">
                    <span className="hidden sm:inline">09:15 AM</span>
                    <span className="sm:hidden">09:15</span>
                    <span className={`font-bold text-sm sm:text-base ${isReplayMode ? 'text-orange-600' : 'text-blue-600'} truncate`}>
                        {formatTime(selectedTime)} {isReplayMode && <span className="hidden sm:inline">(Historical)</span>}
                    </span>
                    <span className="hidden sm:inline">{formatTime(sliderToTime(currentMaxInterval))}</span>
                    <span className="sm:hidden">{formatTime(sliderToTime(currentMaxInterval)).replace(' AM', '').replace(' PM', '')}</span>
                </div>

                {/* Timeline Slider */}
                <input
                    type="range"
                    min="0"
                    max={currentMaxInterval}
                    value={sliderValue}
                    onChange={handleSliderChange}
                    onMouseUp={handleMouseUp}
                    onTouchEnd={handleMouseUp}
                    className="w-full h-3 bg-gradient-to-r from-blue-200 via-blue-400 to-blue-600 rounded-lg appearance-none cursor-pointer slider"
                    style={{
                        background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${currentMaxInterval > 0 ? (sliderValue / currentMaxInterval) * 100 : 0}%, #dbeafe ${currentMaxInterval > 0 ? (sliderValue / currentMaxInterval) * 100 : 0}%, #dbeafe 100%)`
                    }}
                />

                {/* Time markers */}
                <div className="flex justify-between mt-2 text-[10px] sm:text-xs text-gray-400">
                    {(() => {
                        const markers = [0]
                        const step = Math.ceil(currentMaxInterval / 5)
                        for (let i = 1; i < 5; i++) {
                            const marker = i * step
                            if (marker <= currentMaxInterval) markers.push(marker)
                        }
                        if (currentMaxInterval > 0) markers.push(currentMaxInterval)
                        return markers.map((marker, idx) => (
                            <span key={idx} className="hidden sm:inline">{formatTime(sliderToTime(marker))}</span>
                        ))
                    })()}
                </div>
            </div>

            <div className="text-[10px] sm:text-xs text-gray-500 text-center">
                💡 Drag the slider to see historical data at any time
            </div>

            <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: ${isReplayMode ? '#f97316' : '#3b82f6'};
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }

        .slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: ${isReplayMode ? '#f97316' : '#3b82f6'};
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          border: none;
        }
      `}</style>
        </div>
    )
}
