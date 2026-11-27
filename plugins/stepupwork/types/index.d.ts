// What the pane draws from, as the plugin reads it off the workshop’s tools.
export type Row = {
  key: string
  title: string
  step?: string
  points?: number
  claimable: boolean
  reason?: string
  link?: string
}
export type Ready = { groups: { name: string; rows: Row[] }[]; next?: string; canClaim?: number; note?: string }
export type Train = { n: string; state: string; round?: number; red?: string; link?: string }
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
  acceptance: string[]
}
export type Question = {
  id: string
  key?: string
  revision?: string | number
  text: string
  choices: string[]
  suggested?: string
  at?: number
  of?: number
}
export type Questions = { items: Question[]; skipped: string[] }
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
