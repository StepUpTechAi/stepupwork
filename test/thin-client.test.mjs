import { test } from 'node:test'
import assert from 'node:assert'
import { readFileSync, cpSync, mkdtempSync, appendFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const PLUGIN = new URL('../plugins/stepupwork', import.meta.url).pathname
const CHECK = new URL('../scripts/thin-client-check.mjs', import.meta.url).pathname

const run = dir => spawnSync('node', [CHECK, dir], { encoding: 'utf8' })
const copy = () => {
  const dir = join(mkdtempSync(join(tmpdir(), 'thin-')), 'p')
  cpSync(PLUGIN, dir, { recursive: true })
  return dir
}

test('the plugin as it is passes', () => {
  assert.strictEqual(run(PLUGIN).status, 0, run(PLUGIN).stderr)
})

test('a long prompt fails', () => {
  const dir = copy()
  appendFileSync(join(dir, 'hooks/register.tsx'), `\nexport const p = '${'rule '.repeat(80)}'\n`)
  const r = run(dir)
  assert.strictEqual(r.status, 1)
  assert.match(r.stderr, /string over/)
})

test('a long skill fails', () => {
  const dir = copy()
  appendFileSync(join(dir, 'skills/deliver-ticket/SKILL.md'), 'rule '.repeat(300))
  assert.strictEqual(run(dir).status, 1)
})

test('a second hub route fails', () => {
  const dir = copy()
  const m = join(dir, '.claude-plugin/plugin.json')
  const text = readFileSync(m, 'utf8').replace('"type": "http",', '"type": "http",\n      "extra": "${user_config.hub_url}/api/rank",')
  writeFileSync(m, text)
  const r = run(dir)
  assert.strictEqual(r.status, 1)
  assert.match(r.stderr, /hub route \/api\/rank/)
})

test('$.http.fetch fails', () => {
  const dir = copy()
  appendFileSync(join(dir, 'hooks/register.tsx'), `\nexport const f = ($: any) => $.http.fetch('x')\n`)
  const r = run(dir)
  assert.strictEqual(r.status, 1)
  assert.match(r.stderr, /\$\.http\.fetch/)
})

test('a hook off the list fails', () => {
  const dir = copy()
  appendFileSync(join(dir, 'hooks/register.tsx'), `\nexport const g = (on: any) => on('prompt.submit', () => {})\n`)
  assert.strictEqual(run(dir).status, 1)
})
