/**
 * ประมาณเวลาอ่านบทความ (นาที)
 * ภาษาไทย: ~500 ตัวอักษร/นาที
 * ภาษาอังกฤษ: ~250 คำ/นาที
 */
export function estimateReadingTime(html: string): number {
  const text = html.replace(/<[^>]*>/g, '').trim()

  // นับตัวอักษรไทย
  const thaiChars = (text.match(/[\u0E00-\u0E7F]/g) || []).length
  const thaiMinutes = thaiChars / 500

  // นับคำอังกฤษ (ที่ไม่ใช่ไทย)
  const nonThaiText = text.replace(/[\u0E00-\u0E7F]/g, ' ').trim()
  const engWords = nonThaiText.split(/\s+/).filter((w) => w.length > 0).length
  const engMinutes = engWords / 250

  return Math.max(1, Math.ceil(thaiMinutes + engMinutes))
}

export interface TOCItem {
  id: string
  text: string
  level: 2 | 3
}

/**
 * Parse headings (H2, H3) จาก HTML content สำหรับ Table of Contents
 * เพิ่ม id ให้ heading เพื่อ anchor link
 */
export function parseTOC(html: string): { toc: TOCItem[]; htmlWithIds: string } {
  const toc: TOCItem[] = []
  let counter = 0

  const htmlWithIds = html.replace(
    /<(h[23])>(.*?)<\/\1>/gi,
    (_match, tag: string, text: string) => {
      const level = parseInt(tag.charAt(1)) as 2 | 3
      const plainText = text.replace(/<[^>]*>/g, '').trim()
      const id = `heading-${counter++}`
      toc.push({ id, text: plainText, level })
      return `<${tag} id="${id}">${text}</${tag}>`
    }
  )

  return { toc, htmlWithIds }
}
