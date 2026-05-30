const fs = require('fs')
const path = require('path')
const https = require('https')

const API_URL = 'https://api.xn--12cainl6g3mua5b.com/api/v1'
const TOKEN = process.env.TOKEN || ''
const WP_ROOT = 'C:/Users/Admin/Local Sites/icezhouze/app/public'
const DATA_FILE = 'C:/Users/Admin/Local Sites/icezhouze/app/public/bad_loan_export.json'

// Bank name mapping
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
    const req = https.request({
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': bodyBuffer.length,
      },
    }, (res) => {
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

function apiRequest(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_URL + urlPath)
    const jsonStr = JSON.stringify(body)
    const req = https.request({
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method,
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(jsonStr),
      },
    }, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch { resolve({ raw: data }) }
      })
    })
    req.on('error', reject)
    req.write(jsonStr)
    req.end()
  })
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function main() {
  if (!TOKEN) {
    console.error('ERROR: TOKEN env var required')
    process.exit(1)
  }

  // 1. Get all debtors from API
  console.log('Fetching existing debtors...')
  const debtorsRes = await apiRequest('GET', '/lender/debtors?limit=500', null)

  // Fix: GET doesn't need body
  const debtorsGet = await new Promise((resolve, reject) => {
    const url = new URL(API_URL + '/lender/debtors?limit=500')
    const req = https.request({
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${TOKEN}` },
    }, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch { resolve({ raw: data }) }
      })
    })
    req.on('error', reject)
    req.end()
  })

  const debtors = debtorsGet.data || []
  console.log(`Found ${debtors.length} debtors`)

  // 2. Find debtors without idCardImage
  const missing = debtors.filter(d => !d.idCardImage)
  console.log(`Missing images: ${missing.length}`)

  // 3. Load source data for matching
  const raw = fs.readFileSync(DATA_FILE, 'utf8')
  const sourceData = JSON.parse(raw).data

  let uploaded = 0, skipped = 0, failed = 0

  for (let i = 0; i < missing.length; i++) {
    const debtor = missing[i]
    const label = `[${i + 1}/${missing.length}] ${debtor.firstName} ${debtor.lastName}`

    // Match by idCard or phone
    const source = sourceData.find(s =>
      (s.card_id && s.card_id === debtor.idCard) ||
      (s.phone_number && s.phone_number === debtor.phone)
    )

    if (!source || !source.card_id_image || source.card_id_image === '-') {
      console.log(`${label} — no source image found`)
      skipped++
      continue
    }

    // Get local file path
    try {
      const urlObj = new URL(source.card_id_image)
      const localPath = path.join(WP_ROOT, urlObj.pathname)

      if (!fs.existsSync(localPath)) {
        console.log(`${label} — file not found: ${localPath}`)
        skipped++
        continue
      }

      // Upload with retry
      let imageUrl = ''
      for (let retry = 0; retry < 3; retry++) {
        const uploadRes = await uploadFile(localPath)
        if (uploadRes.success && uploadRes.data?.url) {
          imageUrl = uploadRes.data.url
          break
        }
        // Rate limited — wait and retry
        console.log(`${label} — rate limited, waiting 3s (retry ${retry + 1}/3)`)
        await sleep(3000)
      }

      if (!imageUrl) {
        console.log(`${label} — upload failed after 3 retries`)
        failed++
        continue
      }

      // Update debtor with image URL via direct DB (PATCH not available, use PUT-like approach)
      // Actually we need to check if there's an update endpoint
      // For now, store the mapping
      console.log(`${label} — uploaded: ${imageUrl}`)

      // We'll update via DB directly after
      fs.appendFileSync('image-updates.jsonl', JSON.stringify({
        debtorId: debtor.id,
        idCardImage: imageUrl,
        firstName: debtor.firstName,
        lastName: debtor.lastName,
      }) + '\n')

      uploaded++

      // Wait 2.5s between uploads to avoid rate limit (30/min = 1 per 2s)
      await sleep(2500)

    } catch (e) {
      console.log(`${label} — error: ${e.message}`)
      failed++
    }
  }

  console.log('')
  console.log(`=== Result ===`)
  console.log(`Uploaded: ${uploaded}`)
  console.log(`Skipped: ${skipped}`)
  console.log(`Failed: ${failed}`)
  console.log('')
  if (uploaded > 0) {
    console.log(`Image URLs saved to image-updates.jsonl`)
    console.log(`Run DB update to apply.`)
  }
}

main().catch(console.error)
