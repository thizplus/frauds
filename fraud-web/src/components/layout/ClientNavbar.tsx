'use client'

import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'

const Navbar = dynamic(
  () => import('./Navbar').then((m) => ({ default: m.Navbar })),
  { ssr: false }
)

export function ClientNavbar() {
  const pathname = usePathname()
  if (pathname?.startsWith('/register')) return null
  return <Navbar />
}
