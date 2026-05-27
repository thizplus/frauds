'use client'

import { Search, X } from 'lucide-react'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function SearchInput({ value, onChange, placeholder = 'ค้นหา...' }: SearchInputProps) {
  return (
    <div className="relative">
      <Search
        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
        style={{ color: value ? 'var(--accent)' : 'var(--text-dim)' }}
      />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full pl-10 pr-9 py-2.5 text-sm rounded-xl outline-none"
        style={{
          background: 'var(--bg-input)',
          border: '1px solid var(--border)',
          color: 'var(--text)',
        }}
      />
      {value && (
        <button
          className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded"
          style={{ color: 'var(--text-dim)' }}
          onClick={() => onChange('')}
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}
