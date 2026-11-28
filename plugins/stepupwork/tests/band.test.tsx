import { expect, test } from 'claude-code/testing'

import { BRIEF, PANE, READY, SURFACES, TICKET, world } from './world'

const BAND = {
  plugin: 'stepupwork',
  component: 'AbovePrompt',
  requestId: 'band',
  props: {
    hasSurvey: false,
    isCollapsed: false,
    isWorking: false,
    maxRows: 8,
    bodyColumns: 100,
    scroll: { offset: 0, bodyRows: 7 },
    view: {},
  },
} as const
const ASKS = [
  {
    id: 'n1',
    key: 'DEMO-1',
    revision: 'r2',
    text: 'Hide the rows too, or show them with the names taken out?',
    choices: [{ label: 'A: hide them' }, { label: 'B: show them, no names' }],
    suggested: 'B',
  },
  { id: 'n2', key: 'DEMO-2', revision: 'r1', text: 'Keep the old line?', choices: ['Yes', 'No'] },
]

function hub(items: unknown[]) {
  let left = [...items]

  return {
    my_status: { line: 'Nothing claimed.', counts: { questions: left.length } },
    ready_work: READY,
    ticket: TICKET,
    brief: BRIEF,
    needs_you: () => ({ items: left, count: left.length }),
    answer_need: (args: Record<string, unknown>) => {
      left = left.filter(i => (i as { id: string }).id !== args.needId)

      return { ok: true }
    },
  }
}

test('no question waiting: no band, on either surface', async ($, on) => {
  const w = world(on, hub([]))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await w.clock.settle()
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect(await ui.find({ type: 'Text', text: /Jen asks/ })).toBeUndefined()
    expect(await ui.find({ type: 'Button', key: 'band-open' })).toBeUndefined()
    await ui.unmount()
  }
})

test('a question waiting: "Jen asks", the whole question wrapped, its replies and Open', async ($, on) => {
  const w = world(on, hub(ASKS))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await w.clock.settle()
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect(await ui.drawn()).toMatchObject({ type: 'Box' })
    const ask = await ui.find({ type: 'Text', text: /^Jen asks about DEMO-1:/ })
    expect(ask?.text).toBe(`Jen asks about DEMO-1: ${ASKS[0]?.text}`)
    // Wrapped, never cut.
    expect(ask?.props.wrap).toBeUndefined()
    const a = await ui.find({ type: 'Button', key: 'band-choice-0' })
    const b = await ui.find({ type: 'Button', key: 'band-choice-1' })
    const open = await ui.find({ type: 'Button', key: 'band-open' })
    expect([a?.props.label, b?.props.label, open?.props.label]).toEqual(['A: hide them', 'B: show them, no names', 'Open'])
    if (surface === 'terminal') {
      // Text replies: "1: A: hide them  2: …  o: Open", no button chrome.
      expect([a?.props.hotkey, b?.props.hotkey, open?.props.hotkey]).toEqual(['1', '2', 'o'])
      expect([a?.props.plain, b?.props.plain, open?.props.plain]).toEqual([true, true, true])
    } else {
      expect(a?.props.plain).toBeUndefined()
      expect(a?.props.variant).toBeUndefined()
      expect(b?.props.variant).toBe('primary')
    }
    await ui.unmount()
  }
})

test('the band yields to a survey', async ($, on) => {
  const w = world(on, hub(ASKS))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await w.clock.settle()
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal', props: { ...BAND.props, hasSurvey: true } })
  expect(await ui.find({ type: 'Text', text: /Jen asks/ })).toBeUndefined()
  await ui.unmount()
})

for (const surface of SURFACES) {
  test(`${surface}: an answer from the band takes the pane’s path, the next question, then no band`, async ($, on) => {
    const w = world(on, hub(ASKS))
    await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
    await w.clock.settle()
    const ui = await $.ui.mount({ ...BAND, surface })
    await ui.press({ key: 'band-choice-1' })
    expect(w.called('answer_need').at(-1)?.args).toEqual({
      key: 'DEMO-1',
      needId: 'n1',
      revision: 'r2',
      answer: { choice: 'B: show them, no names' },
    })
    expect((await ui.find({ type: 'Text', text: /^Jen asks/ }))?.text).toBe('Jen asks about DEMO-2: Keep the old line?')
    expect((await ui.find({ type: 'Button', key: 'band-choice-0' }))?.props.label).toBe('Yes')
    await ui.press({ key: 'band-choice-0' })
    expect(w.called('answer_need').at(-1)?.args.answer).toEqual({ choice: 'Yes' })
    expect(await ui.find({ type: 'Text', text: /Jen asks/ })).toBeUndefined()
    await ui.unmount()
  })
}

test('the pane and the band show the same question, and Open opens the pane on it', async ($, on) => {
  const w = world(on, hub(ASKS))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await w.clock.settle()
  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await band.press({ key: 'band-open' })
  expect(w.opened.at(-1)).toBe('stepupwork')
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await pane.find({ type: 'Markdown', text: /Hide the rows/ }))?.props.text).toBe(ASKS[0]?.text)
  // Answered in the pane, the band moves on with it.
  await pane.press({ key: 'choice-0' })
  expect((await band.find({ type: 'Text', text: /^Jen asks/ }))?.text).toBe('Jen asks about DEMO-2: Keep the old line?')
  await pane.unmount()
  await band.unmount()
})
