---
name: documentation-and-adrs
description: Records decisions and documentation. Use when making architectural decisions, changing public APIs, shipping features, or when you need to record context that future engineers and agents will need to understand the codebase.
---

# Documentation and ADRs

When saving local decision notes or ADR-style workflow artifacts, resolve the current MDF work item and write `.mdf/work/{work_id}/decision-NNN.md` by default. Only promote a decision into tracked project docs when the user explicitly asks or project policy requires a durable reviewed document.

Before writing tracked project docs, discover the project's docs rules and taxonomy. Existing tracked docs policy files and structure are the source of truth; MDF defaults apply only when no stronger project convention exists.

## Overview

Document decisions, not just code. The most valuable documentation captures the *why* — the context, constraints, and trade-offs that led to a decision. Code shows *what* was built; documentation explains *why it was built this way* and *what alternatives were considered*. This context is essential for future humans and agents working in the codebase.

## Durable Tracked Docs Placement

Tracked project docs are durable shared documentation that will be committed to the repository. Local MDF artifacts under `.mdf/work/{work_id}/` remain the default for workflow notes, draft decisions, specs, plans, reviews, and ship evidence.

Before writing or updating tracked project docs:

1. Resolve the canonical project root. If running under `<canonical-root>/.worktrees/<branch>`, use `<canonical-root>` for docs discovery and `.mdf` state.
2. Read likely docs policy files when present: `docs/AGENTS.md`, `docs/CLAUDE.md`, `AGENTS.md`, `CLAUDE.md`, `docs/index.md`, and root `README.md`.
3. Inspect existing docs taxonomy, especially `docs/index.md`, area indexes, existing `docs/architecture/`, `docs/decisions/`, `docs/operations/`, feature/system-local `spec.md` and `decisions.md`, and any project-specific decision templates.
4. Prefer the project's existing convention over MDF defaults.
5. If multiple tracked-doc destinations are plausible, or confidence is not high, stop before writing tracked docs and ask which convention to follow.

For monorepos with no stronger existing convention, durable project-wide architecture, product, migration, and operations decisions default to the canonical root `docs/`, not `apps/*/docs` or `packages/*/docs`. App/package-local docs are appropriate only when the existing project convention clearly scopes that documentation to a local feature, package, or system boundary.

When MDF must apply a fallback decision convention, use root-level `docs/decisions/` organized by area or design unit:

```text
docs/decisions/<area-or-design-unit>/<decision-slug>.md
```

Avoid date-only filenames, a single global numbered ADR sequence, or placing durable decisions solely near the implementation file unless the project already uses that convention.

### Docs Profile Cache

To avoid rediscovering the same docs structure on every run, maintain a project-local docs profile cache under the canonical project root:

```text
<canonical-root>/.mdf/project/docs-profile.json
<canonical-root>/.mdf/project/docs-profile.md
```

Do not create this cache inside linked worktrees. Do not store it as primary state under `~/.mdf`; the global `~/.mdf/projects.json` registry remains only a thin project index. Before writing `.mdf/project/docs-profile.*`, verify that `<canonical-root>/.mdf/` is ignored by git using the same `.mdf/` guard as the task and artifact storage workflows.

The docs profile cache is an interpretation cache, not the source of truth. Tracked docs policy files and the tracked docs tree remain authoritative. Use the cache only when it is fresh and high-confidence.

The JSON profile should record enough evidence for future agents to trust or invalidate it:

