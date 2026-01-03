import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Momentum Dashboard - Trading Toolkit',
  description: 'Advanced trading dashboard with real-time market data and strategy widgets',
}

export default function MomentumLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}

