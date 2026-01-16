'use client'
import Image from 'next/image'

export default function Hero() {
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden gradient-hero pt-20 px-4 sm:px-6 lg:px-8">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 right-20 w-96 h-96 bg-white opacity-5 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-white opacity-5 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      <div className="container mx-auto relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left Content */}
          <div className="text-center lg:text-left space-y-8">
            <div className="space-y-6">
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-white leading-tight">
                India's Best
                <br />
                <span className="bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                  Toolkit for Trading
                </span>
              </h1>
              <p className="text-xl sm:text-2xl text-gray-300 max-w-2xl leading-relaxed">
                Empower your trading journey with real-time data, advanced analytics,
                and professional-grade tools designed for modern trader.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <a
                href="/sign-in"
                className="group relative bg-white text-black px-8 py-4 rounded-xl font-semibold text-lg overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-2xl text-center"
              >
                <span className="relative z-10">Get Started</span>
                <div className="absolute inset-0 bg-gradient-to-r from-gray-100 to-white opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </a>
              <button
                onClick={() => scrollToSection('explore')}
                className="group bg-transparent border-2 border-white/30 text-white px-8 py-4 rounded-xl font-semibold text-lg backdrop-blur-sm hover:bg-white/10 hover:border-white/50 transition-all duration-300"
              >
                Explore Features
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-8 pt-8 border-t border-white/10">
              <div>
                <div className="text-3xl font-bold text-white">50K+</div>
                <div className="text-sm text-gray-400 mt-1">Active Users</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-white">₹100Cr+</div>
                <div className="text-sm text-gray-400 mt-1">Traded Volume</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-white">4.8★</div>
                <div className="text-sm text-gray-400 mt-1">User Rating</div>
              </div>
            </div>
          </div>

          {/* Right Content - Main Image */}
          <div className="relative hidden lg:block">
            <div className="relative z-10 transform rotate-2 hover:rotate-0 transition-transform duration-500">
              <Image
                src="/main.png"
                alt="Trading Dashboard"
                width={800}
                height={600}
                className="rounded-3xl shadow-2xl w-full h-auto"
                priority
              />
            </div>

            {/* Background Card */}
            <div className="absolute top-8 left-8 -z-10 bg-gray-800/50 backdrop-blur-xl rounded-3xl shadow-2xl p-8 transform -rotate-3 w-full h-full"></div>

            {/* Floating Elements */}
            <div className="absolute -top-4 -right-4 w-24 h-24 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20"></div>
            <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-white/5 backdrop-blur-sm rounded-full border border-white/10"></div>
          </div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
        <button
          onClick={() => scrollToSection('explore')}
          className="text-white/60 hover:text-white transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </button>
      </div>
    </section>
  )
}

