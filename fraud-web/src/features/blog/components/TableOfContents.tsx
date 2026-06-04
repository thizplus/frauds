'use client'

import { useState, useEffect } from 'react'
import { List } from 'lucide-react'
import type { TOCItem } from '../utils'

interface TableOfContentsProps {
  items: TOCItem[]
}

export function TableOfContents({ items }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState('')
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (items.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        // หา heading ที่อยู่ใน viewport บนสุด
        const visible = entries.filter((e) => e.isIntersecting)
        if (visible.length > 0) {
          setActiveId(visible[0].target.id)
        }
      },
      { rootMargin: '-80px 0px -70% 0px' }
    )

    items.forEach((item) => {
      const el = document.getElementById(item.id)
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [items])

  if (items.length < 2) return null

  const handleClick = (id: string) => {
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setActiveId(id)
      setIsOpen(false)
    }
  }

  return (
    <>
      {/* Desktop: sticky sidebar */}
      <nav className="toc-desktop">
        <p className="toc-title">
          <List className="w-4 h-4" />
          สารบัญ
        </p>
        <ul className="toc-list">
          {items.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => handleClick(item.id)}
                className={`toc-link ${item.level === 3 ? 'toc-link-sub' : ''} ${activeId === item.id ? 'toc-link-active' : ''}`}
              >
                {item.text}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Mobile: collapsible */}
      <div className="toc-mobile">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="toc-mobile-toggle"
        >
          <List className="w-4 h-4" />
          สารบัญ ({items.length} หัวข้อ)
          <span className={`toc-chevron ${isOpen ? 'open' : ''}`}>▾</span>
        </button>
        {isOpen && (
          <ul className="toc-list">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => handleClick(item.id)}
                  className={`toc-link ${item.level === 3 ? 'toc-link-sub' : ''}`}
                >
                  {item.text}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
