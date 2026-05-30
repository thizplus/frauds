const https = require('https')

const API_URL = 'https://api.xn--12cainl6g3mua5b.com/api/v1'
const TOKEN = process.env.TOKEN || ''

function apiGet(urlPath) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_URL + urlPath)
    const req = https.request({
      hostname: url.hostname, port: 443,
      path: url.pathname + url.search, method: 'GET',
      headers: { 'Authorization': `Bearer ${TOKEN}` },
    }, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => { try { resolve(JSON.parse(data)) } catch { resolve({ raw: data }) } })
    })
    req.on('error', reject)
    req.end()
  })
}

function apiPost(urlPath) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_URL + urlPath)
    const req = https.request({
      hostname: url.hostname, port: 443,
      path: url.pathname + url.search, method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': 2,
      },
    }, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => { try { resolve(JSON.parse(data)) } catch { resolve({ raw: data }) } })
    })
    req.on('error', reject)
    req.write('{}')
    req.end()
  })
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function main() {
  if (!TOKEN) { console.error('ERROR: TOKEN required'); process.exit(1) }

  // Fetch all debtors (all pages)
  let allDebtors = []
  let page = 1
  while (true) {
    const res = await apiGet(`/lender/debtors?page=${page}&limit=50`)
    if (!res.success || !res.data || res.data.length === 0) break
    allDebtors = allDebtors.concat(res.data)
    if (!res.meta?.hasNext) break
    page++
  }

  console.log(`Total debtors: ${allDebtors.length}`)

  // Filter unchecked only
  const unchecked = allDebtors.filter(d => !d.checkedAt)
  console.log(`Unchecked: ${unchecked.length}`)
  console.log('')

  let checked = 0, failed = 0, matches = 0

  for (let i = 0; i < unchecked.length; i++) {
    const d = unchecked[i]
    const label = `[${i + 1}/${unchecked.length}] ${d.firstName} ${d.lastName}`

    try {
      const res = await apiPost(`/lender/debtors/${d.id}/check`)
      if (res.success) {
        const m = res.data?.matches || 0
        if (m > 0) matches++
        checked++
        if ((i + 1) % 10 === 0 || m > 0) {
          console.log(`${label} — ${m > 0 ? `FOUND ${m} matches` : 'OK'} (${checked} done)`)
        }
      } else {
        console.log(`${label} — FAIL: ${res.error?.message || JSON.stringify(res)}`)
        failed++
      }
    } catch (e) {
      console.log(`${label} — ERROR: ${e.message}`)
      failed++
    }

    await sleep(200)
  }

  console.log('')
  console.log(`=== Result ===`)
  console.log(`Checked: ${checked}`)
  console.log(`Failed: ${failed}`)
  console.log(`With matches: ${matches}`)
}

main().catch(console.error)
