---
name: webperf
description: "Run an MDF web performance audit for browser-facing applications."
---

# webperf

## Upstream command contract

`/webperf` targets web applications specifically. Do not use it for utility
libraries, CLIs, or server-only code with no browser-facing output.

## Determine the mode

Deep mode — activate when any of these is available:

- A Lighthouse JSON report file (e.g. `npx lighthouse <url> --output json --output-path ./report.json`, or `npx -p chrome-devtools-mcp chrome-devtools lighthouse_audit --output-format=json` from the Chrome DevTools MCP CLI)
- A PageSpeed Insights JSON response (includes Lighthouse + CrUX)
- A CrUX API response (requires `$CRUX_API_KEY` or `$GOOGLE_API_KEY` environment variables — never hard-code these values in config files)
- A DevTools performance trace
- A live URL plus the chrome-devtools MCP server configured in the harness (capture metrics directly via `lighthouse_audit` and `performance_*` tools)
- The Chrome DevTools MCP CLI invoked locally (via `npx -p chrome-devtools-mcp chrome-devtools <tool>`), passing the JSON output to the agent

Quick mode — default when none of the above are available. Scan source code for
structural anti-patterns and label every finding as `potential impact`.

## Run the audit

Before spawning, load the plugin-installed
`../../references/subagent-dispatch-policy.md` and
`../../references/model-routing-5.6.md`. The root classifies audit difficulty
and risk, verifies a GPT-5.6 capability at the `high` floor, and passes the
selected dispatch record through the generic runtime spawn path with the exact
persona prompt. Persona model or effort frontmatter is only a direct-invocation
default; the root-selected dispatch record overrides it for MDF-managed work. Missing
capability requires a visible root fallback with degraded status or an
explicit stop; never silently use a fast, older, or future profile.

Spawn one generic subagent with the exact `web-performance-auditor` persona
prompt resolved from the installed plugin root and the root-selected dispatch
record. Pass it explicitly:

- The files, components, or diff under review
- Any artifact paths (Lighthouse JSON, PSI JSON, CrUX response, trace) or pasted JSON content
- The target URL or page name when known
- A note on which mode you expect (Quick or Deep), so the agent surfaces missing inputs if Deep was intended

The subagent returns a scorecard (only populated with sourced values — mark
unmeasured fields `not measured`, never fabricate metrics), a ranked list of
findings, positive observations, and proactive recommendations.

## Output

Return the full audit report to the user. No synthesis or merge step is needed
— this is a single-persona command.

## MDF/Codex adaptation

Resolve the installed plugin root before loading paths. Use this Codex-native
entrypoint when the user invokes `webperf`, `mdf webperf`, `$webperf`, or asks
for a web performance audit.

From the resolved plugin root, load the exact upstream
`agents/web-performance-auditor.md` persona prompt and invoke one generic
subagent with the root dispatch record. This is a single-persona call; do not
fan out to additional reviewers. References from
the persona to `performance-optimization` or
`browser-testing-with-devtools` are guidance and capability references, not
additional `webperf` subagent calls.

If the generic runtime, exact persona prompt, or root dispatch record cannot be
resolved, use a root fallback with degraded status or stop explicitly. Do not
silently omit the audit.
