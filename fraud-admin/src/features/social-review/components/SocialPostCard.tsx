import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  CheckCircle,
  XCircle,
  Archive,
  ThumbsUp,
  MessageCircle,
  Image as ImageIcon,
  Users,
  ExternalLink,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import type { SocialPostItem } from '../types'
import { ImageLightbox } from './ImageLightbox'

interface SocialPostCardProps {
  post: SocialPostItem
  onApprove: (postId: string) => void
  onReject: (postId: string) => void
  onArchive: (postId: string) => void
  isApproving?: boolean
  isRejecting?: boolean
  isArchiving?: boolean
}

function formatDate(dateStr: string) {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}

function truncateMessage(msg: string, maxLen = 500) {
  if (!msg || msg.length <= maxLen) return msg
  return msg.slice(0, maxLen) + '...'
}

export function SocialPostCard({ post, onApprove, onReject, onArchive, isApproving, isRejecting, isArchiving }: SocialPostCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const message = expanded ? post.message : truncateMessage(post.message)
  const isLong = post.message && post.message.length > 500
  const hasImages = post.imageUrls && post.imageUrls.length > 0
  const hasComments = post.comments && post.comments.length > 0
  const hasEntities = post.entities && post.entities.length > 0

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        {/* Header — เหมือน FB post header */}
        <div className="flex items-center gap-3 px-4 pt-4 pb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm shrink-0">
            {post.authorName?.charAt(0) || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm truncate">{post.authorName || 'ไม่ทราบชื่อ'}</div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{formatDate(post.creationTime)}</span>
            </div>
          </div>
          {post.permalinkUrl && (
            <a
              href={post.permalinkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-primary shrink-0"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>

        {/* Post Type Badge */}
        {post.postType && (
          <div className="px-4 py-1.5 flex items-center gap-2">
            <Badge className={
              post.postType === 'fraud_report' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
              post.postType === 'fraud_warning' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' :
              post.postType === 'search_person' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' :
              post.postType === 'advertisement' ? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' :
              'bg-muted text-muted-foreground'
            }>
              {post.postType === 'fraud_report' ? 'ร้องเรียนโกง' :
               post.postType === 'fraud_warning' ? 'แจ้งเตือนมิจฉาชีพ' :
               post.postType === 'search_person' ? 'ตามหาคนโกง' :
               post.postType === 'advertisement' ? 'โฆษณา' :
               post.postType === 'unrelated' ? 'ไม่เกี่ยว' : post.postType}
            </Badge>
            <span className="text-[10px] text-muted-foreground">
              ({post.postTypeConfidence}) {post.postTypeReason}
            </span>
          </div>
        )}

        {/* Message */}
        <div className="px-4 py-2">
          <p className="text-sm whitespace-pre-line leading-relaxed">{message}</p>
          {isLong && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-primary hover:underline mt-1"
            >
              {expanded ? 'ย่อ' : 'ดูเพิ่มเติม...'}
            </button>
          )}
        </div>

        {/* Images — lightbox */}
        {hasImages && <ImageLightbox urls={post.imageUrls} />}

        {/* Engagement */}
        <div className="flex items-center gap-4 px-4 py-2 text-xs text-muted-foreground border-t border-b">
          <span className="flex items-center gap-1">
            <ThumbsUp className="h-3.5 w-3.5" />
            {post.reactionCount}
          </span>
          <span className="flex items-center gap-1">
            <MessageCircle className="h-3.5 w-3.5" />
            {post.commentCount}
          </span>
          {post.imageCount > 0 && (
            <span className="flex items-center gap-1">
              <ImageIcon className="h-3.5 w-3.5" />
              {post.imageCount}
            </span>
          )}
          {post.personCount > 0 && (
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {post.personCount} คน
            </span>
          )}
          <Badge variant="outline" className="ml-auto text-[10px]">
            {post.reviewStatus}
          </Badge>
        </div>

        {/* Comments toggle */}
        {hasComments && (
          <>
            <button
              onClick={() => setShowComments(!showComments)}
              className="w-full flex items-center justify-between px-4 py-2 text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
            >
              <span>ดู {post.comments.length} ความคิดเห็น</span>
              {showComments ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>

            {showComments && (
              <div className="px-4 pb-2 space-y-2 border-t">
                {post.comments.map((comment, i) => (
                  <div key={i} className="flex gap-2 pt-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground text-xs font-bold shrink-0">
                      {comment.authorName?.charAt(0) || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="bg-muted rounded-xl px-3 py-1.5">
                        <div className="text-xs font-semibold">{comment.authorName || 'ไม่ทราบชื่อ'}</div>
                        <div className="text-xs whitespace-pre-line">{comment.text}</div>
                      </div>
                      {/* Comment images — lightbox */}
                      {comment.imageUrls && comment.imageUrls.length > 0 && (
                        <div className="mt-1">
                          <ImageLightbox urls={comment.imageUrls} columns={3} />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Entities — แสดงชัดว่าอะไรค้นเจอ อะไรไม่เจอ */}
        {hasEntities && (() => {
          const searchable = post.entities.filter(e => e.sourceType === 'message')
          const notSearchable = post.entities.filter(e => e.sourceType !== 'message')
          return (
            <div className="px-4 py-2 border-t space-y-2">
              {searchable.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-green-600 dark:text-green-400 mb-1.5 font-semibold">✅ ค้นเจอใน Unified Search</div>
                  <div className="flex flex-wrap gap-1.5">
                    {searchable.map((e, i) => (
                      <span key={i} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        e.entityType === 'phone' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                        e.entityType === 'bank_account' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                        e.entityType === 'id_card' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                        'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
                      }`}>
                        {e.entityType === 'phone' ? '📱' : e.entityType === 'bank_account' ? '🏦' : e.entityType === 'id_card' ? '🪪' : '👤'}
                        {e.rawValue}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {notSearchable.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">❌ ค้นไม่เจอ (คนโพส/คน comment/อื่นๆ)</div>
                  <div className="flex flex-wrap gap-1.5">
                    {notSearchable.map((e, i) => {
                      const label = e.sourceType === 'post' ? 'คนโพส' :
                        e.sourceType === 'comment' ? 'คน comment' :
                        e.sourceType === 'image' ? 'จากรูป' : 'ไม่ทราบที่มา'
                      return (
                        <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground opacity-70">
                          👤 {e.rawValue}
                          <span className="text-[9px]">({label})</span>
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}
              {searchable.length === 0 && (
                <div className="text-[10px] text-muted-foreground">⚠️ ไม่มีข้อมูลที่จะค้นเจอใน Unified Search</div>
              )}
            </div>
          )
        })()}

        {/* Actions — Approve / Archive / Reject */}
        <div className="flex gap-2 px-4 py-3">
          <Button
            size="sm"
            className="flex-1"
            onClick={() => onApprove(post.postId)}
            disabled={isApproving || isRejecting || isArchiving}
          >
            <CheckCircle className="h-4 w-4 mr-1.5" />
            {isApproving ? 'กำลังอนุมัติ...' : 'อนุมัติ'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={() => onArchive(post.postId)}
            disabled={isApproving || isRejecting || isArchiving}
          >
            <Archive className="h-4 w-4 mr-1.5" />
            {isArchiving ? 'กำลังเก็บ...' : 'เก็บไว้ก่อน'}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="flex-1"
            onClick={() => onReject(post.postId)}
            disabled={isApproving || isRejecting || isArchiving}
          >
            <XCircle className="h-4 w-4 mr-1.5" />
            {isRejecting ? 'กำลังปฏิเสธ...' : 'ปฏิเสธ'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
