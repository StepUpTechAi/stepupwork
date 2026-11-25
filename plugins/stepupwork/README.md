# StepUpWork for Claude

Connects Claude to your StepUpWork workshop. You get the workshop's tools through its MCP server, a short skill for delivering a ticket, and, in Claude Code, a pane beside the chat.

Install it in a Claude Code session:

```
/plugin install stepupwork --marketplace StepUpTechAi/stepupwork
```

Set the option `hub_url` to your hub's address with no trailing slash, then sign in from `/mcp`. Open the pane with `/stepupwork`, and assign yourself a ticket with `/stepupwork assign KEY`. The workshop holds the rules; the plugin only shows and calls.

Privacy: https://stepuptech.ai/privacy
