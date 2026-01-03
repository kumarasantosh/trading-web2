import Header from '@/components/Header'
import Hero from '@/components/Hero'
import Explore from '@/components/Explore'
import Partners from '@/components/Partners'
import Testimonials from '@/components/Testimonials'
import Subscribe from '@/components/Subscribe'
import Footer from '@/components/Footer'

export default function Home() {
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

