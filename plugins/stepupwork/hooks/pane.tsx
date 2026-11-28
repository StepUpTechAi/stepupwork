// The pane’s states: signed out, idle with ready work, working on a ticket,
// a question waiting, and a train red. A minimised pane is one line.
import type { EngineInterface, RenderInput } from 'claude-code'

import type { Status } from '../types'
import { countsLine, plural, questionCount, readyCount, waitingOf, workshopLink } from './counts'
import { ctxOf, fill, footer, monogram, rule } from './parts'
import type { Ctx } from './parts'
import { question } from './question'
import { readyRows } from './rows'
import { brief, checklist, lease } from './ticket'
import { clockTime, isRunning, setView, snapshot } from './state'

// Step Up’s swoosh, the product’s mark (never Jen’s).
const SWOOSH = [
  '<svg viewBox="0 0 130 130"><path d="M102 14C102 14 90 107 64 107C44 107 48 60 48 60C48 60 48 47 32 47C16 47 16 73 16 73"',
  ' fill="none" stroke="#BD6844" stroke-width="14" stroke-linecap="round"/></svg>',
].join('')

type PaneEvent = RenderInput<'Pane'>

function signedOut($: EngineInterface, c: Ctx) {
  const { Box, Text, Button } = c.ui

  return (
    <Box flexDirection="column" gap={1} alignItems="flex-start" paddingY={1}>
      {c.Svg && <c.Svg source={SWOOSH} alt="StepUpWork" width={40} height={40} />}
      <Text size="title" bold>
        Sign in to your workshop
      </Text>
      <Text dimColor>
        StepUpWork isn’t signed in here. Your ticket, its train, ready work and Jen’s questions show here once it is.
      </Text>
      <Box gap={1}>
        <Button key="sign-in" variant="primary" label="Sign in from /mcp" onPress={() => fill($, '/mcp')} />
      </Box>
      <Text dimColor size="caption">
        Already signed in on claude.ai? Restart this session to use that sign-in.
      </Text>
    </Box>
  )
}

function readLine(s: Status | null) {
  if (!s) return undefined
  const rate = isRunning(s.train?.state) ? 'checks every 20 s while a train runs' : 'checks every minute'

  return `Read ${clockTime(s.readAt)} · ${rate}`
}

// "Jen has 3 questions for you" and Answer, which opens the first in place.
function jenCard($: EngineInterface, c: Ctx, count: number, canDraw: boolean) {
  const { Box, Text, Button, Link } = c.ui
  const frame = c.isTerm ? {} : { borderStyle: 'round', borderColor: 'subtle' as const, paddingX: 1 }

  return (
    <Box key="jen-card" gap={1} alignItems="center" {...frame}>
      <Box flexShrink={0}>{monogram(c)}</Box>
      <Box flexGrow={1} flexShrink={1} minWidth={0}>
        <Text size="footnote">{`Jen has ${plural(count, 'question')} for you`}</Text>
      </Box>
      <Box flexShrink={0}>
        {canDraw ? (
          <Button key="answer" label="Answer" onPress={() => setView($, x => ({ ...x, answering: true }))} />
        ) : (
          c.workshop !== undefined && <Link href={c.workshop}>Answer in the workshop</Link>
        )}
      </Box>
    </Box>
  )
}

export async function drawPane($: EngineInterface, e: PaneEvent) {
  const { isIn, s, w, held, qs, on, v, l } = await snapshot($)
  const c = ctxOf($, e, l, workshopLink(s, w, held, l))
  const { Box, Text } = c.ui
  if (isIn === false) return signedOut($, c)
  if (isIn === null) return <Text dimColor>Run /stepupwork to load ready work.</Text>
  const waiting = waitingOf(qs)
  const q = waiting[0]
  const asks = questionCount(qs, s)
  const t = s?.train
  if (e.props.placement === 'widget') {
    const glance = [held?.key ?? 'Nothing claimed', t && `train ${t.n} ${t.state}`, asks && `? ${asks}`]

    return <Text wrap="truncate">{glance.filter(Boolean).join(' · ')}</Text>
  }
  const showQuestion = q !== undefined && (held !== null || v.answering)
  const asked = showQuestion && question($, c, q, qs.skipped.length + 1, qs.skipped.length + waiting.length)
  const read = readLine(s)

  if (held === null) {
    const ready = readyCount(w, s)
    const counts = countsLine(ready, asks)

    return (
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="column">
          <Text size="heading" bold>
            Nothing claimed
          </Text>
          {counts !== undefined && (
            <Text dimColor size="footnote">
              {counts}
            </Text>
          )}
        </Box>
        {asks > 0 && !showQuestion && jenCard($, c, asks, q !== undefined)}
        {asked}
        {w ? (
          readyRows($, c, w, { label: 'Ready work', right: ready !== undefined ? `${ready} you can take` : undefined }, !showQuestion)
        ) : (
          <Text dimColor>Loading ready work…</Text>
        )}
        {rule(c)}
        {read !== undefined && footer(c, read)}
      </Box>
    )
  }
  const isRed = t?.state === 'red'

  return (
    <Box flexDirection="column" gap={1}>
      {asked}
      {asked && rule(c)}
      {lease($, c, s, held)}
      {rule(c)}
      {held.acceptance.length > 0 && checklist($, c, held, on[held.key] ?? [])}
      {held.acceptance.length > 0 && rule(c)}
      {!isRed && brief($, c, held, v.wholeBrief)}
      {!isRed && !!held.brief && rule(c)}
      {isRed &&
        w &&
        readyRows($, c, w, { label: 'Next for you', right: 'while the train is repaired', most: 2 }, !showQuestion, held.key)}
      {isRed && w && rule(c)}
      {read !== undefined && footer(c, read)}
    </Box>
  )
}
