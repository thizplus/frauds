import { useParams, useNavigate } from 'react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { DollarSign, Monitor, CreditCard, Wrench, AlertTriangle, Search, UserCheck, Crown, Share2 } from 'lucide-react'
import { useSettingsByCategory } from '../hooks'
import { SettingItem } from '../components/SettingItem'
import { SocialLinksEditor } from '../components/SocialLinksEditor'
import type { LucideIcon } from 'lucide-react'

const SECTIONS = [
  { id: 'quota', label: 'โควต้า/ลิมิต', icon: DollarSign, description: 'ตั้งค่าจำนวนการค้นหาและรายงานต่อวัน' },
  { id: 'display', label: 'การแสดงผล', icon: Monitor, description: 'ตั้งค่า mask ข้อมูล + จำนวนผลค้นหา' },
  { id: 'payment', label: 'ชำระเงิน', icon: CreditCard, description: 'ตั้งค่า PromptPay + SlipOK' },
  { id: 'social', label: 'Social Media', icon: Share2, description: 'ตั้งค่าลิงก์โซเชียลมีเดีย แสดงหน้าแรก' },
  { id: 'system', label: 'ระบบ', icon: Wrench, description: 'ตั้งค่าทั่วไป + maintenance mode' },
]

interface SettingMeta {
  type: 'text' | 'number' | 'boolean' | 'select'
  options?: { label: string; value: string }[]
  suffix?: string
  label: string
  hint?: string
  group?: string
  icon?: LucideIcon
}

const SETTING_META: Record<string, SettingMeta> = {
  // Quota — ค้นหา
  'quota.guest_search_limit': {
    type: 'number', suffix: 'ครั้ง/วัน',
    label: 'Guest (ไม่ได้ล็อกอิน)',
    hint: 'จำนวนค้นหาสำหรับคนที่ยังไม่ได้เข้าสู่ระบบ นับใน browser',
    group: 'ค้นหา', icon: Search,
  },
  'quota.free_search_limit': {
    type: 'number', suffix: 'ครั้ง/วัน',
    label: 'Free User (ล็อกอินแล้ว)',
    hint: 'จำนวนค้นหาสำหรับผู้ใช้ที่ล็อกอินแล้วแต่ยังไม่ได้สมัครสมาชิก',
    group: 'ค้นหา', icon: UserCheck,
  },
  'quota.member_search_limit': {
    type: 'number', suffix: 'ครั้ง/วัน',
    label: 'Member (สมาชิก)',
    hint: 'จำนวนค้นหาสำหรับสมาชิก ใส่ 0 = ไม่จำกัด',
    group: 'ค้นหา', icon: Crown,
  },
  // Display
  'display.mask_phone': { type: 'boolean', label: 'Mask เบอร์โทร', hint: 'ซ่อนเบอร์โทรสำหรับผู้ใช้ที่ไม่ใช่สมาชิก' },
  'display.mask_bank': { type: 'boolean', label: 'Mask เลขบัญชี', hint: 'ซ่อนเลขบัญชีสำหรับผู้ใช้ที่ไม่ใช่สมาชิก' },
  'display.show_evidence': {
    type: 'select', label: 'แสดงหลักฐาน',
    hint: 'กำหนดว่าใครสามารถดูรูปหลักฐานได้',
    options: [
      { label: 'ทุกคน', value: 'all' },
      { label: 'สมาชิกเท่านั้น', value: 'member_only' },
      { label: 'ซ่อน', value: 'hidden' },
    ],
  },
  'display.max_results_free': { type: 'number', suffix: 'รายการ', label: 'ผลค้นหาสูงสุด (Free)', hint: 'จำนวนผลค้นหาที่แสดงสำหรับ Free user' },
  'display.max_results_member': { type: 'number', suffix: 'รายการ', label: 'ผลค้นหาสูงสุด (Member)', hint: 'จำนวนผลค้นหาที่แสดงสำหรับสมาชิก' },
  // Payment
  'payment.promptpay_type': {
    type: 'select', label: 'ประเภท PromptPay',
    hint: 'เลือกประเภทเลขที่ใช้รับเงิน',
    options: [
      { label: 'เลขบัตรประชาชน', value: 'national_id' },
      { label: 'เบอร์โทรศัพท์', value: 'phone' },
      { label: 'e-Wallet', value: 'ewallet' },
    ],
  },
  'payment.promptpay_number': { type: 'text', label: 'เลข PromptPay', hint: 'เบอร์โทรหรือเลขบัตร ปชช. สำหรับรับเงิน' },
  'payment.promptpay_name': { type: 'text', label: 'ชื่อบัญชี', hint: 'ชื่อที่แสดงให้ลูกค้าเห็น' },
  'payment.bank_account': { type: 'text', label: 'เลขบัญชีธนาคาร', hint: 'ใช้กรณีไม่ใช้ PromptPay' },
  'payment.bank_name': { type: 'text', label: 'ชื่อธนาคาร', hint: 'ชื่อธนาคารสำหรับโอนเงิน' },
  'payment.slipok_branch_id': { type: 'text', label: 'SlipOK Branch ID', hint: 'ได้จาก slipok.com' },
  'payment.slipok_api_key': { type: 'text', label: 'SlipOK API Key', hint: 'ได้จาก slipok.com' },
  'payment.slipok_log': { type: 'boolean', label: 'ป้องกันสลิปซ้ำ', hint: 'เปิด = SlipOK บันทึกสลิปไว้ตรวจซ้ำ (แนะนำเปิดเสมอ)' },
  'payment.auto_verify_slip': { type: 'boolean', label: 'ตรวจสลิปอัตโนมัติ', hint: 'ใช้ SlipOK ตรวจสลิปแล้วอนุมัติอัตโนมัติ' },
  // System
  'system.maintenance_mode': { type: 'boolean', label: 'ปิดปรับปรุง', hint: 'เปิดโหมดปิดปรับปรุงระบบ' },
  'system.registration_open': { type: 'boolean', label: 'เปิดรับสมัคร', hint: 'อนุญาตให้ผู้ใช้ใหม่สมัครสมาชิกได้' },
  'system.require_evidence': { type: 'boolean', label: 'บังคับแนบหลักฐาน', hint: 'บังคับให้แนบรูปหลักฐานเมื่อแจ้งโกง' },
  'system.auto_verify_threshold': { type: 'number', suffix: 'คน', label: 'ยืนยันอัตโนมัติ', hint: 'จำนวนคนที่ต้องรายงานซ้ำก่อนยืนยันอัตโนมัติ' },
}

