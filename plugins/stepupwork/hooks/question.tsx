// Jen’s question, in the pane and in the band: its text and each choice’s full
// text wrapped, never cut; the buttons carry the short labels. Where the hub
// sent a text cut short, it says the full question is in the workshop.
import type { EngineInterface } from 'claude-code'

import type { Question } from '../types'
import { fullLine, isSuggested, needsLines, suggestion } from './asks'
import { answer } from './hub'
import { hot, monogram, primary, section } from './parts'
import type { Ctx } from './parts'

// Where the full question is: its own link, its ticket’s, else the workshop.
export const questionLink = (c: Ctx, q: Question) => q.link ?? (q.key ? c.links[q.key] : undefined) ?? c.workshop

// "A: hide those rows too. The client sees fewer repairs.", one to a line.
export function choiceLines(c: Ctx, q: Question) {
  const { Text } = c.ui
  if (!needsLines(q)) return []

  return q.choices.map(choice => {
    const { letter, rest } = fullLine(choice)

    return (
      <Text size="footnote">
        <Text bold>{letter}</Text>
        {`: ${rest}`}
      </Text>
    )
  })
}

export function cutNote(c: Ctx, q: Question) {
  const { Box, Text, Link } = c.ui
  if (!q.isCut) return null
  const link = questionLink(c, q)

  return (
    <Box gap={1} flexWrap="wrap">
      <Text dimColor size="footnote">
        The full question is in the workshop.
      </Text>
      {link !== undefined && <Link href={link}>Open it there</Link>}
    </Box>
  )
}

export function question($: EngineInterface, c: Ctx, q: Question, place: number, total: number) {
  const { Box, Text, Button, Input, Markdown } = c.ui
  const n = c.isTerm ? q.choices.length + 1 : 0
  const said = suggestion(q)

  return (
    <Box flexDirection="column" gap={1}>
      {section(c, 'Questions for you', `${q.at ?? place} of ${q.of ?? total}`)}
      <Box gap={1} alignItems="flex-start">
        <Box flexShrink={0}>{monogram(c, 22)}</Box>
        <Box flexDirection="column" gap={1} flexGrow={1} flexShrink={1} minWidth={0}>
          <Box gap={1}>
            <Text bold size="footnote">
              Jen
            </Text>
            {q.key !== undefined && (
              <Text dimColor size="caption">
                {q.key}
              </Text>
            )}
          </Box>
          {c.isTerm ? <Text>{q.text}</Text> : <Markdown key={`q-${q.id}`} text={q.text} />}
          {choiceLines(c, q)}
          {cutNote(c, q)}
          <Box gap={1} flexWrap="wrap">
            {q.choices.map((choice, i) => (
              <Button
                key={`choice-${i}`}
                label={choice.short}
                {...hot(c, String(i + 1))}
                {...primary(isSuggested(q, choice))}
                onPress={() => answer($, q, { choice: choice.value })}
              />
            ))}
            <Button key="skip" label="Skip" {...hot(c, String(n))} onPress={() => answer($, q, { skip: true })} />
          </Box>
          {said !== undefined && (
            <Text dimColor size="caption">
              {said}
            </Text>
          )}
          <Input
            key="free-answer"
            placeholder="Or answer in your words"
            submitLabel="Send"
            onSubmit={text => (text.trim() ? answer($, q, { text: text.trim() }) : undefined)}
          />
        </Box>
      </Box>
    </Box>
  )
}
