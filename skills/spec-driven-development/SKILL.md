---
name: spec-driven-development
description: Creates specs before coding. Use when starting a new project, feature, or significant change and no specification exists yet. Use when requirements are unclear, ambiguous, or only exist as a vague idea.
---

# Spec-Driven Development

## Overview

Write a structured specification before writing any code. The spec is the shared source of truth between you and the human engineer — it defines what we're building, why, and how we'll know it's done. Code without a spec is guessing.

## When to Use

- Starting a new project or feature
- Requirements are ambiguous or incomplete
- The change touches multiple files or modules
- You're about to make an architectural decision
- The task would take more than 30 minutes to implement

**When NOT to use:** Single-line fixes, typo corrections, or changes where requirements are unambiguous and self-contained.

## The Gated Workflow

Spec-driven development has four phases. Do not advance to the next phase until the current one is validated.

```
SPECIFY ──→ PLAN ──→ TASKS ──→ IMPLEMENT
   │          │        │          │
   ▼          ▼        ▼          ▼
 Human      Human    Human      Human
 reviews    reviews  reviews    reviews
```

### Phase 1: Specify

Start with a high-level vision. Ask the human clarifying questions until requirements are concrete.

**Surface assumptions immediately.** Before writing any spec content, list what you're assuming:

```
ASSUMPTIONS I'M MAKING:
1. This is a web application (not native mobile)
2. Authentication uses session-based cookies (not JWT)
3. The database is PostgreSQL (based on existing Prisma schema)
4. We're targeting modern browsers only (no IE11)
→ Correct me now or I'll proceed with these.
```

Don't silently fill in ambiguous requirements. The spec's entire purpose is to surface misunderstandings *before* code gets written — assumptions are the most dangerous form of misunderstanding.

**Write a spec document covering these six core areas:**

1. **Objective** — What are we building and why? Who is the user? What does success look like?

2. **Commands** — Full executable commands with flags, not just tool names.
   ```
   Build: npm run build
   Test: npm test -- --coverage
   Lint: npm run lint --fix
   Dev: npm run dev
   ```

3. **Project Structure** — Where source code lives, where tests go, where docs belong.
   ```
   src/           → Application source code
   src/components → React components
   src/lib        → Shared utilities
   tests/         → Unit and integration tests
   e2e/           → End-to-end tests
   docs/          → Documentation
   ```

4. **Code Style** — One real code snippet showing your style beats three paragraphs describing it. Include naming conventions, formatting rules, and examples of good output.

5. **Testing Strategy** — What framework, where tests live, coverage expectations, which test levels for which concerns.

6. **Boundaries** — Three-tier system:
   - **Always do:** Run tests before commits, follow naming conventions, validate inputs
   - **Ask first:** Database schema changes, adding dependencies, changing CI config
   - **Never do:** Commit secrets, edit vendor directories, remove failing tests without approval

**Spec template:**

```markdown
# Spec: [Project/Feature Name]

## Objective
[What we're building and why. User stories or acceptance criteria.]

## Tech Stack
[Framework, language, key dependencies with versions]

## Commands
[Build, test, lint, dev — full commands]

## Project Structure
[Directory layout with descriptions]

## Code Style
[Example snippet + key conventions]

## Testing Strategy
[Framework, test locations, coverage requirements, test levels]

## Boundaries
- Always: [...]
- Ask first: [...]
- Never: [...]

## Success Criteria
[How we'll know this is done — specific, testable conditions]

## Open Questions
[Anything unresolved that needs human input]
```

**Reframe instructions as success criteria.** When receiving vague requirements, translate them into concrete conditions:

```
REQUIREMENT: "Make the dashboard faster"

REFRAMED SUCCESS CRITERIA:
- Dashboard LCP < 2.5s on 4G connection
- Initial data load completes in < 500ms
- No layout shift during load (CLS < 0.1)
→ Are these the right targets?
```

This lets you loop, retry, and problem-solve toward a clear goal rather than guessing what "faster" means.

**Run an inline blocker-oriented self-review loop after drafting.** Once the SPEC draft covers the required sections, evaluate it before saving or presenting it. This is the default `$spec` quality gate. Block only on issues likely to cause flawed planning:

- TODO, TBD, placeholder text, or incomplete required sections
- Internal contradictions between objective, scope, commands, testing, boundaries, or success criteria
- Ambiguity that could lead the planner to design the wrong implementation
- Scope too broad for one coherent implementation plan
- Unrequested features, speculative architecture, or over-engineering beyond the user's request
- Success criteria that are too abstract to verify
- Necessary unresolved questions that are missing from `Open Questions`

Revise the SPEC and repeat the inline self-review until there are no blockers or a focused user question is required. Do not block on wording polish, stylistic preferences, formatting preferences, or nice-to-have additions.

Subagent-assisted SPEC evaluation may be used only when both conditions are true:

1. The current user request explicitly authorizes subagents, delegation, or parallel agent work.
2. The runtime exposes the needed subagent tools.

