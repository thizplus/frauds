'use client'

import { useState, useEffect } from 'react'

interface ShareButtonsProps {
  url: string
  title: string
}

// Brand SVG icons
const FacebookIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
)

const LineIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
    <path d="M19.365 9.864c.58 0 1.049.47 1.049 1.049 0 .58-.47 1.049-1.049 1.049H17.87v1.497h1.497c.58 0 1.049.47 1.049 1.049 0 .58-.47 1.049-1.049 1.049H16.82a1.049 1.049 0 01-1.049-1.049V9.864c0-.58.47-1.049 1.049-1.049h2.545c.58 0 1.049.47 1.049 1.049 0 .58-.47 1.049-1.049 1.049H17.87v.901h1.497zM14.22 14.557a1.049 1.049 0 01-1.049 1.049 1.049 1.049 0 01-.863-.453l-2.082-2.848v2.252a1.049 1.049 0 01-2.098 0V9.864a1.049 1.049 0 011.049-1.049c.352 0 .672.176.863.453l2.082 2.848V9.864a1.049 1.049 0 012.098 0v4.693zM7.08 14.557a1.049 1.049 0 01-2.098 0V9.864a1.049 1.049 0 012.098 0v4.693zM4.635 15.606H2.088A1.049 1.049 0 011.04 14.557V9.864c0-.58.47-1.049 1.049-1.049.58 0 1.049.47 1.049 1.049v3.644h1.497c.58 0 1.049.47 1.049 1.049 0 .58-.47 1.049-1.049 1.049zM24 10.304C24 4.612 18.627.07 12 .07S0 4.612 0 10.304c0 5.065 4.493 9.31 10.558 10.112.411.089.97.271 1.112.623.127.319.083.818.04 1.14l-.18 1.076c-.055.318-.253 1.246 1.09.679 1.344-.567 7.254-4.272 9.896-7.315C23.795 14.988 24 12.74 24 10.304z"/>
  </svg>
)

const XIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
)

const CopyIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
  </svg>
)

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
