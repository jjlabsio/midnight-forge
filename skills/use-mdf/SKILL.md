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
6. Keep ambiguity, destructive confirmation, and external authority in the
   root. Do not add a controller, router persona, or machine-only protocol.

## Automatic workflows

Only `auto-workflow`, `auto-workflow-pr`, and `quick-workflow-pr` load
`<plugin-root>/references/automatic-operation-contract.md` plus their named
profile contract. The PR continuation also loads
`<plugin-root>/references/auto-workflow-contract.md` for its accepted local
workflow. Stage skills do not receive or interpret profile names.

- `auto-workflow`: local implementation and commits only.
- `auto-workflow-pr`: plan-backed implementation, canonical ship, push, and PR.
- `quick-workflow-pr`: explicitly selected bounded build, review, commit, and PR.

The root owns profile selection, operation order, omissions, executor/critic
dispatch, acceptance, recovery, commits, lifecycle, and external actions.

## Delegation

Load `<plugin-root>/references/subagent-dispatch-policy.md`,
`<plugin-root>/references/model-routing-5.6.md`, and
`<plugin-root>/references/model-routing-performance.md` whenever MDF delegates.

- Use skill-backed executors and critics for automatic operations.
- Use persona-backed dispatch only when the canonical skill names a specialist.
- Keep one writer per shared worktree.
- Consume actual returned reports; join complete fan-outs before synthesis.
- Keep artifact acceptance, lifecycle, commits, external actions, and final
  synthesis in the root.
- Preserve canonical `ship` as a direct root-owned fan-out without an outer
  executor or critic.
