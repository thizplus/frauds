'use client'

import { Globe, User, Sparkles, ExternalLink } from 'lucide-react'
import type { FaceMatch } from '../types'

interface FaceSocialResultCardProps {
  match: FaceMatch
}

export function FaceSocialResultCard({ match }: FaceSocialResultCardProps) {
  const social = match.socialPost!
  const similarityPct = Math.round(match.similarity * 100)
  const strengthLabel = match.evidenceStrength === 'high' ? 'สูง' : match.evidenceStrength === 'medium' ? 'กลาง' : 'ต่ำ'
  const strengthColor = match.evidenceStrength === 'high' ? 'var(--danger, #ef4444)' : match.evidenceStrength === 'medium' ? 'var(--warning, #f59e0b)' : 'var(--text-muted)'

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '.75rem 1rem' }}>
      <div className="flex items-center gap-2.5">
        <div
          className="shrink-0 flex items-center justify-center"
          style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, var(--accent-dim), rgba(0,212,146,.05))', border: '1px solid var(--border-accent)', color: 'var(--accent)' }}
        >
          <Globe className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base font-bold truncate" style={{ color: 'var(--text)' }}>
              {social.displayName || 'ไม่ทราบชื่อ'}
            </span>
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0"
              style={{ background: `color-mix(in srgb, ${strengthColor} 15%, transparent)`, color: strengthColor }}
            >
              {strengthLabel}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Sparkles className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--text-dim)' }} />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>ใบหน้าตรงกัน</span>
            <span className="text-sm font-bold" style={{ color: similarityPct >= 70 ? 'var(--accent)' : 'var(--text-dim)' }}>{similarityPct}%</span>
            <div className="flex-1 h-1.5 rounded-full" style={{ background: 'var(--bg-tertiary, rgba(255,255,255,0.05))' }}>
              <div className="h-1.5 rounded-full" style={{ width: `${similarityPct}%`, background: similarityPct >= 70 ? 'var(--accent)' : 'var(--text-dim)' }} />
            </div>
          </div>
        </div>
      </div>

      {social.permalinkUrl && (
        <a
          href={social.permalinkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-2 rounded-lg text-sm font-bold mt-2.5 transition-opacity hover:opacity-80"
          style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
        >
          <ExternalLink className="w-4 h-4" />
          ดูโพสต้นทาง
        </a>
      )}
    </div>
  )
}
