import { useCallback, useEffect, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CheckCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { SocialPostCard } from '../components/SocialPostCard'
import {
  useSocialReviewFeed,
  useApproveSocialPost,
  useRejectSocialPost,
  useBatchApproveSocialPosts,
} from '../hooks'

export function SocialReviewPage() {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useSocialReviewFeed()
  const approve = useApproveSocialPost()
  const reject = useRejectSocialPost()
  const batchApprove = useBatchApproveSocialPosts()
  const [processingId, setProcessingId] = useState<string | null>(null)
  const observerRef = useRef<HTMLDivElement>(null)

  // Infinite scroll — IntersectionObserver
  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [target] = entries
      if (target.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage()
      }
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage]
  )

  useEffect(() => {
    const el = observerRef.current
    if (!el) return
    const observer = new IntersectionObserver(handleObserver, { threshold: 0.1 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [handleObserver])

  // Flatten pages → posts
  const allPosts = data?.pages.flatMap((page) => page.data) ?? []
  const total = data?.pages[0]?.meta.total ?? 0

  const handleApprove = (postId: string) => {
    setProcessingId(postId)
    approve.mutate(postId, {
      onSuccess: () => {
        toast.success('อนุมัติแล้ว')
        setProcessingId(null)
      },
      onError: () => {
        toast.error('อนุมัติไม่สำเร็จ')
        setProcessingId(null)
      },
    })
  }

  const handleReject = (postId: string) => {
    setProcessingId(postId)
    reject.mutate(postId, {
      onSuccess: () => {
        toast.success('ปฏิเสธแล้ว')
        setProcessingId(null)
      },
      onError: () => {
        toast.error('ปฏิเสธไม่สำเร็จ')
        setProcessingId(null)
      },
    })
  }

  const handleBatchApproveAll = () => {
    const ids = allPosts.map((p) => p.postId)
    if (ids.length === 0) return
    if (!window.confirm(`อนุมัติทั้งหมด ${ids.length} โพส?`)) return

    batchApprove.mutate(ids, {
      onSuccess: (result) => {
        const data = result as { approved: number; failed: number }
        toast.success(`อนุมัติ ${data.approved} โพส`)
      },
      onError: () => toast.error('เกิดข้อผิดพลาด'),
    })
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">ตรวจสอบ Social Posts</h1>
          <Badge variant="secondary">{total} รอตรวจ</Badge>
        </div>
        {allPosts.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleBatchApproveAll}
            disabled={batchApprove.isPending}
          >
            <CheckCircle className="h-4 w-4 mr-1.5" />
            {batchApprove.isPending ? 'กำลังอนุมัติ...' : `อนุมัติทั้งหมด (${allPosts.length})`}
          </Button>
        )}
      </div>

      {/* Feed */}
      <div className="max-w-2xl mx-auto space-y-4">
        {isLoading ? (
          // Skeleton loading
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ))
        ) : allPosts.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">ไม่มีโพสรอตรวจสอบ</p>
            <p className="text-sm mt-1">ข้อมูลใหม่จาก Collector จะแสดงที่นี่</p>
          </div>
        ) : (
          <>
            {allPosts.map((post) => (
              <SocialPostCard
                key={post.postId}
                post={post}
                onApprove={handleApprove}
                onReject={handleReject}
                isApproving={processingId === post.postId && approve.isPending}
                isRejecting={processingId === post.postId && reject.isPending}
              />
            ))}

            {/* Infinite scroll trigger */}
            <div ref={observerRef} className="flex justify-center py-4">
              {isFetchingNextPage && (
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  กำลังโหลด...
                </div>
              )}
              {!hasNextPage && allPosts.length > 0 && (
                <p className="text-xs text-muted-foreground">แสดงครบทั้งหมดแล้ว</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
