'use client'

import { Phone, CreditCard, User } from 'lucide-react'

interface TypeFilterProps {
  selected: string
  onChange: (type: string) => void
}

const filters = [
  { type: 'all', label: 'ทั้งหมด', icon: null },
  { type: 'phone', label: 'เบอร์', icon: Phone },
  { type: 'bank', label: 'บัญชี', icon: CreditCard },
  { type: 'name', label: 'ชื่อ', icon: User },
]

export function TypeFilter({ selected, onChange }: TypeFilterProps) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2" data-pill-group="">
      {filters.map(({ type, label, icon: Icon }) => (
        <button
          key={type}
          className={`pill ${selected === type ? 'pill-active' : ''}`}
          onClick={() => onChange(type)}
        >
          {Icon && <Icon className="w-3.5 h-3.5" />}
          {label}
        </button>
      ))}
    </div>
  )
}
