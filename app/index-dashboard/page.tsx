'use client'

import TopNavigation from '@/components/momentum/TopNavigation'
import Footer from '@/components/Footer'
import IndexPanel from '@/components/IndexPanel'

export default function IndexDashboardPage() {
    return (
        <div className="min-h-screen bg-[#0d1117] text-gray-200">
            {/* Top Navigation */}
            <div className="relative z-50">
                <TopNavigation hideTopMovers={true} />
            </div>

            {/* Header Bar */}
            <div className="bg-[#161b22] border-b border-gray-700/50">
                <div className="px-4 lg:px-6 py-3">
                    <h1 className="text-lg font-bold tracking-wider text-white uppercase flex items-center gap-3">
                        <span className="bg-gradient-to-r from-blue-500 to-purple-500 w-1 h-6 rounded-full inline-block"></span>
                        Index Dashboard
                    </h1>
                </div>
            </div>

            {/* Dashboard Content — Two panels side by side */}
            <div className="px-3 lg:px-6 py-4">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <IndexPanel symbol="NIFTY" />
                    <IndexPanel symbol="BANKNIFTY" />
                </div>
            </div>

            <Footer />
        </div>
    )
}
