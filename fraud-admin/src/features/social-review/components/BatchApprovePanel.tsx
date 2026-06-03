import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { CheckCircle, Loader2, AlertCircle, Users } from 'lucide-react'
import { usePostTypeCounts, useStartBatchApproveByType, useBatchApproveProgress } from '../hooks'
import { useQueryClient } from '@tanstack/react-query'
import { socialReviewKeys } from '../hooks'

const POST_TYPE_LABELS: Record<string, string> = {
  fraud_report: 'ร้องเรียนโกง',
  fraud_warning: 'แจ้งเตือนมิจฉาชีพ',
  search_person: 'ตามหาคนโกง',
  unrelated: 'ไม่เกี่ยว',
  unknown: 'ไม่ระบุ',
}

const POST_TYPE_STYLES: Record<string, string> = {
  fraud_report: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  fraud_warning: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  search_person: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  unrelated: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  unknown: 'bg-muted text-muted-foreground',
}

export function BatchApprovePanel() {
  const qc = useQueryClient()
  const { data: counts, isLoading } = usePostTypeCounts()
  const startMutation = useStartBatchApproveByType()
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(
    new Set(['fraud_report', 'search_person', 'fraud_warning'])
  )
  const [jobId, setJobId] = useState<string | null>(null)
  const { data: progress } = useBatchApproveProgress(jobId)

  if (isLoading || !counts) return null
  if (counts.total === 0) return null

  const selectedCount = counts.counts
    .filter(c => selectedTypes.has(c.postType))
    .reduce((sum, c) => sum + c.count, 0)

  const toggleType = (type: string) => {
    const next = new Set(selectedTypes)
    if (next.has(type)) next.delete(type)
    else next.add(type)
    setSelectedTypes(next)
  }

  const handleStart = async () => {
    if (selectedCount === 0) return
    if (!confirm(`อนุมัติ ${selectedCount} โพส ดำเนินการ?`)) return

    try {
      const id = await startMutation.mutateAsync(Array.from(selectedTypes))
      setJobId(id)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'เกิดข้อผิดพลาด'
      alert(msg)
    }
  }

  const isRunning = progress?.status === 'running'
  const isCompleted = progress?.status === 'completed'
  const progressPercent = progress && progress.batchesTotal > 0
    ? Math.round((progress.batchesDone / progress.batchesTotal) * 100)
    : 0

  const handleReset = () => {
    setJobId(null)
    qc.invalidateQueries({ queryKey: socialReviewKeys.all })
  }

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Batch Approve ตามประเภท</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Checkboxes */}
        {!isRunning && !isCompleted && (
          <>
            <div className="flex flex-wrap gap-3">
              {counts.counts.map(c => (
                <label key={c.postType} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={selectedTypes.has(c.postType)}
                    onCheckedChange={() => toggleType(c.postType)}
                  />
                  <Badge className={POST_TYPE_STYLES[c.postType] || POST_TYPE_STYLES.unknown}>
                    {POST_TYPE_LABELS[c.postType] || c.postType}
                  </Badge>
                  <span className="text-sm text-muted-foreground">{c.count}</span>
                </label>
              ))}
            </div>
            <Button
              onClick={handleStart}
              disabled={selectedCount === 0 || startMutation.isPending}
              size="sm"
            >
              {startMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-1.5" />
              )}
              อนุมัติ {selectedCount} โพส
            </Button>
          </>
        )}

        {/* Progress */}
        {isRunning && progress && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span>กำลังอนุมัติ... batch {progress.batchesDone}/{progress.batchesTotal}</span>
            </div>
            <Progress value={progressPercent} />
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span>อนุมัติ: {progress.approved}/{progress.totalFound}</span>
              {progress.failed > 0 && <span className="text-red-500">ล้มเหลว: {progress.failed}</span>}
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                Face: {progress.faceIngested}
              </span>
            </div>
          </div>
        )}

        {/* Summary */}
        {isCompleted && progress && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
              <CheckCircle className="h-4 w-4" />
              <span>เสร็จสิ้น!</span>
            </div>
            <div className="flex gap-4 text-sm">
              <span>อนุมัติ: <strong>{progress.approved}</strong></span>
              {progress.failed > 0 && (
                <span className="text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" />
                  ล้มเหลว: {progress.failed}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                Face embeddings: +{progress.faceIngested}
              </span>
            </div>
            <Button size="sm" variant="outline" onClick={handleReset}>
              ปิด
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
