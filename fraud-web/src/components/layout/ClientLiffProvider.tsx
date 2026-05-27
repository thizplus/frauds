'use client'

import dynamic from 'next/dynamic'

const LiffProvider = dynamic(
  () => import('@/lib/providers/LiffProvider').then((m) => ({ default: m.LiffProvider })),
  { ssr: false }
)

export function ClientLiffProvider({ children }: { children: React.ReactNode }) {
  return <LiffProvider>{children}</LiffProvider>
}
