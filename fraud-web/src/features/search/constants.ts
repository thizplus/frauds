import { AlertTriangle, UserCheck, MessageCircle } from 'lucide-react'

export const ROLE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof AlertTriangle }> = {
  mentioned: { label: 'ถูกกล่าวถึง', color: 'var(--danger, #ef4444)', bg: 'rgba(239,68,68,.12)', icon: AlertTriangle },
  poster: { label: 'ผู้โพส', color: 'var(--text-muted)', bg: 'rgba(255,255,255,.06)', icon: UserCheck },
  commenter: { label: 'ผู้แสดงความเห็น', color: 'var(--text-muted)', bg: 'rgba(255,255,255,.06)', icon: MessageCircle },
}
