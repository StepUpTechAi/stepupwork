// The "Jen asks" band above the prompt: the question the pane would show next,
// in one row, with Jen's quick replies and Open. It reads the pane's questions
// and answers through the pane's own path, so both move on together.
import type { EngineInterface, RenderElement, RenderInput } from 'claude-code'

import type { Question } from '../types'
import { answer } from './hub'
import { monogram, primary } from './parts'
import { PANE, setView, snapshot } from './state'

type $ = EngineInterface
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Next = (e: any) => Promise<RenderElement>

// A quick reply's short form: "A" for "A: hide them", the whole of a short one.
export function shortOf(choice: string) {
  const head = /^([^:]{1,12}):/.exec(choice)?.[1]?.trim()

  return head || (choice.length > 16 ? `${choice.slice(0, 15)}…` : choice)
}

const isSuggested = (q: Question, choice: string) =>
  q.suggested !== undefined && (choice === q.suggested || choice.startsWith(`${q.suggested}:`))

async function openPane($: $) {
  await setView($, v => ({ ...v, answering: true }))
  await $.ui.open({ id: PANE, title: 'StepUpWork' })
}

export async function band($: $, e: RenderInput<'AbovePrompt'>, next: Next) {
  if (e.props.hasSurvey) return next(e)
  const { isIn, qs } = await snapshot($)
  const q = qs.items.find(i => !qs.skipped.includes(i.id))
  if (isIn !== true || q === undefined) return next(e)
  const ui = $.ui.resolve(e)
  const { Box, Text, Button } = ui
  // The terminal draws the row as text, each reply "1: A"; the desktop as buttons.
  const isTerm = e.surface === 'terminal'
  const about = q.key !== undefined ? ` about ${q.key}` : ''
  // Digits for the replies; "o" for Open, clear of them.
  const keys = (k: string) => (isTerm ? { plain: true as const, hotkey: k } : {})

  return (
    <Box gap={1} alignItems="center">
      {monogram({ ui, isTerm })}
      <Box flexGrow={1} flexShrink={1}>
        <Text wrap="truncate">
          <Text bold>{`Jen asks${about}:`}</Text> {q.text}
        </Text>
      </Box>
      {q.choices.slice(0, 9).map((choice, i) => (
        <Button
          key={`band-choice-${i}`}
          label={shortOf(choice)}
          {...keys(String(i + 1))}
          {...(isTerm ? {} : primary(isSuggested(q, choice)))}
          onPress={() => answer($, q, { choice })}
        />
      ))}
      <Button key="band-open" label="Open" {...keys('o')} onPress={() => openPane($)} />
    </Box>
  )
}
