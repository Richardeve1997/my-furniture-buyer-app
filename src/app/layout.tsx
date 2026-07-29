import type { Metadata } from 'next'
import { Anton, Archivo, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { SiteHeader } from '@/components/SiteHeader'

// Anton for anything shouting, Archivo for anything explaining,
// JetBrains Mono for anything countable.
const anton = Anton({
  weight: '400',
  variable: '--font-anton',
  subsets: ['latin'],
})

const archivo = Archivo({
  variable: '--font-archivo',
  subsets: ['latin'],
})

const mono = JetBrains_Mono({
  variable: '--font-mono-stack',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'FURNITURE / BUYER',
  description: 'Browse the catalogue. Spend the budget. Nothing subtle.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${anton.variable} ${archivo.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SiteHeader />
        <main className="flex-1 w-full max-w-[1400px] mx-auto px-5 py-10 sm:px-8">
          {children}
        </main>
        <footer className="mt-auto">
          <div className="hazard h-2" />
          <div className="border-t-2 border-rule bg-deck">
            <div className="max-w-[1400px] mx-auto px-5 sm:px-8 py-5 flex flex-wrap gap-x-6 gap-y-1 justify-between">
              <p className="stencil text-ash">Furniture / Buyer — Day 01</p>
              <p className="stencil text-ash">Cognitivo × UNSW · Hackathon 2026</p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  )
}
