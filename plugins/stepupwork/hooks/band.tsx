// The "Jen asks" band above the prompt: the question the pane would show next,
// its text and each choice’s full text wrapped, never cut, then Jen’s quick
// replies by their short labels and Open. It reads the pane’s questions and
// answers through the pane’s own path, so both move on together.
import type { EngineInterface, RenderElement, RenderInput } from 'claude-code'

import { isSuggested } from './asks'
import { workshopLink } from './counts'
import { answer } from './hub'
import { ctxOf, monogram, primary } from './parts'
import { choiceLines, cutNote } from './question'
import { PANE, setView, snapshot } from './state'

type $ = EngineInterface
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Next = (e: any) => Promise<RenderElement>

async function openPane($: $) {
  await setView($, v => ({ ...v, answering: true }))
  await $.ui.open({ id: PANE, title: 'StepUpWork' })
}

export async function band($: $, e: RenderInput<'AbovePrompt'>, next: Next) {
  if (e.props.hasSurvey) return next(e)
  const { isIn, qs, s, w, held, l } = await snapshot($)
  const q = qs.items.find(i => !qs.skipped.includes(i.id))
  if (isIn !== true || q === undefined) return next(e)
  const c = ctxOf($, e, l, workshopLink(s, w, held, l))
  const { Box, Text, Button } = c.ui
  const about = q.key !== undefined ? ` about ${q.key}` : ''
  // The terminal draws the replies as text, each "1: A"; the desktop as buttons.
  // Digits for the replies; "o" for Open, clear of them.
  const keys = (k: string) => (c.isTerm ? { plain: true as const, hotkey: k } : {})

  return (
    <Box flexDirection="column">
      <Box gap={1} alignItems="flex-start">
        <Box flexShrink={0}>{monogram(c)}</Box>
        <Box flexDirection="column" flexGrow={1} flexShrink={1} minWidth={0}>
          <Text>
            <Text bold>{`Jen asks${about}:`}</Text> {q.text}
          </Text>
          {choiceLines(c, q)}
          {cutNote(c, q)}
        </Box>
      </Box>
      <Box gap={1} flexWrap="wrap">
        {q.choices.slice(0, 9).map((choice, i) => (
          <Button
            key={`band-choice-${i}`}
            label={choice.short}
            {...keys(String(i + 1))}
            {...(c.isTerm ? {} : primary(isSuggested(q, choice)))}
            onPress={() => answer($, q, { choice: choice.value })}
          />
        ))}
        <Button key="band-open" label="Open" {...keys('o')} onPress={() => openPane($)} />
      </Box>
    </Box>
  )
}
