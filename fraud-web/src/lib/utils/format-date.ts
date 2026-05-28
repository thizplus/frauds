/**
 * Format date สำหรับแสดงผล — ใช้ timezone Asia/Bangkok
 * ป้องกัน Buddhist Era issue โดยใช้ en-GB + แปลเดือนเอง
 */

const THAI_MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
const THAI_MONTHS_LONG = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']

function toDate(dateStr: string): Date | null {
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return null
    return d
  } catch {
    return null
  }
}

/** 25 พ.ค. 69 */
export function formatDateShort(dateStr: string): string {
  const d = toDate(dateStr)
  if (!d) return dateStr
  const day = d.toLocaleDateString('en-GB', { day: 'numeric', timeZone: 'Asia/Bangkok' })
  const month = THAI_MONTHS_SHORT[d.getMonth()]
  const year = (d.getFullYear() + 543).toString().slice(-2)
  return `${day} ${month} ${year}`
}

/** 25 พฤษภาคม 2569 */
export function formatDateLong(dateStr: string): string {
  const d = toDate(dateStr)
  if (!d) return dateStr
  const day = d.toLocaleDateString('en-GB', { day: 'numeric', timeZone: 'Asia/Bangkok' })
  const month = THAI_MONTHS_LONG[d.getMonth()]
  const year = d.getFullYear() + 543
  return `${day} ${month} ${year}`
}

/** 25 พ.ค. 14:30 */
export function formatDatetime(dateStr: string): string {
  const d = toDate(dateStr)
  if (!d) return dateStr
  const day = d.toLocaleDateString('en-GB', { day: 'numeric', timeZone: 'Asia/Bangkok' })
  const month = THAI_MONTHS_SHORT[d.getMonth()]
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' })
  return `${day} ${month} ${time}`
}

/** 25 พ.ค. */
export function formatDateNoYear(dateStr: string): string {
  const d = toDate(dateStr)
  if (!d) return dateStr
  const day = d.toLocaleDateString('en-GB', { day: 'numeric', timeZone: 'Asia/Bangkok' })
  const month = THAI_MONTHS_SHORT[d.getMonth()]
  return `${day} ${month}`
}
