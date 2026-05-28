'use client'

import { ShieldCheck, Lock, Zap } from 'lucide-react'

export function TrustBadges() {
  return (
    <div className="trust-row">
      <span className="flex items-center gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5 text-accent" />
        อัปเดตทุกวัน
      </span>
      <span className="sep" />
      <span className="flex items-center gap-1.5">
        <Lock className="w-3.5 h-3.5 text-accent" />
        ปลอดภัย เข้ารหัส
      </span>
      <span className="sep" />
      <span className="flex items-center gap-1.5">
        <Zap className="w-3.5 h-3.5 text-accent" />
        ค้นหาได้ทันที
      </span>
    </div>
  )
}
