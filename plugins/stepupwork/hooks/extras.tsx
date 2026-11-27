// Around the pane: a card under the submit, assign and train calls, the
// right-click rows on a ticket key, and the glyph beside the prompt.
import type { EngineInterface, RenderElement, RenderInput } from 'claude-code'

import { call } from './hub'
import { https, objectOf } from './read'
import { fill } from './parts'
import { isRunning, KEY, setLinks, snapshot } from './state'

type $ = EngineInterface
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any
// The engine’s next, per surface: each hook hands it back the event it was given.
type Next = (e: Any) => Promise<RenderElement>

// The workshop’s own tools, under the plugin’s server or the claude.ai connector.
const CARD = /^mcp__.*stepupwork.*__(submit|assign|train)$/

// A tool’s output as the row holds it: content blocks, a text, or the record.
function payload(out: unknown): Any {
  const blocks = Array.isArray(out) ? out : (out as Any)?.content
  if (Array.isArray(blocks)) return objectOf({ content: blocks, structuredContent: (out as Any)?.structuredContent })
  if (typeof out !== 'string') return out ?? null
  try {
    return JSON.parse(out)
  } catch {
    return { line: out }
  }
}

function cardOf(kind: string, input: Any, out: unknown) {
  const o = payload(out) ?? {}
  const id = String(input?.ticket ?? input?.key ?? input?.id ?? o.key ?? o.id ?? '')
  const line = [o.line, o.message, o.summary, o.text].find(v => typeof v === 'string' && v !== '')
  const link = https(o.link ?? o.url)
  if (!line && !link) return null
  const what = kind === 'train' ? `train ${id}` : id

  return { line: line as string | undefined, link, label: id ? `Open ${what} in the workshop` : 'Open in the workshop' }
}

export async function toolCard($: $, e: RenderInput<'ToolUse'>, next: Next) {
  const m = CARD.exec(e.props.tool)
  if (!m || e.props.isRunning || e.props.isErrored) return next(e)
  const card = cardOf(m[1] ?? '', e.props.input, e.props.output)
  const row = await next(e)
  if (!card) return row
  const { Box, Text, Link } = $.ui.resolve(e)
  // A mobile app draws the card under the row when the Box holding both has a border.
  const frame = { borderStyle: 'round', borderColor: 'subtle' as const, paddingX: 1 }

  return (
    <Box flexDirection="column" {...(e.surface === 'mobile' ? frame : {})}>
      {row}
      <Box flexDirection="column" {...(e.surface === 'mobile' ? {} : frame)}>
        {card.line !== undefined && <Text>{card.line}</Text>}
        {card.link !== undefined && <Link href={card.link}>{card.label}</Link>}
      </Box>
    </Box>
  )
}

// Finds a ticket’s workshop link when no tool result has shown it yet.
async function findLink($: $, key: string) {
  const r = await call($, 'ticket', { ticket: key })
  const link = r && !r.isError ? https(objectOf(r)?.link) : undefined
  if (!link) return $.ui.toast(`No workshop link came back for ${key}.`)
  await setLinks($, l => ({ ...l, [key]: link }))
  $.ui.toast(`${key} in the workshop: ${link}`)
}

export async function menu($: $, e: RenderInput<'ContextMenu'>, next: Next) {
  const key = (e.props.selection?.text ?? e.props.code?.text ?? e.props.link?.text ?? '').trim()
  if (!KEY.test(key)) return next(e)
  const link = (await snapshot($)).l[key]
  const { Box, Button, Link, Text } = $.ui.resolve(e)

  return (
    <Box flexDirection="column">
      {link !== undefined ? (
        <Link href={link}>Open in the workshop</Link>
      ) : (
        <Button key="open" onPress={() => findLink($, key)}>
          Open in the workshop <Text dimColor>{key}</Text>
        </Button>
      )}
      <Button key="ask-jen" onPress={() => fill($, `Ask Jen about ${key}: `)}>
        Ask Jen about this <Text dimColor>Adds to the prompt</Text>
      </Button>
    </Box>
  )
}

// Shows while a question waits: its count, and the train while one runs.
export async function glyph($: $, e: RenderInput<'BesidePrompt'>, next: Next) {
  const { qs, s } = await snapshot($)
  const waiting = qs.items.filter(q => !qs.skipped.includes(q.id)).length
  if (!waiting || e.props.maxColumns < 3) return next(e)
  const t = s?.train
  const train = t && isRunning(t.state) ? `● ${t.n} ` : ''
  const { Box, Text } = $.ui.resolve(e)

  return (
    <Box>
      {train !== '' && train.length + 3 <= e.props.maxColumns && (
        <Text color={t?.state === 'red' ? 'error' : 'success'}>{train}</Text>
      )}
      <Text color="claude">{`? ${waiting}`}</Text>
    </Box>
  )
}
