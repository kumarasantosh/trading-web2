'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import Header from '@/components/Header'
import Hero from '@/components/Hero'
import Explore from '@/components/Explore'
import Partners from '@/components/Partners'
import Testimonials from '@/components/Testimonials'
import Subscribe from '@/components/Subscribe'
import Footer from '@/components/Footer'

export default function Home() {
  const router = useRouter()
  const { isLoaded, userId } = useAuth()

  useEffect(() => {
    // Wait for Clerk to load, then check if user is logged in
    if (isLoaded && userId) {
      router.push('/momentum')
    }
  }, [isLoaded, userId, router])

  // Show loading while Clerk is initializing
  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }

  // If user is logged in, don't render landing page (redirect will happen)
  if (userId) {
    return null
  }

  return (
    <main className="min-h-screen">
      <Header />
      <Hero />
      <Partners />
      <Explore />
      <Testimonials />
      <Subscribe />
      <Footer />
    </main>
  )
}


