// The workshop’s tools, called through whichever StepUpWork connection is
// signed in, and the poll that keeps the pane, the status line and the toasts live.
import type { EngineInterface, Timer } from 'claude-code'

import type { Question } from '../types'
import { questionOf, questionsOf } from './asks'
import { statusText } from './counts'
import { heldOf, noticesOf, objectOf, readyOf, statusOf, textOf } from './read'
import type { Notice, Result } from './read'
import { call, SIGN_IN } from './connect'
import { isRunning, setLinks, setQuestions, setReady, setSignedIn, setStatus, setTicket, setTicks, setView, snapshot } from './state'

type $ = EngineInterface

export { call, SIGN_IN } from './connect'

let timer: Timer | null = null
let period = 0
const shown = new Set<string>()

async function stored<T>($: $, key: string): Promise<T | undefined> {
  return (await $.store.get(key).catch(() => undefined)) as T | undefined
}

async function save($: $, key: string, value: unknown) {
  await $.store.set(key, value).catch(() => {})
}

// One poll of my_status with its last cursor. False while signed out.
export async function poll($: $, isFirst = false): Promise<boolean> {
  const prev = (await snapshot($)).s
  const r = await call($, 'my_status', prev?.cursor !== undefined ? { since: prev.cursor } : {})
  if (!r) {
    stop()
    await setSignedIn($, false)

    return false
  }
  await setSignedIn($, true)
  if (r.isError) return true
  const s = statusOf(r, await $.clock.now(), await stored<string>($, 'ticket'))
  await setStatus($, () => s)
  await showStatus($)
  await announce($, noticesOf(r, s))
  if (s.key && s.key !== (await snapshot($)).held?.key) await loadTicket($, s.key)
  if (isFirst || s.questions !== prev?.questions) await loadQuestions($, questionOf(objectOf(r)?.question))
  if (s.train?.state === 'red' && prev?.train?.state !== 'red') await loadReady($)
  schedule($, isRunning(s.train?.state) ? 20_000 : 60_000)

  return true
}

// The status line, from the same counts the pane’s header and rows heading say.
export async function showStatus($: $) {
  const { s, w, qs, held } = await snapshot($)
  $.ui.status(statusText(s, w, qs, held))
}

// Every 60 s, and every 20 s while one of the person’s trains runs.
function schedule($: $, ms: number) {
  if (timer && ms === period) return
  timer?.cancel()
  period = ms
  timer = $.clock.every(ms, () => void poll($).catch(() => {}))
}

export function stop() {
  timer?.cancel()
  timer = null
  period = 0
}

// One toast for each event, and one native notice for a train going red or landing.
async function announce($: $, list: Notice[]) {
  const seen = (await stored<string[]>($, 'seen')) ?? []
  const fresh = list.filter(n => !seen.includes(n.id) && !shown.has(n.id))
  for (const n of fresh) {
    shown.add(n.id)
    $.ui.toast(n.text)
    if (n.isBig) void $.ui.notify(n.text, { title: 'StepUpWork', key: n.id }).catch(() => {})
  }
  if (fresh.length) await save($, 'seen', [...seen, ...fresh.map(n => n.id)].slice(-50))
}

async function keep($: $, found: Record<string, string | undefined>) {
  const add = Object.entries(found).filter((kv): kv is [string, string] => !!kv[1])
  if (add.length) await setLinks($, l => ({ ...l, ...Object.fromEntries(add) }))
}

export async function loadReady($: $) {
  const r = await call($, 'ready_work', {})
  if (!r) return
  const w = r.isError ? { groups: [], note: textOf(r) } : readyOf(r)
  await setReady($, w)
  await showStatus($)
  await keep($, Object.fromEntries(w.groups.flatMap(g => g.rows).map(row => [row.key, row.link])))
}

export async function loadTicket($: $, key: string) {
  const [t, b] = await Promise.all([call($, 'ticket', { ticket: key }), call($, 'brief', { ticket: key })])
  const ok = (r: Result | null) => (r && !r.isError ? objectOf(r) : null)
  const held = heldOf(key, ok(t), ok(b))
  await setTicket($, held)
  await keep($, { [key]: held.link })
  await loadTicks($)
}

// needs_you’s questions; my_status’s waiting question where needs_you leaves it out.
export async function loadQuestions($: $, asked: Question | null = null) {
  const r = await call($, 'needs_you', {})
  if ((!r || r.isError) && !asked) return
  const got = r && !r.isError ? questionsOf(r) : { items: [] as Question[], count: undefined }
  const items = asked && !got.items.some(i => i.id === asked.id) ? [asked, ...got.items] : got.items
  await setQuestions($, q => ({
    items,
    skipped: q.skipped.filter(id => items.some(i => i.id === id)),
    isRead: true,
    count: got.count,
  }))
  await showStatus($)
}

async function person($: $) {
  return (await snapshot($)).s?.person ?? 'me'
}

export async function loadTicks($: $) {
  const all = (await stored<Record<string, number[]>>($, `ticks:${await person($)}`)) ?? {}
  await setTicks($, () => all)
}

// Ticks are the person’s own: the hub keeps no state for a criterion.
export async function tick($: $, key: string, i: number) {
  const all = await setTicks($, t => {
    const on = t[key] ?? []

    return { ...t, [key]: on.includes(i) ? on.filter(n => n !== i) : [...on, i].sort((a, b) => a - b) }
  })
  await save($, `ticks:${await person($)}`, all)
}

// A ticket held or a question waiting: the pane opens itself for these alone.
export async function hasWork($: $) {
  const { held, qs } = await snapshot($)

  return held !== null || qs.items.length > 0
}

// Everything the pane draws, read again. False while signed out.
export async function refresh($: $): Promise<boolean> {
  if (!(await poll($, true))) return false
  await Promise.all([loadReady($), loadTicks($)])

  return true
}

export async function assign($: $, key: string): Promise<string> {
  const r = await call($, 'assign', { ticket: key })
  const said = !r ? SIGN_IN : r.isError ? textOf(r) : `Assigned ${key} to you.`
  if (r && !r.isError) {
    await save($, 'ticket', key)
    await setStatus($, s => (s ? { ...s, key, since: s.readAt, train: undefined } : s))
    await loadTicket($, key)
    await showStatus($)
  }
  $.ui.toast(said)

  return said
}

type Given = { choice: string } | { text: string } | { skip: true }

export async function answer($: $, q: Question, given: Given) {
  const r = await call($, 'answer_need', { key: q.key, needId: q.id, revision: q.revision, answer: given })
  const isSkip = 'skip' in given
  // The hub may not take a skip yet: the pane skips it here all the same.
  if (r && r.isError && !isSkip) return $.ui.toast(textOf(r))
  await setQuestions($, s =>
    isSkip ? { ...s, skipped: [...s.skipped, q.id] } : { ...s, items: s.items.filter(i => i.id !== q.id) },
  )
  if (!isSkip) await loadQuestions($)
  const left = (await snapshot($)).qs
  if (!left.items.some(i => !left.skipped.includes(i.id))) await setView($, v => ({ ...v, answering: false }))
  await showStatus($)
}
