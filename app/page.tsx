'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Header from '@/components/Header'
import Hero from '@/components/Hero'
import Explore from '@/components/Explore'
import Partners from '@/components/Partners'
import Testimonials from '@/components/Testimonials'
import Subscribe from '@/components/Subscribe'
import Footer from '@/components/Footer'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    // Check if user is logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        // User is logged in, redirect to momentum
        router.push('/momentum')
      }
    })
  }, [router])

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


