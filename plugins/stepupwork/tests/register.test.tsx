import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'stepupwork',
  component: 'Pane',
  requestId: 'stepupwork',
  props: {
    title: 'StepUpWork',
    isFocused: false,
    bodyColumns: 40,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

test('the pane says how to load work, on every surface', { options: { hub_url: 'https://hub.example.com' } }, async ($, on) => {
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    const row = await ui.find({ type: 'Text', text: /\/stepupwork/ })
    expect(row?.text).toBe('Run /stepupwork to load ready work.')
    await ui.unmount()
  }
})
