import type { Metadata } from 'next'
import { Providers } from '@/components/providers'
import './globals.css'

export const metadata: Metadata = {
  title: "India's Best Toolkit for Trading",
  description: 'Work with all the necessary information and tools to boost money flow from your capital investment',
  keywords: 'trading, investment, stock market, India, finance',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}

