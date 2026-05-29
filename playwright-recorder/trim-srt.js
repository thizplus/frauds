// ===== Offset SRT timecodes — ลบ N วินาทีจากทุก timestamp =====
// Usage: node trim-srt.js [seconds] [input.srt] [output.srt]

const fs = require('fs')

const offsetSec = parseFloat(process.argv[2] || '5')
const inputFile = process.argv[3] || 'subtitles/A01-text-search-found.srt'
const outputFile = process.argv[4] || 'output/A01/A01-trimmed.srt'

const content = fs.readFileSync(inputFile, 'utf-8')

function parseSrtTime(str) {
  const [h, m, rest] = str.split(':')
  const [s, ms] = rest.split(',')
  return parseInt(h) * 3600000 + parseInt(m) * 60000 + parseInt(s) * 1000 + parseInt(ms)
}

function formatSrtTime(ms) {
  if (ms < 0) ms = 0
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  const mil = ms % 1000
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')},${mil.toString().padStart(3, '0')}`
}

const offsetMs = offsetSec * 1000
const lines = content.split('\n')
let output = ''
let idx = 1

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim()
  if (line.includes('-->')) {
    const [startStr, endStr] = line.split('-->').map(s => s.trim())
    const start = parseSrtTime(startStr) - offsetMs
    const end = parseSrtTime(endStr) - offsetMs
    if (start >= 0) {
      output += `${idx}\n`
      output += `${formatSrtTime(start)} --> ${formatSrtTime(end)}\n`
      // next line is subtitle text
      i++
      output += `${lines[i]?.trim() || ''}\n\n`
      idx++
    }
  }
}

const dir = require('path').dirname(outputFile)
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
fs.writeFileSync(outputFile, output, 'utf-8')
console.log(`✓ SRT offset -${offsetSec}s: ${inputFile} → ${outputFile}`)
