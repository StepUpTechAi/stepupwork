// The ticket in hand: what it is and how long it has been yours, its train
// (the rounds and who is on it where `train` says), the hand-in buttons, the
// acceptance checklist with its bar, and the brief.
import type { EngineInterface } from 'claude-code'

import type { Held, Status, Train } from '../types'
import { tick } from './hub'
import { fill, pill, plural, primary, section } from './parts'
import type { Ctx, Tone } from './parts'
import { setView, took } from './state'

const toneOf = (result: string): Tone =>
  /pass|green|ok|success|done/.test(result) ? 'success' : /red|fail|error/.test(result) ? 'error' : 'subtle'

const ago = (ms: number) => (took(ms) === 'just now' ? 'just now' : `${took(ms)} ago`)

// Each round’s steps as pills, then who is on the train.
export function trainStrip(c: Ctx, t: Train) {
  const { Box, Text } = c.ui
  const mine = t.tickets.filter(x => x.isMine).map(x => `${x.key} (yours)`)
  const rest = t.tickets.filter(x => !x.isMine).map(x => x.key)
  if (!t.rounds.length && !t.tickets.length) return null

  return (
    <Box flexDirection="column">
      {t.rounds.map(r => (
        <Box key={`round-${r.n}`} gap={1} flexWrap="wrap">
          <Text dimColor size="caption">{`Round ${r.n}`}</Text>
          {r.steps.length
            ? r.steps.map(s => pill(c, s.name, toneOf(s.result)))
            : r.redAt !== undefined
              ? pill(c, r.redAt, 'error')
              : r.result !== undefined && pill(c, r.result, toneOf(r.result))}
          {r.fixed && <Text dimColor size="caption">fixed</Text>}
        </Box>
      ))}
      {t.tickets.length > 0 && (
        <Text dimColor size="caption">{`On it: ${[...mine, ...rest].join(', ')} · a batch of ${t.tickets.length}`}</Text>
      )}
    </Box>
  )
}

export function redTrain($: EngineInterface, c: Ctx, t: Train, readAt: number) {
  const { Box, Text, Button, Link } = c.ui
  const head = `Train ${t.n} went red${t.red ? ` at ${t.red}` : ''}`
  const when = [t.round !== undefined && `round ${t.round}`, t.at !== undefined && ago(Math.max(0, readAt - t.at))]

  return (
    <Box flexDirection="column" gap={1} borderStyle="round" borderColor="error" paddingX={1}>
      <Box gap={1} flexWrap="wrap">
        <Text bold color="error">
          {c.isTerm ? `● ${head}` : head}
        </Text>
        <Text dimColor size="caption">
          {when.filter(Boolean).join(' · ')}
        </Text>
      </Box>
      {trainStrip(c, t)}
      <Text size="footnote">Jen is repairing it on the siding. Your ticket stays on the train. Nothing waits on you.</Text>
      <Box gap={1} alignItems="center" flexWrap="wrap">
        <Button key="what-broke" label="Ask Jen what broke" onPress={() => fill($, `Ask Jen what broke train ${t.n}.`)} />
        {t.link !== undefined && <Link href={t.link}>{`Open train ${t.n}`}</Link>}
      </Box>
    </Box>
  )
}

