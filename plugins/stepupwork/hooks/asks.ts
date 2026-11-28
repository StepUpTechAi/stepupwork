// Jen’s questions as needs_you (or my_status’s `question`) answers them: today
// a text alone; with the hub’s richer fields, choices with a short label and a
// full text, a suggestion and progress. Nothing here cuts a text: where the hub
// sent one cut short (it ends in "…"), the question says so.
import type { Choice, Question } from '../types'
import { https, num, objectOf, str, words } from './read'
import type { Any, Result } from './read'

// A choice’s own letter: "A: hide them", "B) show them", "(C) neither".
const LETTER = /^\s*\(?([A-Z])[:.)]\s+/
// The longest label a button carries; a longer choice’s button is its letter.
const SHORT = 28
export const isCutText = (t: string) => /(…|\.\.\.)\s*$/.test(t)

export function choiceOf(c: Any, i: number): Choice {
  const label = str(c) ?? str(c?.label) ?? str(c?.value) ?? str(c?.text) ?? ''
  const value = str(c) ?? str(c?.value) ?? str(c?.label) ?? str(c?.text) ?? ''
  const full = str(c?.text) ?? str(c?.full) ?? str(c?.description) ?? str(c?.detail) ?? label
  const own = str(c?.letter) ?? /^[A-Z]$/.exec(str(c?.key) ?? '')?.[0]
  const letter = own ?? LETTER.exec(label)?.[1] ?? LETTER.exec(full)?.[1] ?? String.fromCharCode(65 + i)
  const given = str(c?.short) ?? (label !== full ? label : undefined)
  const short = given && given.length <= SHORT ? given : full.length <= SHORT ? full : letter

  return { letter, short, full, value, isCut: isCutText(full) }
}

// The full text with its letter in front, once: "A: hide those rows too."
export function fullLine(c: Choice): { letter: string; rest: string } {
  return { letter: c.letter, rest: c.full.replace(LETTER, '') }
}

// Whether the buttons alone say all a choice says: then no lines above them.
export const needsLines = (q: Question) => q.choices.some(c => c.full !== c.short)

export function isSuggested(q: Question, c: Choice) {
  const s = q.suggested
  if (s === undefined) return false

  return s === c.letter || s === c.value || s === c.short || c.value.startsWith(`${s}:`)
}

// "Jen suggests B.": by the choice’s letter where the suggestion names one.
export function suggestion(q: Question): string | undefined {
  if (q.suggested === undefined) return undefined
  const c = q.choices.find(x => isSuggested(q, x))

  return `Jen suggests ${c ? c.letter : q.suggested}.`
}

export function questionOf(n: Any): Question | null {
  const id = str(n?.id) ?? str(n?.needId)
  if (!id) return null
  const text = str(n.text) ?? str(n.question) ?? str(n.ask) ?? ''
  const raw: Any[] = Array.isArray(n.choices) ? n.choices : Array.isArray(n.options) ? n.options : []
  const choices = raw.filter(c => words(c) ?? str(c?.value)).map(choiceOf)

  return {
    id,
    key: str(n.key),
    revision: n.revision,
    text,
    choices,
    suggested: words(n.suggested) ?? str(n.suggested?.letter),
    at: num(n.progress?.at),
    of: num(n.progress?.of),
    isCut: isCutText(text) || choices.some(c => c.isCut),
    link: https(n.link) ?? https(n.url),
  }
}

// needs_you’s items, and its count where it sends one.
export function questionsOf(r: Result): { items: Question[]; count?: number } {
  const o = objectOf(r)
  const items: Any[] = Array.isArray(o) ? o : (o?.items ?? o?.needs ?? [])

  return { items: items.map(questionOf).filter((q): q is Question => q !== null), count: num(o?.count) }
}
