import { expect, test } from 'claude-code/testing'

import { PANE, RUN, SURFACES, world } from './world'

test('signed out: the pane says how to sign in, and nothing polls', async ($, on) => {
  const w = world(on, { my_status: { line: 'x' } }, { isSignedIn: false })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await w.clock.settle()
  const r = await $.command.run({ command: 'stepupwork', args: '', ...RUN })
  expect(r.text).toContain('StepUpWork is not signed in here.')
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /^Sign in/ }))?.text).toBe('Sign in to your workshop')
    expect(await ui.find({ type: 'Svg' })).toEqual(surface === 'desktop' ? expect.anything() : undefined)
    await ui.press({ key: 'sign-in' })
    await ui.unmount()
  }
  expect(w.filled).toEqual(['/mcp', '/mcp'])
  await w.clock.advance(10 * 60_000)
  expect(w.calls).toEqual([])
  expect(w.opened).toEqual(['stepupwork'])
})
