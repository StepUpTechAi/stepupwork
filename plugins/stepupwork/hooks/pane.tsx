// The pane’s states: signed out, idle with ready work, working on a ticket,
// a question waiting, and a train red. A minimised pane is one line.
import type { EngineInterface, RenderInput } from 'claude-code'

import type { Held, Status } from '../types'
import { brief, checklist, fill, monogram, plural, question, redTrain } from './parts'
import { readyRows } from './rows'
import type { Ctx } from './parts'
import { clockTime, isRunning, setView, snapshot, took } from './state'

// Step Up’s swoosh, the product’s mark (never Jen’s).
const SWOOSH = [
  '<svg viewBox="0 0 130 130"><path d="M102 14C102 14 90 107 64 107C44 107 48 60 48 60C48 60 48 47 32 47C16 47 16 73 16 73"',
  ' fill="none" stroke="#BD6844" stroke-width="14" stroke-linecap="round"/></svg>',
].join('')

type PaneEvent = RenderInput<'Pane'>

function signedOut($: EngineInterface, c: Ctx, e: PaneEvent) {
  const { Box, Text, Button } = c.ui
  const ui = $.ui.resolve(e)

  return (
    <Box flexDirection="column" gap={1}>
      {'Svg' in ui && <ui.Svg source={SWOOSH} alt="StepUpWork" width={40} height={40} />}
      <Text size="title" bold>
        Sign in to your workshop
      </Text>
      <Text dimColor>
        StepUpWork isn’t signed in here. Your ticket, its train, ready work and Jen’s questions show here once it is.
      </Text>
      <Button key="sign-in" variant="primary" label="Sign in from /mcp" onPress={() => fill($, '/mcp')} />
      <Text dimColor size="caption">
        Already signed in on claude.ai? Restart this session to use that sign-in.
      </Text>
    </Box>
  )
}

function lease($: EngineInterface, c: Ctx, s: Status | null, held: Held) {
  const { Box, Text, Button } = c.ui
  const t = s?.train
  const on = s?.since !== undefined ? took(Math.max(0, s.readAt - s.since)) : undefined
  const trainLine =
    !t || t.state === 'red'
      ? undefined
      : t.state === 'landed'
        ? `Landed with train ${t.n}.`
        : `On train ${t.n} · ${t.state}${t.round !== undefined ? ` · round ${t.round}` : ''}`

  return (
    <Box flexDirection="column">
      <Box gap={1}>
        <Text bold color="claude">
          Working on
        </Text>
        {held.step !== undefined && <Text dimColor>{held.step}</Text>}
        {on !== undefined && <Text dimColor>{`· ${on}`}</Text>}
      </Box>
      <Box gap={1}>
        <Text mono bold size="heading">
          {held.key}
        </Text>
        {held.points !== undefined && <Text backgroundColor="subtle">{` ${plural(held.points, 'point')} `}</Text>}
      </Box>
      {held.title !== undefined && <Text>{held.title}</Text>}
      {t?.state === 'red' && redTrain($, c, t)}
      {trainLine !== undefined && <Text dimColor>{trainLine}</Text>}
      {!t && <Text dimColor>Not on a train yet. Hand it in once the branch is pushed.</Text>}
      {held.latest !== undefined && <Text dimColor>{`Latest: ${held.latest}`}</Text>}
      {!t && (
        <Box gap={1} marginTop={1}>
          <Button
            key="hand-in"
            variant="primary"
            label="Hand in…"
            onPress={() => fill($, `Push the branch for ${held.key}, then hand it in with the stepupwork submit tool.`)}
          />
          <Button key="park" label="Park…" onPress={() => fill($, `Park ${held.key} in StepUpWork. The reason: `)} />
          <Button key="let-go" label="Let it go…" onPress={() => fill($, `Release ${held.key} in StepUpWork. The reason: `)} />
        </Box>
      )}
    </Box>
  )
}

function footer($: EngineInterface, c: Ctx, s: Status | null) {
  const { Box, Text, Link } = c.ui
  if (!s) return null
  const rate = isRunning(s.train?.state) ? 'checks every 20 s while a train runs' : 'checks every minute'

  return (
    <Box justifyContent="space-between" gap={1}>
      <Text dimColor size="caption">{`Read ${clockTime(s.readAt)} · ${rate}`}</Text>
      {s.link !== undefined && <Link href={s.link}>Open the workshop</Link>}
    </Box>
  )
}

export async function drawPane($: EngineInterface, e: PaneEvent) {
  const ui = $.ui.resolve(e)
  const c: Ctx = { ui, isTerm: e.surface === 'terminal' }
  const { Box, Text, Button } = ui
  const { isIn, s, w, held, qs, on, v } = await snapshot($)
  if (isIn === false) return signedOut($, c, e)
  if (isIn === null) return <Text dimColor>Run /stepupwork to load ready work.</Text>
  const waiting = qs.items.filter(q => !qs.skipped.includes(q.id))
  const q = waiting[0]
  const t = s?.train
  if (e.props.placement === 'widget') {
    const glance = [held?.key ?? 'Nothing claimed', t && `train ${t.n} ${t.state}`, waiting.length && `? ${waiting.length}`]

    return <Text wrap="truncate">{glance.filter(Boolean).join(' · ')}</Text>
  }
  const showQuestion = q !== undefined && (held !== null || v.answering)
  const asked = showQuestion && question($, c, q, qs.skipped.length + 1, qs.skipped.length + waiting.length)

  if (held === null) {
    const counts = [
      `${s?.ready ?? w?.canClaim ?? 0} ready for you`,
      waiting.length ? `${plural(waiting.length, 'question')} for you` : '',
    ]

    return (
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="column">
          <Text size="heading" bold>
            Nothing claimed
          </Text>
          <Text dimColor>{counts.filter(Boolean).join(' · ')}</Text>
        </Box>
        {waiting.length > 0 && !showQuestion && (
          <Box gap={1}>
            {monogram(c)}
            <Text>{`Jen has ${plural(waiting.length, 'question')} for you`}</Text>
            <Button key="answer" label="Answer" onPress={() => setView($, x => ({ ...x, answering: true }))} />
          </Box>
        )}
        {asked}
        {w ? readyRows($, c, w, 'Ready work', !showQuestion) : <Text dimColor>Loading ready work…</Text>}
        {footer($, c, s)}
      </Box>
    )
  }

  return (
    <Box flexDirection="column" gap={1}>
      {asked}
      {lease($, c, s, held)}
      {held.acceptance.length > 0 && checklist($, c, held, on[held.key] ?? [])}
      {brief($, c, held, v.wholeBrief)}
      {t?.state === 'red' && w && readyRows($, c, w, 'Next for you while the train is repaired', !showQuestion, held.key)}
      {footer($, c, s)}
    </Box>
  )
}