export function lease($: EngineInterface, c: Ctx, s: Status | null, held: Held) {
  const { Box, Text, Button } = c.ui
  const t = s?.train
  const on = s?.since !== undefined ? took(Math.max(0, s.readAt - s.since)) : undefined
  const running = t && t.state !== 'red' && (t.state === 'landed' ? `Landed with train ${t.n}.` : `On train ${t.n} · ${t.state}${t.round !== undefined ? ` · round ${t.round}` : ''}`)

  return (
    <Box flexDirection="column" gap={1}>
      <Box flexDirection="column">
        <Box gap={1}>
          <Text bold size="caption" color="claude">
            Working on
          </Text>
          {held.step !== undefined && <Text dimColor size="caption">{held.step}</Text>}
          {on !== undefined && <Text dimColor size="caption">{`· ${on}`}</Text>}
        </Box>
        <Box gap={1} alignItems="center">
          <Text mono bold size="heading">
            {held.key}
          </Text>
          {held.points !== undefined && pill(c, plural(held.points, 'point'), 'subtle')}
        </Box>
        {held.title !== undefined && <Text>{held.title}</Text>}
      </Box>
      {t?.state === 'red' && redTrain($, c, t, s?.readAt ?? 0)}
      {running && <Text dimColor size="footnote">{running}</Text>}
      {t && t.state !== 'red' && trainStrip(c, t)}
      {!t && (
        <Box gap={1} flexWrap="wrap">
          <Text dimColor size="footnote">Not on a train yet.</Text>
          <Text dimColor size="footnote">Hand it in once the branch is pushed.</Text>
        </Box>
      )}
      {held.latest !== undefined && (
        <Box gap={1}>
          <Box flexShrink={0}>
            <Text dimColor size="caption">Latest:</Text>
          </Box>
          <Text size="caption">{held.latest}</Text>
        </Box>
      )}
      {!t && (
        <Box gap={1} flexWrap="wrap">
          <Button key="hand-in" {...primary(true)} label="Hand in…" onPress={() => fill($, `Push the branch for ${held.key}, then hand it in with the stepupwork submit tool.`)} />
          <Button key="park" label="Park…" onPress={() => fill($, `Park ${held.key} in StepUpWork. The reason: `)} />
          <Button key="let-go" label="Let it go…" onPress={() => fill($, `Release ${held.key} in StepUpWork. The reason: `)} />
        </Box>
      )}
    </Box>
  )
}

export function checklist($: EngineInterface, c: Ctx, held: Held, on: number[]) {
  const { Box, Text, Button, Progress } = c.ui
  const n = held.acceptance.length
  const done = on.filter(i => i < n).length

  return (
    <Box flexDirection="column">
      <Progress label="Acceptance" value={done} max={n} valueText={`${done} of ${n} ticked by you`} color="success" />
      {held.acceptance.map((criterion, i) => {
        const has = on.includes(i)

        return (
          <Button key={`tick-${i}`} plain onPress={() => tick($, held.key, i)}>
            <Text {...(has ? { color: 'success' } : { dimColor: true })}>{c.isTerm ? (has ? '[x]' : '[ ]') : has ? '☑' : '☐'}</Text>{' '}
            <Text size="footnote" dimColor={has}>
              {criterion}
            </Text>
          </Button>
        )
      })}
    </Box>
  )
}

export function brief($: EngineInterface, c: Ctx, held: Held, isWhole: boolean) {
  const { Box, Button, Link, Markdown, Text } = c.ui
  if (!held.brief) return null
  const rev = held.revision && (held.revision.startsWith('r') ? held.revision : `r${held.revision}`)
  const fresh = held.fresh === undefined ? undefined : held.fresh ? 'fresh' : 'not fresh'
  const paths = held.paths === undefined ? undefined : plural(held.paths, 'planned path')
  const summary = held.brief.split(/\n\s*\n/)[0] ?? held.brief
  const more = (held.paths ?? 0) - held.firstPaths.length
  const list = held.firstPaths.map((p, i) => `- \`${p}\`${i === held.firstPaths.length - 1 && more > 0 ? ` and ${more} more` : ''}`)

  return (
    <Box flexDirection="column" gap={1}>
      {section(c, 'Brief', [rev, fresh, paths].filter(Boolean).join(' · '))}
      {c.isTerm ? <Text>{isWhole ? held.brief : summary}</Text> : <Markdown key="brief" text={isWhole ? held.brief : summary} />}
      {list.length > 0 && <Markdown key="paths" text={list.join('\n')} />}
      <Box gap={1} alignItems="center" flexWrap="wrap">
        {summary !== held.brief && (
          <Button key="whole-brief" label={isWhole ? 'Show less' : 'Read the whole brief'} onPress={() => setView($, v => ({ ...v, wholeBrief: !isWhole }))} />
        )}
        {held.link !== undefined && <Link href={held.link}>Open in the workshop</Link>}
      </Box>
    </Box>
  )
}
