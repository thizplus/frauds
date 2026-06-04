'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { hasConsented, acceptAll, rejectAll } from '@/lib/gtm/consent'

export function CookieConsent() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    // แสดงเฉพาะเมื่อยังไม่เคย consent + delay เล็กน้อยให้หน้าโหลดก่อน
    const timer = setTimeout(() => {
      if (!hasConsented()) setShow(true)
    }, 1500)
    return () => clearTimeout(timer)
  }, [])

  if (!show) return null

  const handleAccept = () => {
    acceptAll()
    setShow(false)
    window.dispatchEvent(new Event('consent-updated'))
  }

  const handleReject = () => {
    rejectAll()
    setShow(false)
  }

  return (
    <div className="cookie-consent">
      <div className="cookie-consent-inner">
        <p className="cookie-consent-text">
          เว็บไซต์นี้ใช้คุกกี้เพื่อพัฒนาประสบการณ์การใช้งาน{' '}
          <Link href="/privacy" className="cookie-consent-link">
            อ่านนโยบาย
          </Link>
        </p>
        <div className="cookie-consent-actions">
          <button onClick={handleReject} className="btn btn-ghost btn-sm">
            ปฏิเสธ
          </button>
          <button onClick={handleAccept} className="btn btn-primary btn-sm">
            ยอมรับ
          </button>
        </div>
      </div>
    </div>
  )
}
