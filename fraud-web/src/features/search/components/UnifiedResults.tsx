'use client'

import { Bot, Database, Globe, Sparkles, BadgeCheck, Clock, ExternalLink } from 'lucide-react'
import type { FraudResponse, UnifiedSection, SocialResult } from '../types'
import { FraudRow } from './FraudRow'

interface UnifiedResultsProps {
  query: string
  sections: UnifiedSection[]
  totalResults: number
  onSelectFraud: (fraud: FraudResponse) => void
  loading?: boolean
  isMember?: boolean
}

export function UnifiedResults({
  query,
  sections,
  totalResults,
  onSelectFraud,
  loading,
  isMember = false,
}: UnifiedResultsProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card p-4 animate-pulse">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-slate-800" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-slate-800 rounded w-1/3" />
                <div className="h-3 bg-slate-800 rounded w-1/2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (!sections || sections.length === 0 || totalResults === 0) {
    return (
      <div className="card p-8 text-center">
        <Database className="w-10 h-10 mx-auto text-slate-600 mb-3" />
        <div className="text-slate-300 font-medium">ไม่พบข้อมูล</div>
        <div className="text-sm text-slate-500 mt-1">
          ไม่พบรายชื่อที่ตรงกับ &quot;{query}&quot;
        </div>
      </div>
    )
  }

  // เรียง fraud section ก่อน social
  const sorted = [...sections].sort((a, b) => {
    if (a.source === 'frauds') return -1
    if (b.source === 'frauds') return 1
    return 0
  })

  return (
    <>
      {/* Result header */}
      <div className="mb-4 flex items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2.5 text-base">
          <span className="result-bot-badge">
            <Bot className="w-5 h-5" />
          </span>
          <span style={{ color: 'var(--text-secondary)' }}>
            AI พบ <span className="text-accent font-semibold">{totalResults} รายการ</span> ที่ตรงกับ{' '}
            <span className="font-mono" style={{ color: 'var(--text)' }}>{query}</span>
          </span>
        </div>
        <span className="hidden sm:inline-flex live-pill text-sm">
          <Sparkles className="w-3.5 h-3.5" />
          AI scored
        </span>
      </div>

      {sorted.map((section) => (
        <div key={section.source} className="mb-6">
          {/* Section header */}
          <div className="flex items-center gap-2 mb-3 px-1">
            {section.source === 'frauds' ? (
              <Database className="w-5 h-5 text-accent" />
            ) : (
              <Globe className="w-5 h-5 text-accent" />
            )}
            <span className="text-base font-semibold" style={{ color: 'var(--text)' }}>
              {section.label}
            </span>
            <span
              className="text-sm px-2 py-0.5 rounded-full font-bold"
              style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
            >
              {section.count}
            </span>
          </div>

          {/* Section content */}
          {section.source === 'social' && (
            <p className="text-sm mb-2 px-1" style={{ color: 'var(--text-dim)' }}>
              ข้อมูลนี้ไม่ใช่การยืนยันการโกง เป็นเพียงข้อมูลที่เก็บจาก Facebook กรุณาตรวจสอบ URL ต้นทางเพื่อประกอบการพิจารณา
            </p>
          )}
          <div className="row-ai-list">
            {section.source === 'frauds' ? (
              (section.results as FraudResponse[]).map((fraud) => (
                <FraudRow
                  key={fraud.id}
                  fraud={fraud}
                  onClick={() => onSelectFraud(fraud)}
                  isMember={isMember}
                />
              ))
            ) : (
              (section.results as SocialResult[]).map((item, idx) => (
                <SocialCard key={`${item.matchedValue}-${idx}`} item={item} />
              ))
            )}
          </div>
        </div>
      ))}
    </>
  )
}

function SocialCard({ item }: { item: SocialResult }) {
  const confidencePct = Math.round(item.confidence * 100)

  return (
    <div className="flex items-center gap-3" style={{ padding: '.7rem 1rem', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12 }}>
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: 'var(--accent-dim)' }}
      >
        <Globe className="w-5 h-5 text-accent" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-base font-medium truncate" style={{ color: 'var(--text)' }}>
            {item.displayName || item.matchedValue}
          </span>
          {item.verificationState === 'verified' && (
            <BadgeCheck className="w-4 h-4 text-accent shrink-0" />
          )}
        </div>
        <div className="flex items-center gap-2 text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
          <span className="font-mono">{item.matchedValue}</span>
          <span className="px-1.5 py-0.5 rounded text-xs" style={{ background: 'var(--bg-elevated)', color: 'var(--text-dim)' }}>
            {item.entityType}
          </span>
          {item.permalinkUrl && (
            <a
              href={item.permalinkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:underline text-xs"
              style={{ color: 'var(--accent)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              ดูต้นทาง
            </a>
          )}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-xs" style={{ color: 'var(--text-dim)' }}>ความเชื่อมั่น</div>
        <div
          className="text-base font-bold"
          style={{ color: confidencePct >= 80 ? 'var(--accent)' : 'var(--text-dim)' }}
        >
          {confidencePct}%
        </div>
      </div>
    </div>
  )
}
