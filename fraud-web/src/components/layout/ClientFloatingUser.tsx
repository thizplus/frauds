'use client'

import dynamic from 'next/dynamic'

const FloatingUser = dynamic(
  () => import('./FloatingUser').then((m) => ({ default: m.FloatingUser })),
  { ssr: false }
)

export function ClientFloatingUser() {
  return <FloatingUser />
}
