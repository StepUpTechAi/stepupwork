// The pane’s parts: Jen’s question, the acceptance checklist, the brief, a red
// train, and the ready rows. One tree for every surface; the terminal draws
// plain text rows where the desktop draws a richer element.
import type { Elements, EngineInterface } from 'claude-code'

import type { Held, Question, Train } from '../types'
import { answer, tick } from './hub'
import { setView } from './state'

export type UI = Pick<Elements['terminal'], 'Box' | 'Text' | 'Button' | 'Input' | 'Link' | 'Markdown' | 'Progress'>
export type Ctx = { ui: UI; isTerm: boolean }

export function fill($: EngineInterface, text: string) {
  return $.prompt.fill({ text, mode: 'replace' })
}
export const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`
// A key on the terminal, where a focused pane takes it; none elsewhere.
export const hot = (c: Ctx, k: string) => (c.isTerm ? { hotkey: k } : {})
export const primary = (is: boolean) => (is ? { variant: 'primary' as const } : {})

// Jen’s avatar: the J monogram.
export function monogram(c: Ctx) {
  const { Text } = c.ui

  return (
    <Text bold color="inverseText" backgroundColor="claude">
      {' J '}
    </Text>
  )
}

export function question($: EngineInterface, c: Ctx, q: Question, place: number, total: number) {
  const { Box, Text, Button, Input, Markdown } = c.ui
  const n = c.isTerm ? q.choices.length + 1 : 0

  return (
    <Box flexDirection="column" gap={1}>
      <Box justifyContent="space-between">
        <Text bold>Questions for you</Text>
        <Text dimColor>{`${q.at ?? place} of ${q.of ?? total}`}</Text>
      </Box>
      <Box gap={1}>
        {monogram(c)}
        <Text bold>Jen</Text>
        {q.key !== undefined && <Text dimColor>{q.key}</Text>}
      </Box>
      {c.isTerm ? <Text>{q.text}</Text> : <Markdown key={`q-${q.id}`} text={q.text} />}
      <Box gap={1} flexWrap="wrap">
        {q.choices.map((choice, i) => (
          <Button
            key={`choice-${i}`}
            label={choice}
            {...hot(c, String(i + 1))}
            {...primary(choice === q.suggested || choice.startsWith(`${q.suggested}:`))}
            onPress={() => answer($, q, { choice })}
          />
        ))}
        <Button key="skip" label="Skip" {...hot(c, String(n))} onPress={() => answer($, q, { skip: true })} />
      </Box>
      {q.suggested !== undefined && <Text dimColor>{`Jen suggests ${q.suggested}.`}</Text>}
      <Input
        key="free-answer"
        placeholder="Or answer in your words"
        submitLabel="Send"
        onSubmit={text => (text.trim() ? answer($, q, { text: text.trim() }) : undefined)}
      />
    </Box>
  )
}

export function checklist($: EngineInterface, c: Ctx, held: Held, on: number[]) {
  const { Box, Text, Button, Progress } = c.ui
  const n = held.acceptance.length
  const said = `${on.filter(i => i < n).length} of ${n} ticked by you`

  return (
    <Box flexDirection="column">
      {c.isTerm ? (
        <Text bold>{`Acceptance · ${said}`}</Text>
      ) : (
        <Progress label="Acceptance" value={on.filter(i => i < n).length} max={n} valueText={said} color="success" />
      )}
      {held.acceptance.map((criterion, i) => {
        const has = on.includes(i)

        return (
          <Button key={`tick-${i}`} plain onPress={() => tick($, held.key, i)}>
            <Text {...(has ? { color: 'success' } : {})}>{c.isTerm ? (has ? '[x]' : '[ ]') : has ? '☑' : '☐'}</Text>{' '}
            <Text dimColor={has}>{criterion}</Text>
          </Button>
        )
      })}
    </Box>
  )
}

export function brief($: EngineInterface, c: Ctx, held: Held, isWhole: boolean) {
  const { Box, Text, Button, Link, Markdown } = c.ui
  if (!held.brief) return null
  const rev = held.revision && (held.revision.startsWith('r') ? held.revision : `r${held.revision}`)
  const fresh = held.fresh === undefined ? undefined : held.fresh ? 'fresh' : 'not fresh'
  const paths = held.paths === undefined ? undefined : plural(held.paths, 'planned path')
  const summary = held.brief.split(/\n\s*\n/)[0] ?? held.brief
  const text = isWhole ? held.brief : summary

  return (
    <Box flexDirection="column">
      <Box justifyContent="space-between">
        <Text bold>Brief</Text>
        <Text dimColor>{[rev, fresh, paths].filter(Boolean).join(' · ')}</Text>
      </Box>
      {c.isTerm ? <Text>{text}</Text> : <Markdown key="brief" text={text} />}
      <Box gap={1}>
        {summary !== held.brief && (
          <Button
            key="whole-brief"
            label={isWhole ? 'Show less' : 'Read the whole brief'}
            onPress={() => setView($, v => ({ ...v, wholeBrief: !isWhole }))}
          />
        )}
        {held.link !== undefined && <Link href={held.link}>Open in the workshop</Link>}
      </Box>
    </Box>
  )
}

export function redTrain($: EngineInterface, c: Ctx, t: Train) {
  const { Box, Text, Button, Link } = c.ui
  const head = `Train ${t.n} went red${t.red ? ` at ${t.red}` : ''}`
  const frame = c.isTerm ? {} : { borderStyle: 'round', borderColor: 'error' as const, paddingX: 1 }

  return (
    <Box flexDirection="column" {...frame}>
      <Box gap={1}>
        <Text bold color="error">
          {c.isTerm ? `● ${head}` : head}
        </Text>
        {t.round !== undefined && <Text dimColor>{`round ${t.round}`}</Text>}
      </Box>
      <Text>Jen is repairing it. Your ticket stays on the train. Nothing waits on you.</Text>
      <Box gap={1}>
        <Button key="what-broke" label="Ask Jen what broke" onPress={() => fill($, `Ask Jen what broke train ${t.n}.`)} />
        {t.link !== undefined && <Link href={t.link}>{`Open train ${t.n} in the workshop`}</Link>}
      </Box>
    </Box>
  )
}
