import { expect, test } from 'claude-code/testing'

const READY = JSON.stringify({
  groups: [{ project: 'aipods', lane: 'now', rows: [
    { key: 'BL-10578', title: 'The label guidance heading says tenant', step: 'To plan', claimable: true },
    { key: 'BL-10697', title: 'Runway on Storeplay shows the client its work', step: 'To plan', claimable: true },
  ] }],
  next: { key: 'BL-10578' },
  counts: { canClaim: 4 },
})
const PANE = {
  plugin: 'stepupwork', component: 'Pane', requestId: 'stepupwork',
  props: { title: 'StepUpWork', isFocused: false, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 20 }, view: {} },
} as const

for (const command of ['stepupwork', 'stepupwork:stepupwork']) {
  test(`/${command} opens the pane and lists ready work as lines, the next first`, async ($, on) => {
    on('ui.open', () => ({ value: { isPlaced: true } }))
    on('mcp.connect', (_, e) => ({ value: { isConnected: e.server === 'claude.ai stepupwork', server: e.server } }))
    on('mcp.call', () => ({ value: { content: [{ type: 'text', text: READY }], isError: false } }))
    const r = await $.command.run({ command, args: '' })
    expect(r.text).toBe('StepUpWork pane opened.')
    const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
    const t = await ui.find({ type: 'Text', text: /Next: BL-10578/ })
    expect(t?.text).toContain('BL-10697  Runway on Storeplay shows the client its work (To plan)')
    expect(t?.text).toContain('4 you can claim.')
    await ui.unmount()
  })
}
