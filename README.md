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
- Two short skills: `deliver-ticket`, for picking up and handing in a ticket, and `hey-jen`, for talking to Jen from any chat.
- A pane beside the chat. Open it with `/stepupwork`. Assign yourself a ticket with `/stepupwork assign KEY`.
- A status line with your ticket and its train, a toast when a train goes red or lands, and a card under the workshop's calls.

The pane works in Claude Code. In claude.ai and the desktop chat you get the same tools, answered as text.

## For an organization

Add the marketplace under `extraKnownMarketplaces`, and set `enabledPlugins` to `{ "stepupwork@stepupwork": true }`. Set it to `false` to block the plugin everywhere.

## What the mod may use

The list is in `thin-client.json`. CI refuses a change that goes past it: long prompt or rule text, any hub route other than `/mcp`, or a hook or call that is not listed. It also runs `claude plugin validate` and the mod's tests.

Releases are pinned by version.

## Release notes

### 0.2.1

- Each ready ticket's row shows its key, its title cut short with "…", a Next mark on the next ticket, its step, and the Assign button, at any pane width. Only the title gets shorter. In a pane too narrow for the button beside the title, the button goes on the line under it, so it is never pushed out of sight.
- A ticket you can't take yet is greyed out, with the reason where its button would be ("Overlaps …") and a line under the list saying what it waits for.
- Under "Nothing claimed" the pane says how many tickets are ready for you and how many questions Jen has for you. The status line, the header and the list use the same number.
- When Jen has questions for you, a card says how many, with Answer to answer them right in the pane, one at a time.
- At the foot of the pane: when it last read the workshop and how often it checks, and a link to open the workshop.
- Jen's questions show in full in the pane, in the row above the prompt and when you ask in a chat: the question and every choice, never cut off. The buttons carry short labels, and the full words of each choice sit above them. If the workshop itself sent a question cut short, the pane says the full question is in the workshop and links to it.
- The ticket you're working on looks as designed: its points, its train, a bar for your acceptance ticks, the first files the brief plans to change, and Hand in…, Park… and Let it go…. A red train shows each round's steps and the other tickets on it, where the workshop sends them.
- The pane now tries the plugin's own connection to the workshop first. If that one still needs you to sign in but the claude.ai connector is signed in, the pane and the skills use the connector, which reaches the same workshop.

### 0.2.0

- The pane shows where you are: signed out, ready work, the ticket you're working on, a question from Jen, or your train gone red.
- Ready work lists each ticket's key, title and step, with the next one marked. Assign takes it and the pane moves to your ticket.
- Your ticket shows its train, how long you've had it, its brief, and its acceptance criteria as a checklist you tick. The ticks are yours: they stay with the plugin on your computer, not in the workshop.
- The pane checks the workshop every minute, and every 20 seconds while your train runs. It doesn't check while you're signed out.
- When a train goes red or lands you get one toast and one notice, never two for the same thing. The status line shows your ticket and its train, and clears when the session ends.
- Jen's questions show one at a time, with Jen's choices and suggestion, Skip, and a box for your own answer. A mark beside the prompt shows while one waits.
- While a question from Jen waits, a "Jen asks" row sits above the prompt with Jen's quick replies and Open. An answer there goes the same way as one in the pane, and the row moves to the next question or goes. The terminal draws it as one line of text (press 1, 2… or o once the row has focus, or a digit in an empty prompt); the desktop draws it with buttons.
- Calls to submit, assign and train get a card with what happened and a link to the workshop. Right-click a ticket key to open it in the workshop or ask Jen about it.
- Hand in puts a prompt in the box asking Claude to push the branch and submit. The plugin never submits by itself.
- New skill, `hey-jen`: Claude passes your words to Jen and quotes Jen's back, and never speaks as Jen. Until the workshop can take a message for Jen, Claude says so.
- The pane opens by itself at the start of a session only when you hold a ticket or a question waits, and only in the desktop's Code tab. In a terminal, open it with `/stepupwork`.
- The mod may now also draw above and beside the prompt, under tool calls and in the right-click menu, read the clock and fill the prompt. `thin-client.json` lists them.

## Licence, icon and privacy

- Licence: all rights reserved; you may install and run the plugin to reach a StepUpWork workshop you belong to. See `LICENSE`.
- Icon: `plugins/stepupwork/.claude-plugin/icon.png` (512 px), the StepUpWork mark on dark, from `assets/icon.svg`.
- Privacy: https://stepuptech.ai/privacy
