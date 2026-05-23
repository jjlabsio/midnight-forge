# Agent Skills MDF Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vendor the original agent-skills workflow bundle into Midnight Forge as native Codex plugin skills while preserving the original workflow semantics.

**Architecture:** Keep Midnight Forge's plugin mechanics unchanged: `.codex-plugin/plugin.json` and `.claude-plugin/plugin.json` continue to expose the root `skills/` directory. Copy original agent-skills `skills/`, `references/`, and `agents/` into the repository, then add thin Codex-native entrypoint skills for the original Claude commands. Add a local validation script that checks file presence, routing descriptions, entrypoint semantics, JSON manifests, and documented collision tradeoffs.

**Tech Stack:** Markdown skill files, JSON plugin manifests, Node.js validation script, git worktree branch `task-001-agent-skills-mdf`.

---

### Task 1: Validation Guard

**Files:**
- Create: `scripts/validate-agent-skills-port.js`

- [ ] **Step 1: Write the failing validation script**

Create a Node.js script that asserts:
- There are 23 original agent-skills directories under `skills/`.
- `references/` contains the five original checklist/reference files.
- `agents/` contains `README.md`, `code-reviewer.md`, `security-auditor.md`, and `test-engineer.md`.
- Entry skills exist for `spec`, `plan`, `build`, `test`, `review`, `code-simplify`, and `ship`.
- Entrypoint frontmatter descriptions contain practical trigger phrases.
- Entrypoints preserve conditional workflow semantics from the original commands.
- `using-agent-skills` has strong Codex-oriented routing metadata.
- Plugin JSON files parse and still point at `./skills/`.

- [ ] **Step 2: Run validation to verify RED**

Run: `node scripts/validate-agent-skills-port.js`

Expected: FAIL because the vendored skills and entrypoint skills do not exist yet.

### Task 2: Vendor Original Bundle

**Files:**
- Create: `references/*.md`
- Create: `agents/*.md`
- Create: `skills/<agent-skill>/SKILL.md`

- [ ] **Step 1: Copy original agent-skills assets**

Copy from `/Users/jaejinsong/code/projects/plugins/agent-skills`:
- `skills/*` into `skills/`
- `references/` into `references/`
- `agents/` into `agents/`

- [ ] **Step 2: Check for name collisions**

Run: `find skills -mindepth 1 -maxdepth 1 -type d -print | sort`

Expected: existing MDF skills remain and original agent-skills names are added. Document the `test-driven-development` collision risk in `references/agent-skills-port-notes.md` instead of renaming, because preserving original names is required unless a concrete collision forces a change.

### Task 3: Codex Entrypoints and Meta Skill

**Files:**
- Create: `skills/spec/SKILL.md`
- Create: `skills/plan/SKILL.md`
- Create: `skills/build/SKILL.md`
- Create: `skills/test/SKILL.md`
- Create: `skills/review/SKILL.md`
- Create: `skills/code-simplify/SKILL.md`
- Create: `skills/ship/SKILL.md`
- Modify: `skills/using-agent-skills/SKILL.md`

- [ ] **Step 1: Add thin entrypoint wrappers**

Convert each original `.claude/commands/*.md` file into a Codex-native skill. Keep the original command content and add frontmatter with `name` and trigger-rich `description`.

- [ ] **Step 2: Preserve conditional semantics**

Ensure wrappers do not invoke every related skill unconditionally:
- `spec` starts with `spec-driven-development`.
- `plan` starts with `planning-and-task-breakdown`, stays read-only, and writes `tasks/plan.md` and `tasks/todo.md`.
- `build` starts with `incremental-implementation` and `test-driven-development`, using `debugging-and-error-recovery` only on failure.
- `test` uses `browser-testing-with-devtools` only for browser issues.
- `review` uses security/performance skills only for those review depths.
- `code-simplify` uses `code-review-and-quality` only after simplification.
- `ship` preserves fan-out, fallback, and small-change skip semantics.

- [ ] **Step 3: Strengthen `using-agent-skills`**

Update its metadata and routing text so Codex reliably considers it for spec, plan, build, test, review, simplify, ship, debugging, UI, API/interface, security, performance, documentation, migration, and general development workflow decisions.

### Task 4: Docs and Verification

**Files:**
- Modify: `README.md`
- Create: `references/agent-skills-port-notes.md`

- [ ] **Step 1: Document the expanded workflow surface**

Update README scope and invocation examples for the new entrypoint skills while preserving existing MDF task docs.

- [ ] **Step 2: Run full verification**

Run:
- `node scripts/validate-agent-skills-port.js`
- `node -e 'JSON.parse(require("fs").readFileSync(".codex-plugin/plugin.json", "utf8")); JSON.parse(require("fs").readFileSync(".claude-plugin/plugin.json", "utf8")); JSON.parse(require("fs").readFileSync(".agents/plugins/marketplace.json", "utf8")); JSON.parse(require("fs").readFileSync(".claude-plugin/marketplace.json", "utf8")); console.log("json ok")'`
- `find skills -mindepth 2 -maxdepth 2 -name SKILL.md | sort`

Expected: validation passes, JSON parses, and skills are discoverable under `skills/`.
