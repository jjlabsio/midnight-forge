# Midnight Forge Docs

Midnight Forge (`mdf`) is a Codex plugin harness for solo developers. It ships MDF task/init skills and a generated runtime skill surface built from vendored `agent-skills` plus MDF overlays.

## Areas

- [Product](product/index.md): product context and current scope.
- [Architecture](architecture/index.md): system design and runtime generation model.
- [Decisions](decisions/index.md): durable decision records.
- [Operations](operations/index.md): release and verification notes.
- [Research](research/model-routing-evidence.md): historical model-routing evidence and its limits.

## Documentation Rules

Tracked docs in this directory are durable shared project documentation. Workflow artifacts, drafts, reviews, and task evidence stay under the local gitignored `.mdf/work/{work_id}/` tree unless a user explicitly promotes them into tracked docs.

Project-wide decisions use:

```text
docs/decisions/<area-or-design-unit>/<decision-slug>.md
```

When adding, moving, or deleting tracked docs, update this index and the relevant area index in the same change.