```json
{
  "version": 1,
  "canonical_root": "/absolute/project/root",
  "generated_at": "2026-06-07T00:00:00Z",
  "source_files": [
    {
      "path": "docs/index.md",
      "sha256": "hex",
      "mtime": "2026-06-07T00:00:00Z"
    }
  ],
  "known_absent_source_files": [
    "docs/AGENTS.md",
    "docs/CLAUDE.md"
  ],
  "detected_taxonomy": {
    "docs_root": "docs",
    "architecture": "docs/architecture",
    "decisions": "docs/decisions",
    "operations": "docs/operations"
  },
  "decision_placement": {
    "default": "docs/decisions/<area-or-design-unit>/<decision-slug>.md",
    "monorepo_scope": "canonical-root-docs",
    "preserve_existing_feature_or_system_local_decisions": true
  },
  "index_update_rules": [
    "Update docs/index.md when adding a new top-level docs area.",
    "Update area index files when the existing taxonomy uses them."
  ],
  "confidence": "high",
  "ambiguities": []
}
```

Invalidate or rescan the profile when any recorded source file changes by hash or mtime, when a likely docs policy/index file appears or disappears, when a previously absent source file now exists, or when existing decision docs indicate a different convention than the cached profile. If the cache is missing, stale, low-confidence, or ambiguous, rescan before using it. If rescanning still leaves more than one plausible destination, stop before tracked writes and ask the user.

## When to Use

- Making a significant architectural decision
- Choosing between competing approaches
- Adding or changing a public API
- Shipping a feature that changes user-facing behavior
- Onboarding new team members (or agents) to the project
- When you find yourself explaining the same thing repeatedly

**When NOT to use:** Don't document obvious code. Don't add comments that restate what the code already says. Don't write docs for throwaway prototypes.

## Decision Records

Decision records capture the reasoning behind significant technical and product decisions. They're the highest-value documentation you can write.

### When to Write a Decision Record

- Choosing a framework, library, or major dependency
- Designing a data model or database schema
- Selecting an authentication strategy
- Deciding on an API architecture (REST vs. GraphQL vs. tRPC)
- Choosing between build tools, hosting platforms, or infrastructure
- Any decision that would be expensive to reverse

### Decision Record Template

Use the project's discovered decision convention. If MDF fallback rules apply, store decisions under `docs/decisions/<area-or-design-unit>/<decision-slug>.md`:

```markdown
# Use PostgreSQL for primary database

## Status
Accepted | Superseded | Deprecated

## Date
2025-01-15

## Context
We need a primary database for the task management application. Key requirements:
- Relational data model (users, tasks, teams with relationships)
- ACID transactions for task state changes
- Support for full-text search on task content
- Managed hosting available (for small team, limited ops capacity)

## Decision
Use PostgreSQL with Prisma ORM.

## Alternatives Considered

### MongoDB
- Pros: Flexible schema, easy to start with
- Cons: Our data is inherently relational; would need to manage relationships manually
- Rejected: Relational data in a document store leads to complex joins or data duplication

### SQLite
- Pros: Zero configuration, embedded, fast for reads
- Cons: Limited concurrent write support, no managed hosting for production
- Rejected: Not suitable for multi-user web application in production

### MySQL
- Pros: Mature, widely supported
- Cons: PostgreSQL has better JSON support, full-text search, and ecosystem tooling
- Rejected: PostgreSQL is the better fit for our feature requirements

## Consequences
- Prisma provides type-safe database access and migration management
- We can use PostgreSQL's full-text search instead of adding Elasticsearch
- Team needs PostgreSQL knowledge (standard skill, low risk)
- Hosting on managed service (Supabase, Neon, or RDS)
```

### Decision Record Lifecycle

```
PROPOSED → ACCEPTED → (SUPERSEDED or DEPRECATED)
```

- **Don't delete old decision records.** They capture historical context.
- When a decision changes, write a new decision record that references and supersedes the old one according to the project's discovered convention.

## Inline Documentation

### When to Comment

Comment the *why*, not the *what*:

```typescript
// BAD: Restates the code
// Increment counter by 1
counter += 1;

// GOOD: Explains non-obvious intent
// Rate limit uses a sliding window — reset counter at window boundary,
// not on a fixed schedule, to prevent burst attacks at window edges
if (now - windowStart > WINDOW_SIZE_MS) {
  counter = 0;
  windowStart = now;
}
```

### When NOT to Comment

