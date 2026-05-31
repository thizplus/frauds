import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  CheckCircle,
  XCircle,
  ThumbsUp,
  MessageCircle,
  Image,
  Users,
  ExternalLink,
  Clock,
} from 'lucide-react'
import type { SocialPostItem } from '../types'

interface SocialPostCardProps {
  post: SocialPostItem
  onApprove: (postId: string) => void
  onReject: (postId: string) => void
  isApproving?: boolean
  isRejecting?: boolean
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

export function SocialPostCard({ post, onApprove, onReject, isApproving, isRejecting }: SocialPostCardProps) {
  const [expanded, setExpanded] = useState(false)
  const message = expanded ? post.message : truncateMessage(post.message)
  const isLong = post.message && post.message.length > 500

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        {/* Header — เหมือน FB post header */}
        <div className="flex items-center gap-3 px-4 pt-4 pb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">
            {post.authorName?.charAt(0) || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm truncate">{post.authorName || 'ไม่ทราบชื่อ'}</div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{formatDate(post.creationTime)}</span>
              <span className="mx-1">·</span>
              <span className="text-muted-foreground/70">Group: {post.groupId}</span>
            </div>
          </div>
          {post.permalinkUrl && (
            <a
              href={post.permalinkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-primary"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>

        {/* Message — เนื้อหาโพส */}
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

        {/* Engagement — reaction/comment/image counts */}
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
              <Image className="h-3.5 w-3.5" />
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

        {/* Actions — Approve / Reject */}
        <div className="flex gap-2 px-4 py-3">
          <Button
            size="sm"
            className="flex-1"
            onClick={() => onApprove(post.postId)}
            disabled={isApproving || isRejecting}
          >
            <CheckCircle className="h-4 w-4 mr-1.5" />
            {isApproving ? 'กำลังอนุมัติ...' : 'อนุมัติ'}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="flex-1"
            onClick={() => onReject(post.postId)}
            disabled={isApproving || isRejecting}
          >
            <XCircle className="h-4 w-4 mr-1.5" />
            {isRejecting ? 'กำลังปฏิเสธ...' : 'ปฏิเสธ'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
