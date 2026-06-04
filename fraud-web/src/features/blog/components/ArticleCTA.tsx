import Link from 'next/link'
import { Search, AlertTriangle, Shield, ArrowRight } from 'lucide-react'

type CTAVariant = 'mid' | 'bottom'

interface ArticleCTAProps {
  variant: CTAVariant
  categorySlug?: string
}

const CTA_CONFIG: Record<string, { primary: CTAAction; secondary: CTAAction }> = {
  news: {
    primary: { label: 'ค้นหาคนโกง', href: '/', icon: 'search' },
    secondary: { label: 'แจ้งข้อมูลคนโกง', href: '/report', icon: 'alert' },
  },
  review: {
    primary: { label: 'ค้นหาคนโกง', href: '/', icon: 'search' },
    secondary: { label: 'แจ้งข้อมูลคนโกง', href: '/report', icon: 'alert' },
  },
  default: {
    primary: { label: 'ค้นหาคนโกง', href: '/', icon: 'search' },
    secondary: { label: 'สมัครสมาชิก', href: '/pricing', icon: 'shield' },
  },
}

interface CTAAction {
  label: string
  href: string
  icon: 'search' | 'alert' | 'shield'
}

const IconMap = { search: Search, alert: AlertTriangle, shield: Shield }

export function ArticleCTA({ variant, categorySlug }: ArticleCTAProps) {
  const config = CTA_CONFIG[categorySlug || ''] || CTA_CONFIG.default
  const Icon1 = IconMap[config.primary.icon]
  const Icon2 = IconMap[config.secondary.icon]

  if (variant === 'mid') {
    return (
      <div className="article-cta-mid">
        <div className="article-cta-mid-icon">
          <Search className="w-6 h-6" />
        </div>
        <div className="article-cta-mid-body">
          <p className="article-cta-mid-title">เช็คก่อน เชื่อใคร</p>
          <p className="article-cta-mid-desc">ค้นหาชื่อ เบอร์ เลขบัญชีคนโกงได้ทันที ฟรี!</p>
          <div className="article-cta-actions">
            <Link href={config.primary.href} className="btn btn-primary btn-sm">
              <Icon1 className="w-4 h-4" />
              {config.primary.label}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Bottom CTA — ใหญ่เด่น
  return (
    <div className="article-cta-bottom">
      <div className="article-cta-bottom-shield">
        <Shield className="w-10 h-10" />
      </div>
      <h3 className="article-cta-bottom-title">ปกป้องตัวเองจากมิจฉาชีพ</h3>
      <p className="article-cta-bottom-desc">
        ค้นหาชื่อ เบอร์โทร เลขบัญชี ก่อนโอนเงินให้ใคร<br />
        ระบบ AI ตรวจสอบฐานข้อมูลให้ทันที
      </p>
      <div className="article-cta-actions article-cta-actions-center">
        <Link href={config.primary.href} className="btn btn-primary">
          <Icon1 className="w-4 h-4" />
          {config.primary.label}
          <ArrowRight className="w-4 h-4" />
        </Link>
        <Link href={config.secondary.href} className="btn btn-secondary">
          <Icon2 className="w-4 h-4" />
          {config.secondary.label}
        </Link>
      </div>
    </div>
  )
}
