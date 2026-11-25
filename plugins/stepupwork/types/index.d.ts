export type Ticket = { key: string }

declare module 'claude-code' {
  interface PluginState {
    stepupwork: { ready: Shaped<string>; ticket: Shaped<string> }
  }
}
