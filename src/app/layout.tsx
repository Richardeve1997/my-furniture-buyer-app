import type { Metadata } from 'next'
import './globals.css'
import { SiteHeader } from '@/components/SiteHeader'

// The Flip7 spec calls for the native system stack rather than a webfont —
// it's what gives the system its "app you already have" familiarity, and it
// costs no loading time.

export const metadata: Metadata = {
  title: 'Furniture Buyer',
  description: 'Browse the catalogue and spend your budget.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <SiteHeader />
        <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-8 sm:px-6">
          {children}
        </main>
        <footer className="mt-auto border-t-2 border-dashed border-teal/25">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 flex flex-wrap gap-x-6 gap-y-1 justify-between">
            <p className="eyebrow text-ink-soft">Furniture Buyer · Day 01</p>
            <p className="eyebrow text-ink-soft">Cognitivo × UNSW · 2026</p>
          </div>
        </footer>
      </body>
    </html>
  )
}
