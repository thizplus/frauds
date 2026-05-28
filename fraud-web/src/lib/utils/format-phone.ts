/**
 * Format เบอร์โทร สำหรับแสดงผล
 */

/** 0891234567 → 089-123-4567 */
export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/[^0-9]/g, '')
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
  }
  if (cleaned.length === 9) {
    return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 5)}-${cleaned.slice(5)}`
  }
  return phone
}

/** 0891234567 → 089-XXX-4567 (mask กลาง) */
export function maskPhone(phone: string): string {
  const cleaned = phone.replace(/[^0-9]/g, '')
  if (cleaned.length >= 7) {
    return `${cleaned.slice(0, 3)}-XXX-${cleaned.slice(-4)}`
  }
  return phone
}

/** 1234567890 → XXX-XXXX-7890 (mask เลขบัญชี) */
export function maskBank(account: string): string {
  if (account.length < 4) return account
  return 'XXX-XXXX-' + account.slice(-4)
}
