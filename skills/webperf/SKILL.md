---
name: webperf
description: "Use when the user invokes webperf, mdf webperf, or asks for a web performance audit with the web-performance-auditor persona."
---

# webperf

Use this Codex-native entrypoint when the user invokes `webperf`, `mdf webperf`, `$webperf`, or asks for a web performance audit.

`webperf` targets web applications specifically. Do not use it for utility libraries, CLIs, or server-only code with no browser-facing output.

## Determine the mode

**Deep mode** — activate when any of these is available:

- A Lighthouse JSON report file, such as `npx lighthouse <url> --output json --output-path ./report.json` or `npx -p chrome-devtools-mcp chrome-devtools lighthouse_audit --output-format=json`
- A PageSpeed Insights JSON response, including Lighthouse and CrUX
- A CrUX API response, requiring `CRUX_API_KEY` or `GOOGLE_API_KEY`
- A DevTools performance trace
- A live URL plus the Chrome DevTools MCP server configured in the harness, where metrics can be captured directly via `lighthouse_audit` and `performance_*` tools
- The Chrome DevTools MCP CLI invoked locally with `npx -p chrome-devtools-mcp chrome-devtools <tool>`, passing the JSON output to the agent

**Quick mode** — default when none of the above are available. Scan source code for structural anti-patterns and label every finding as `potential impact`.

## Run the audit

Spawn the `web-performance-auditor` subagent. Pass it explicitly:

- The files, components, or diff under review
- Any artifact paths, such as Lighthouse JSON, PSI JSON, CrUX response, trace, or pasted JSON content
- The target URL or page name when known
- A note on which mode you expect, Quick or Deep, so the agent surfaces missing inputs if Deep was intended

The subagent returns a scorecard, only populated with sourced values. Mark unmeasured fields `not measured`, never fabricate metrics. The report also includes a ranked list of findings, positive observations, and proactive recommendations.

## Output

Return the full audit report to the user. No synthesis or merge step is needed because this is a single-persona command.
