import { expect, test } from 'claude-code/testing'

import { clipped } from './layout'
import { NOW, PANE, READY, RUN, SURFACES, TICKET, world } from './world'

const LONG = 'The ready list shows each ticket’s whole title, however long the title of that ticket runs on'
const LONG_READY = {
  ...READY,
  groups: [{ ...READY.groups[0], rows: READY.groups[0]!.rows.map(r => ({ ...r, title: `${r.title}: ${LONG}` })) }],
}
const IDLE = { my_status: { line: 'Nothing claimed.' }, ready_work: LONG_READY, needs_you: { items: [] } }
const at = (bodyColumns: number) => ({ ...PANE, props: { ...PANE.props, bodyColumns } })

// The pane's widths: the docked desktop pane at its narrowest, a terminal
// sidebar, and the width the 0.2.0 tests drew at.
for (const surface of SURFACES) {
  for (const cols of [28, 36, 44, 60]) {
    test(`${surface}, ${cols} cells, long titles: every Assign is drawn whole`, async ($, on) => {
      world(on, IDLE)
      await $.command.run({ command: 'stepupwork', args: '', ...RUN })
      const ui = await $.ui.mount({ ...at(cols), surface })
      for (const key of ['DEMO-1', 'DEMO-2']) expect(await ui.find({ type: 'Button', key: `assign-${key}` })).toBeDefined()
      expect(clipped((await ui.drawn()) as never, cols)).toEqual([])
      if (surface === 'desktop') {
        // The title is what shrinks: in a Box that may go to nothing, cut with an ellipsis.
        const title = await ui.find({ type: 'Text', text: /however long/ })
        expect(title?.props.wrap).toBe('truncate')
        const row = (await ui.find({ type: 'Box', key: 'row-DEMO-1' })) as never as { children: { props: Record<string, unknown> }[] }
        expect(row.children[1]?.props.flexShrink).toBe(0)
        expect(row.children[0]?.props).toMatchObject({ flexShrink: 1, minWidth: 0 })
      }
      await ui.unmount()
    })
  }
}

test('the checker finds the clip 0.2.0 drew: a title that could not shrink pushed Assign off', () => {
  const text = (s: string, p = {}) => ({ type: 'Text', props: p, children: [s] })
  const asBuilt = {
    type: 'Box',
    props: { gap: 1, justifyContent: 'space-between' },
    children: [
      { type: 'Box', props: { gap: 1, flexShrink: 1 }, children: [text('DEMO-1'), text(LONG, { wrap: 'truncate' }), text(' Next ')] },
      { type: 'Button', props: { label: 'Assign to me' } },
    ],
  }
  expect(clipped(asBuilt, 60).map(c => c.what)).toEqual(['Assign to me'])
})

test('wide enough, a row is one line; too narrow, the button goes under the title', async ($, on) => {
  world(on, IDLE)
  await $.command.run({ command: 'stepupwork', args: '', ...RUN })
  const wide = await $.ui.mount({ ...at(60), surface: 'desktop' })
  expect((await wide.find({ type: 'Box', key: 'row-DEMO-1' }))?.props.flexDirection).toBeUndefined()
  await wide.unmount()
  const narrow = await $.ui.mount({ ...at(36), surface: 'desktop' })
  expect((await narrow.find({ type: 'Box', key: 'row-DEMO-1' }))?.props.flexDirection).toBe('column')
  // Stacked, the pills stay: Next and the step.
  expect((await narrow.find({ type: 'Text', text: /^ Next $/ }))?.props.backgroundColor).toBe('claude')
  await narrow.unmount()
})

test('a row that cannot be taken is dimmed, its reason where the button would be, and why under the list', async ($, on) => {
  world(on, IDLE)
  await $.command.run({ command: 'stepupwork', args: '', ...RUN })
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Button', key: 'assign-DEMO-3' })).toBeUndefined()
    expect((await ui.find({ type: 'Text', text: /^Overlaps DEMO-2$/ }))?.props.dimColor).toBe(true)
    expect((await ui.find({ type: 'Text', text: /A ticket that waits/ }))?.props.dimColor).toBe(true)
    expect((await ui.find({ type: 'Text', text: /waits until/ }))?.text).toBe('DEMO-3 waits until DEMO-2 lands.')
    await ui.unmount()
  }
})

test('the overlap line names the shared files where ready_work sends them', async ($, on) => {
  const rows = [{ key: 'DEMO-4', title: 't', claimable: false, overlap: { with: 'DEMO-1', paths: ['a.tsx'] } }]
  world(on, { ...IDLE, ready_work: { groups: [{ project: 'demo', rows }] } })
  await $.command.run({ command: 'stepupwork', args: '', ...RUN })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /waits until/ }))?.text).toBe(
    'DEMO-4 waits until DEMO-1 lands: they change the same file.',
  )
  await ui.unmount()
})

