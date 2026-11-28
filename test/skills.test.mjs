import { test } from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'

const skill = name => readFileSync(new URL(`../plugins/stepupwork/skills/${name}/SKILL.md`, import.meta.url), 'utf8')
const LIMIT = JSON.parse(readFileSync(new URL('../thin-client.json', import.meta.url), 'utf8')).limits.skillChars

test('hey-jen lists every choice in full with its letter, never shortened', () => {
  const s = skill('hey-jen')
  assert.match(s, /each choice on its own line, its letter first, in full, never shortened/)
})

test('hey-jen says which choice Jen suggests when the hub says so', () => {
  assert.match(skill('hey-jen'), /Say which Jen suggests when the tool says/)
})

test('hey-jen does not pass a cut text off as whole: it points at the workshop', () => {
  assert.match(skill('hey-jen'), /If any text ends in "…", say the full question is in the workshop and give its link/)
})

test('both skills take the tools from either connection, the plugin server or the claude.ai connector', () => {
  for (const name of ['hey-jen', 'deliver-ticket']) {
    const s = skill(name)
    assert.match(s, /plugin's `?stepupwork`? server|plugin's server/, name)
    assert.match(s, /claude\.ai connector/, name)
  }
})

test('the skills stay under the thin client’s limit', () => {
  for (const name of ['hey-jen', 'deliver-ticket']) assert.ok(skill(name).length <= LIMIT, `${name}: ${skill(name).length}`)
})
