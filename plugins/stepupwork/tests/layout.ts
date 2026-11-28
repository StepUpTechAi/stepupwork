// Lays a drawn tree out in cells, as a flexbox surface would, to find a control
// pushed past the pane's edge. The kit draws no paint, so this is the test's
// own measure: a Text is its length, a Button its label and 4 cells of chrome,
// and an item shrinks below its content only with `minWidth: 0`, as in CSS.
type Node = { type: string; props?: Record<string, unknown>; children?: (Node | string)[]; text?: string }

const BUTTON = 4
const kids = (n: Node) => (n.children ?? []).filter((k): k is Node => typeof k === 'object' && k !== null)
const textOf = (n: Node | string): string =>
  typeof n === 'string' ? n : n.type === 'Button' ? String(n.props?.label ?? '') : (n.children ?? []).map(textOf).join('')
const num = (v: unknown) => (typeof v === 'number' ? v : 0)
const isRow = (n: Node) => n.type === 'Box' && (n.props?.flexDirection ?? 'row') === 'row'
const frame = (n: Node) => 2 * num(n.props?.paddingX) + (n.props?.borderStyle ? 2 : 0)
const gapOf = (n: Node) => num(n.props?.gap)

// The width a node takes with room to spare.
export function measure(n: Node): number {
  switch (n.type) {
    case 'Text':
    case 'Link':
      return textOf(n).length || String(n.props?.label ?? n.props?.href ?? '').length
    case 'Button':
      return n.props?.label !== undefined ? String(n.props.label).length + (n.props?.plain ? 0 : BUTTON) : textOf(n).length
    case 'Svg':
      return Math.ceil(num(n.props?.width ?? 16) / 8)
    case 'Box': {
      const ks = kids(n).map(measure)
      const inner = isRow(n) ? ks.reduce((a, b) => a + b, 0) + gapOf(n) * Math.max(0, ks.length - 1) : Math.max(0, ...ks)

      return inner + frame(n)
    }
    default:
      return Math.max(0, ...textOf(n).split(/\s+/).map(w => w.length))
  }
}

// The least a node can be squeezed to.
function least(n: Node): number {
  if (n.type === 'Box' && n.props?.minWidth === 0 && n.props?.flexShrink !== 0) return 0
  if (n.props?.flexShrink === 0) return measure(n)
  if (n.type === 'Text' && n.props?.wrap && n.props.wrap !== 'wrap') return measure(n)
  if (n.type === 'Text' || n.type === 'Markdown') return Math.max(0, ...textOf(n).split(/\s+/).map(w => w.length))
  if (n.type === 'Input' || n.type === 'Progress') return 10
  if (n.type !== 'Box') return measure(n)
  const ks = kids(n).map(least)

  return (isRow(n) ? ks.reduce((a, b) => a + b, 0) + gapOf(n) * Math.max(0, ks.length - 1) : Math.max(0, ...ks)) + frame(n)
}

export type Clip = { what: string; end: number; edge: number }

// Every Button and Link that would end past the visible edge: the pane's, or
// that of a Box around it that hides what overflows. `n` sits at `x`, `w` wide.
export function clipped(n: Node, w: number, x = 0, edge = w, out: Clip[] = []): Clip[] {
  if (n.type === 'Button' || n.type === 'Link') {
    const end = x + measure(n)
    if (end > edge) out.push({ what: textOf(n) || String(n.props?.label ?? ''), end, edge })

    return out
  }
  if (n.type !== 'Box') return out
  const inner = w - frame(n)
  const left = x + frame(n) / 2
  const seen = n.props?.overflow === 'hidden' ? Math.min(edge, x + w) : edge
  const ks = kids(n)
  if (!isRow(n)) {
    for (const k of ks) clipped(k, inner, left, seen, out)

    return out
  }
  const gap = gapOf(n)
  const isWrap = n.props?.flexWrap === 'wrap'
  const want = ks.map(measure)
  // A row too wide shrinks its items, in order, never below their least.
  let over = want.reduce((a, b) => a + b, 0) + gap * Math.max(0, ks.length - 1) - inner
  const widths = want.map((wanted, i) => {
    if (isWrap || over <= 0) return wanted
    const give = Math.max(0, Math.min(over, wanted - least(ks[i] as Node)))
    over -= give

    return wanted - give
  })
  let at = left
  ks.forEach((k, i) => {
    const kw = Math.min(widths[i] ?? 0, isWrap ? inner : Infinity)
    if (isWrap && at > left && at + kw > left + inner) at = left
    clipped(k, kw, at, seen, out)
    at += kw + gap
  })

  return out
}
