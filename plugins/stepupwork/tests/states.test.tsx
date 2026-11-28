import { expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { clipped } from './layout'
import { BRIEF, NOW, PANE, READY, SURFACES, TICKET, world } from './world'

const BASE = { ready_work: READY, needs_you: { items: [] }, ticket: TICKET }
const HELD = { line: 'x', lease: { key: 'DEMO-1' }, leaseSince: NOW - 72 * 60_000, person: { id: 'p1' } }
const PATHS = { ...BRIEF, plannedPaths: ['a.tsx', 'b.mjs', 'c.ts', 'd.ts', 'e.ts'] }
// train as the hub is getting it: rounds with their steps, and who is on it.
const RICH_TRAIN = {
  n: 412,
  state: 'red',
  round: 2,
  red: { step: 'e2e', since: NOW - 3 * 60_000 },
  link: 'https://hub.example.com/trains/412',
  rounds: [
    { n: 1, result: 'red', redAt: 'unit', fix: 'f1' },
    {
      n: 2,
      steps: [
        { name: 'build', result: 'passed' },
        { name: 'unit', result: 'passed' },
        { name: 'e2e', result: 'red' },
        { name: 'visual', result: 'waiting' },
      ],
    },
  ],
  tickets: [{ key: 'DEMO-1', mine: true }, { key: 'DEMO-7' }, { key: 'DEMO-8' }, { key: 'DEMO-9' }],
}

async function mounted($: Parameters<TestBody>[0], on: Parameters<TestBody>[1], status: unknown, extra = {}) {
  const w = world(on, { ...BASE, brief: PATHS, my_status: status, ...extra }, { store: { 'ticks:p1': { 'DEMO-1': [0, 2] } } })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await w.clock.settle()

  return w
}

for (const surface of SURFACES) {
  test(`${surface} working: Working on, the step and time, the key and its points pill, the title`, async ($, on) => {
    await mounted($, on, HELD)
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /^Working on$/ }))?.props).toMatchObject({ color: 'claude', size: 'caption' })
    expect((await ui.find({ type: 'Text', text: /^Building$/ }))?.props.dimColor).toBe(true)
    expect((await ui.find({ type: 'Text', text: /^· 1 h 12 min$/ }))).toBeDefined()
    expect((await ui.find({ type: 'Text', text: /^DEMO-1$/ }))?.props).toMatchObject({ mono: true, size: 'heading' })
    expect((await ui.find({ type: 'Text', text: /^ 3 points $/ }))?.props.backgroundColor).toBe('subtle')
    expect((await ui.find({ type: 'Text', text: /^Not on a train yet\.$/ }))).toBeDefined()
    expect((await ui.find({ type: 'Text', text: /^Hand it in once the branch is pushed\.$/ }))).toBeDefined()
    await ui.unmount()
  })

  test(`${surface} working: Hand in… primary, Park… and Let it go…, none cut at a narrow pane`, async ($, on) => {
    const w = await mounted($, on, HELD)
    const ui = await $.ui.mount({ ...PANE, surface, props: { ...PANE.props, bodyColumns: 32 } })
    expect((await ui.find({ type: 'Button', key: 'hand-in' }))?.props).toMatchObject({ label: 'Hand in…', variant: 'primary' })
    expect((await ui.find({ type: 'Button', key: 'park' }))?.props.label).toBe('Park…')
    expect((await ui.find({ type: 'Button', key: 'let-go' }))?.props.label).toBe('Let it go…')
    expect(clipped((await ui.drawn()) as never, 32)).toEqual([])
    await ui.press({ key: 'park' })
    await ui.press({ key: 'let-go' })
    expect(w.filled).toEqual(['Park DEMO-1 in StepUpWork. The reason: ', 'Release DEMO-1 in StepUpWork. The reason: '])
    await ui.unmount()
  })

  test(`${surface} working: the acceptance bar and its figure, ticks as boxes`, async ($, on) => {
    await mounted($, on, HELD)
    const ui = await $.ui.mount({ ...PANE, surface })
    // The kit draws a Progress as Box and Text: its label, its figure, its bar.
    expect((await ui.find({ type: 'Text', text: /^Acceptance/ }))).toBeDefined()
    expect((await ui.find({ type: 'Text', text: /ticked by you/ }))?.text).toContain('2 of 3 ticked by you')
    expect((await ui.find({ type: 'Button', key: 'tick-1' }))?.text).toContain(surface === 'terminal' ? '[ ]' : '☐')
    await ui.unmount()
  })

  test(`${surface} working: the brief’s head, its summary, the first planned paths and how many more`, async ($, on) => {
    await mounted($, on, HELD)
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /^r3/ }))?.text).toBe('r3 · fresh · 5 planned paths')
    expect((await ui.find({ type: 'Markdown', key: 'paths' }))?.props.text).toBe('- `a.tsx`\n- `b.mjs` and 3 more')
    expect((await ui.find({ type: 'Button', key: 'whole-brief' }))?.props.label).toBe('Read the whole brief')
    expect((await ui.find({ type: 'Link', text: 'Open in the workshop' }))?.props.href).toBe(TICKET.link)
    await ui.unmount()
  })

  test(`${surface} red, the train as the hub is getting it: the box, rounds and steps, who is on it`, async ($, on) => {
    const more = { ...READY.groups[0], rows: [...READY.groups[0]!.rows, { key: 'DEMO-5', title: 'Five', claimable: true }] }
    await mounted($, on, { ...HELD, train: RICH_TRAIN }, { ready_work: { ...READY, groups: [more] } })
    const ui = await $.ui.mount({ ...PANE, surface })
    const box = await ui.find({ type: 'Box', text: /went red/ })
    expect((await ui.find({ type: 'Text', text: /went red/ }))?.props.color).toBe('error')
    expect((await ui.find({ type: 'Text', text: /^round 2/ }))?.text).toBe('round 2 · 3 min ago')
    expect((await ui.find({ type: 'Text', text: /^Round 1$/ }))).toBeDefined()
    expect((await ui.find({ type: 'Text', text: /^ unit $/ }))?.props.backgroundColor).toBe('error')
    expect((await ui.find({ type: 'Text', text: /^fixed$/ }))).toBeDefined()
    const steps = await ui.findAll({ type: 'Text', text: /^ (build|unit|e2e|visual) $/ })
    expect(steps.map(s => [s.text.trim(), s.props.backgroundColor])).toEqual([
      ['unit', 'error'],
      ['build', 'success'],
      ['unit', 'success'],
      ['e2e', 'error'],
      ['visual', 'subtle'],
    ])
    expect((await ui.find({ type: 'Text', text: /^On it:/ }))?.text).toBe('On it: DEMO-1 (yours), DEMO-7, DEMO-8, DEMO-9 · a batch of 4')
    expect((await ui.find({ type: 'Link', text: 'Open train 412' }))?.props.href).toBe(RICH_TRAIN.link)
    expect(box).toBeDefined()
    // The red pane: no hand-in, no brief; the next work while the train is repaired, two rows.
    expect(await ui.find({ type: 'Button', key: 'hand-in' })).toBeUndefined()
    expect(await ui.find({ type: 'Markdown', key: 'brief' })).toBeUndefined()
    expect((await ui.find({ type: 'Text', text: /^while the train/ }))).toBeDefined()
    for (const key of ['DEMO-2', 'DEMO-3']) expect(await ui.find({ type: 'Box', key: `row-${key}` })).toBeDefined()
    expect(await ui.find({ type: 'Box', key: 'row-DEMO-5' })).toBeUndefined()
    expect(await ui.find({ type: 'Box', key: 'row-DEMO-1' })).toBeUndefined()
    expect((await ui.find({ type: 'Text', text: /^Read / }))?.text).toContain('checks every 20 s while a train runs')
    await ui.unmount()
  })

  test(`${surface} red, the train as the hub sends it today: no rounds drawn, nothing made up`, async ($, on) => {
    await mounted($, on, { ...HELD, train: { n: 412, state: 'red', round: 2, red: 'e2e' } })
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /went red/ }))?.text).toContain('Train 412 went red at e2e')
    expect((await ui.find({ type: 'Text', text: /^round 2/ }))?.text).toBe('round 2')
    expect(await ui.find({ type: 'Text', text: /^Round / })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: /^On it:/ })).toBeUndefined()
    expect(await ui.find({ type: 'Link', text: /^Open train/ })).toBeUndefined()
    await ui.unmount()
  })
}

test('desktop: the red box has its round error border; the terminal a ● head instead', async ($, on) => {
  await mounted($, on, { ...HELD, train: RICH_TRAIN })
  const desk = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await desk.find({ type: 'Box', text: /^Train 412 went red/ }))?.props).toMatchObject({ borderStyle: 'round', borderColor: 'error' })
  await desk.unmount()
  const term = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await term.find({ type: 'Text', text: /went red/ }))?.text).toBe('● Train 412 went red at e2e')
  await term.unmount()
})

test('a running train that is not red: its line and its rounds, no hand-in', async ($, on) => {
  await mounted($, on, { ...HELD, train: { ...RICH_TRAIN, state: 'gating', red: undefined, rounds: RICH_TRAIN.rounds.slice(0, 1) } })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /^On train/ }))?.text).toBe('On train 412 · gating · round 2')
  expect((await ui.find({ type: 'Text', text: /^Round 1$/ }))).toBeDefined()
  expect(await ui.find({ type: 'Button', key: 'hand-in' })).toBeUndefined()
  await ui.unmount()
})
