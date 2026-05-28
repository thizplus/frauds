'use client'

import { Camera } from 'lucide-react'
import { Drawer } from '@/components/ui/Drawer'
import { FaceSearchTab } from '@/features/search/components/FaceSearchTab'
import type { FraudResponse } from '@/features/search/types'

interface FaceSearchDrawerProps {
  open: boolean
  onClose: () => void
  onSelectFraud: (fraud: FraudResponse) => void
}

export function FaceSearchDrawer({ open, onClose, onSelectFraud }: FaceSearchDrawerProps) {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5">
          <Camera className="w-6 h-6" style={{ color: 'var(--accent)' }} />
          <h2 className="text-xl font-bold" style={{ color: 'var(--text)' }}>ค้นหาด้วยใบหน้า</h2>
        </div>
      }
    >
      <FaceSearchTab onSelectFraud={(fraud) => { onClose(); onSelectFraud(fraud) }} />
    </Drawer>
  )
}
