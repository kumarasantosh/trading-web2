import Header from '@/components/Header'
import Footer from '@/components/Footer'
import Link from 'next/link'

export default function RiskDisclosure() {
    return (
        <main className="min-h-screen">
            <Header forceDarkText />
            <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
                <div className="container mx-auto max-w-4xl">
                    <h1 className="text-4xl font-bold text-black mb-8">Risk Disclosure</h1>
                    <div className="prose prose-lg max-w-none">
                        <p className="text-gray-700 mb-4">
                            Last updated: {new Date().toLocaleDateString()}
                        </p>
                        <div className="space-y-6 text-gray-700">
                            <div className="bg-red-50 border-l-4 border-red-500 p-4 my-6">
                                <p className="font-bold text-red-800 text-lg">
                                    Trading in equity, derivatives, futures, options, and intraday markets involves high risk.
                                </p>
                            </div>

                            <div>
                                <h2 className="text-2xl font-bold text-black mb-3">Key Risks</h2>
                                <ul className="list-disc list-inside space-y-2 ml-4">
                                    <li><strong>Losses can exceed expectations</strong> - Market volatility can result in significant financial losses</li>
                                    <li><strong>Intraday trading is highly volatile</strong> - Prices can fluctuate dramatically within short periods</li>
                                    <li><strong>Past performance does not guarantee future results</strong> - Historical data is not a reliable predictor</li>
                                    <li><strong>Leverage amplifies both gains and losses</strong> - Derivatives and margin trading carry additional risks</li>
                                </ul>
                            </div>

                            <div className="bg-orange-50 border-l-4 border-orange-400 p-4 my-6">
                                <p className="font-semibold text-orange-800">
                                    Users should trade only with money they can afford to lose and should consult a SEBI-registered professional before making trading decisions.
                                </p>
                            </div>

                            <div>
                                <h2 className="text-2xl font-bold text-black mb-3">ectrade.in does not guarantee:</h2>
                                <ul className="list-disc list-inside space-y-2 ml-4">
                                    <li>Profits or returns</li>
                                    <li>Accuracy or completeness of data</li>
                                    <li>Consistent performance of tools or indicators</li>
                                </ul>
                            </div>

                            <p className="italic">
                                All examples shown on this platform are illustrative only and not actual trading results.
                            </p>

                            <p>
                                By using ectrade.in, you acknowledge that you understand these risks and accept full responsibility for your trading decisions.
                            </p>
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
                </div>
            </section>
            <Footer />
        </main>
    )
}
