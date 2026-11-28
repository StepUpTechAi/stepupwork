import { expect, test } from 'claude-code/testing'

import { PANE, READY, RUN, world } from './world'

const IDLE = { my_status: { line: 'x' }, ready_work: READY, needs_you: { items: [] } }

test('the plugin’s own server is asked first, by its manifest key', async ($, on) => {
  const w = world(on, IDLE, { servers: { stepupwork: 'plugin:stepupwork:stepupwork' } })
  await $.command.run({ command: 'stepupwork', args: '', ...RUN })
  expect(w.asked).toEqual(['stepupwork'])
  expect(new Set(w.via)).toEqual(new Set(['plugin:stepupwork:stepupwork']))
})

test('the same server run as the claude.ai connector: the engine answers the key with that name, and calls go there', async ($, on) => {
  const w = world(on, IDLE, { servers: { stepupwork: 'claude.ai Step Up Work' } })
  await $.command.run({ command: 'stepupwork', args: '', ...RUN })
  expect(w.asked).toEqual(['stepupwork'])
  expect(new Set(w.via)).toEqual(new Set(['claude.ai Step Up Work']))
})

test('the plugin’s server waiting on sign-in: the signed-in claude.ai connector carries the pane', async ($, on) => {
  const w = world(on, IDLE, { servers: { 'claude.ai Step Up Work': 'claude.ai Step Up Work' } })
  const r = await $.command.run({ command: 'stepupwork', args: '', ...RUN })
  expect(r.text).toBe('StepUpWork pane opened.')
  expect(w.asked).toEqual(['stepupwork', 'plugin:stepupwork:stepupwork', 'claude.ai Step Up Work'])
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ type: 'Button', key: 'assign-DEMO-1' }))?.props.label).toBe('Assign to me')
  await ui.unmount()
})

test('neither signed in: the pane says how to sign in, and every name was tried once', async ($, on) => {
  const w = world(on, IDLE, { servers: {} })
  const r = await $.command.run({ command: 'stepupwork', args: '', ...RUN })
  expect(r.text).toContain('StepUpWork is not signed in here.')
  expect(w.asked).toEqual(['stepupwork', 'plugin:stepupwork:stepupwork', 'claude.ai Step Up Work', 'claude.ai stepupwork'])
  expect(w.calls).toEqual([])
})
