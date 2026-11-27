// Reads what the workshop tools answer into what the pane draws. Every field is
// read only when present: a tool that answers less than this still draws.
import type { Held, Question, Ready, Status, Train } from '../types'

export type Result = { content: { type: string; text?: string }[]; isError?: boolean; structuredContent?: unknown }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any

export const textOf = (r: Result) => r.content.map(c => c.text ?? '').join('\n')

export function objectOf(r: Result): Any {
  if (r.structuredContent && typeof r.structuredContent === 'object') return r.structuredContent
  try {
    return JSON.parse(textOf(r))
  } catch {
    return null
  }
}

const str = (v: unknown) => (typeof v === 'string' && v !== '' ? v : typeof v === 'number' ? String(v) : undefined)
const num = (v: unknown) => (typeof v === 'number' ? v : undefined)
const words = (v: Any) => str(v) ?? str(v?.text) ?? str(v?.label)
const list = (v: Any): string[] => (Array.isArray(v) ? v.map(words).filter((w): w is string => !!w) : [])
export const https = (v: unknown) => (typeof v === 'string' && v.startsWith('https://') ? v : undefined)

function time(v: unknown): number | undefined {
  if (typeof v === 'number') return v
  const t = typeof v === 'string' ? Date.parse(v) : NaN

  return Number.isNaN(t) ? undefined : t
}

function trainOf(t: Any): Train | undefined {
  const n = str(t?.n) ?? str(t?.id)
  if (!n) return undefined
  const red = str(t.red) ?? str(t.red?.at) ?? str(t.red?.step)

  return { n, state: str(t.state) ?? (red ? 'red' : ''), round: num(t.round), red, link: https(t.link) }
}

// my_status: today a line (and counts); with the hub’s new fields, the lease,
// its train, the waiting question and notices since the cursor.
export function statusOf(r: Result, readAt: number, held?: string): Status {
  const o = objectOf(r)
  if (!o || typeof o !== 'object') return { line: str(textOf(r)), key: held, person: 'me', readAt }
  const lease = o.lease ?? {}
  const counts = o.counts ?? {}

  return {
    line: str(o.line),
    key: str(lease.key) ?? str(o.ticket?.key) ?? str(o.ticket) ?? held,
    since: time(o.leaseSince ?? lease.since),
    train: trainOf(o.train),
    questions: num(counts.questions) ?? num(counts.needsYou) ?? (o.question ? 1 : undefined),
    ready: num(counts.ready) ?? num(counts.canClaim),
    person: str(o.person?.id) ?? str(o.person?.email) ?? str(o.person) ?? str(o.you) ?? 'me',
    link: https(o.link),
    readAt,
    cursor: str(o.cursor),
  }
}

export type Notice = { id: string; text: string; isBig: boolean }

const BIG = /red|landed/

// Notices since the cursor where the hub sends them; else the train’s own state.
export function noticesOf(r: Result, s: Status): Notice[] {
  const list = objectOf(r)?.notices
  if (Array.isArray(list)) {
    return list
      .filter(n => words(n))
      .map(n => ({ id: str(n.id) ?? words(n)!, text: words(n)!, isBig: BIG.test(`${n.kind ?? ''} ${words(n)}`) }))
  }
  const t = s.train
  if (!t || (t.state !== 'red' && t.state !== 'landed')) return []
  const on = s.key ? `, with ${s.key} on it` : ''
  const text =
    t.state === 'red'
      ? `Train ${t.n} went red${t.red ? ` at ${t.red}` : ''}${t.round ? ` in round ${t.round}` : ''}${on}.`
      : `Train ${t.n} landed${on}.`

  return [{ id: `train-${t.n}-${t.state}-${t.round ?? 0}`, text, isBig: true }]
}

export function statusLine(s: Status): string | undefined {
  const t = s.train
  if (s.key && t) return `${s.key} · train ${t.n} ${t.state === 'red' && t.red ? `red at ${t.red}` : t.state}`.trim()

  return s.line ?? s.key
}

export function readyOf(r: Result): Ready {
  const o = objectOf(r)
  if (!o || typeof o !== 'object') return { groups: [], note: textOf(r) }
  const groups = (o.groups ?? []).map((g: Any) => ({
    name: [g.project, g.lane].filter(Boolean).join(' · '),
    rows: (g.rows ?? []).map((row: Any) => ({
      key: String(row.key),
      title: str(row.title) ?? '',
      step: str(row.step),
      points: num(row.points),
      claimable: row.claimable !== false,
      reason: str(row.reason) ?? (row.overlap?.with ? `Overlaps ${row.overlap.with}` : undefined),
      link: https(row.link),
    })),
  }))

  return { groups, next: str(o.next?.key), canClaim: num(o.counts?.canClaim) }
}

// needs_you: today’s items, or the richer shape with choices, a suggestion and progress.
export function questionsOf(r: Result): Question[] {
  const o = objectOf(r)
  const items: Any[] = Array.isArray(o) ? o : (o?.items ?? o?.needs ?? [])

  return items
    .map(n => ({
      id: str(n.id) ?? str(n.needId) ?? '',
      key: str(n.key),
      revision: n.revision,
      text: str(n.text) ?? str(n.question) ?? str(n.ask) ?? '',
      choices: list(n.choices ?? n.options),
      suggested: words(n.suggested),
      at: num(n.progress?.at),
      of: num(n.progress?.of),
    }))
    .filter(q => q.id !== '')
}

export function heldOf(key: string, t: Any, b: Any): Held {
  const latest = t?.diary?.latest

  return {
    key,
    title: str(t?.title),
    step: str(t?.step),
    points: num(t?.points),
    latest: str(latest) ?? str(latest?.text),
    link: https(t?.link),
    brief: str(b?.text) ?? str(b?.brief) ?? str(b?.summary),
    revision: str(b?.revision),
    fresh: typeof b?.fresh === 'boolean' ? b.fresh : undefined,
    paths: Array.isArray(b?.plannedPaths) ? b.plannedPaths.length : undefined,
    acceptance: list(b?.acceptance),
  }
}
