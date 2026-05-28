/**
 * Format date สำหรับแสดงผล — ใช้ timezone Asia/Bangkok
 * ใช้ Intl.DateTimeFormat เพื่อให้ได้ค่า day/month/year ตาม timezone ที่ต้องการ
 */

const THAI_MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
const THAI_MONTHS_LONG = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']

const TZ = 'Asia/Bangkok'

/** แยก day, month, year, hour, minute จาก date string ตาม Bangkok timezone */
function parse(dateStr: string): { day: number; month: number; year: number; hour: string; minute: string } | null {
  if (!dateStr) return null
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return null
    if (d.getFullYear() < 1970) return null

    // ใช้ Intl เพื่อดึงค่าตาม timezone
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: TZ,
      year: 'numeric', month: 'numeric', day: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(d)

    const get = (type: string) => parts.find(p => p.type === type)?.value || '0'
    return {
      day: parseInt(get('day')),
      month: parseInt(get('month')) - 1, // 0-indexed
      year: parseInt(get('year')),
      hour: get('hour').padStart(2, '0'),
      minute: get('minute').padStart(2, '0'),
    }
  } catch {
    return null
  }
}

/** 25 พ.ค. 69 */
export function formatDateShort(dateStr: string): string {
  const p = parse(dateStr)
  if (!p) return '-'
  const yearBE = (p.year + 543).toString().slice(-2)
  return `${p.day} ${THAI_MONTHS_SHORT[p.month]} ${yearBE}`
}

/** 25 พฤษภาคม 2569 */
export function formatDateLong(dateStr: string): string {
  const p = parse(dateStr)
  if (!p) return '-'
  return `${p.day} ${THAI_MONTHS_LONG[p.month]} ${p.year + 543}`
}

/** 25 พ.ค. 14:30 */
export function formatDatetime(dateStr: string): string {
  const p = parse(dateStr)
  if (!p) return '-'
  return `${p.day} ${THAI_MONTHS_SHORT[p.month]} ${p.hour}:${p.minute}`
}

/** 25 พ.ค. */
export function formatDateNoYear(dateStr: string): string {
  const p = parse(dateStr)
  if (!p) return '-'
  return `${p.day} ${THAI_MONTHS_SHORT[p.month]}`
}
