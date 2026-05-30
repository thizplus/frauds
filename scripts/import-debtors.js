const fs = require('fs')
const path = require('path')
const https = require('https')
const http = require('http')

// === Config ===
const API_URL = 'https://api.xn--12cainl6g3mua5b.com/api/v1'
const TOKEN = process.env.TOKEN || ''
const WP_ROOT = 'C:/Users/Admin/Local Sites/icezhouze/app/public'
const DATA_FILE = 'C:/Users/Admin/Local Sites/icezhouze/app/public/bad_loan_export.json'
const DRY_RUN = process.argv.includes('--dry-run')
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '0') || 0

// === Bank Name Mapping ===
const BANK_MAP = {
  'ธนาคารกสิกรไทย': 'กสิกรไทย',
  'ธนาคารไทยพาณิชย์': 'ไทยพาณิชย์',
  'ธนาคารกรุงไทย': 'กรุงไทย',
  'ธนาคารกรุงเทพ': 'กรุงเทพ',
  'ธนาคารกรุงศรีอยุธยา': 'กรุงศรีอยุธยา',
  'ธนาคารธนชาต': 'ทีเอ็มบีธนชาต',
  'ธนาคารธนชาติ': 'ทีเอ็มบีธนชาต',
  'ธนาคารออมสิน': 'ออมสิน',
  'ธนาคารเกียรตินาคิน': 'เกียรตินาคิน',
  'ธนาคารเพื่อการสหกรณ์': 'ธ.ก.ส.',
  'PROMPTPAY': 'พร้อมเพย์',
  'Prompay': 'พร้อมเพย์',
  '-': '',
}

function mapBankName(oldName) {
  return BANK_MAP[oldName] || oldName.replace(/^ธนาคาร/, '') || ''
}

// === HTTP Helpers ===
function apiRequest(method, urlPath, body, isFormData) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_URL + urlPath)
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method,
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
      },
    }

    if (body && !isFormData) {
      const jsonStr = JSON.stringify(body)
      options.headers['Content-Type'] = 'application/json; charset=utf-8'
      options.headers['Content-Length'] = Buffer.byteLength(jsonStr)
    }

    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch { resolve({ raw: data }) }
      })
    })
    req.on('error', reject)

    if (body && !isFormData) {
      req.write(JSON.stringify(body))
    } else if (isFormData) {
      body.pipe(req)
      return
    }
    req.end()
  })
}

function uploadFile(filePath) {
  return new Promise((resolve, reject) => {
    const boundary = '----FormBoundary' + Math.random().toString(36).slice(2)
    const fileName = path.basename(filePath)
    const fileData = fs.readFileSync(filePath)
    const ext = path.extname(fileName).toLowerCase()
    const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg'

    const header = Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n` +
      `Content-Type: ${mimeType}\r\n\r\n`
    )
    const footer = Buffer.from(`\r\n--${boundary}--\r\n`)
    const bodyBuffer = Buffer.concat([header, fileData, footer])

    const url = new URL(API_URL + '/uploads?folder=register/id-cards')
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': bodyBuffer.length,
      },
    }

    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch { resolve({ raw: data }) }
      })
    })
    req.on('error', reject)
    req.write(bodyBuffer)
    req.end()
  })
}

// === Main ===
async function main() {
  if (!TOKEN) {
    console.error('ERROR: TOKEN env var required. Run: TOKEN=xxx node scripts/import-debtors.js')
    process.exit(1)
  }

  const raw = fs.readFileSync(DATA_FILE, 'utf8')
  const json = JSON.parse(raw)
  let items = json.data

  const SKIP = parseInt(process.argv.find(a => a.startsWith('--skip='))?.split('=')[1] || '0') || 0
  if (SKIP > 0) items = items.slice(SKIP)
  if (LIMIT > 0) items = items.slice(0, LIMIT)

  console.log(`=== Import Debtors ===`)
  console.log(`Total: ${items.length} | DRY_RUN: ${DRY_RUN}`)
  console.log('')

  let success = 0, failed = 0, skippedImage = 0
  const errors = []

  for (let i = 0; i < items.length; i++) {
    const p = items[i]
    const label = `[${i + 1}/${items.length}] ${p.first_name} ${p.last_name}`

    // 1. Upload image
    let imageUrl = ''
    if (p.card_id_image && p.card_id_image !== '-') {
      try {
        const urlObj = new URL(p.card_id_image)
        const localPath = path.join(WP_ROOT, urlObj.pathname)

        if (fs.existsSync(localPath)) {
          if (DRY_RUN) {
            imageUrl = `[DRY_RUN] ${localPath}`
            console.log(`${label} — image OK (dry run)`)
          } else {
            const uploadRes = await uploadFile(localPath)
            if (uploadRes.success && uploadRes.data?.url) {
              imageUrl = uploadRes.data.url
            } else {
              console.log(`${label} — image upload failed:`, uploadRes)
              skippedImage++
            }
          }
        } else {
          console.log(`${label} — image not found: ${localPath}`)
          skippedImage++
        }
      } catch (e) {
        console.log(`${label} — image error: ${e.message}`)
        skippedImage++
      }
    }

    // 2. Create debtor
    const debtor = {
      firstName: p.first_name,
      lastName: p.last_name || '',
      idCard: p.card_id || '',
      phone: p.phone_number || '',
      bankAccount: p.bank_id || '',
      bankName: mapBankName(p.bank_name || ''),
      address: (p.work_address && p.work_address !== '-') ? p.work_address : '',
      idCardImage: imageUrl,
    }

    if (DRY_RUN) {
      console.log(`${label} — OK (dry run)`, JSON.stringify(debtor, null, 0))
      success++
      continue
    }

    try {
      const res = await apiRequest('POST', '/lender/debtors', debtor)
      if (res.success) {
        console.log(`${label} — OK (id: ${res.data?.id})`)
        success++
      } else {
        console.log(`${label} — FAIL:`, res.error?.message || JSON.stringify(res))
        errors.push({ index: i, name: label, error: res })
        failed++
      }
    } catch (e) {
      console.log(`${label} — ERROR: ${e.message}`)
      errors.push({ index: i, name: label, error: e.message })
      failed++
    }

    // rate limit — 100ms between requests
    await new Promise(r => setTimeout(r, 100))
  }

  console.log('')
  console.log(`=== Result ===`)
  console.log(`Success: ${success}`)
  console.log(`Failed: ${failed}`)
  console.log(`Skipped Images: ${skippedImage}`)

  if (errors.length > 0) {
    console.log(`\n=== Errors ===`)
    errors.forEach(e => console.log(`- ${e.name}: ${JSON.stringify(e.error)}`))
  }
}

main().catch(console.error)
