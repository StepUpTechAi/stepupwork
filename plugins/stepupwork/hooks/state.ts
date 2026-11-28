import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { Held, Questions, Ready, Status, View } from '../types'

type $ = EngineInterface
type Change<T> = (value: T) => T

// Change a tag when what an atom holds changes: it declines what an earlier
// version stored, which outlives a reload.
const signedIn = atom({ plugin: 'stepupwork', key: 'signedIn' } as const, null, { shape: 'signin-1' })
const status = atom({ plugin: 'stepupwork', key: 'status' } as const, null, { shape: 'status-2' })
const ready = atom({ plugin: 'stepupwork', key: 'ready' } as const, null, { shape: 'ready-4' })
const ticket = atom({ plugin: 'stepupwork', key: 'ticket' } as const, null, { shape: 'ticket-3' })
const questions = atom({ plugin: 'stepupwork', key: 'questions' } as const, { items: [], skipped: [], isRead: false }, {
  shape: 'needs-2',
})
// The acceptance ticks of the person signed in, by ticket key: the criteria ticked.
const ticks = atom({ plugin: 'stepupwork', key: 'ticks' } as const, {}, { shape: 'ticks-1' })
const view = atom({ plugin: 'stepupwork', key: 'view' } as const, { answering: false, wholeBrief: false }, {
  shape: 'view-1',
})
// Workshop links seen in tool results, by ticket key: the menu’s "Open in the workshop".
const links = atom({ plugin: 'stepupwork', key: 'links' } as const, {}, { shape: 'links-1' })

// Every value the pane, the glyph and the menu draw from, read together. The
// atoms are read and written in this file alone, where validate lists them.
export async function snapshot($: $) {
  const [isIn, s, w, held, qs, on, v, l] = await Promise.all([
    read($, signedIn),
    read($, status),
    read($, ready),
    read($, ticket),
    read($, questions),
    read($, ticks),
    read($, view),
    read($, links),
  ])

  return { isIn, s, w, held, qs, on, v, l }
}

export function setSignedIn($: $, isIn: boolean) {
  return update($, signedIn, () => isIn)
}
export function setStatus($: $, change: Change<Status | null>) {
  return update($, status, change)
}
export function setReady($: $, w: Ready) {
  return update($, ready, () => w)
}
export function setTicket($: $, held: Held | null) {
  return update($, ticket, () => held)
}
export function setQuestions($: $, change: Change<Questions>) {
  return update($, questions, change)
}
export function setTicks($: $, change: Change<Record<string, number[]>>) {
  return update($, ticks, change)
}
export function setView($: $, change: Change<View>) {
  return update($, view, change)
}
export function setLinks($: $, change: Change<Record<string, string>>) {
  return update($, links, change)
}

export const PANE = 'stepupwork'
export const KEY = /^[A-Z][A-Z0-9]*-\d+$/

// "1 h 12 min", "6 min", "just now"
export function took(ms: number): string {
  const min = Math.floor(ms / 60_000)
  if (min < 1) return 'just now'
  const h = Math.floor(min / 60)

  return h ? `${h} h ${min % 60} min` : `${min} min`
}

// "9:14am", as the footer reads
export function clockTime(ms: number): string {
  const d = new Date(ms)
  const h = d.getHours()

  return `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}${h < 12 ? 'am' : 'pm'}`
}

export const isRunning = (state?: string) => !!state && state !== 'landed'
