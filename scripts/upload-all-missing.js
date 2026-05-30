const fs = require('fs')
const path = require('path')
const https = require('https')

const API_URL = 'https://api.xn--12cainl6g3mua5b.com/api/v1'
const TOKEN = process.env.TOKEN || ''
const WP_ROOT = 'C:/Users/Admin/Local Sites/icezhouze/app/public'
const DATA_FILE = 'C:/Users/Admin/Local Sites/icezhouze/app/public/bad_loan_export.json'

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
      hostname: url.hostname, port: 443,
      path: url.pathname + url.search, method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': bodyBuffer.length,
      },
    }, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => { try { resolve(JSON.parse(data)) } catch { resolve({ raw: data }) } })
    })
    req.on('error', reject)
    req.write(bodyBuffer)
    req.end()
  })
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function main() {
  if (!TOKEN) { console.error('ERROR: TOKEN required'); process.exit(1) }

  const sourceData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')).data
  const updates = []
  let uploaded = 0, skipped = 0, failed = 0

  for (let i = 0; i < sourceData.length; i++) {
    const p = sourceData[i]
    const label = `[${i + 1}/${sourceData.length}] ${p.first_name} ${p.last_name}`

    if (!p.card_id_image || p.card_id_image === '-') {
      skipped++
      continue
    }

    let localPath
    try {
      const urlObj = new URL(p.card_id_image)
      localPath = path.join(WP_ROOT, urlObj.pathname)
    } catch {
      skipped++
      continue
    }

    if (!fs.existsSync(localPath)) {
      console.log(`${label} — file not found`)
      skipped++
      continue
    }

    // Upload with retry
    let imageUrl = ''
    for (let retry = 0; retry < 3; retry++) {
      try {
        const res = await uploadFile(localPath)
        if (res.success && res.data?.url) {
          imageUrl = res.data.url
          break
        }
        console.log(`${label} — rate limited, wait 5s (${retry + 1}/3)`)
        await sleep(5000)
      } catch (e) {
        console.log(`${label} — error: ${e.message}, retry...`)
        await sleep(5000)
      }
    }

    if (!imageUrl) {
      console.log(`${label} — FAILED after 3 retries`)
      failed++
      continue
    }

    // Match by card_id or phone
    updates.push({
      idCard: p.card_id,
      phone: p.phone_number,
      imageUrl,
    })

    uploaded++
    if (uploaded % 10 === 0) console.log(`${label} — uploaded (${uploaded} done)`)

    // 2.5s delay to stay under rate limit
    await sleep(2500)
  }

  // Save SQL updates
  let sql = ''
  for (const u of updates) {
    const escaped = u.imageUrl.replace(/'/g, "''")
    if (u.idCard) {
      sql += `UPDATE debtors SET id_card_image = '${escaped}' WHERE id_card = '${u.idCard}' AND (id_card_image = '' OR id_card_image IS NULL);\n`
    } else if (u.phone) {
      sql += `UPDATE debtors SET id_card_image = '${escaped}' WHERE phone = '${u.phone}' AND (id_card_image = '' OR id_card_image IS NULL);\n`
    }
  }
  fs.writeFileSync('update-images.sql', sql)

  console.log('')
  console.log(`=== Result ===`)
  console.log(`Uploaded: ${uploaded}`)
  console.log(`Skipped: ${skipped}`)
  console.log(`Failed: ${failed}`)
  console.log(`SQL file: update-images.sql (${updates.length} updates)`)
}

main().catch(console.error)
