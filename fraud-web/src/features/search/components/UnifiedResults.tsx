'use client'

import { Bot, Database } from 'lucide-react'
import type { FraudResponse, UnifiedSection, SocialResult } from '../types'
import { FraudRow } from './FraudRow'
import { SocialResultCard } from './SocialResultCard'

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

  const sorted = [...sections].sort((a, b) => {
    if (a.source === 'frauds') return -1
    if (b.source === 'frauds') return 1
    return 0
  })

  return (
    <>
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
      </div>

      {sorted.map((section) => (
        <div key={section.source} className="mb-6">
          <div className="flex items-center gap-2 mb-2 px-1">
            <span className="text-sm font-bold" style={{ color: 'var(--text-muted)' }}>
              {section.label}
            </span>
            <span
              className="text-xs px-1.5 py-0.5 rounded-full font-bold"
              style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
            >
              {section.count}
            </span>
          </div>

          {section.source === 'social' && (
            <p className="text-sm mb-2 px-1" style={{ color: 'var(--text-dim)' }}>
              ข้อมูลนี้ไม่ใช่การยืนยันการโกง เป็นเพียงข้อมูลที่เก็บจากโซเชียลมีเดีย กรุณาตรวจสอบ URL ต้นทางเพื่อประกอบการพิจารณา
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
                <SocialResultCard
                  key={`${item.matchedValue}-${idx}`}
                  displayName={item.displayName}
                  matchedValue={item.matchedValue}
                  entityType={item.entityType}
                  role={item.role}
                  permalinkUrl={item.permalinkUrl}
                  postInfo={item.postInfo}
                  icon="entity-type"
                />
              ))
            )}
          </div>
        </div>
      ))}
    </>
  )
}
