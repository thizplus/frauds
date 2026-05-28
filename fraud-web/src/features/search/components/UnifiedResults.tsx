'use client'

import { Bot, Database, Globe, Sparkles, BadgeCheck, Clock, ExternalLink, Phone, CreditCard, IdCard, User, MessageSquare, Heart, Image, Calendar, AlertTriangle, UserCheck, MessageCircle } from 'lucide-react'
import { formatPhone } from '@/lib/utils/format-phone'
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
      </div>

      {sorted.map((section) => (
        <div key={section.source} className="mb-6">
          {/* Section header */}
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

          {/* Section content */}
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
                <SocialCard key={`${item.matchedValue}-${idx}`} item={item} />
              ))
            )}
          </div>
        </div>
      ))}
    </>
  )
}

const ROLE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof AlertTriangle }> = {
  mentioned: { label: 'ถูกกล่าวถึง', color: 'var(--danger, #ef4444)', bg: 'rgba(239,68,68,.12)', icon: AlertTriangle },
  poster: { label: 'ผู้โพส', color: 'var(--text-muted)', bg: 'rgba(255,255,255,.06)', icon: UserCheck },
  commenter: { label: 'ผู้แสดงความเห็น', color: 'var(--text-muted)', bg: 'rgba(255,255,255,.06)', icon: MessageCircle },
}

function SocialCard({ item }: { item: SocialResult }) {
  const role = ROLE_CONFIG[item.role || ''] || ROLE_CONFIG.mentioned
  const RoleIcon = role.icon
  const post = item.postInfo

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '.75rem 1rem' }}>
      {/* Row 1: ชื่อ + role badge */}
      <div className="flex items-center gap-2.5">
        <div
          className="shrink-0 flex items-center justify-center"
          style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, var(--accent-dim), rgba(0,212,146,.05))', border: '1px solid var(--border-accent)', color: 'var(--accent)' }}
        >
          {item.entityType === 'phone' ? <Phone className="w-4 h-4" /> :
            item.entityType === 'bank_account' ? <CreditCard className="w-4 h-4" /> :
              item.entityType === 'id_card' ? <IdCard className="w-4 h-4" /> :
                <User className="w-4 h-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base font-bold truncate" style={{ color: 'var(--text)' }}>
              {item.displayName || item.matchedValue}
            </span>
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1"
              style={{ background: role.bg, color: role.color }}
            >
              <RoleIcon className="w-3 h-3" />
              {role.label}
            </span>
          </div>
          {item.entityType === 'phone' && (
            <div className="text-sm font-mono mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {formatPhone(item.matchedValue)}
            </div>
          )}
        </div>
      </div>

      {/* Row 2: ข้อความโพส (ถ้ามี) */}
      {post?.message && (
        <div
          className="text-sm mt-2.5 rounded-lg"
          style={{ padding: '.5rem .75rem', background: 'rgba(255,255,255,.03)', color: 'var(--text-secondary)', lineHeight: 1.5 }}
        >
          &ldquo;{post.message.length > 150 ? post.message.slice(0, 150) + '...' : post.message}&rdquo;
        </div>
      )}

      {/* Row 3: post meta — ผู้โพส + วันที่ + stats + link */}
      {post && (
        <div className="flex items-center gap-3 flex-wrap mt-2 text-xs" style={{ color: 'var(--text-dim)' }}>
          {post.authorName && (
            <span className="flex items-center gap-1">
              <User className="w-3.5 h-3.5" />
              {post.authorName}
            </span>
          )}
          {post.postDate && (
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {new Date(post.postDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
            </span>
          )}
          {post.reactionCount > 0 && (
            <span className="flex items-center gap-1">
              <Heart className="w-3.5 h-3.5" /> {post.reactionCount}
            </span>
          )}
          {post.commentCount > 0 && (
            <span className="flex items-center gap-1">
              <MessageSquare className="w-3.5 h-3.5" /> {post.commentCount}
            </span>
          )}
          {post.imageCount > 0 && (
            <span className="flex items-center gap-1">
              <Image className="w-3.5 h-3.5" /> {post.imageCount}
            </span>
          )}
        </div>
      )}

      {/* Row 4: link ดูต้นทาง */}
      {item.permalinkUrl && (
        <a
          href={item.permalinkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-2 rounded-lg text-sm font-bold mt-2.5 transition-opacity hover:opacity-80"
          style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="w-4 h-4" />
          ดูโพสต้นทาง
        </a>
      )}
    </div>
  )
}
