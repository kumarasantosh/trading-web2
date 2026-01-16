'use client'

import { useState } from 'react'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import Link from 'next/link'

export default function FAQ() {
    const [openIndex, setOpenIndex] = useState<number | null>(0)

    const faqs = [
        {
            question: 'What is ectrade?',
            answer: (
                <p className="text-gray-700">
                    E C Trade is a toolkit for traders which helps to find the best trades in the live market by following the footpath of big players and some inbuilt strategies.
                </p>
            ),
        },
        {
            question: 'To Whom E C Trade is helpful For?',
            answer: (
                <>
                    <p className="text-gray-700 mb-4">
                        E C Trade is helpful for traders who want clarity, structure, and confidence while trading the markets.
                    </p>

                    <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-4">
                        <h3 className="font-bold text-green-900 mb-2">✓ Best Suited For:</h3>
                        <ul className="list-disc list-inside space-y-1 text-green-800">
                            <li>Intraday Traders</li>
                            <li>Beginner Traders</li>
                            <li>Working Professionals</li>
                            <li>Self-Directed Traders</li>
                            <li>Traders Who Value Simplicity</li>
                        </ul>
                    </div>

                    <div className="bg-red-50 border-l-4 border-red-500 p-4">
                        <h3 className="font-bold text-red-900 mb-2">✗ Not Suitable For:</h3>
                        <ul className="list-disc list-inside space-y-1 text-red-800">
                            <li>Traders looking for guaranteed profits</li>
                            <li>Investors seeking long-term investment advice</li>
                            <li>Anyone unwilling to accept market risk</li>
                        </ul>
                    </div>
                </>
            ),
        },
        {
            question: 'How does ectrade differ from other trading tools?',
            answer: (
                <>
                    <p className="text-gray-700 mb-3">
                        E C Trade is designed by traders, for traders. Unlike many trading tools that focus only on indicators or automated signals, E C Trade focuses on practical trade ideas inspired by experienced and consistent professional traders.
                    </p>
                    <p className="text-gray-700">
                        The tool is built specifically for intraday traders, keeping speed, clarity, and simplicity in mind. There is no unnecessary data or long-term investing noise.
                    </p>
                </>
            ),
        },
        {
            question: 'Does it place orders for the trader?',
            answer: (
                <p className="text-gray-700">
                    E C Trade does not place trades or give guaranteed buy/sell recommendations. It helps users identify potential trade opportunities so they can make their own informed decisions.
                </p>
            ),
        },
        {
            question: 'Does it provide any guarantee of profit?',
            answer: (
                <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4">
                    <p className="text-yellow-900 font-semibold">
                        E C Trade does not promise profits or fixed returns. Trading involves risk, and all final trading decisions are entirely the responsibility of the user.
                    </p>
                </div>
            ),
        },
    ]

    const toggleAccordion = (index: number) => {
        setOpenIndex(openIndex === index ? null : index)
    }

    return (
        <main className="min-h-screen">
            <Header forceDarkText />
            <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
                <div className="container mx-auto max-w-4xl">
                    <h1 className="text-4xl font-bold text-black mb-8">
                        Frequently Asked Questions
                    </h1>
                    <div className="space-y-4 mb-8">
                        {faqs.map((faq, index) => (
                            <div
                                key={index}
                                className="border border-gray-200 rounded-lg overflow-hidden"
                            >
                                <button
                                    onClick={() => toggleAccordion(index)}
                                    className="w-full flex items-center justify-between p-5 text-left bg-white hover:bg-gray-50 transition-colors"
                                >
                                    <h2 className="text-lg sm:text-xl font-bold text-black pr-4">
                                        {faq.question}
                                    </h2>
                                    <svg
                                        className={`w-6 h-6 flex-shrink-0 transition-transform duration-300 ${openIndex === index ? 'rotate-180' : ''
                                            }`}
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M19 9l-7 7-7-7"
                                        />
                                    </svg>
                                </button>
                                <div
                                    className={`overflow-hidden transition-all duration-300 ${openIndex === index ? 'max-h-[1000px]' : 'max-h-0'
                                        }`}
                                >
                                    <div className="p-5 pt-0 bg-gray-50">
                                        {faq.answer}
                                    </div>
                                </div>
                            </div>
                        ))}
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
            </section>
            <Footer />
        </main>
    )
}
