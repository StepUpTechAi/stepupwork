import type { EngineInterface, Register, RenderSurface } from 'claude-code'

import { band } from './band'
import { glyph, menu, toolCard } from './extras'
import { assign, call, hasWork, refresh, SIGN_IN, stop } from './hub'
import { drawPane } from './pane'
import { PANE } from './state'

// A plugin command also arrives under the plugin name.
const COMMANDS = ['stepupwork', 'stepupwork:stepupwork']

// Loads the pane’s state at start, and opens the pane only when a ticket is held
// or a question waits, on a surface where it docks: the desktop’s Code tab, or a
// host that attaches one. A terminal opens it on /stepupwork.
async function start($: EngineInterface, surface: RenderSurface | null) {
  if (!(await refresh($).catch(() => false))) return
  if ((await hasWork($)) && surface !== 'terminal' && surface !== 'mobile') {
    await $.ui.open({ id: PANE, title: 'StepUpWork' })
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const key = (await $.store.get('ticket').catch(() => undefined)) as string | undefined
    if (key) $.ui.status(key)
    const ran = await next(e)
    void start($, e.surface).catch(() => {})

    return ran
  })

  on('session.end', async ($, e, next) => {
    stop()
    $.ui.status(undefined)

    return next(e)
  })

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const ran = await next(e)
    const key = (await $.store.get('ticket')) as string | undefined
    if (key) void call($, 'log_work', { ticket: key, call: e.tool_use_id }).catch(() => {})

    return ran
  })

  for (const command of COMMANDS) {
    on('command.run', { command }, async ($, e) => {
      const [verb, key] = e.args.trim().split(/\s+/)
      if (verb === 'assign' && key) return { text: await assign($, key) }
      await $.ui.open({ id: PANE, title: 'StepUpWork' })
      const isIn = await refresh($)
      if (!isIn) $.ui.toast(SIGN_IN)

      return { text: isIn ? 'StepUpWork pane opened.' : SIGN_IN }
    })
  }

  on('ui.render', { component: 'Pane', requestId: PANE }, drawPane)
  on('ui.render', { component: 'AbovePrompt' }, band)
  on('ui.render', { component: 'BesidePrompt' }, glyph)
  on('ui.render', { component: 'ToolUse' }, toolCard)
  on('ui.render', { component: 'ContextMenu' }, menu)
}
