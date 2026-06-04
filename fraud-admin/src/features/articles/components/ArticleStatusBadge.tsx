import { Badge } from '@/components/ui/badge'
import type { ArticleStatus } from '../types'

const STATUS_CONFIG: Record<ArticleStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'แบบร่าง', variant: 'secondary' },
  published: { label: 'เผยแพร่แล้ว', variant: 'default' },
  archived: { label: 'เก็บถาวร', variant: 'outline' },
}

export function ArticleStatusBadge({ status }: { status: ArticleStatus }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.draft
  return <Badge variant={config.variant}>{config.label}</Badge>
}
