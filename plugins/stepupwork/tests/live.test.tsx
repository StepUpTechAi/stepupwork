import { expect, test } from 'claude-code/testing'

import { BRIEF, NOW, PANE, READY, SURFACES, TICKET, world } from './world'

const BASE = { ready_work: READY, needs_you: { items: [] }, ticket: TICKET, brief: BRIEF }
const train = (state: string, round = 2) => ({
  line: 'DEMO-1 is on train 412.',
  lease: { key: 'DEMO-1' },
  leaseSince: NOW - 10 * 60_000,
  train: { n: 412, state, round, red: state === 'red' ? 'e2e' : undefined },
  cursor: `c-${state}-${round}`,
  person: { id: 'p1' },
  link: 'https://hub.example.com/w',
})
const RED = 'Train 412 went red at e2e in round 2, with DEMO-1 on it.'

test('today: my_status answers only its line, the status line shows it, polled every 60 s', async ($, on) => {
  const w = world(on, { ...BASE, my_status: { line: 'Nothing claimed. 2 ready for you.' } })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await w.clock.settle()
  expect(w.statuses.at(-1)).toBe('Nothing claimed. 2 ready for you.')
  expect(w.called('my_status')).toEqual([{ tool: 'my_status', args: {} }])
  await w.clock.advance(59_000)
  expect(w.called('my_status')).toHaveLength(1)
  await w.clock.advance(1_000)
  expect(w.called('my_status')).toHaveLength(2)
  expect(w.toasts).toEqual([])
})

test('a plain-text my_status still sets the status line', async ($, on) => {
  const w = world(on, { ...BASE, my_status: 'Nothing claimed.' })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await w.clock.settle()
  expect(w.statuses.at(-1)).toBe('Nothing claimed.')
})

test('with the new fields: the cursor rides each poll, every 20 s while the train runs', async ($, on) => {
  const w = world(on, { ...BASE, my_status: train('gating') })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await w.clock.settle()
  expect(w.statuses.at(-1)).toBe('DEMO-1 · train 412 gating')
  await w.clock.advance(20_000)
  expect(w.called('my_status').map(c => c.args)).toEqual([{}, { since: 'c-gating-2' }])
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /^On train/ }))?.text).toBe('On train 412 · gating · round 2')
  expect((await ui.find({ type: 'Text', text: /^Read/ }))?.text).toContain('checks every 20 s while a train runs')
  await ui.unmount()
})

test('a red train raises one toast and one notice, however often it is polled; landing one more', async ($, on) => {
  let state = 'red'
  const w = world(on, { ...BASE, my_status: () => train(state) })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await w.clock.settle()
  await w.clock.advance(60_000)
  expect(w.called('my_status').length).toBeGreaterThan(2)
  expect(w.toasts).toEqual([RED])
  expect(w.notices).toEqual([RED])
  expect(w.statuses.at(-1)).toBe('DEMO-1 · train 412 red at e2e')
  state = 'landed'
  await w.clock.advance(60_000)
  await w.clock.advance(60_000)
  expect(w.toasts).toEqual([RED, 'Train 412 landed, with DEMO-1 on it.'])
  expect(w.notices).toHaveLength(2)
})

test('notices from the hub are used as sent, never doubled by the train state', async ($, on) => {
  const notices = [{ id: 'n-7', kind: 'red', text: RED }]
  const w = world(on, { ...BASE, my_status: () => ({ ...train('red'), notices }) })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await w.clock.settle()
  await w.clock.advance(40_000)
  expect(w.toasts).toEqual([RED])
  expect(w.notices).toEqual([RED])
})

test('an event seen in an earlier session is not raised again', async ($, on) => {
  const w = world(on, { ...BASE, my_status: train('red') }, { store: { seen: ['train-412-red-2'] } })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await w.clock.settle()
  expect(w.toasts).toEqual([])
})

test('the red pane: the train, who is on it, and Ask Jen what broke', async ($, on) => {
  const w = world(on, { ...BASE, my_status: train('red') })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await w.clock.settle()
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    const head = await ui.find({ type: 'Text', text: /went red/ })
    expect(head?.text).toBe(surface === 'terminal' ? '● Train 412 went red at e2e' : 'Train 412 went red at e2e')
    expect((await ui.find({ type: 'Text', text: /Nothing waits on you/ }))?.text).toContain('Jen is repairing it.')
    expect((await ui.find({ type: 'Text', text: /^Next for you/ }))?.text).toContain('while the train is repaired')
    expect(await ui.find({ type: 'Button', key: 'assign-DEMO-1' })).toBeUndefined()
    expect(await ui.find({ type: 'Button', key: 'hand-in' })).toBeUndefined()
    await ui.press({ key: 'what-broke' })
    await ui.unmount()
  }
  expect(w.filled.at(-1)).toBe('Ask Jen what broke train 412.')
})

test('the status line clears at session end, and the polls stop', async ($, on) => {
  const w = world(on, { ...BASE, my_status: train('gating') })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await w.clock.settle()
  await $.session.end({ reason: 'other', sessionId: 'test', resume: { id: 'test' } })
  expect(w.statuses.at(-1)).toBeUndefined()
  const polls = w.called('my_status').length
  await w.clock.advance(120_000)
  expect(w.called('my_status')).toHaveLength(polls)
})
