import type { Metadata } from 'next'
import { Jost } from 'next/font/google'
import './globals.css'

const jost = Jost({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-jost',
})

export const metadata: Metadata = {
  title: 'Venue Booking Manager',
  description: 'Capture and review booking details for a multi-use venue.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={jost.variable}>
      <body>{children}</body>
    </html>
  )
}