```typescript
// Don't comment self-explanatory code
function calculateTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

// Don't leave TODO comments for things you should just do now
// TODO: add error handling  ← Just add it

// Don't leave commented-out code
// const oldImplementation = () => { ... }  ← Delete it, git has history
```

### Document Known Gotchas

```typescript
/**
 * IMPORTANT: This function must be called before the first render.
 * If called after hydration, it causes a flash of unstyled content
 * because the theme context isn't available during SSR.
 *
 * See ADR-003 for the full design rationale.
 */
export function initializeTheme(theme: Theme): void {
  // ...
}
```

## API Documentation

For public APIs (REST, GraphQL, library interfaces):

### Inline with Types (Preferred for TypeScript)

```typescript
/**
 * Creates a new task.
 *
 * @param input - Task creation data (title required, description optional)
 * @returns The created task with server-generated ID and timestamps
 * @throws {ValidationError} If title is empty or exceeds 200 characters
 * @throws {AuthenticationError} If the user is not authenticated
 *
 * @example
 * const task = await createTask({ title: 'Buy groceries' });
 * console.log(task.id); // "task_abc123"
 */
export async function createTask(input: CreateTaskInput): Promise<Task> {
  // ...
}
```

### OpenAPI / Swagger for REST APIs

```yaml
paths:
  /api/tasks:
    post:
      summary: Create a task
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateTaskInput'
      responses:
        '201':
          description: Task created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Task'
        '422':
          description: Validation error
```

## README Structure

Every project should have a README that covers:

```markdown
# Project Name

One-paragraph description of what this project does.

## Quick Start
1. Clone the repo
2. Install dependencies: `npm install`
3. Set up environment: `cp .env.example .env`
4. Run the dev server: `npm run dev`

## Commands
| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm test` | Run tests |
| `npm run build` | Production build |
| `npm run lint` | Run linter |

## Architecture
Brief overview of the project structure and key design decisions.
Link to decision records for details.

## Contributing
How to contribute, coding standards, PR process.
```

## Changelog Maintenance

For shipped features:

```markdown
# Changelog

## [1.2.0] - 2025-01-20
### Added
- Task sharing: users can share tasks with team members (#123)
- Email notifications for task assignments (#124)

### Fixed
- Duplicate tasks appearing when rapidly clicking create button (#125)

### Changed
- Task list now loads 50 items per page (was 20) for better UX (#126)
```

## Documentation for Agents

Special consideration for AI agent context:

- **CLAUDE.md / rules files** — Document project conventions so agents follow them
- **Spec files** — Keep specs updated so agents build the right thing
- **Decision records** — Help agents understand why past decisions were made (prevents re-deciding)
- **Inline gotchas** — Prevent agents from falling into known traps

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "The code is self-documenting" | Code shows what. It doesn't show why, what alternatives were rejected, or what constraints apply. |
| "We'll write docs when the API stabilizes" | APIs stabilize faster when you document them. The doc is the first test of the design. |
| "Nobody reads docs" | Agents do. Future engineers do. Your 3-months-later self does. |
| "Decision records are overhead" | A 10-minute decision record prevents a 2-hour debate about the same decision six months later. |
| "Comments get outdated" | Comments on *why* are stable. Comments on *what* get outdated — that's why you only write the former. |

## Red Flags

- Architectural decisions with no written rationale
- Public APIs with no documentation or types
- README that doesn't explain how to run the project
- Commented-out code instead of deletion
- TODO comments that have been there for weeks
- No decision records in a project with significant architectural choices
- Documentation that restates the code instead of explaining intent

## Verification

After documenting:

- [ ] Decision records exist for all significant architectural decisions required by project policy
- [ ] README covers quick start, commands, and architecture overview
- [ ] API functions have parameter and return type documentation
- [ ] Known gotchas are documented inline where they matter
- [ ] No commented-out code remains
- [ ] Rules files (CLAUDE.md etc.) are current and accurate
