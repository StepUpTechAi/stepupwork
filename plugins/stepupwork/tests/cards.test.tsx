import { expect, test } from 'claude-code/testing'

import { TICKET, world } from './world'

const SUBMITTED = {
  line: 'Check passed. DEMO-1 is in the landing queue, 2 ahead of it.',
  link: 'https://hub.example.com/t/DEMO-1',
}
const card = (tool: string, input: unknown, output: unknown) =>
  ({
    plugin: 'stepupwork',
    component: 'ToolUse',
    requestId: 'tu-1',
    props: { tool_use_id: 'tu-1', tool, input, isRunning: false, isErrored: false, isInterrupted: false, output },
  }) as const
const MENU = { plugin: 'stepupwork', surface: 'desktop', component: 'ContextMenu', requestId: 'menu' } as const

test('a card under submit keeps the row and adds its line and link', async ($, on) => {
  world(on, {})
  // Stands for the engine's own row.
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>the call's own row</Text>
  })
  const blocks = [{ type: 'text', text: JSON.stringify(SUBMITTED) }]
  for (const surface of ['terminal', 'desktop', 'mobile'] as const) {
    for (const tool of ['mcp__plugin_stepupwork_stepupwork__submit', 'mcp__claude_ai_stepupwork__submit']) {
      const ui = await $.ui.mount({ ...card(tool, { ticket: 'DEMO-1' }, blocks), surface })
      expect((await ui.find({ type: 'Text', text: /own row/ }))?.text).toBe("the call's own row")
      expect((await ui.find({ type: 'Text', text: /^Check passed/ }))?.text).toBe(SUBMITTED.line)
      const link = await ui.find({ type: 'Link' })
      expect(link?.props.href).toBe(SUBMITTED.link)
      expect(link?.text).toContain('Open DEMO-1 in the workshop')
      await ui.unmount()
    }
  }
})

test('assign and train calls get their cards too', async ($, on) => {
  world(on, {})
  const assigned = { message: 'Assigned DEMO-2 to you.', link: 'https://hub.example.com/t/DEMO-2' }
  let ui = await $.ui.mount({
    ...card('mcp__plugin_stepupwork_stepupwork__assign', { ticket: 'DEMO-2' }, JSON.stringify(assigned)),
    surface: 'desktop',
  })
  expect((await ui.find({ type: 'Link' }))?.text).toContain('Open DEMO-2 in the workshop')
  await ui.unmount()
  const t = { content: [{ type: 'text', text: JSON.stringify({ line: 'Train 412 is gating.', link: 'https://hub.example.com/tr/412' }) }] }
  ui = await $.ui.mount({ ...card('mcp__plugin_stepupwork_stepupwork__train', { id: '412' }, t), surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /gating/ }))?.text).toBe('Train 412 is gating.')
  expect((await ui.find({ type: 'Link' }))?.text).toContain('Open train 412 in the workshop')
  await ui.unmount()
})

test('other calls, and calls still running, are left alone', async ($, on) => {
  world(on, {})
  let ui = await $.ui.mount({ ...card('Bash', { command: 'ls' }, JSON.stringify(SUBMITTED)), surface: 'desktop' })
  expect(await ui.find({ type: 'Link' })).toBeUndefined()
  await ui.unmount()
  const running = card('mcp__plugin_stepupwork_stepupwork__submit', { ticket: 'DEMO-1' }, undefined)
  ui = await $.ui.mount({ ...running, props: { ...running.props, isRunning: true }, surface: 'desktop' })
  expect(await ui.find({ type: 'Link' })).toBeUndefined()
  await ui.unmount()
})

test('right-click a ticket key: Open in the workshop, and Ask Jen about this', async ($, on) => {
  const w = world(on, { ticket: TICKET })
  let ui = await $.ui.mount({ ...MENU, props: { selection: { text: ' DEMO-1 ' } } })
  await ui.press({ key: 'ask-jen' })
  expect(w.filled).toEqual(['Ask Jen about DEMO-1: '])
  await ui.press({ key: 'open' })
  expect(w.called('ticket')[0]?.args).toEqual({ ticket: 'DEMO-1' })
  expect(w.toasts).toEqual(['DEMO-1 in the workshop: https://hub.example.com/t/DEMO-1'])
  await ui.unmount()
  // Once a link is known the row is the link itself.
  ui = await $.ui.mount({ ...MENU, props: { code: { text: 'DEMO-1', isBlock: false } } })
  expect((await ui.find({ type: 'Link' }))?.props.href).toBe(TICKET.link)
  await ui.unmount()
})

test('any other selection gets no row', async ($, on) => {
  world(on, {})
  const ui = await $.ui.mount({ ...MENU, props: { selection: { text: 'a sentence, not a key' } } })
  expect(await ui.find({ type: 'Button' })).toBeUndefined()
  await ui.unmount()
})

test('a Bash call still logs work against the ticket held', async ($, on) => {
  const w = world(on, { log_work: { ok: true } }, { store: { ticket: 'DEMO-1' } })
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  await w.clock.settle()
  expect(w.called('log_work')[0]?.args.ticket).toBe('DEMO-1')
})
