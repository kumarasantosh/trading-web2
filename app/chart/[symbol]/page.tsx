"use client";

import { useParams, useRouter } from "next/navigation";
import TradingViewWidget from "@/components/TradingViewWidget";

export default function ChartPage() {
    const params = useParams();
    const router = useRouter();
    const symbol = (params?.symbol as string) || '';

    if (!symbol) {
        return <div>Loading...</div>;
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 shadow-sm">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => router.back()}
                                className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                                Back
                            </button>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">
                                    NSE:{symbol}
                                </h1>
                                <p className="text-sm text-gray-500">Live Chart Analysis</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Chart Container */}
            <div className="container mx-auto px-4 py-6">
                <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-200">
                    <TradingViewWidget
                        symbol={symbol}
                        exchange="NSE"
                        interval="D"
                        theme="light"
                        height={600}
                    />
                </div>
            </div>
        </div>
    );
}
