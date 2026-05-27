'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'
import { LoginForm } from './LoginForm'

interface LoginModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function LoginModal({ open, onOpenChange }: LoginModalProps) {
  // ปิดด้วย Escape
  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onOpenChange])

  // ล็อค scroll
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div className="modal-backdrop" onClick={() => onOpenChange(false)}>
      <div className="modal-content fade-in" onClick={(e) => e.stopPropagation()}>
        {/* Mobile drag handle */}
        <div className="w-10 h-1 rounded-full mx-auto mb-4 sm:hidden"
          style={{ background: 'var(--border-strong)' }} />

        {/* Close button */}
        <div className="flex justify-end mb-2">
          <button className="btn-ghost btn-icon" onClick={() => onOpenChange(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <LoginForm onSuccess={() => onOpenChange(false)} />
      </div>
    </div>
  )
}
