// What the pane draws from, as the plugin reads it off the workshop’s tools.
export type Row = {
  key: string
  title: string
  step?: string
  points?: number
  claimable: boolean
  reason?: string
  // The line under the list saying why a row waits: "DEMO-3 waits until DEMO-2 lands."
  waits?: string
  link?: string
}
export type Ready = { groups: { name: string; rows: Row[] }[]; next?: string; canClaim?: number; note?: string }
// One step of a train’s round, as `train` answers it: "build" passed, "e2e" red.
export type Step = { name: string; result: string }
export type Round = { n: number; result?: string; redAt?: string; steps: Step[]; fixed: boolean }
export type Train = {
  n: string
  state: string
  round?: number
  red?: string
  // When it went red, or when the state last changed.
  at?: number
  link?: string
  rounds: Round[]
  // The tickets on it, the person’s own marked.
  tickets: { key: string; isMine: boolean }[]
}
export type Status = {
  line?: string
  key?: string
  since?: number
  train?: Train
  questions?: number
  ready?: number
  person: string
  link?: string
  readAt: number
  cursor?: string | number
}
export type Held = {
  key: string
  title?: string
  step?: string
  points?: number
  latest?: string
  link?: string
  brief?: string
  revision?: string
  fresh?: boolean
  paths?: number
  // The first planned paths, drawn under the brief’s summary.
  firstPaths: string[]
  acceptance: string[]
}
// A choice as drawn: its letter, the button’s short label, the full text the
// person decides from, and the value answer_need takes back.
export type Choice = { letter: string; short: string; full: string; value: string; isCut: boolean }
export type Question = {
  id: string
  key?: string
  revision?: string | number
  text: string
  choices: Choice[]
  suggested?: string
  at?: number
  of?: number
  // The hub sent the question or a choice cut short (it ends in "…").
  isCut: boolean
  link?: string
}
// `isRead`: needs_you has answered at least once. `count`: its own count, where
// it sends one, for questions it sent in a shape the pane cannot draw.
export type Questions = { items: Question[]; skipped: string[]; isRead: boolean; count?: number }
export type View = { answering: boolean; wholeBrief: boolean }

declare module 'claude-code' {
  interface PluginState {
    stepupwork: {
      signedIn: Shaped<boolean | null>
      status: Shaped<Status | null>
      ready: Shaped<Ready | null>
      ticket: Shaped<Held | null>
      questions: Shaped<Questions>
      ticks: Shaped<Record<string, number[]>>
      view: Shaped<View>
      links: Shaped<Record<string, string>>
    }
  }
}
