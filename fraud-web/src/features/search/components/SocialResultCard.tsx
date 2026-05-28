'use client'

import { Phone, CreditCard, IdCard, User, Calendar, Heart, MessageSquare, Image, ExternalLink } from 'lucide-react'
import { formatPhone } from '@/lib/utils/format-phone'
import { ROLE_CONFIG } from '../constants'
import type { PostInfo } from '../types'

interface SocialResultCardProps {
  displayName?: string
  matchedValue?: string
  entityType?: string
  role?: string
  permalinkUrl?: string
  postInfo?: PostInfo
  icon?: 'entity-type' | 'user'
}

export function SocialResultCard({
  displayName,
  matchedValue,
  entityType,
  role: roleName,
  permalinkUrl,
  postInfo: post,
  icon = 'entity-type',
}: SocialResultCardProps) {
  const role = ROLE_CONFIG[roleName || ''] || ROLE_CONFIG.mentioned
  const RoleIcon = role.icon

  const renderIcon = () => {
    if (icon === 'user') return <User className="w-4 h-4" />
    if (entityType === 'phone') return <Phone className="w-4 h-4" />
    if (entityType === 'bank_account') return <CreditCard className="w-4 h-4" />
    if (entityType === 'id_card') return <IdCard className="w-4 h-4" />
    return <User className="w-4 h-4" />
  }

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '.75rem 1rem' }}>
      {/* Row 1: ชื่อ + role badge */}
      <div className="flex items-center gap-2.5">
        <div
          className="shrink-0 flex items-center justify-center"
          style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, var(--accent-dim), rgba(0,212,146,.05))', border: '1px solid var(--border-accent)', color: 'var(--accent)' }}
        >
          {renderIcon()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base font-bold truncate" style={{ color: 'var(--text)' }}>
              {displayName || matchedValue || 'ไม่ทราบชื่อ'}
            </span>
            {roleName && (
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1"
                style={{ background: role.bg, color: role.color }}
              >
                <RoleIcon className="w-3 h-3" />
                {role.label}
              </span>
            )}
          </div>
          {entityType === 'phone' && matchedValue && (
            <div className="text-sm font-mono mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {formatPhone(matchedValue)}
            </div>
          )}
        </div>
      </div>

      {/* Row 2: ข้อความโพส */}
      {post?.message && (
        <div
          className="text-sm mt-2.5 rounded-lg"
          style={{ padding: '.5rem .75rem', background: 'rgba(255,255,255,.03)', color: 'var(--text-secondary)', lineHeight: 1.5 }}
        >
          &ldquo;{post.message.length > 150 ? post.message.slice(0, 150) + '...' : post.message}&rdquo;
        </div>
      )}

      {/* Row 3: post metadata */}
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
            <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5" /> {post.reactionCount}</span>
          )}
          {post.commentCount > 0 && (
            <span className="flex items-center gap-1"><MessageSquare className="w-3.5 h-3.5" /> {post.commentCount}</span>
          )}
          {post.imageCount > 0 && (
            <span className="flex items-center gap-1"><Image className="w-3.5 h-3.5" /> {post.imageCount}</span>
          )}
        </div>
      )}

      {/* Row 4: link */}
      {permalinkUrl && (
        <a
          href={permalinkUrl}
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
