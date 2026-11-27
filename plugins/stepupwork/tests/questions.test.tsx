import { expect, test } from 'claude-code/testing'

import { BRIEF, PANE, READY, SURFACES, TICKET, world } from './world'

// needs_you as it answers today: the ask, its key and revision, no choices.
const TODAY = [
  { id: 'n1', key: 'DEMO-1', revision: 2, text: 'Should the empty state say nothing at all?' },
  { id: 'n2', key: 'DEMO-2', revision: 1, text: 'Which file holds the empty line?' },
]
// The richer shape the hub is getting: choices, a suggestion, progress.
const RICH = [
  {
    id: 'n1',
    key: 'DEMO-1',
    revision: 'r2',
    text: 'Hide the rows too, or show them with the names taken out?',
    choices: [{ label: 'A: hide them' }, { label: 'B: show them, no names' }],
    suggested: 'B',
    progress: { at: 1, of: 3 },
  },
  { id: 'n2', key: 'DEMO-1', revision: 'r1', text: 'Keep the old line?', choices: ['Yes', 'No'], progress: { at: 2, of: 3 } },
]
const BESIDE = {
  plugin: 'stepupwork',
  component: 'BesidePrompt',
  requestId: 'beside',
  props: { maxColumns: 12, floatRows: 0, floatColumns: 40, isWorking: false, view: {} },
} as const

function hub(items: unknown[]) {
  let left = [...items]

  return {
    my_status: { line: 'Nothing claimed.', counts: { questions: left.length } },
    ready_work: READY,
    ticket: TICKET,
    brief: BRIEF,
    needs_you: () => ({ items: left, count: left.length }),
    answer_need: (args: Record<string, unknown>) => {
      if ((args.answer as { skip?: boolean }).skip) return undefined
      left = left.filter(i => (i as { id: string }).id !== args.needId)

      return { ok: true }
    },
  }
}

test('today: one question at a time as Jen’s text, with Skip and a free answer', async ($, on) => {
  const w = world(on, hub(TODAY))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await w.clock.settle()
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    // Answer, pressed once, holds the question open on every surface.
    if (surface === 'terminal') {
      expect((await ui.find({ type: 'Text', text: /^Jen has/ }))?.text).toBe('Jen has 2 questions for you')
      await ui.press({ key: 'answer' })
    }
    expect((await ui.find({ type: 'Text', text: / of / }))?.text).toBe('1 of 2')
    const ask = await ui.find({ type: surface === 'terminal' ? 'Text' : 'Markdown', text: /empty state/ })
    expect(ask).toBeDefined()
    expect((await ui.find({ type: 'Button', key: 'skip' }))?.props.label).toBe('Skip')
    expect((await ui.find({ type: 'Input', key: 'free-answer' }))?.props.submitLabel).toBe('Send')
    await ui.unmount()
  }
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.input({ key: 'free-answer', text: 'Yes, say nothing.' })
  expect(w.called('answer_need')[0]?.args).toEqual({
    key: 'DEMO-1',
    needId: 'n1',
    revision: 2,
    answer: { text: 'Yes, say nothing.' },
  })
  expect((await ui.find({ type: 'Markdown', text: /Which file/ }))?.props.text).toBe(TODAY[1]?.text)
  expect((await ui.find({ type: 'Text', text: / of / }))?.text).toBe('1 of 1')
  await ui.unmount()
})

test('the richer shape: choices as buttons, the suggested one primary, then the next question', async ($, on) => {
  const w = world(on, hub(RICH))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await w.clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'answer' })
  expect((await ui.find({ type: 'Text', text: / of / }))?.text).toBe('1 of 3')
  expect((await ui.find({ type: 'Button', key: 'choice-0' }))?.props.variant).toBeUndefined()
  expect((await ui.find({ type: 'Button', key: 'choice-1' }))?.props.variant).toBe('primary')
  expect((await ui.find({ type: 'Text', text: /^Jen suggests/ }))?.text).toBe('Jen suggests B.')
  await ui.press({ key: 'choice-1' })
  expect(w.called('answer_need')[0]?.args.answer).toEqual({ choice: 'B: show them, no names' })
  expect((await ui.find({ type: 'Text', text: / of / }))?.text).toBe('2 of 3')
  expect((await ui.find({ type: 'Button', key: 'choice-0' }))?.props.label).toBe('Yes')
  await ui.unmount()
})

test('Skip shows the next question even where the hub takes no skip yet', async ($, on) => {
  const w = world(on, hub(TODAY))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await w.clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'answer' })
  await ui.press({ key: 'skip' })
  expect(w.called('answer_need')[0]?.args.answer).toEqual({ skip: true })
  expect((await ui.find({ type: 'Text', text: /Which file/ }))?.text).toBe(TODAY[1]?.text)
  expect((await ui.find({ type: 'Text', text: / of / }))?.text).toBe('2 of 2')
  await ui.unmount()
})

test('a question shows at once beside a ticket held, and opens the pane at start', async ($, on) => {
  const w = world(on, { ...hub(RICH), my_status: { line: 'x', lease: { key: 'DEMO-1' } } })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await w.clock.settle()
  expect(w.opened).toEqual(['stepupwork'])
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /^Questions for you$/ }))?.text).toBe('Questions for you')
  expect((await ui.find({ type: 'Text', text: /^Working on$/ }))?.text).toBe('Working on')
  await ui.unmount()
})

test('the glyph beside the prompt shows while a question waits', async ($, on) => {
  const w = world(on, hub(TODAY))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await w.clock.settle()
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...BESIDE, surface })
    expect((await ui.find({ type: 'Text', text: /\?/ }))?.text).toBe('? 2')
    await ui.unmount()
  }
})

test('no question, no glyph', async ($, on) => {
  const w = world(on, hub([]))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await w.clock.settle()
  const ui = await $.ui.mount({ ...BESIDE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /\?/ })).toBeUndefined()
  await ui.unmount()
})
