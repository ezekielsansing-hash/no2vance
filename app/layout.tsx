import type { Metadata } from 'next'
import './globals.css'

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
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