When those conditions are met, use `agents/spec-evaluator.md` as the prompt template. In Claude Code, use the named `spec-evaluator` agent when available. In Codex, if named plugin agents are not directly available but generic subagents are explicitly authorized and available, pass the evaluator prompt template with the draft SPEC, the original request and relevant conversation constraints, and the blocker checklist above. The evaluator must return only blocker findings, `question needed`, or `no blockers`; it must not rewrite the SPEC or ask the user directly.

The main agent owns revisions, user questions, artifact saving, and deciding whether another evaluator pass is needed. If required information is missing, ask only the clarifying question or related small set of questions needed to unblock the current SPEC phase. Prefer one focused question, but ask multiple related questions when one answer would not resolve the ambiguity.

### Phase 2: Plan

With the validated spec, generate a technical implementation plan:

1. Identify the major components and their dependencies
2. Determine the implementation order (what must be built first)
3. Note risks and mitigation strategies
4. Identify what can be built in parallel vs. what must be sequential
5. Define verification checkpoints between phases

The plan should be reviewable: the human should be able to read it and say "yes, that's the right approach" or "no, change X."

### Phase 3: Tasks

Break the plan into discrete, implementable tasks:

- Each task should be completable in a single focused session
- Each task has explicit acceptance criteria
- Each task includes a verification step (test, build, manual check)
- Tasks are ordered by dependency, not by perceived importance
- No task should require changing more than ~5 files

**Task template:**
```markdown
- [ ] Task: [Description]
  - Acceptance: [What must be true when done]
  - Verify: [How to confirm — test command, build, manual check]
  - Files: [Which files will be touched]
```

### Phase 4: Implement

Execute tasks one at a time following `skills/incremental-implementation/SKILL.md` (`incremental-implementation`) and `skills/test-driven-development/SKILL.md` (`test-driven-development`). Use `skills/context-engineering/SKILL.md` (`context-engineering`) to load the right spec sections and source files at each step rather than flooding the agent with the entire spec.

## Keeping the Spec Alive

The spec is a living document, not a one-time artifact:

- **Update when decisions change** — If you discover the data model needs to change, update the spec first, then implement.
- **Update when scope changes** — Features added or cut should be reflected in the spec.
- **Keep the spec discoverable** — MDF workflow specs live under `.mdf/work/{work_id}/` by default and are indexed in `.mdf/index.jsonl`.
- **Promote only when needed** — Commit a spec to tracked project docs only when the user explicitly asks or project policy requires it.
- **Reference the spec in PRs when available** — Link to the tracked spec if promoted; otherwise summarize the relevant MDF spec artifact.

For MDF workflow artifacts, save specs under the current work item by default. Before saving, verify MDF user and project init state; if init state is missing, stop and instruct the user to run `mdf init`.

```text
<canonical-root>/.mdf/work/{work_id}/spec-NNN.md
```

Resolve `canonical_root` and `work_id` from the active lock first. If there is no active lock, create an implicit work item. Repeated spec runs create `spec-001.md`, `spec-002.md`, and so on; update `item.md` `latest.spec` and `.mdf/index.jsonl`. Only promote a spec into tracked project docs, such as `SPEC.md`, when the user explicitly asks or project policy requires it.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "This is simple, I don't need a spec" | Simple tasks don't need *long* specs, but they still need acceptance criteria. A two-line spec is fine. |
| "I'll write the spec after I code it" | That's documentation, not specification. The spec's value is in forcing clarity *before* code. |
| "The spec will slow us down" | A 15-minute spec prevents hours of rework. Waterfall in 15 minutes beats debugging in 15 hours. |
| "Requirements will change anyway" | That's why the spec is a living document. An outdated spec is still better than no spec. |
| "The user knows what they want" | Even clear requests have implicit assumptions. The spec surfaces those assumptions. |

## Red Flags

- Starting to write code without any written requirements
- Asking "should I just start building?" before clarifying what "done" means
- Implementing features not mentioned in any spec or task list
- Making architectural decisions without documenting them
- Skipping the spec because "it's obvious what to build"

## Verification

Before proceeding to implementation, confirm:

- [ ] The spec covers all six core areas
- [ ] The human has reviewed and approved the spec
- [ ] Success criteria are specific and testable
- [ ] Boundaries (Always/Ask First/Never) are defined
- [ ] The blocker-oriented evaluator loop found no planning-blocking issues
- [ ] The spec is saved to `.mdf/work/{work_id}/spec-NNN.md`, or to a tracked repository file only when explicitly requested

For `auto-workflow`, human review and approval of a saved spec artifact is a
manual checkpoint only when a real decision, `question needed`, or missing
required information remains. If the blocker-oriented evaluator loop found no
planning-blocking issues and the spec entrypoint is running in auto-workflow
mode, the workflow may continue to planning without an extra manual approval
turn. This does not change `interview-me` criteria or its explicit confirmation
gate.
