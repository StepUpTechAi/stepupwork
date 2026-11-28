import { expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { clipped } from './layout'
import { PANE, READY, SURFACES, TICKET, world } from './world'

const BAND = {
  plugin: 'stepupwork',
  component: 'AbovePrompt',
  requestId: 'band',
  props: { hasSurvey: false, isCollapsed: false, isWorking: false, maxRows: 8, bodyColumns: 60, scroll: { offset: 0, bodyRows: 7 }, view: {} },
} as const

const A = 'A: hide those rows too. The client sees fewer repairs, and none of the repair rows show at all.'
const B = 'B: show them with the names taken out. The client sees every repair as the workshop’s own.'
// The richer shape: a short label for the button, the full text to decide from.
const RICH = {
  id: 'n1',
  key: 'DEMO-1',
  revision: 'r2',
  text: 'The brief hides our rows from a client’s person, but their own repair rows still carry our worker names.',
  choices: [
    { label: 'A: hide them', text: A },
    { label: 'B: show them, no names', text: B },
  ],
  suggested: 'B',
  progress: { at: 1, of: 3 },
}
// Long choices as plain strings, with their letters and no short labels.
const STRINGS = { id: 'n2', key: 'DEMO-1', revision: 1, text: 'Which way?', choices: [A, B] }
// The hub cut a choice short.
const CUT = {
  id: 'n3',
  key: 'DEMO-1',
  revision: 1,
  text: 'Who posts the results?',
  choices: ['A: someone with the clients posts the twelve results and then…', 'B: the workshop posts them'],
  link: 'https://hub.example.com/t/DEMO-1/asks/n3',
}

const hub = (items: unknown[]) => ({
  my_status: { line: 'x', lease: { key: 'DEMO-1' } },
  ready_work: READY,
  ticket: TICKET,
  brief: {},
  needs_you: { items },
  answer_need: { ok: true },
})

async function started($: Parameters<TestBody>[0], on: Parameters<TestBody>[1], items: unknown[]) {
  const w = world(on, hub(items))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await w.clock.settle()

  return w
}

for (const surface of SURFACES) {
  test(`${surface} pane: the question and each choice in full, wrapped; the buttons short`, async ($, on) => {
    const w = await started($, on, [RICH])
    const ui = await $.ui.mount({ ...PANE, surface, props: { ...PANE.props, bodyColumns: 36 } })
    const lines = await ui.findAll({ type: 'Text', text: /^[AB]: / })
    expect(lines.map(l => l.text)).toEqual([A, B])
    for (const l of lines) expect(l.props.wrap).toBeUndefined()
    const ask = await ui.find({ type: surface === 'terminal' ? 'Text' : 'Markdown', text: /repair rows/ })
    expect(ask).toBeDefined()
    expect((await ui.find({ type: 'Button', key: 'choice-0' }))?.props.label).toBe('A: hide them')
    expect((await ui.find({ type: 'Button', key: 'choice-1' }))?.props).toMatchObject({ label: 'B: show them, no names', variant: 'primary' })
    expect((await ui.find({ type: 'Text', text: /^Jen suggests/ }))?.text).toBe('Jen suggests B.')
    expect(await ui.find({ type: 'Text', text: /full question/ })).toBeUndefined()
    expect(clipped((await ui.drawn()) as never, 36)).toEqual([])
    await ui.press({ key: 'choice-1' })
    expect(w.called('answer_need')[0]?.args.answer).toEqual({ choice: 'B: show them, no names' })
    await ui.unmount()
  })

  test(`${surface} band: the question and each choice in full, wrapped; the buttons short`, async ($, on) => {
    await started($, on, [RICH])
    const ui = await $.ui.mount({ ...BAND, surface })
    expect((await ui.find({ type: 'Text', text: /^Jen asks/ }))?.text).toBe(`Jen asks about DEMO-1: ${RICH.text}`)
    expect((await ui.findAll({ type: 'Text', text: /^[AB]: / })).map(l => l.text)).toEqual([A, B])
    expect((await ui.find({ type: 'Button', key: 'band-choice-0' }))?.props.label).toBe('A: hide them')
    await ui.unmount()
  })
}

test('long choices sent as strings: each in full above its letter’s button', async ($, on) => {
  const w = await started($, on, [STRINGS])
  for (const site of [PANE, BAND]) {
    const ui = await $.ui.mount({ ...site, surface: 'desktop' })
    const prefix = site === PANE ? 'choice' : 'band-choice'
    expect((await ui.findAll({ type: 'Text', text: /^[AB]: / })).map(l => l.text)).toEqual([A, B])
    expect((await ui.find({ type: 'Button', key: `${prefix}-0` }))?.props.label).toBe('A')
    expect((await ui.find({ type: 'Button', key: `${prefix}-1` }))?.props.label).toBe('B')
    await ui.unmount()
  }
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'choice-0' })
  // The hub gets back its own choice, whole.
  expect(w.called('answer_need')[0]?.args.answer).toEqual({ choice: A })
  await ui.unmount()
})

test('short choices need no lines above them: the buttons say it all', async ($, on) => {
  await started($, on, [{ id: 'n4', text: 'Keep the old line?', choices: ['Yes', 'No'] }])
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /^A: / })).toBeUndefined()
  expect((await ui.find({ type: 'Button', key: 'choice-0' }))?.props.label).toBe('Yes')
  await ui.unmount()
})

test('a choice the hub cut short: the pane and the band say the full question is in the workshop, with its link', async ($, on) => {
  await started($, on, [CUT])
  for (const surface of SURFACES) {
    for (const site of [PANE, BAND]) {
      const ui = await $.ui.mount({ ...site, surface })
      expect((await ui.find({ type: 'Text', text: /full question/ }))?.text).toBe('The full question is in the workshop.')
      expect((await ui.find({ type: 'Link', text: /Open it there/ }))?.props.href).toBe(CUT.link)
      // The cut choice's button is its letter, not words that stop mid-sentence.
      const prefix = site === PANE ? 'choice' : 'band-choice'
      expect((await ui.find({ type: 'Button', key: `${prefix}-0` }))?.props.label).toBe('A')
      await ui.unmount()
    }
  }
})

test('a cut question with no link of its own points at its ticket’s page', async ($, on) => {
  await started($, on, [{ ...CUT, link: undefined, text: 'Who posts the results of the…' }])
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ type: 'Link', text: /Open it there/ }))?.props.href).toBe(TICKET.link)
  await ui.unmount()
})

test('today’s needs_you, the text alone: no choice lines, no cut note, Skip and a free answer', async ($, on) => {
  await started($, on, [{ id: 'n5', key: 'DEMO-1', revision: 2, text: 'Should the empty state say nothing at all?' }])
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /^A: / })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /full question/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /^Jen suggests/ })).toBeUndefined()
  expect((await ui.find({ type: 'Button', key: 'skip' }))?.props.label).toBe('Skip')
  await ui.unmount()
})

test('my_status’s waiting question shows where needs_you leaves it out', async ($, on) => {
  const w = world(on, { ...hub([]), my_status: { line: 'x', lease: { key: 'DEMO-1' }, question: RICH } })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await w.clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: / of / }))?.text).toBe('1 of 3')
  expect((await ui.find({ type: 'Button', key: 'choice-0' }))?.props.label).toBe('A: hide them')
  await ui.unmount()
})
