'use client'

import { Search, Bot, Camera } from 'lucide-react'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  onSearch: () => void
  onFaceSearch?: () => void
  loading?: boolean
}

export function SearchBar({ value, onChange, onSearch, onFaceSearch, loading }: SearchBarProps) {
  return (
    <div className="card p-2">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="search-field">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
          <input
            type="text"
            className="input input-hero"
            placeholder="ชื่อ · เบอร์โทร · เลขบัญชี"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSearch()}
            style={{ paddingRight: onFaceSearch ? '6rem' : undefined }}
          />
          <span className="search-ai-indicator">
            <span className="live-dot" />
            AI
          </span>
          {onFaceSearch && (
            <button
              className="absolute right-14 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-colors"
              style={{ color: 'var(--text-dim)' }}
              onClick={onFaceSearch}
              title="ค้นด้วยใบหน้า"
              type="button"
            >
              <Camera className="w-5 h-5" />
            </button>
          )}
        </div>
        <button
          className={`btn-ai ${loading ? 'loading' : ''}`}
          onClick={onSearch}
          disabled={loading || !value.trim()}
        >
          <span className="btn-ai-fx">
            <span className="btn-ai-scan" />
          </span>
          <span className="btn-ai-icon">
            <Bot className="w-7 h-7" />
          </span>
          <span className="btn-ai-spinner" />
          <span className="btn-ai-text">
            <span className="btn-ai-primary">{loading ? 'กำลังค้นหา...' : 'ค้นหาด้วย AI'}</span>
            <span className="btn-ai-secondary">วิเคราะห์ 5 ขั้นตอน · ~10s</span>
          </span>
        </button>
      </div>
    </div>
  )
}
