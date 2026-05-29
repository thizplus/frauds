'use client'

import { useState, useEffect } from 'react'
import { Banknote, TrendingUp, ShoppingCart, Users, HelpCircle } from 'lucide-react'

const CATEGORY_ICONS: Record<string, typeof Banknote> = {
  'banknote': Banknote,
  'trending-up': TrendingUp,
  'shopping-cart': ShoppingCart,
  'users': Users,
}

interface Category {
  id: string
  name: string
  icon?: string
}

interface CategoryPickerProps {
  value: string
  onChange: (categoryId: string, categoryName?: string) => void
  label?: string
}

export function CategoryPicker({ value, onChange, label = 'หมวดหมู่' }: CategoryPickerProps) {
  const [categories, setCategories] = useState<Category[]>([])

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL!
    fetch(`${apiUrl}/categories`)
      .then(r => r.json())
      .then(d => {
        if (d.success && Array.isArray(d.data)) {
          setCategories(d.data)
        }
      })
      .catch(() => {})
  }, [])

  return (
    <div>
      <label className="report-label">{label} <span style={{ color: 'var(--accent)' }}>*</span></label>
      <div className="grid grid-cols-4 gap-2">
        {categories.map((cat) => {
          const Icon = CATEGORY_ICONS[cat.icon || ''] || HelpCircle
          const isActive = value === cat.id
          return (
            <button
              key={cat.id}
              type="button"
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all aspect-square justify-center"
              style={{
                background: isActive ? 'var(--accent-dim)' : 'var(--bg-input, var(--card-bg))',
                border: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                color: isActive ? 'var(--accent)' : 'var(--text-muted)',
              }}
              onClick={() => onChange(cat.id, cat.name)}
            >
              <Icon className="w-7 h-7" />
              <span className="text-xs font-semibold leading-tight text-center">{cat.name}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
