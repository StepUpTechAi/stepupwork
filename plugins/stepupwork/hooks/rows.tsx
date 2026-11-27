// The ready rows: key, title and step as a flat text run, the next ticket
// marked, and Assign, which moves the pane to working.
import type { EngineInterface } from 'claude-code'

import type { Ready, Row } from '../types'
import { assign } from './hub'
import { hot, primary } from './parts'
import type { Ctx } from './parts'
import { setView } from './state'

function row($: EngineInterface, c: Ctx, r: Row, isNext: boolean, hasKey: boolean) {
  const { Box, Text, Button } = c.ui
  const take = r.claimable ? (
    <Button
      key={`assign-${r.key}`}
      label={isNext ? 'Assign to me' : 'Assign'}
      {...primary(isNext)}
      {...(isNext && hasKey ? hot(c, '1') : {})}
      onPress={() => assign($, r.key).then(() => setView($, v => ({ ...v, answering: false })))}
    />
  ) : (
    <Text dimColor>{r.reason ?? 'Not yours to take yet'}</Text>
  )
  if (c.isTerm) {
    const run = [r.key, r.title, isNext ? 'Next' : '', r.step ?? ''].filter(Boolean).join('  ')

    return (
      <Box key={`row-${r.key}`} gap={1}>
        <Text wrap="truncate" dimColor={!r.claimable} inverse={isNext}>
          {run}
        </Text>
        {take}
      </Box>
    )
  }

  return (
    <Box key={`row-${r.key}`} gap={1} justifyContent="space-between">
      <Box gap={1} flexShrink={1}>
        <Text mono dimColor={!r.claimable}>{r.key}</Text>
        <Text wrap="truncate" dimColor={!r.claimable}>{r.title}</Text>
        {isNext && <Text backgroundColor="claude" color="inverseText">{' Next '}</Text>}
        {r.step !== undefined && <Text backgroundColor="subtle">{` ${r.step} `}</Text>}
      </Box>
      {take}
    </Box>
  )
}

// Ready rows, the next ticket marked; `skip` leaves out the ticket in hand.
export function readyRows($: EngineInterface, c: Ctx, w: Ready, heading: string, hasKeys: boolean, skip?: string) {
  const { Box, Text } = c.ui
  const groups = w.groups.map(g => ({ ...g, rows: g.rows.filter(r => r.key !== skip) })).filter(g => g.rows.length)
  if (!groups.length) return <Text dimColor>{w.note ?? 'Nothing ready for you.'}</Text>

  return (
    <Box flexDirection="column">
      <Box justifyContent="space-between">
        <Text bold>{groups.length === 1 && groups[0]?.name ? `${heading} · ${groups[0].name}` : heading}</Text>
        {w.canClaim !== undefined && <Text dimColor>{`${w.canClaim} you can take`}</Text>}
      </Box>
      {groups.map(g => [
        groups.length > 1 && <Text dimColor>{g.name}</Text>,
        ...g.rows.map(r => row($, c, r, r.key === w.next, hasKeys)),
      ])}
    </Box>
  )
}
