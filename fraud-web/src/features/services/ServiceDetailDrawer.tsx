'use client'

import { useState, useEffect } from 'react'
import { X, Bot, Zap, Clock, Check, Sparkles } from 'lucide-react'
import { useServices } from './hooks'
import type { ServiceItem } from './types'

interface ServiceDetailDrawerProps {
  open: boolean
  onClose: () => void
  onSelectService: (service: ServiceItem) => void
}

export function ServiceDetailDrawer({ open, onClose, onSelectService }: ServiceDetailDrawerProps) {
  const { data: services } = useServices()
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(null)

  // Lock scroll
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  // Reset on open
  useEffect(() => {
    if (open) setSelectedService(null)
  }, [open])

  if (!open) return null

  return (
    <>
      <div className="payment-drawer-backdrop" onClick={onClose} />
      <div className="payment-drawer">
        {/* Header */}
        <div className="payment-drawer-header">
          <h3 className="text-lg font-bold" style={{ color: 'var(--text)' }}>
            AI ตามหาคนโกง
          </h3>
          <button className="btn-ghost btn-icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="payment-drawer-body">
          {/* Hero */}
          <div className="text-center mb-4">
            <div className="w-20 h-20 rounded-full mx-auto mb-3 flex items-center justify-center"
              style={{ background: 'var(--accent-dim)', border: '2px solid var(--accent)' }}>
              <Bot className="w-10 h-10" style={{ color: 'var(--accent)' }} />
            </div>
            <div className="flex items-center justify-center gap-2 mb-2">
              <Sparkles className="w-5 h-5" style={{ color: 'var(--accent)' }} />
              <h3 className="text-lg font-bold" style={{ color: 'var(--text)' }}>เพิ่มพลังให้การแจ้ง</h3>
            </div>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              เลือกบริการ AI เพื่อตามหาและประจานคนโกง
            </p>
          </div>

          {/* Service Cards */}
          {services && services.length > 0 ? (
            <div className="space-y-3">
              {services.map((service) => (
                <div
                  key={service.id}
                  className={`service-card ${selectedService?.id === service.id ? 'selected' : ''}`}
                  onClick={() => setSelectedService(selectedService?.id === service.id ? null : service)}
                >
                  <div className="service-card-header">
                    <div className="service-card-icon">
                      <Zap className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold" style={{ color: 'var(--text)' }}>{service.name}</div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{service.description}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-lg font-extrabold" style={{ color: 'var(--accent)' }}>{service.price.toLocaleString()}</div>
                      <div className="text-xs" style={{ color: 'var(--text-dim)' }}>บาท</div>
                    </div>
                  </div>

                  {/* Expanded details */}
                  {selectedService?.id === service.id && (
                    <div className="service-card-detail fade-in">
                      {service.duration && (
                        <div className="flex items-center gap-1.5 text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
                          <Clock className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />
                          ระยะเวลา: {service.duration} วัน
                        </div>
                      )}

                      {service.features && service.features.length > 0 && (
                        <div className="space-y-1 mb-3">
                          {service.features.map((f, i) => (
                            <div key={i} className="flex items-start gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                              <Check className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: 'var(--accent)' }} />
                              {f}
                            </div>
                          ))}
                        </div>
                      )}

                      {service.expectedResults && (
                        <div className="text-xs p-2.5 rounded-lg mb-3" style={{ background: 'var(--accent-dim)', color: 'var(--text-secondary)' }}>
                          <span className="font-semibold" style={{ color: 'var(--accent)' }}>ผลลัพธ์ที่คาดหวัง: </span>
                          {service.expectedResults}
                        </div>
                      )}

                      {service.notes && (
                        <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
                          * {service.notes}
                        </p>
                      )}

                      <button className="btn btn-primary btn-lg w-full mt-3" onClick={(e) => {
                        e.stopPropagation()
                        onClose()
                        onSelectService(service)
                      }}>
                        <Zap className="w-4 h-4" />
                        ชำระเงิน {service.price.toLocaleString()} บาท
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-sm" style={{ color: 'var(--text-dim)' }}>ไม่มีบริการในขณะนี้</p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
