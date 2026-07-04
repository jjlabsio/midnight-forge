# Agent Personas

Specialist personas that play a single role with a single perspective. In Midnight Forge they are Codex prompt templates, not a separate plugin agent surface.

| Persona | Role | Best for |
|---------|------|----------|
| [code-reviewer](code-reviewer.md) | Senior Staff Engineer | Five-axis review before merge |
| [security-auditor](security-auditor.md) | Security Engineer | Vulnerability detection, OWASP-style audit |
| [test-engineer](test-engineer.md) | QA Engineer | Test strategy, coverage analysis, Prove-It pattern |
| [spec-evaluator](spec-evaluator.md) | SPEC Evaluator | Optional prompt template for explicitly authorized SPEC subagent review |
| [plan-evaluator](plan-evaluator.md) | Plan Evaluator | Optional prompt template for explicitly authorized plan subagent review |

## Codex Usage

Use inline workflow review by default. Use these persona files as optional prompt templates only when the current user explicitly authorizes subagents, delegation, or parallel agent work and the runtime exposes the needed tools.

Evaluator personas are not public commands. The main agent owns user questions, revisions, artifact saving, inline review by default, and deciding whether another evaluator pass is needed.

## Decision Matrix

```text
Is the work a single perspective on a single artifact?
  Yes -> Is this an explicitly authorized subagent pass for a spec/plan draft?
    Yes -> Evaluator prompt template (`spec-evaluator` or `plan-evaluator`)
    No  -> Direct persona invocation or inline workflow review
  No  -> Are the sub-tasks independent with no shared mutable state or ordering?
    Yes -> `$ship` fan-out when explicitly authorized
    No  -> Sequential entrypoint skills run by the user (`$spec` -> `$plan` -> `$build` -> `$test` -> `$review`)
```

## Rules

1. A persona is a single role with a single output format. If you find yourself adding a second role, create a second persona.
2. Personas do not invoke other personas. Composition is the job of entrypoint skills, workflow skills, or the user.
3. A persona may invoke skills.
4. Every persona file ends with a Composition block stating where it fits.

## Adding A New Persona

1. Create `agents/<role>.md` with the same frontmatter format used by existing personas.
2. Define the role, scope, output format, and rules.
3. Add a Composition block at the bottom.
4. Add the persona to the table at the top of this file.
5. If the persona enables a new orchestration pattern, document it in `references/orchestration-patterns.md` rather than inventing the pattern in the persona file itself.
