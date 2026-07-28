---
name: use-mdf
description: "Use before software development workflow decisions in Codex or MDF."
---

# Use MDF

## Routing

1. Resolve the installed plugin root.
2. Use exact upstream `using-agent-skills` to identify the applicable public
   entrypoint. Do not preload that called skill's primitives.
3. Route the user's intent to the named MDF skill.
4. Let the called skill load the primitives required by its own contract.
5. Treat MDF as routing, state, authority, and Codex adaptation over upstream
   workflow meaning.
6. Keep ambiguity, destructive execution, and external authority in the root.
   Do not add a controller, router persona, or machine-only protocol.

## Delegation

Load `<plugin-root>/references/subagent-dispatch-policy.md` whenever MDF
delegates.

- Use skill-backed executors and critics for automatic operations.
- Use persona-backed dispatch only when the canonical skill names a specialist.
- Keep one writer per shared worktree.
- Consume actual returned reports; join complete fan-outs before synthesis.
- Keep artifact acceptance, lifecycle, commits, external actions, and final
  synthesis in the root.
- Preserve canonical `ship` as a direct root-owned fan-out without an outer
  executor or critic.
