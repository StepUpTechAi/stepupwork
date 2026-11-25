import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

const PANE = 'stepupwork'
const SERVER = 'plugin:stepupwork:stepupwork'

// Change a tag when what an atom holds changes: it declines what an earlier
// version stored, which outlives a reload.
const ready = atom({ plugin: 'stepupwork', key: 'ready' } as const, '', {
  shape: 'ready-1',
})
const ticket = atom({ plugin: 'stepupwork', key: 'ticket' } as const, '', {
  shape: 'ticket-1',
})

const textOf = (r: { content: { type: string; text?: string }[] }) =>
  r.content.map(c => c.text ?? '').join('\n')

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const key = (await $.store.get('ticket')) as string | undefined
    if (key) {
      await update($, ticket, () => key)
      $.ui.status(key)
    }

    return next(e)
  })

  on('session.end', async ($, e, next) => {
    $.ui.status(undefined)

    return next(e)
  })

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const ran = await next(e)
    const key = (await $.store.get('ticket')) as string | undefined
    if (key) {
      void $.mcp.call(SERVER, 'log_work', { ticket: key, call: e.tool_use_id })
    }

    return ran
  })

  on('command.run', { command: 'stepupwork' }, async ($, e) => {
    const [verb, key] = e.args.trim().split(/\s+/)
    if (verb === 'assign' && key) {
      const r = await $.mcp.call(SERVER, 'assign', { ticket: key })
      if (r.isError) {
        $.ui.toast(textOf(r))

        return { text: textOf(r) }
      }
      await $.store.set('ticket', key)
      await update($, ticket, () => key)
      $.ui.status(key)
      $.ui.toast(`Assigned ${key} to you`)

      return { text: `Assigned ${key} to you.` }
    }
    await $.ui.open({ id: PANE, title: 'StepUpWork' })
    const r = await $.mcp.call(SERVER, 'ready_work', {})
    await update($, ready, () => textOf(r))

    return { text: 'StepUpWork pane opened.' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const work = await read($, ready)
    const key = await read($, ticket)

    return (
      <Box flexDirection="column">
        {key !== '' && <Text>Working on {key}</Text>}
        <Text dimColor={work === ''}>{work || 'Run /stepupwork to load ready work.'}</Text>
      </Box>
    )
  })
}
