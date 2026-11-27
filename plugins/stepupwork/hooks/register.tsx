import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

const PANE = 'stepupwork'
// The plugin server first, then the claude.ai connector of the same name: a
// session started from the claude.ai plugin has the connector signed in, while
// the plugin server may still wait on sign-in.
const SERVERS = ['plugin:stepupwork:stepupwork', 'claude.ai stepupwork', 'stepupwork']
// A plugin command also arrives under the plugin name.
const COMMANDS = ['stepupwork', 'stepupwork:stepupwork']

// Change a tag when what an atom holds changes: it declines what an earlier
// version stored, which outlives a reload.
const ready = atom({ plugin: 'stepupwork', key: 'ready' } as const, '', {
  shape: 'ready-2',
})
const ticket = atom({ plugin: 'stepupwork', key: 'ticket' } as const, '', {
  shape: 'ticket-1',
})

type Result = { content: { type: string; text?: string }[]; isError?: boolean }

const textOf = (r: Result) => r.content.map(c => c.text ?? '').join('\n')

type Row = { key: string; title: string; step?: string | null; claimable?: boolean }
type Ready = {
  groups?: { project?: string; lane?: string; rows?: Row[] }[]
  next?: { key?: string } | null
  counts?: { canClaim?: number }
}

// ready_work answers JSON: the pane shows it as lines, the next ticket first
function listOf(text: string): string {
  let r: Ready
  try {
    r = JSON.parse(text) as Ready
  } catch {
    return text
  }
  const lines: string[] = []
  if (r.next?.key) lines.push(`Next: ${r.next.key}`, '')
  for (const g of r.groups ?? []) {
    lines.push([g.project, g.lane].filter(Boolean).join(' · '))
    for (const row of g.rows ?? []) lines.push(`  ${row.key}  ${row.title}${row.step ? ` (${row.step})` : ''}`)
    lines.push('')
  }
  if (!lines.length) return 'Nothing ready for you.'
  const n = r.counts?.canClaim
  lines.push(`${n == null ? '' : `${n} you can claim. `}Take one: /stepupwork assign KEY`)

  return lines.join('\n')
}

const SIGN_IN =
  'StepUpWork is not signed in here. Connect it in Settings › Plugins, or run /mcp and sign in to stepupwork.'

// The first of SERVERS that is connected, or null when none is.
let server: string | null = null

async function call($: EngineInterface, tool: string, args: Record<string, unknown>): Promise<Result | null> {
  if (server === null) {
    for (const s of SERVERS) {
      const c = await $.mcp.connect(s)
      if (c.isConnected) {
        server = c.server
        break
      }
    }
  }
  if (server === null) return null

  return (await $.mcp.call(server, tool, args)) as Result
}

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
    if (key) void call($, 'log_work', { ticket: key, call: e.tool_use_id }).catch(() => {})

    return ran
  })

  for (const command of COMMANDS) {
    on('command.run', { command }, async ($, e) => {
      const [verb, key] = e.args.trim().split(/\s+/)
      if (verb === 'assign' && key) {
        const r = await call($, 'assign', { ticket: key })
        if (!r) {
          $.ui.toast(SIGN_IN)

          return { text: SIGN_IN }
        }
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
      const r = await call($, 'ready_work', {})
      await update($, ready, () => (r ? (r.isError ? textOf(r) : listOf(textOf(r))) : SIGN_IN))

      return { text: r ? 'StepUpWork pane opened.' : SIGN_IN }
    })
  }

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
