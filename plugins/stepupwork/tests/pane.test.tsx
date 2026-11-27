import { expect, test } from 'claude-code/testing'

import { BRIEF, NOW, PANE, READY, RUN, SURFACES, TICKET, world } from './world'

const IDLE = { my_status: { line: 'Nothing claimed.' }, ready_work: READY, needs_you: { items: [] } }
const HELD = {
  my_status: { line: 'DEMO-1 is yours.', lease: { key: 'DEMO-1' }, leaseSince: NOW - 72 * 60_000, person: { id: 'p1' } },
  ready_work: READY,
  needs_you: { items: [] },
  ticket: TICKET,
  brief: BRIEF,
}

for (const command of ['stepupwork', 'stepupwork:stepupwork']) {
  test(`/${command} opens the pane on ready work, the next ticket marked`, async ($, on) => {
    world(on, IDLE)
    const r = await $.command.run({ command, args: '', ...RUN })
    expect(r.text).toBe('StepUpWork pane opened.')
    for (const surface of SURFACES) {
      const ui = await $.ui.mount({ ...PANE, surface })
      expect((await ui.find({ type: 'Text', text: /^Nothing claimed$/ }))?.text).toBe('Nothing claimed')
      expect((await ui.find({ type: 'Button', key: 'assign-DEMO-1' }))?.props.label).toBe('Assign to me')
      expect((await ui.find({ type: 'Button', key: 'assign-DEMO-2' }))?.props.label).toBe('Assign')
      expect(await ui.find({ type: 'Button', key: 'assign-DEMO-3' })).toBeUndefined()
      expect((await ui.find({ type: 'Text', text: /Overlaps DEMO-2/ }))?.text).toBe('Overlaps DEMO-2')
      expect((await ui.find({ type: 'Text', text: /you can take/ }))?.text).toBe('2 you can take')
      if (surface === 'terminal') {
        const row = await ui.find({ type: 'Text', text: /^DEMO-1/ })
        expect(row?.text).toBe('DEMO-1  The first ready ticket  Next  To plan')
      } else {
        expect((await ui.find({ type: 'Text', text: /^ Next $/ }))?.props.backgroundColor).toBe('claude')
        expect((await ui.find({ type: 'Text', text: /^ To plan $/ }))?.text).toBe(' To plan ')
      }
      await ui.unmount()
    }
  })
}

test('Assign calls assign and moves the pane to working', async ($, on) => {
  const w = world(on, { ...IDLE, assign: { ok: true }, ticket: TICKET, brief: BRIEF })
  await $.command.run({ command: 'stepupwork', args: '', ...RUN })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'assign-DEMO-1' })
  expect(w.called('assign')).toEqual([{ tool: 'assign', args: { ticket: 'DEMO-1' } }])
  expect((await ui.find({ type: 'Text', text: /^Working on$/ }))?.text).toBe('Working on')
  expect((await ui.find({ type: 'Text', text: /^DEMO-1$/ }))?.props.mono).toBe(true)
  expect(w.statuses.at(-1)).toBe('DEMO-1')
  expect(w.toasts).toContain('Assigned DEMO-1 to you.')
  await ui.unmount()
})

test('/stepupwork assign KEY still assigns', async ($, on) => {
  const w = world(on, { ...IDLE, assign: { ok: true }, ticket: TICKET, brief: BRIEF })
  const r = await $.command.run({ command: 'stepupwork', args: 'assign DEMO-2', ...RUN })
  expect(r.text).toBe('Assigned DEMO-2 to you.')
  expect(w.called('assign')[0]?.args).toEqual({ ticket: 'DEMO-2' })
})

test('working shows the ticket, its time on it, the brief and ticks a seeded store kept', async ($, on) => {
  const w = world(on, HELD, { store: { 'ticks:p1': { 'DEMO-1': [0, 2] } } })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /^· / }))?.text).toBe('· 1 h 12 min')
    expect((await ui.find({ type: 'Text', text: /^ 3 points $/ }))?.text).toBe(' 3 points ')
    expect((await ui.find({ type: 'Text', text: /^Latest:/ }))?.text).toBe('Latest: ran the tests, all passed')
    expect((await ui.find({ type: 'Text', text: /^r3/ }))?.text).toBe('r3 · fresh · 2 planned paths')
    if (surface === 'terminal') {
      expect((await ui.find({ type: 'Text', text: /^Acceptance/ }))?.text).toBe('Acceptance · 2 of 3 ticked by you')
      expect((await ui.find({ type: 'Button', key: 'tick-0' }))?.text).toContain('[x]')
      expect((await ui.find({ type: 'Button', key: 'tick-1' }))?.text).toContain('[ ]')
    } else {
      // The kit draws a Progress as its label, its figure and a bar.
      expect((await ui.find({ type: 'Text', text: /ticked by you/ }))?.text).toContain('2 of 3 ticked by you')
      expect((await ui.find({ type: 'Button', key: 'tick-2' }))?.text).toContain('☑')
    }
    await ui.unmount()
  }
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'tick-1' })
  expect((await ui.find({ type: 'Text', text: /ticked by you/ }))?.text).toContain('3 of 3 ticked by you')
  await ui.press({ key: 'tick-0' })
  expect((await ui.find({ type: 'Text', text: /ticked by you/ }))?.text).toContain('2 of 3 ticked by you')
  expect(w.store['ticks:p1']).toEqual({ 'DEMO-1': [1, 2] })
  await ui.press({ key: 'whole-brief' })
  expect((await ui.find({ type: 'Markdown' }))?.props.text).toBe(BRIEF.text)
  await ui.unmount()
})

test('Hand in fills the prompt for the model, and the plugin never calls submit', async ($, on) => {
  const w = world(on, HELD)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'hand-in' })
  expect(w.filled).toEqual(['Push the branch for DEMO-1, then hand it in with the stepupwork submit tool.'])
  expect(w.called('submit')).toEqual([])
  await ui.unmount()
})

test('the pane opens itself at start only with work held, and only where it docks', async ($, on) => {
  const w = world(on, HELD)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await w.clock.settle()
  expect(w.opened).toEqual([])
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await w.clock.settle()
  expect(w.opened).toEqual(['stepupwork'])
})

test('nothing held and no question: the pane stays shut at start', async ($, on) => {
  const w = world(on, IDLE)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await w.clock.settle()
  expect(w.opened).toEqual([])
  expect(w.called('my_status')).toHaveLength(1)
})

test('a minimised pane is one line', async ($, on) => {
  world(on, HELD)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop', props: { ...PANE.props, placement: 'widget' } })
  expect((await ui.find({ type: 'Text' }))?.text).toBe('DEMO-1')
  await ui.unmount()
})
