// Reads what the workshop tools answer into what the pane draws. Every field is
// read only when present: a tool that answers less than this still draws.
import type { Held, Ready, Round, Status, Train } from '../types'

export type Result = { content: { type: string; text?: string }[]; isError?: boolean; structuredContent?: unknown }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any

export type { Any }
export const textOf = (r: Result) => r.content.map(c => c.text ?? '').join('\n')

export function objectOf(r: Result): Any {
  if (r.structuredContent && typeof r.structuredContent === 'object') return r.structuredContent
  try {
    return JSON.parse(textOf(r))
  } catch {
    return null
  }
}

export const str = (v: unknown) => (typeof v === 'string' && v !== '' ? v : typeof v === 'number' ? String(v) : undefined)
export const num = (v: unknown) => (typeof v === 'number' ? v : undefined)
export const words = (v: Any) => str(v) ?? str(v?.text) ?? str(v?.label)
const list = (v: Any): string[] => (Array.isArray(v) ? v.map(words).filter((w): w is string => !!w) : [])
export const https = (v: unknown) => (typeof v === 'string' && v.startsWith('https://') ? v : undefined)

function time(v: unknown): number | undefined {
  if (typeof v === 'number') return v
  const t = typeof v === 'string' ? Date.parse(v) : NaN

  return Number.isNaN(t) ? undefined : t
}

const arr = (v: unknown): Any[] => (Array.isArray(v) ? v : [])

// A round as `train` answers it: its steps where sent, else where it went red.
function roundOf(r: Any, i: number): Round {
  const steps = arr(r?.steps)
    .map(x => (typeof x === 'string' ? { name: x, result: '' } : { name: str(x?.name) ?? str(x?.step) ?? '', result: str(x?.result) ?? str(x?.state) ?? '' }))
    .filter(x => x.name)

  return { n: num(r?.n) ?? i + 1, result: str(r?.result), redAt: str(r?.redAt), steps, fixed: !!r?.fix || r?.fixed === true }
}

function trainOf(t: Any): Train | undefined {
  const n = str(t?.n) ?? str(t?.id)
  if (!n) return undefined
  const red = str(t.red) ?? str(t.red?.at) ?? str(t.red?.step) ?? str(t.redAt)
  const tickets = arr(t.tickets)
    .map(x => ({ key: str(x?.key) ?? str(x) ?? '', isMine: x?.mine === true || x?.isMine === true }))
    .filter(x => x.key)

  return {
    n,
    state: str(t.state) ?? (red ? 'red' : ''),
    round: num(t.round),
    red,
    at: time(t.red?.since ?? t.redSince ?? t.since ?? t.at),
    link: https(t.link),
    rounds: arr(t.rounds).map(roundOf),
    tickets,
  }
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

// Why a row waits, in one line: from the hub’s own words, else its overlap.
function waitsOf(row: Any): string | undefined {
  const said = str(row.waits) ?? str(row.reasonLong) ?? str(row.overlap?.why)
  if (said) return said
  const on = str(row.overlap?.with)
  if (!on) return undefined
  const files = arr(row.overlap?.paths).length

  return `${row.key} waits until ${on} lands${files ? `: they change the same file${files === 1 ? '' : 's'}` : ''}.`
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
      waits: row.claimable === false ? waitsOf(row) : undefined,
      link: https(row.link),
    })),
  }))

  return { groups, next: str(o.next?.key), canClaim: num(o.counts?.canClaim) }
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
    firstPaths: arr(b?.plannedPaths).map(words).filter((p): p is string => !!p).slice(0, 2),
    acceptance: list(b?.acceptance),
  }
}