export function SettingsPage() {
  const { section = 'quota' } = useParams()
  const navigate = useNavigate()
  const currentSection = SECTIONS.find((s) => s.id === section) || SECTIONS[0]
  const { data: settings, isLoading, error } = useSettingsByCategory(currentSection.id)

  // จัดกลุ่ม settings ตาม group
  const grouped = settings?.reduce((acc, setting) => {
    const meta = SETTING_META[setting.key]
    const group = meta?.group || 'ทั่วไป'
    if (!acc[group]) acc[group] = []
    acc[group].push(setting)
    return acc
  }, {} as Record<string, typeof settings>) || {}

  const hasGroups = Object.keys(grouped).length > 1

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">ตั้งค่า</h1>

      {/* Section tabs */}
      <div className="flex flex-wrap gap-2">
        {SECTIONS.map((s) => (
          <Button
            key={s.id}
            variant={section === s.id ? 'default' : 'outline'}
            size="sm"
            onClick={() => navigate(`/settings/${s.id}`)}
            className="gap-1.5"
          >
            <s.icon className="h-4 w-4" />
            {s.label}
          </Button>
        ))}
      </div>

      {/* Settings card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <currentSection.icon className="h-5 w-5" />
            {currentSection.label}
          </CardTitle>
          <CardDescription>{currentSection.description}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-9 w-32 ml-auto" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 text-destructive py-4">
              <AlertTriangle className="h-4 w-4" />
              <span>ไม่สามารถโหลดข้อมูลได้</span>
            </div>
          ) : currentSection.id === 'social' ? (
            <SocialLinksEditor />
          ) : settings && settings.length > 0 ? (
            <div className="space-y-6">
              {Object.entries(grouped).map(([group, items], gi) => (
                <div key={group}>
                  {hasGroups && (
                    <>
                      {gi > 0 && <Separator className="mb-4" />}
                      <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-1.5">
                        {items?.[0] && SETTING_META[items[0].key]?.icon && (() => {
                          const Icon = SETTING_META[items[0].key].icon!
                          return <Icon className="h-3.5 w-3.5" />
                        })()}
                        {group}
                      </h3>
                    </>
                  )}
                  <div className="space-y-1">
                    {items?.map((setting) => {
                      const meta = SETTING_META[setting.key] || { type: 'text' as const, label: setting.key }
                      return (
                        <SettingItem
                          key={setting.key}
                          setting={setting}
                          type={meta.type}
                          options={meta.options}
                          suffix={meta.suffix}
                          label={meta.label}
                          hint={meta.hint}
                        />
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground py-4 text-center">
              ยังไม่มีการตั้งค่าในหมวดนี้
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
