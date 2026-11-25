// Refuses a plugin folder that holds more than the thin client.
// Usage: node scripts/thin-client-check.mjs <plugin folder>
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const list = JSON.parse(readFileSync(fileURLToPath(new URL('../thin-client.json', import.meta.url)), 'utf8'))
const CODE = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts']

const walk = dir =>
  readdirSync(dir).flatMap(n => {
    if (n === 'tests' || n === 'node_modules' || n === '.git') return []
    const p = join(dir, n)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })

const root = process.argv[2]
const errors = []
const base = s => s.replace(/\{.*\}$/, '')
const allowedHooks = new Set(list.hooks.map(base))
const allowedCalls = list.calls.map(c => c.replace(/\*$/, ''))
const never = list.never.map(c => c.replace(/\*$/, ''))

for (const file of walk(root)) {
  const text = readFileSync(file, 'utf8')
  const rel = file.slice(root.length + 1)
  if (CODE.includes(extname(file))) {
    if (text.split('\n').length > list.limits.moduleLines) errors.push(`${rel}: more than ${list.limits.moduleLines} lines`)
    for (const m of text.matchAll(/\bon\(\s*['"]([\w.]+)['"]/g)) {
      if (!allowedHooks.has(m[1])) errors.push(`${rel}: hook ${m[1]} is not on the list`)
    }
    for (const m of text.matchAll(/\$\.\w+\.\w+/g)) {
      const call = m[0]
      const ok = allowedCalls.some(a => (a.endsWith('.') ? call.startsWith(a) : call === a || call.startsWith(a + '.')))
      if (!ok || never.some(n => call.startsWith(n))) errors.push(`${rel}: ${call} is not on the list`)
    }
    for (const m of text.matchAll(/['"`]([^'"`]*)['"`]/g)) {
      if (m[1].length > list.limits.stringChars) errors.push(`${rel}: a string over ${list.limits.stringChars} characters`)
    }
  }
  if (/SKILL\.md$|\.md$/.test(file) && text.length > list.limits.skillChars) {
    errors.push(`${rel}: text over ${list.limits.skillChars} characters`)
  }
  // Any hub address: only <hub_url>/mcp. No other address, except the public pages listed in publicAddresses (the privacy policy).
  for (const m of text.matchAll(/\$\{user_config\.hub_url\}([^\s"'`]*)/g)) {
    if (!list.hubRoutes.includes(m[1])) errors.push(`${rel}: hub route ${m[1] || '/'} is not on the list`)
  }
  for (const m of text.matchAll(/https?:\/\/[^\s"'`)]+/g)) {
    if (!/example\.com/.test(m[0]) && !(list.publicAddresses ?? []).includes(m[0])) errors.push(`${rel}: address ${m[0]} is not on the list`)
  }
  for (const m of text.matchAll(/\bhub_url\b[^\n]*?\+\s*['"`]([^'"`]*)/g)) {
    if (!list.hubRoutes.includes(m[1])) errors.push(`${rel}: hub route ${m[1]} is not on the list`)
  }
}

if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}
console.log('thin-client check passed')
