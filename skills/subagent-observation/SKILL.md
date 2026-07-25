---
name: subagent-observation
description: "Use when an MDF root records or checks diagnostic requested-routing observations for an actual subagent dispatch."
---

# Subagent Observation

This is the installed entrypoint and support owner for diagnostic subagent
observation. It is not a router, controller, or lifecycle stage.

Resolve the installed plugin root and read
`<plugin-root>/references/subagent-dispatch-policy.md` completely before using
these helpers. That policy owns dispatch mechanics, authority, observation
meaning, and the `begin`/`finish` and checker invocation contracts.

The scripts in `scripts/` record or check only the policy-required diagnostic
facts. They do not select a model, dispatch work, infer runtime facts, or gate
workflow progress.
