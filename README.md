# stepupwork

StepUpWork for Claude. This is the `stepupwork` plugin and the marketplace it comes from. It connects Claude to your StepUpWork workshop. It is a thin client: the rules, prompts and briefs stay in your workshop, behind your sign-in.

## Install

In a Claude Code session:

```
/plugin install stepupwork --marketplace StepUpTechAi/stepupwork
```

In the desktop app's Code tab: click +, then Plugins, then Add marketplace, enter `StepUpTechAi/stepupwork`, then Add plugin.

There is nothing to set: Claude connects to https://sut.stepupwork.com/mcp. The server shows as needing sign-in until you press Connect on the plugin (or sign in from `/mcp`).

## What you get

- The workshop's tools, through the MCP server.
- A short skill, `deliver-ticket`, for picking up and handing in a ticket.
- A pane beside the chat. Open it with `/stepupwork`. Assign yourself a ticket with `/stepupwork assign KEY`.

The pane works in Claude Code. In claude.ai and the desktop chat you get the same tools, answered as text.

## For an organization

Add the marketplace under `extraKnownMarketplaces`, and set `enabledPlugins` to `{ "stepupwork@stepupwork": true }`. Set it to `false` to block the plugin everywhere.

## What the mod may use

The list is in `thin-client.json`. CI refuses a change that goes past it: long prompt or rule text, any hub route other than `/mcp`, or a hook or call that is not listed. It also runs `claude plugin validate` and the mod's tests.

Releases are pinned by version.

## Licence, icon and privacy

- Licence: all rights reserved; you may install and run the plugin to reach a StepUpWork workshop you belong to. See `LICENSE`.
- Icon: `plugins/stepupwork/.claude-plugin/icon.png` (512 px), the StepUpWork mark on dark, from `assets/icon.svg`.
- Privacy: https://stepuptech.ai/privacy
