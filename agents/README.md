# Agent Personas

Specialist personas that play a single role with a single perspective. In Midnight Forge they are Codex subagent prompts and prompt templates, not a separate plugin agent surface.

| Persona | Role | Best for |
|---------|------|----------|
| [code-reviewer](code-reviewer.md) | Senior Staff Engineer | Five-axis review before merge |
| [security-auditor](security-auditor.md) | Security Engineer | Vulnerability detection, OWASP-style audit |
| [test-engineer](test-engineer.md) | QA Engineer | Test strategy, coverage analysis, Prove-It pattern |
| [spec-evaluator](spec-evaluator.md) | SPEC Evaluator | Fresh-context SPEC review |
| [plan-evaluator](plan-evaluator.md) | Plan Evaluator | Fresh-context plan review |

## How Personas Relate To Skills And Commands

Three layers, each with a distinct job:

| Layer | What it is | Example | Composition role |
|-------|-----------|---------|------------------|
| **Skill** | A workflow with steps and exit criteria | `code-review-and-quality` | The *how* - invoked from inside a persona or command |
| **Persona** | A role with a perspective and an output format | `code-reviewer` | The *who* - adopts a viewpoint, produces a report |
| **Command** | A user-facing entry point | `$review`, `$ship` | The *when* - composes personas and skills |

The user, an entrypoint skill, or a workflow skill is the orchestrator. **Personas do not call other personas.** Skills are mandatory hops inside a persona's workflow.

## When To Use Each

### Direct Persona Invocation

Pick this when you want one perspective on the current change and the user is in the loop.

- "Review this PR" -> invoke `code-reviewer` directly
- "Are there security issues in `auth.ts`?" -> invoke `security-auditor` directly
- "What tests are missing for the checkout flow?" -> invoke `test-engineer` directly
- "Does this SPEC cover the intended behavior?" -> invoke `spec-evaluator` directly
- "Does this plan preserve the approved SPEC?" -> invoke `plan-evaluator` directly

### Entrypoint Skill

Pick this when there's a repeatable workflow you'd otherwise re-explain every time.

- `$review` -> wraps `code-reviewer` with the project's review skill
- `$test` -> wraps `test-engineer` with TDD or standalone verification guidance
- `$spec` -> creates and evaluates a SPEC through the MDF spec workflow
- `$plan` -> creates and evaluates implementation tasks through the MDF planning workflow

### Entrypoint Skill Fan-Out

Pick this when **independent** investigations can run in parallel and produce reports that a single agent then merges.

- `$ship` -> fans out to `code-reviewer` + `security-auditor` + `test-engineer` in parallel, then synthesizes their reports into a go/no-go decision

This is the only orchestration pattern this repo endorses. See [references/orchestration-patterns.md](../references/orchestration-patterns.md) for the full pattern catalog and anti-patterns.

## Decision Matrix

```text
Is the work a single perspective on a single artifact?
|-- Yes -> Is this a useful fresh-context pass for a spec/plan draft?
|   |-- Yes -> Evaluator prompt template (`spec-evaluator` or `plan-evaluator`)
|   `-- No  -> Direct persona invocation, preferably as a subagent when useful
`-- No  -> Are the sub-tasks independent (no shared mutable state, no ordering)?
    |-- Yes -> Entrypoint skill with parallel fan-out (e.g. $ship) or parallel subagents
    `-- No  -> Sequential entrypoint skills run by the user ($spec -> $plan -> $build -> $test -> $review)
```

## Worked Example: Valid Orchestration

`$ship` is the canonical fan-out orchestrator in this repo:

```text
$ship
  |-- (parallel) code-reviewer    -> review report
  |-- (parallel) security-auditor -> audit report
  `-- (parallel) test-engineer    -> coverage report
                  |
        merge phase (main agent)
                  |
        go/no-go decision + rollback plan
```

Why this works:

- Each subagent operates on the same diff but produces a **different perspective**
- They have no dependencies on each other, so the work is genuinely parallel
- Each runs in a fresh context window
- The merge step is small and benefits from full context, so it stays in the main agent

## Worked Example: Invalid Orchestration

A `meta-orchestrator` persona whose job is "decide which other persona to call":

```text
$work-on-pr -> meta-orchestrator
                  |
                  | decides "this needs a review"
                  v
              code-reviewer
                  |
                  v
              meta-orchestrator (paraphrases result)
                  |
                  v
                user
```

Why this fails:

- Pure routing layer with no domain value
- Adds two paraphrasing hops, increasing information loss and cost
- The user or entrypoint skill already knows they want a review; let them call `$review` directly
- Replicates work that entrypoint skills and intent mapping already do

## Rules For Personas

1. A persona is a single role with a single output format. If you find yourself adding a second role, create a second persona.
2. **Personas do not invoke other personas.** Composition is the job of entrypoint skills, workflow skills, or the user.
3. A persona may invoke skills (the *how*).
4. Every persona file ends with a Composition block stating where it fits.

## Codex And MDF Interop

Use subagents proactively for independent review, parallel investigation, and fresh-context checks when the runtime exposes subagent tools. Fall back to inline review only when those tools are unavailable or the task is too small to benefit.

Subagents report results back to the main agent. The main agent owns user questions, revisions, artifact saving, synthesis, and deciding whether another evaluator pass is needed.

Evaluator personas are not public commands. They are prompt templates for fresh-context SPEC and plan review when those reviews add meaningful signal.

## Adding A New Persona

1. Create `agents/<role>.md` with the same frontmatter format used by existing personas.
2. Define the role, scope, output format, and rules.
3. Add a **Composition** block at the bottom (Invoke directly when / Invoke via / Do not invoke from another persona).
4. Add the persona to the table at the top of this file.
5. If the persona enables a new orchestration pattern, document it in `references/orchestration-patterns.md` rather than inventing the pattern in the persona file itself.
