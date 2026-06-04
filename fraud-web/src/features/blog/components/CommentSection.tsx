'use client'

import { useState, useEffect, useCallback } from 'react'
import { MessageCircle, Send, ChevronDown, Reply } from 'lucide-react'
import { useAuthStore } from '@/lib/stores/auth'
import { apiClient } from '@/lib/api/client'
import { LoginModal } from '@/features/auth'

interface Comment {
  id: string
  content: string
  userName: string
  userAvatar: string
  createdAt: string
  parentId?: string
  replies?: Comment[]
}

interface CommentSectionProps {
  articleSlug: string
}

export function CommentSection({ articleSlug }: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [offset, setOffset] = useState(0)
  const [content, setContent] = useState('')
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)

  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)

  const fetchComments = useCallback(async (reset = false) => {
    try {
      setLoading(true)
      const newOffset = reset ? 0 : offset
      const res = await apiClient.get(`/articles/slug/${articleSlug}/comments?limit=20&offset=${newOffset}`)
      const wrapper = res.data as { success: boolean; data: { comments: Comment[]; total: number } }
      const comments = wrapper.data?.comments ?? []
      const total = wrapper.data?.total ?? 0
      if (reset) {
        setComments(comments)
        setOffset(20)
      } else {
        setComments((prev) => [...prev, ...comments])
        setOffset((prev) => prev + 20)
      }
      setTotal(total)
    } catch {
      // ไม่ต้องแสดง error — ถ้า API ยังไม่พร้อม
    } finally {
      setLoading(false)
    }
  }, [articleSlug, offset])

  useEffect(() => {
    fetchComments(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleSlug])

  const handleSubmit = async () => {
    if (!content.trim()) return
    if (!isLoggedIn) {
      setLoginOpen(true)
      return
    }

    setSubmitting(true)
    try {
      await apiClient.post(`/articles/slug/${articleSlug}/comments`, {
        content: content.trim(),
        parentId: replyTo?.id || undefined,
      })
      setContent('')
      setReplyTo(null)
      fetchComments(true)
    } catch {
      // handle error silently
    } finally {
      setSubmitting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'เมื่อสักครู่'
    if (mins < 60) return `${mins} นาที`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours} ชม.`
    const days = Math.floor(hours / 24)
    if (days < 30) return `${days} วัน`
    return new Date(dateStr).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
  }

  const hasMore = comments.length < total

  return (
    <section className="comment-section">
      <h3 className="comment-section-title">
        <MessageCircle className="w-5 h-5" />
        ความคิดเห็น ({total})
      </h3>

      {/* Comment form */}
      <div className="comment-form">
        {replyTo && (
          <div className="comment-reply-badge">
            ตอบกลับ {replyTo.name}
            <button onClick={() => setReplyTo(null)} className="ml-2 opacity-60 hover:opacity-100">&times;</button>
          </div>
        )}
        {isLoggedIn ? (
          <div className="comment-input-col">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="เขียนความคิดเห็น..."
              rows={3}
              maxLength={1000}
              className="comment-textarea"
            />
            <button
              onClick={handleSubmit}
              disabled={submitting || !content.trim()}
              className="btn btn-primary btn-sm comment-send-btn"
            >
              <Send className="w-4 h-4" />
              {submitting ? 'กำลังส่ง...' : 'ส่งความคิดเห็น'}
            </button>
          </div>
        ) : (
          <button onClick={() => setLoginOpen(true)} className="btn btn-secondary btn-sm w-full">
            เข้าสู่ระบบเพื่อแสดงความคิดเห็น
          </button>
        )}
      </div>

      {/* Comments list */}
      {loading && comments.length === 0 ? (
        <p className="text-sm text-secondary text-center py-4">กำลังโหลด...</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-secondary text-center py-4">ยังไม่มีความคิดเห็น เป็นคนแรกเลย!</p>
      ) : (
        <div className="comment-list">
          {comments.map((c) => (
            <div key={c.id} className="comment-item">
              <div className="comment-avatar">
                {c.userAvatar ? (
                  <img src={c.userAvatar} alt="" referrerPolicy="no-referrer" />
                ) : (
                  <span>{c.userName?.charAt(0)?.toUpperCase() || 'U'}</span>
                )}
              </div>
              <div className="comment-body">
                <div className="comment-meta">
                  <span className="comment-author">{c.userName}</span>
                  <span className="comment-time">{timeAgo(c.createdAt)}</span>
                </div>
                <p className="comment-text">{c.content}</p>
                <button
                  onClick={() => setReplyTo({ id: c.id, name: c.userName })}
                  className="comment-reply-btn"
                >
                  <Reply className="w-3.5 h-3.5" />
                  ตอบกลับ
                </button>

                {/* Replies */}
                {c.replies && c.replies.length > 0 && (
                  <div className="comment-replies">
                    {c.replies.map((r) => (
                      <div key={r.id} className="comment-item comment-item-reply">
                        <div className="comment-avatar comment-avatar-sm">
                          {r.userAvatar ? (
                            <img src={r.userAvatar} alt="" referrerPolicy="no-referrer" />
                          ) : (
                            <span>{r.userName?.charAt(0)?.toUpperCase() || 'U'}</span>
                          )}
                        </div>
                        <div className="comment-body">
                          <div className="comment-meta">
                            <span className="comment-author">{r.userName}</span>
                            <span className="comment-time">{timeAgo(r.createdAt)}</span>
                          </div>
                          <p className="comment-text">{r.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Load more */}
      {hasMore && (
        <button onClick={() => fetchComments(false)} className="btn btn-secondary btn-sm w-full mt-4" disabled={loading}>
          <ChevronDown className="w-4 h-4" />
          โหลดเพิ่ม
        </button>
      )}

      <LoginModal open={loginOpen} onOpenChange={setLoginOpen} />
    </section>
  )
}
