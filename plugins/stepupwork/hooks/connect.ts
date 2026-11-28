// The one StepUpWork connection the pane, the band and the cards call through.
import type { EngineInterface } from 'claude-code'

import type { Result } from './read'

// The plugin’s own server by its manifest key first: the engine reads that key
// first and, where the same server runs under another name (the claude.ai
// connector), answers with that name. Then the names /mcp lists: the plugin’s
// server, and the claude.ai connector, which may be signed in while the
// plugin’s own server still waits on sign-in.
const SERVERS = ['stepupwork', 'plugin:stepupwork:stepupwork', 'claude.ai Step Up Work', 'claude.ai stepupwork']

export const SIGN_IN =
  'StepUpWork is not signed in here. Connect it in Settings › Plugins, or run /mcp and sign in to stepupwork.'

// The first of SERVERS that is connected, or null when none is.
let server: string | null = null

export async function call($: EngineInterface, tool: string, args: Record<string, unknown>): Promise<Result | null> {
  if (server === null) {
    for (const s of SERVERS) {
      const c = await $.mcp.connect(s)
      if (c.isConnected) {
        server = c.server
        break
      }
    }
  }
  if (server === null) return null

  return (await $.mcp.call(server, tool, args)) as Result
}
