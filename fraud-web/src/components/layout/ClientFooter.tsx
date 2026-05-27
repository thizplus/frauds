'use client'

import { usePathname } from 'next/navigation'
import { Footer } from './Footer'

export function ClientFooter() {
  const pathname = usePathname()
  if (pathname?.startsWith('/register')) return null
  return <Footer />
}
