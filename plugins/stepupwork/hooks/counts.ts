// The numbers the pane, its header and the status line say, worked out once
// here, so the header, the rows heading and the status line never disagree.
import type { Held, Questions, Ready, Status } from '../types'

export const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`

export const waitingOf = (qs: Questions) => qs.items.filter(q => !qs.skipped.includes(q.id))

// What ready_work says the person can take; my_status’s count until it answers.
export function readyCount(w: Ready | null, s: Status | null): number | undefined {
  if (w && (w.groups.length > 0 || w.canClaim !== undefined)) {
    return w.canClaim ?? w.groups.flatMap(g => g.rows).filter(r => r.claimable).length
  }

  return s?.ready
}

// The questions waiting: those needs_you sent, its count where it sent ones the
// pane cannot draw, my_status’s count until needs_you answers.
export function questionCount(qs: Questions, s: Status | null): number {
  if (!qs.isRead) return s?.questions ?? 0
  const shown = waitingOf(qs).length

  return shown || Math.max(0, (qs.count ?? 0) - qs.skipped.length)
}

// "4 ready for you · 3 questions for you"
export function countsLine(ready: number | undefined, questions: number): string | undefined {
  const parts = [ready !== undefined && `${ready} ready for you`, questions > 0 && `${plural(questions, 'question')} for you`]
  const said = parts.filter(Boolean).join(' · ')

  return said || undefined
}

export function statusText(s: Status | null, w: Ready | null, qs: Questions, held: Held | null): string | undefined {
  if (!s) return undefined
  const key = held?.key ?? s.key
  const t = s.train
  if (key && t) return `${key} · train ${t.n} ${t.state === 'red' && t.red ? `red at ${t.red}` : t.state}`.trim()
  if (key) return key
  const counts = countsLine(readyCount(w, s), questionCount(qs, s))

  return counts ? `Nothing claimed · ${counts}` : s.line
}

const ORIGIN = /^https:\/\/[^/?#]+/

// The workshop’s address: my_status’s link, else the site of any link a tool sent.
export function workshopLink(s: Status | null, w: Ready | null, held: Held | null, seen: Record<string, string>) {
  if (s?.link) return s.link
  const any = [held?.link, ...(w?.groups.flatMap(g => g.rows.map(r => r.link)) ?? []), ...Object.values(seen)]

  return any.map(l => (l ? ORIGIN.exec(l)?.[0] : undefined)).find(Boolean)
}
