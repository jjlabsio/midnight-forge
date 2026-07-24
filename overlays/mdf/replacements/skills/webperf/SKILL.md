---
name: webperf
description: "Run a web performance audit via the web-performance-auditor persona"
---

# webperf

## Upstream command contract

/webperf targets web applications specifically. Do not use it for utility libraries, CLIs, or server-only code with no browser-facing output.

## Determine the mode

Deep mode — activate when any of these is available:
- A Lighthouse JSON report file (e.g. `npx lighthouse <url> --output json --output-path ./report.json`, or `npx -p chrome-devtools-mcp chrome-devtools lighthouse_audit --output-format=json` from the Chrome DevTools MCP CLI)
- A PageSpeed Insights JSON response (includes Lighthouse + CrUX)
- A CrUX API response (requires $CRUX_API_KEY or $GOOGLE_API_KEY environment variables — never hard-code these values in config files)
- A DevTools performance trace
- A live URL plus the chrome-devtools MCP server configured in the harness (capture metrics directly via lighthouse_audit and performance_* tools)
- The Chrome DevTools MCP CLI invoked locally (via `npx -p chrome-devtools-mcp chrome-devtools <tool>`), passing the JSON output to the agent

Quick mode — default when none of the above are available. Scan source code for structural anti-patterns and label every finding as `potential impact`.

## Run the audit

Spawn the `web-performance-auditor` subagent (the CLI exposes each custom subagent in `agents/` as a tool with the same name). Pass it explicitly:

- The files, components, or diff under review
- Any artifact paths (Lighthouse JSON, PSI JSON, CrUX response, trace) or pasted JSON content
- The target URL or page name when known
- A note on which mode you expect (Quick or Deep), so the agent surfaces missing inputs if Deep was intended

The subagent returns a scorecard (only populated with sourced values — mark unmeasured fields `not measured`, never fabricate metrics), a ranked list of findings, positive observations, and proactive recommendations.

## Output

Return the full audit report to the user. No synthesis or merge step is needed — this is a single-persona command.

## MDF adaptation

1. Resolve the installed plugin root and run exact upstream
   `using-agent-skills` discovery.
2. Load `<plugin-root>/references/subagent-dispatch-policy.md` and the exact
   resolved `web-performance-auditor` persona prompt.
3. Invoke one generic subagent with the root-selected dispatch record. Do not
   fan out or add a merge step.
4. If the runtime, prompt, or dispatch record cannot be resolved, disclose a
   root fallback with degraded status or stop explicitly. Never silently omit
   the audit.
