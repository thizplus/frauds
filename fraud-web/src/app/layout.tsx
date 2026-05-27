import type { Metadata } from 'next'
import { Inter, JetBrains_Mono, Google_Sans } from 'next/font/google'
import './globals.css'
import { QueryProvider } from '@/lib/providers/QueryProvider'
import { ClientNavbar } from '@/components/layout/ClientNavbar'
import { ClientLiffProvider } from '@/components/layout/ClientLiffProvider'
import { ClientFooter } from '@/components/layout/ClientFooter'
import { ClientFloatingUser } from '@/components/layout/ClientFloatingUser'
import { getPageMetadata } from '@/lib/seo/metadata'

const googleSans = Google_Sans({
  subsets: ['latin', 'thai'],
  variable: '--font-google-sans',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

const baseMeta = getPageMetadata('home')

export const metadata: Metadata = {
  ...baseMeta,
  metadataBase: new URL('https://xn--12cainl6g3mua5b.com'),
  icons: {
    icon: '/favicon.svg',
    apple: '/apple-touch-icon.svg',
  },
  manifest: '/manifest.json',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html suppressHydrationWarning lang="th" className={`${googleSans.variable} ${inter.variable} ${jetbrainsMono.variable}`}>
      <head />
      <body suppressHydrationWarning className="flex flex-col min-h-screen" style={{ fontFamily: `var(--font-google-sans), var(--font-inter), system-ui, sans-serif` }}>
        <QueryProvider>
          <ClientLiffProvider>
            <ClientNavbar />
            <main className="flex-1 flex flex-col tech-grid">{children}</main>
            <ClientFooter />
            {/* <ClientFloatingUser /> — ปิดไว้ก่อน ดูรก */}
          </ClientLiffProvider>
        </QueryProvider>
      </body>
    </html>
  )
}
