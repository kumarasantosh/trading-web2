'use client'

import { useState, useEffect } from 'react'

interface Testimonial {
  name: string
  rating: number
  text: string
  role?: string
}

export default function Testimonials() {
  const testimonials: Testimonial[] = [
    {
      name: 'Rajesh Kumar',
      rating: 5,
      text: 'This platform has completely transformed my trading experience. The real-time data and analytics are incredibly accurate.',
      role: 'Professional Trader',
    },
    {
      name: 'Priya Sharma',
      rating: 5,
      text: 'The mobile app is fantastic! I can manage my portfolio and execute trades from anywhere. Highly recommended!',
      role: 'Day Trader',
    },
    {
      name: 'Amit Patel',
      rating: 5,
      text: 'Best investment I made this year. The tools and support are top-notch. My returns have improved significantly.',
      role: 'Investor',
    },
    {
      name: 'Sneha Reddy',
      rating: 5,
      text: 'The user interface is intuitive and the features are comprehensive. Perfect for both beginners and experts.',
      role: 'Swing Trader',
    },
  ]

  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % testimonials.length)
    }, 5000)
    return () => clearInterval(interval)
  }, [testimonials.length])

  const goToSlide = (index: number) => {
    setCurrentIndex(index)
  }

  const goToPrevious = () => {
    setCurrentIndex(
      (prev) => (prev - 1 + testimonials.length) % testimonials.length
    )
  }

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % testimonials.length)
  }

  return (
    <section
      id="testimonials"
      className="py-24 px-4 sm:px-6 lg:px-8 bg-white scroll-mt-20"
    >
      <div className="container mx-auto">
        <div className="text-center mb-20">
          <div className="inline-block mb-4">
            <span className="px-4 py-2 bg-black text-white rounded-full text-sm font-semibold">
              Testimonials
            </span>
          </div>
          <h2 className="text-5xl sm:text-6xl font-extrabold text-black mb-6">
            Trusted by Thousands
            <br />
            <span className="text-gray-600">of Traders</span>
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            See what our users have to say about their trading experience
          </p>
        </div>

        <div className="max-w-5xl mx-auto">
          <div className="relative bg-gradient-to-br from-gray-50 to-white rounded-3xl p-8 sm:p-16 shadow-2xl border border-gray-100">
            {/* Testimonial Content */}
            <div className="text-center mb-12">
              <div className="flex justify-center mb-6">
                {[...Array(testimonials[currentIndex].rating)].map((_, i) => (
                  <span key={i} className="text-3xl text-yellow-400 mx-1">
                    ★
                  </span>
                ))}
              </div>
              <div className="mb-8">
                <svg className="w-12 h-12 text-gray-300 mx-auto mb-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.996 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.984zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z"/>
                </svg>
              </div>
              <p className="text-xl sm:text-2xl text-gray-800 mb-8 leading-relaxed font-medium">
                "{testimonials[currentIndex].text}"
              </p>
              <div>
                <h3 className="text-2xl font-bold text-black mb-2">
                  {testimonials[currentIndex].name}
                </h3>
                {testimonials[currentIndex].role && (
                  <p className="text-gray-500 text-lg">
                    {testimonials[currentIndex].role}
                  </p>
                )}
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="flex justify-center items-center space-x-4">
              <button
                onClick={goToPrevious}
                className="p-2 rounded-full bg-gray-200 hover:bg-black hover:text-white transition-colors"
                aria-label="Previous testimonial"
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
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>

              {/* Dots Indicator */}
              <div className="flex space-x-2">
                {testimonials.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => goToSlide(index)}
                    className={`w-3 h-3 rounded-full transition-colors ${
                      index === currentIndex
                        ? 'bg-black'
                        : 'bg-gray-300 hover:bg-gray-400'
                    }`}
                    aria-label={`Go to testimonial ${index + 1}`}
                  />
                ))}
              </div>

              <button
                onClick={goToNext}
                className="p-2 rounded-full bg-gray-200 hover:bg-black hover:text-white transition-colors"
                aria-label="Next testimonial"
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
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

