"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import TradingViewWidget from "@/components/TradingViewWidget";
import Footer from "@/components/Footer";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface TrendlineData {
    time: string;
    putOI: number;
    callOI: number;
    pcr: number;
    niftySpot: number | null;
}

export default function ChartPage() {
    const params = useParams();
    const router = useRouter();
    const symbol = (params?.symbol as string) || '';
    const [trendlineData, setTrendlineData] = useState<TrendlineData[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedDate, setSelectedDate] = useState(() => {
        // Default to today's date in YYYY-MM-DD format
        const today = new Date();
        return today.toISOString().split('T')[0];
    });

    useEffect(() => {
        if (symbol === 'NIFTY' || symbol === 'NIFTY 50') {
            fetchTrendlineData();
        }
    }, [symbol, selectedDate]);

    const fetchTrendlineData = async () => {
        setLoading(true);
        try {
            const response = await fetch(
                `/api/oi-trendline?symbol=NIFTY&date=${selectedDate}`
            );
            const result = await response.json();
            
            if (result.success && result.data) {
                setTrendlineData(result.data);
            } else {
                setTrendlineData([]);
            }
        } catch (error) {
            console.error('Error fetching trendline data:', error);
            setTrendlineData([]);
        } finally {
            setLoading(false);
        }
    };

    // Format time for display (HH:MM format in IST)
    const formatTime = (timeString: string) => {
        const date = new Date(timeString);
        // Convert UTC to IST (UTC + 5:30)
        const istHours = (date.getUTCHours() + 5) % 24;
        const istMinutes = date.getUTCMinutes() + 30;
        const adjustedHours = istMinutes >= 60 ? istHours + 1 : istHours;
        const adjustedMinutes = istMinutes >= 60 ? istMinutes - 60 : istMinutes;
        return `${adjustedHours.toString().padStart(2, '0')}:${adjustedMinutes.toString().padStart(2, '0')}`;
    };

    // Format large numbers with K/M suffix
    const formatOI = (value: number) => {
        if (value >= 1000000) {
            return `${(value / 1000000).toFixed(2)}M`;
        } else if (value >= 1000) {
            return `${(value / 1000).toFixed(2)}K`;
        }
        return value.toLocaleString();
    };

    if (!symbol) {
        return <div>Loading...</div>;
    }

    const showTrendline = symbol === 'NIFTY' || symbol === 'NIFTY 50';

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
                        {showTrendline && (
                            <div className="flex items-center gap-2">
                                <label className="text-sm text-gray-600">Date:</label>
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    max={new Date().toISOString().split('T')[0]}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Chart Container */}
            <div className="container mx-auto px-4 py-6 space-y-6">
                <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-200">
                    <TradingViewWidget
                        symbol={symbol}
                        exchange="NSE"
                        interval="D"
                        theme="light"
                        height={600}
                    />
                </div>

                {/* OI Trendline Chart */}
                {showTrendline && (
                    <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-200">
                        <h2 className="text-xl font-bold text-gray-900 mb-4">
                            Put/Call OI Trendline (9:15 AM - 3:30 PM)
                        </h2>
                        {loading ? (
                            <div className="flex items-center justify-center h-96">
                                <div className="text-gray-500">Loading trendline data...</div>
                            </div>
                        ) : trendlineData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={400}>
                                <LineChart data={trendlineData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                                    <XAxis 
                                        dataKey="time" 
                                        tickFormatter={formatTime}
                                        stroke="#666"
                                        style={{ fontSize: '12px' }}
                                    />
                                    <YAxis 
                                        yAxisId="oi"
                                        stroke="#8884d8"
                                        tickFormatter={formatOI}
                                        style={{ fontSize: '12px' }}
                                    />
                                    <Tooltip 
                                        formatter={(value: number, name: string) => {
                                            if (name === 'putOI' || name === 'callOI') {
                                                return [formatOI(value), name === 'putOI' ? 'Put OI' : 'Call OI'];
                                            }
                                            return [value.toFixed(4), 'PCR'];
                                        }}
                                        labelFormatter={(label) => `Time: ${formatTime(label)}`}
                                        contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px' }}
                                    />
                                    <Legend 
                                        formatter={(value) => {
                                            if (value === 'putOI') return 'Put OI';
                                            if (value === 'callOI') return 'Call OI';
                                            return value;
                                        }}
                                    />
                                    <Line
                                        yAxisId="oi"
                                        type="monotone"
                                        dataKey="putOI"
                                        stroke="#ef4444"
                                        strokeWidth={2}
                                        dot={{ r: 3 }}
                                        name="putOI"
                                    />
                                    <Line
                                        yAxisId="oi"
                                        type="monotone"
                                        dataKey="callOI"
                                        stroke="#10b981"
                                        strokeWidth={2}
                                        dot={{ r: 3 }}
                                        name="callOI"
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-96">
                                <div className="text-gray-500 text-center">
                                    <p>No trendline data available for {selectedDate}</p>
                                    <p className="text-sm mt-2">Data is captured every 3 minutes during market hours (9:15 AM - 3:30 PM IST)</p>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
            <Footer />
        </div>
    );
}