// my_status says 7 ready; ready_work, which the rows come from, says 2.
const DISAGREE = {
  my_status: { line: 'Nothing claimed. 7 ready for you.', counts: { ready: 7, questions: 2 } },
  ready_work: READY,
  needs_you: { items: [{ id: 'n1', text: 'One?' }, { id: 'n2', text: 'Two?' }] },
}

test('one count: the header, the rows heading and the status line all say the rows’ number', async ($, on) => {
  const w = world(on, DISAGREE)
  await $.command.run({ command: 'stepupwork', args: '', ...RUN })
  expect(w.statuses.at(-1)).toBe('Nothing claimed · 2 ready for you · 2 questions for you')
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /ready for you/ }))?.text).toBe('2 ready for you · 2 questions for you')
    expect((await ui.find({ type: 'Text', text: /you can take/ }))?.text).toBe('2 you can take')
    expect(await ui.find({ type: 'Text', text: /7/ })).toBeUndefined()
    await ui.unmount()
  }
})

test('without counts from ready_work, the rows it can take are counted', async ($, on) => {
  const w = world(on, { ...DISAGREE, ready_work: { ...READY, counts: undefined } })
  await $.command.run({ command: 'stepupwork', args: '', ...RUN })
  expect(w.statuses.at(-1)).toBe('Nothing claimed · 2 ready for you · 2 questions for you')
})

for (const surface of SURFACES) {
  test(`${surface}: Jen’s card, "Jen has 2 questions for you", her mark, and Answer opens the first in place`, async ($, on) => {
    world(on, DISAGREE)
    await $.command.run({ command: 'stepupwork', args: '', ...RUN })
    const ui = await $.ui.mount({ ...PANE, surface })
    const card = await ui.find({ type: 'Box', key: 'jen-card' })
    expect(card?.text).toContain('Jen has 2 questions for you')
    expect(await ui.find(surface === 'desktop' ? { type: 'Svg' } : { type: 'Text', text: /^ J $/ })).toBeDefined()
    expect(clipped((await ui.drawn()) as never, 36)).toEqual([])
    await ui.press({ key: 'answer' })
    expect(await ui.find({ type: 'Box', key: 'jen-card' })).toBeUndefined()
    expect((await ui.find({ type: 'Text', text: / of / }))?.text).toBe('1 of 2')
    await ui.unmount()
  })
}

test('my_status counts questions needs_you sends in a shape the pane cannot draw: Answer goes to the workshop', async ($, on) => {
  const odd = { my_status: { line: 'x', counts: { questions: 3 }, link: 'https://hub.example.com/w' }, ready_work: READY }
  world(on, { ...odd, needs_you: { count: 3, threads: [] } })
  await $.command.run({ command: 'stepupwork', args: '', ...RUN })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ type: 'Box', key: 'jen-card' }))?.text).toContain('Jen has 3 questions for you')
  expect(await ui.find({ type: 'Button', key: 'answer' })).toBeUndefined()
  expect((await ui.find({ type: 'Link', text: /Answer in the workshop/ }))?.props.href).toBe('https://hub.example.com/w')
  await ui.unmount()
})

test('no questions: no card, and the header says the ready count alone', async ($, on) => {
  world(on, IDLE)
  await $.command.run({ command: 'stepupwork', args: '', ...RUN })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Box', key: 'jen-card' })).toBeUndefined()
  expect((await ui.find({ type: 'Text', text: /ready for you/ }))?.text).toBe('2 ready for you')
  await ui.unmount()
})

test('the footer: the read time and the rate on the left, Open the workshop on the right', async ($, on) => {
  world(on, { ...IDLE, my_status: { line: 'x', link: 'https://hub.example.com/w' } })
  await $.command.run({ command: 'stepupwork', args: '', ...RUN })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const read = await ui.find({ type: 'Text', text: /^Read / })
  expect(read?.text).toMatch(/^Read \d{1,2}:\d\d(am|pm) · checks every minute$/)
  const d = new Date(NOW)
  expect(read?.text).toContain(`${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}`)
  expect((await ui.find({ type: 'Link', text: 'Open the workshop' }))?.props.href).toBe('https://hub.example.com/w')
  await ui.unmount()
})

test('the footer’s link without my_status’s: the site of a link a tool sent; none sent, no link', async ($, on) => {
  const rows = [{ key: 'DEMO-1', title: 't', claimable: true, link: 'https://hub.example.com/t/DEMO-1' }]
  world(on, { ...IDLE, ready_work: { groups: [{ rows }] } })
  await $.command.run({ command: 'stepupwork', args: '', ...RUN })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ type: 'Link', text: 'Open the workshop' }))?.props.href).toBe('https://hub.example.com')
  await ui.unmount()
})

test('no link from any tool: the footer has its read line and no link', async ($, on) => {
  world(on, { ...IDLE, ticket: TICKET })
  await $.command.run({ command: 'stepupwork', args: '', ...RUN })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Link', text: 'Open the workshop' })).toBeUndefined()
  expect((await ui.find({ type: 'Text', text: /^Read / }))?.text).toContain('checks every minute')
  await ui.unmount()
})
