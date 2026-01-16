'use client'

import { useState, useEffect } from 'react'
import { UserButton, SignInButton, SignedIn, SignedOut } from '@clerk/nextjs'

interface HeaderProps {
  forceDarkText?: boolean
}

export default function Header({ forceDarkText = false }: HeaderProps) {
  const [isScrolled, setIsScrolled] = useState(false)

  // Use dark text if forced or scrolled
  const useDarkText = forceDarkText || isScrolled

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled || forceDarkText
          ? 'bg-white/95 backdrop-blur-xl shadow-lg py-3'
          : 'bg-transparent py-5'
          }`}
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <a href="/" className="flex items-center space-x-3">
              <img
                src="/logo.png"
                alt="ectrade"
                className={`h-8 sm:h-10 w-auto transition-all ${useDarkText
                    ? ''
                    : 'bg-white p-1 rounded'
                  }`}
              />
            </a>

            {/* Navigation */}
            <nav className="hidden md:flex items-center space-x-8">
              <a
                href="/momentum"
                className={`transition-colors font-medium ${useDarkText
                  ? 'text-gray-700 hover:text-black'
                  : 'text-white/80 hover:text-white'
                  }`}
              >
                Momentum
              </a>
              <button
                onClick={() => scrollToSection('explore')}
                className={`transition-colors font-medium ${useDarkText
                  ? 'text-gray-700 hover:text-black'
                  : 'text-white/80 hover:text-white'
                  }`}
              >
                Explore
              </button>
              <button
                onClick={() => scrollToSection('testimonials')}
                className={`transition-colors font-medium ${useDarkText
                  ? 'text-gray-700 hover:text-black'
                  : 'text-white/80 hover:text-white'
                  }`}
              >
                Testimonials
              </button>
              <SignedOut>
                <a
                  href="/sign-in"
                  className={`transition-colors font-medium ${useDarkText
                    ? 'text-gray-700 hover:text-black'
                    : 'text-white/80 hover:text-white'
                    }`}
                >
                  Login
                </a>
              </SignedOut>
              <SignedIn>
                <UserButton afterSignOutUrl="/" />
              </SignedIn>
              <button
                onClick={() => scrollToSection('subscribe')}
                className="bg-black text-white px-6 py-3 rounded-xl hover:bg-gray-900 transition-all duration-300 font-semibold shadow-lg hover:shadow-xl hover:scale-105"
              >
                Subscribe Now
              </button>
            </nav>

            {/* Mobile Menu Button */}
            <button
              className={`md:hidden transition-colors ${useDarkText ? 'text-black' : 'text-white'}`}
              onClick={() => {
                const nav = document.getElementById('mobile-nav')
                nav?.classList.toggle('hidden')
              }}
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
          </div>

          {/* Mobile Navigation */}
          <nav
            id="mobile-nav"
            className="hidden md:hidden mt-4 pb-4 space-y-3 bg-white rounded-lg shadow-lg p-4 border border-gray-200"
          >
            <a
              href="/momentum"
              onClick={() => document.getElementById('mobile-nav')?.classList.add('hidden')}
              className="block w-full text-left text-black hover:text-gray-600 transition-colors font-medium py-2"
            >
              Momentum
            </a>
            <button
              onClick={() => {
                scrollToSection('explore')
                document.getElementById('mobile-nav')?.classList.add('hidden')
              }}
              className="block w-full text-left text-black hover:text-gray-600 transition-colors font-medium py-2"
            >
              Explore
            </button>
            <button
              onClick={() => {
                scrollToSection('testimonials')
                document.getElementById('mobile-nav')?.classList.add('hidden')
              }}
              className="block w-full text-left text-black hover:text-gray-600 transition-colors font-medium py-2"
            >
              Testimonials
            </button>
            <SignedOut>
              <a
                href="/sign-in"
                onClick={() => document.getElementById('mobile-nav')?.classList.add('hidden')}
                className="block w-full text-left text-black hover:text-gray-600 transition-colors font-medium py-2"
              >
                Login
              </a>
            </SignedOut>
            <SignedIn>
              <div className="py-2">
                <UserButton afterSignOutUrl="/" />
              </div>
            </SignedIn>
            <button
              onClick={() => {
                scrollToSection('subscribe')
                document.getElementById('mobile-nav')?.classList.add('hidden')
              }}
              className="block w-full bg-black text-white px-6 py-2 rounded-lg hover:bg-gray-800 transition-colors font-medium text-center"
            >
              Subscribe Now
            </button>
          </nav>
        </div>
      </header>
    </>
  )
}

