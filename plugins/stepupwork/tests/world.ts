// A workshop for the tests: the hub's tools answered from a table, a clock that
// moves only when a test moves it, a store, and a record of what the plugin said.
import { mock } from 'claude-code/testing'
import type { On } from 'claude-code'

export const NOW = Date.parse('2026-11-28T09:00:00Z')
export const PANE = {
  plugin: 'stepupwork',
  component: 'Pane',
  requestId: 'stepupwork',
  props: { title: 'StepUpWork', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const
export const SURFACES = ['terminal', 'desktop'] as const
export const RUN = { origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 120 } } as const

type Answer = unknown | ((args: Record<string, unknown>) => unknown)
// `servers`: what each name $.mcp.connect is asked answers, as the engine would:
// the name it runs under, or none. Absent, the claude.ai connector alone is in.
type Options = { isSignedIn?: boolean; store?: Record<string, unknown>; servers?: Record<string, string | null> }

export const READY = {
  groups: [
    {
      project: 'demo',
      lane: 'now',
      rows: [
        { key: 'DEMO-1', title: 'The first ready ticket', step: 'To plan', claimable: true },
        { key: 'DEMO-2', title: 'The second ready ticket', step: 'Ready', claimable: true },
        { key: 'DEMO-3', title: 'A ticket that waits', step: 'To plan', claimable: false, overlap: { with: 'DEMO-2' } },
      ],
    },
  ],
  next: { key: 'DEMO-1' },
  counts: { canClaim: 2 },
}
export const TICKET = {
  key: 'DEMO-1',
  title: 'The first ready ticket',
  step: 'Building',
  points: 3,
  diary: { latest: 'ran the tests, all passed' },
  link: 'https://hub.example.com/t/DEMO-1',
}
export const BRIEF = {
  text: 'Draw the empty state.\n\nThe rest of the brief, read on demand.',
  acceptance: ['The empty state says so.', 'Light and dark.', 'Desktop and phone.'],
  revision: 3,
  fresh: true,
  plannedPaths: ['a.tsx', 'b.mjs'],
}

export function world(on: On, answers: Record<string, Answer>, options: Options = {}) {
  const calls: { tool: string; args: Record<string, unknown> }[] = []
  const toasts: string[] = []
  const notices: string[] = []
  const statuses: (string | undefined)[] = []
  const filled: string[] = []
  const opened: string[] = []
  const clock = mock.clock(on, { now: NOW })
  // The plugin's store, which a test seeds and reads back.
  const store: Record<string, unknown> = JSON.parse(JSON.stringify(options.store ?? {}))
  on('store.get', (_, e) => ({ value: store[e.key] }))
  on('store.set', (_, e) => {
    store[e.key] = JSON.parse(JSON.stringify(e.value))

    return { value: undefined }
  })
  const asked: string[] = []
  const servers = options.servers ?? { 'claude.ai stepupwork': 'claude.ai stepupwork' }
  on('mcp.connect', (_, e) => {
    asked.push(e.server)
    const as = options.isSignedIn !== false ? servers[e.server] : null

    return {
      value: (as ? { isConnected: true, server: as } : { isConnected: false, reason: 'auth', message: 'Sign in first' }) as never,
    }
  })
  const via: string[] = []
  on('mcp.call', (_, e) => {
    calls.push({ tool: e.tool, args: e.args })
    via.push(e.server)
    const a = answers[e.tool]
    const v = typeof a === 'function' ? (a as (args: Record<string, unknown>) => unknown)(e.args) : a
    const text = v === undefined ? `No tool ${e.tool}` : typeof v === 'string' ? v : JSON.stringify(v)

    return { value: { content: [{ type: 'text' as const, text }], isError: v === undefined } }
  })
  on('ui.toast', (_, e) => {
    toasts.push(e.text)

    return { value: undefined }
  })
  on('ui.notify', (_, e) => {
    notices.push(e.text)

    return { value: { isSent: true, channel: 'terminal_bell' } as never }
  })
  on('ui.status', (_, e) => {
    statuses.push(e.text)

    return { value: undefined }
  })
  on('prompt.fill', (_, e) => {
    filled.push(e.text)

    return { isFilled: true, text: e.text, cursor: e.text.length } as never
  })
  on('ui.open', (_, e) => {
    opened.push(e.id)

    return { value: { isPlaced: true } }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.end', () => ({ sessionId: 'test' }))
  on('tool.call', () => ({ result: {} }) as never)

  return {
    asked,
    via,
    calls,
    toasts,
    notices,
    statuses,
    filled,
    opened,
    clock,
    store,
    called: (tool: string) => calls.filter(c => c.tool === tool),
  }
}
