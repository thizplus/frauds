'use client'

import { Bot, UserCheck, AlertTriangle, ScanLine, Database, Search } from 'lucide-react'

const tickerItems = [
  { icon: Bot, text: 'Bot Collector เก็บโพสต์ใหม่จาก Facebook Group #fraud-watch' },
  { icon: UserCheck, text: 'Admin ยืนยันรายชื่อ "นางมาลี ป." แล้ว' },
  { icon: AlertTriangle, text: 'AI ตรวจพบ pattern ใหม่ในช่วง 5 นาทีที่ผ่านมา' },
  { icon: ScanLine, text: 'AI วิเคราะห์ความน่าเชื่อถือ 47 รายการ' },
  { icon: Database, text: 'เพิ่มรายชื่อใหม่ 12 รายในชั่วโมงล่าสุด' },
  { icon: Search, text: 'คำค้น "081-xxx-xxxx" ค้นบ่อยที่สุด 2.3k ครั้ง/วัน' },
]

export function LiveTicker() {
  // Duplicate for seamless loop
  const items = [...tickerItems, ...tickerItems]

  return (
    <section className="w-full">
      <div className="py-2.5 px-4 flex items-center gap-3 overflow-hidden" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-card)' }}>
        <div className="flex items-center gap-2 flex-shrink-0 pr-3" style={{ borderRight: '1px solid var(--border-strong)' }}>
          <span className="live-dot" />
          <span className="text-xs font-semibold font-mono text-accent">LIVE</span>
        </div>
        <div className="ticker flex-1">
          <div className="ticker-track">
            {items.map((item, i) => (
              <span key={i} className="ticker-item">
                <item.icon className="w-3.5 h-3.5 ticker-icon" />
                {item.text}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
