'use client'

import { useState, useEffect, useRef } from 'react'
import { CreditCard } from 'lucide-react'
import { BANKS } from '@/lib/config/constants'

interface BankSelectorProps {
  value: string
  onChange: (bankName: string) => void
  label?: string
}

export function BankSelector({ value, onChange, label = 'ธนาคาร' }: BankSelectorProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div className="bank-dropdown-wrap" ref={ref}>
      {label && <label className="report-label">{label}</label>}
      <button
        type="button"
        className="bank-dropdown-trigger"
        onClick={() => setOpen(!open)}
      >
        {value ? (
          <span className="bank-dropdown-selected">
            <img src={BANKS.find(b => b.name === value)?.icon} alt="" className="bank-dropdown-icon" />
            {value}
          </span>
        ) : (
          <span style={{ color: 'var(--text-faint)' }}>เลือกธนาคาร</span>
        )}
        <CreditCard className="w-4 h-4" style={{ color: 'var(--text-dim)' }} />
      </button>
      {open && (
        <div className="bank-dropdown-list">
          {BANKS.map((bank) => (
            <button
              key={bank.symbol}
              type="button"
              className={`bank-dropdown-item ${value === bank.name ? 'active' : ''}`}
              onClick={() => { onChange(bank.name); setOpen(false) }}
            >
              <img src={bank.icon} alt={bank.name} className="bank-dropdown-icon" />
              <span>{bank.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
