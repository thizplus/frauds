'use client'

import { useState, useEffect } from 'react'

interface ShareButtonsProps {
  url: string
  title: string
}

const FacebookIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
)

const LineIcon = () => (
  <svg viewBox="0 0 320 320" width="20" height="20" fill="currentColor">
    <path d="M160 0C71.6 0 0 59.2 0 132c0 65.2 57.8 119.8 135.8 130.1 5.3 1.1 12.5 3.5 14.3 8 1.6 4.1 1.1 10.5.5 14.6l-2.3 13.8c-.7 4.1-3.3 16 14 8.7 17.3-7.3 93.3-54.9 127.3-94C310.7 188.8 320 161.5 320 132 320 59.2 248.4 0 160 0zm-47.4 172.9h-28.3c-3.2 0-5.8-2.6-5.8-5.8V112c0-3.2 2.6-5.8 5.8-5.8 3.2 0 5.8 2.6 5.8 5.8v49.3h22.5c3.2 0 5.8 2.6 5.8 5.8 0 3.2-2.6 5.8-5.8 5.8zm22.5-5.8c0 3.2-2.6 5.8-5.8 5.8-3.2 0-5.8-2.6-5.8-5.8V112c0-3.2 2.6-5.8 5.8-5.8 3.2 0 5.8 2.6 5.8 5.8v55.1zm57.1 0c0 2.3-1.4 4.4-3.5 5.3-.7.3-1.5.5-2.3.5-1.6 0-3.1-.7-4.2-1.9l-28.3-38.5v34.6c0 3.2-2.6 5.8-5.8 5.8-3.2 0-5.8-2.6-5.8-5.8V112c0-2.3 1.4-4.4 3.5-5.3 2.3-1 5-.4 6.5 1.4l28.3 38.5V112c0-3.2 2.6-5.8 5.8-5.8 3.2 0 5.8 2.6 5.8 5.8v55.1zm40.7-43.5c3.2 0 5.8 2.6 5.8 5.8 0 3.2-2.6 5.8-5.8 5.8h-22.5v11.7h22.5c3.2 0 5.8 2.6 5.8 5.8 0 3.2-2.6 5.8-5.8 5.8h-28.3c-3.2 0-5.8-2.6-5.8-5.8V112c0-3.2 2.6-5.8 5.8-5.8h28.3c3.2 0 5.8 2.6 5.8 5.8 0 3.2-2.6 5.8-5.8 5.8h-22.5v5.8h22.5z"/>
  </svg>
)

const XIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
)

const CopyIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
  </svg>
)

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)

export function ShareButtons({ url, title }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false)
  const [canShare, setCanShare] = useState(false)
  const encodedUrl = encodeURIComponent(url)
  const encodedTitle = encodeURIComponent(title)

  useEffect(() => {
    setCanShare(typeof navigator !== 'undefined' && 'share' in navigator)
  }, [])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  const shareLinks = [
    { label: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`, icon: <FacebookIcon />, color: '#1877F2' },
    { label: 'LINE', href: `https://social-plugins.line.me/lineit/share?url=${encodedUrl}`, icon: <LineIcon />, color: '#06C755' },
    { label: 'X', href: `https://x.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`, icon: <XIcon />, color: '#000' },
  ]

  return (
    <div className="share-buttons">
      <span className="share-label">แชร์บทความ</span>
      <div className="share-icons">
        {shareLinks.map((link) => (
          <a
            key={link.label}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="share-btn"
            style={{ '--share-color': link.color } as React.CSSProperties}
            title={`แชร์ไปยัง ${link.label}`}
          >
            {link.icon}
          </a>
        ))}
        <button onClick={handleCopy} className="share-btn" title="คัดลอก URL">
          {copied ? <CheckIcon /> : <CopyIcon />}
        </button>
      </div>
    </div>
  )
}
