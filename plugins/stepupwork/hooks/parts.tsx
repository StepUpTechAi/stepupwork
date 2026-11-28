// The pane’s small parts, one tree for every surface: Jen’s mark, a pill, a
// section’s head, a rule between sections and the footer. The desktop draws an
// Svg where it has one; the terminal draws text.
import type { Elements, EngineInterface, RenderInput, RenderSurface } from 'claude-code'

export type UI = Pick<Elements['desktop'], 'Box' | 'Text' | 'Button' | 'Input' | 'Link' | 'Markdown' | 'Progress'>
export type Ctx = {
  ui: UI
  Svg?: Elements['desktop']['Svg']
  isTerm: boolean
  // The pane’s width in cells, what the rows budget against.
  cols: number
  links: Record<string, string>
  workshop?: string
}

type Site = RenderInput<'Pane'> | RenderInput<'AbovePrompt'>

export function ctxOf($: EngineInterface, e: Site, links: Record<string, string> = {}, workshop?: string): Ctx {
  const ui = $.ui.resolve(e)
  const surface: RenderSurface = e.surface

  return {
    ui,
    // The terminal’s table answers an Svg as an empty Box: text marks there.
    Svg: surface !== 'terminal' && 'Svg' in ui ? ui.Svg : undefined,
    isTerm: surface === 'terminal',
    cols: e.props.bodyColumns,
    links,
    workshop,
  }
}

export function fill($: EngineInterface, text: string) {
  return $.prompt.fill({ text, mode: 'replace' })
}
export { plural } from './counts'
// A key on the terminal, where a focused pane takes it; none elsewhere.
export const hot = (c: Ctx, k: string) => (c.isTerm ? { hotkey: k } : {})
export const primary = (is: boolean) => (is ? { variant: 'primary' as const } : {})

// Jen’s mark: the J monogram, a round one where the surface draws an Svg.
const MONOGRAM = [
  '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="10" fill="#BD6844"/>',
  '<text x="10" y="14.4" text-anchor="middle" font-family="system-ui,sans-serif" font-size="12" font-weight="700"',
  ' fill="#FFFFFF">J</text></svg>',
].join('')

export function monogram(c: Ctx, px = 18) {
  const { Text } = c.ui
  if (c.Svg) return <c.Svg source={MONOGRAM} alt="Jen" width={px} height={px} />

  return (
    <Text bold color="inverseText" backgroundColor="claude">
      {' J '}
    </Text>
  )
}

// A rounded label as the engine can draw one: a run on a tone. "Next", "To plan".
export type Tone = 'claude' | 'subtle' | 'success' | 'error'
export function pill(c: Ctx, text: string, tone: Tone, dim = false) {
  const { Text } = c.ui
  const ink = tone === 'subtle' ? {} : { color: 'inverseText' as const }

  return (
    <Text size="caption" backgroundColor={tone} dimColor={dim} {...ink}>
      {` ${text} `}
    </Text>
  )
}

// A section’s head: its name on the left, a dim figure on the right.
export function section(c: Ctx, label: string, right?: string) {
  const { Box, Text } = c.ui

  return (
    <Box justifyContent="space-between" gap={1}>
      <Box flexShrink={1} minWidth={0}>
        <Text bold size="footnote">
          {label}
        </Text>
      </Box>
      {right !== undefined && (
        <Box flexShrink={0}>
          <Text dimColor size="caption">
            {right}
          </Text>
        </Box>
      )}
    </Box>
  )
}

const RULE = [
  '<svg width="2000" height="1" preserveAspectRatio="none">',
  '<rect width="2000" height="1" fill="#80808040"/></svg>',
].join('')

// The line between sections; the terminal leaves a blank row instead.
export function rule(c: Ctx) {
  if (!c.Svg) return null

  return <c.Svg source={RULE} alt="Section break" height={1} />
}

// "Read 9:14am · checks every minute" on the left, "Open the workshop" on the right.
export function footer(c: Ctx, read: string) {
  const { Box, Text, Link } = c.ui

  return (
    <Box justifyContent="space-between" alignItems="center" gap={1}>
      <Box flexShrink={1} minWidth={0}>
        <Text dimColor size="caption">
          {read}
        </Text>
      </Box>
      {c.workshop !== undefined && (
        <Box flexShrink={0}>
          <Link href={c.workshop}>Open the workshop</Link>
        </Box>
      )}
    </Box>
  )
}
