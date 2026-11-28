// The ready rows, as the mock draws them: the key in mono, the title cut with
// an ellipsis, a Next pill on the next ticket, the step pill, then Assign. The
// title is the one part that shrinks; the button never does. Where the pane is
// too narrow for the button beside the title at all, the button goes under it.
import type { EngineInterface } from 'claude-code'

import type { Ready, Row } from '../types'
import { assign } from './hub'
import { hot, pill, primary, section } from './parts'
import type { Ctx } from './parts'
import { setView } from './state'

// Cells a button draws beside its label, a gap, the least of a title worth showing.
export const BUTTON = 4
const GAP = 1
const TITLE_MIN = 10

// Whether a row’s parts fit on one line of `cols` cells, the title at its least.
export function fitsOneLine(c: Ctx, r: Row, isNext: boolean, take: number) {
  if (c.isTerm) return take + GAP + TITLE_MIN <= c.cols
  const pills = (isNext ? 'Next'.length + 2 + GAP : 0) + (r.step ? r.step.length + 2 + GAP : 0)

  return r.key.length + GAP + TITLE_MIN + pills + GAP + take <= c.cols
}

function row($: EngineInterface, c: Ctx, r: Row, isNext: boolean, hasKey: boolean) {
  const { Box, Text, Button } = c.ui
  const label = isNext ? 'Assign to me' : 'Assign'
  const dim = !r.claimable
  const why = r.reason ?? 'Not yours to take yet'
  const take = r.claimable ? (
    <Button
      key={`assign-${r.key}`}
      label={label}
      {...primary(isNext)}
      {...(isNext && hasKey ? hot(c, '1') : {})}
      onPress={() => assign($, r.key).then(() => setView($, v => ({ ...v, answering: false })))}
    />
  ) : (
    <Text dimColor size="caption">
      {why}
    </Text>
  )
  const isOneLine = fitsOneLine(c, r, isNext, r.claimable ? label.length + BUTTON : why.length)
  const title = c.isTerm ? (
    <Text wrap="truncate" dimColor={dim} inverse={isNext}>
      {[r.key, r.title, isNext ? 'Next' : '', r.step ?? ''].filter(Boolean).join('  ')}
    </Text>
  ) : (
    <Box gap={1} alignItems="center" flexGrow={1} flexShrink={1} minWidth={0}>
      <Box flexShrink={0}>
        <Text mono size="footnote" dimColor={dim}>
          {r.key}
        </Text>
      </Box>
      <Box flexGrow={1} flexShrink={1} minWidth={0} overflow="hidden">
        <Text wrap="truncate" size="footnote" dimColor={dim}>
          {r.title}
        </Text>
      </Box>
      {isNext && <Box flexShrink={0}>{pill(c, 'Next', 'claude', dim)}</Box>}
      {r.step !== undefined && <Box flexShrink={0}>{pill(c, r.step, 'subtle', dim)}</Box>}
    </Box>
  )

  return (
    <Box
      key={`row-${r.key}`}
      gap={1}
      minWidth={0}
      {...(isOneLine ? { alignItems: 'center' as const } : { flexDirection: 'column' as const, alignItems: 'flex-start' as const })}
    >
      {c.isTerm ? (
        <Box flexGrow={1} flexShrink={1} minWidth={0}>
          {title}
        </Box>
      ) : (
        title
      )}
      <Box flexShrink={0}>
        {take}
      </Box>
    </Box>
  )
}

// Ready rows, the next ticket marked; `skip` leaves out the ticket in hand.
export function readyRows(
  $: EngineInterface,
  c: Ctx,
  w: Ready,
  head: { label: string; right?: string; most?: number },
  hasKeys: boolean,
  skip?: string,
) {
  const { Box, Text } = c.ui
  const groups = w.groups.map(g => ({ ...g, rows: g.rows.filter(r => r.key !== skip) })).filter(g => g.rows.length)
  if (!groups.length) return <Text dimColor>{w.note ?? 'Nothing ready for you.'}</Text>
  const one = groups.length === 1 && groups[0]?.name ? ` · ${groups[0].name}` : ''
  let left = head.most ?? Infinity
  const shown = groups.map(g => {
    const rows = g.rows.slice(0, left)
    left -= rows.length

    return { ...g, rows }
  })
  const waits = shown.flatMap(g => g.rows).flatMap(r => (r.waits ? [r.waits] : []))

  return (
    <Box flexDirection="column" gap={1}>
      {section(c, `${head.label}${one}`, head.right)}
      <Box flexDirection="column">
        {shown.map(g => [
          groups.length > 1 && g.rows.length > 0 && <Text dimColor size="caption">{g.name}</Text>,
          ...g.rows.map(r => row($, c, r, r.key === w.next, hasKeys)),
        ])}
      </Box>
      {waits.map(line => (
        <Text dimColor size="caption">
          {line}
        </Text>
      ))}
    </Box>
  )
}
