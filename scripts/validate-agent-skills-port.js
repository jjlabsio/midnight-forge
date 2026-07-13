#!/usr/bin/env node

/*
 * This is a contract test, not a prose linter.  agent-skills owns primitive
 * workflow semantics; MDF owns the Codex controllers and runtime adaptation.
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { loadInventory } = require("./overlay-inventory");

const root = path.resolve(__dirname, "..");
const vendorRoot = path.join(root, "vendor", "agent-skills");
const inventory = loadInventory(path.join(root, "overlays", "mdf", "inventory.json"));
const failures = [];

const controllers = ["spec", "plan", "build", "review", "auto-workflow", "use-mdf", "code-simplify", "ship", "test", "webperf"];

function read(filePath) {
  return fs.readFileSync(filePath);
}

function text(filePath) {
  return read(filePath).toString("utf8");
}

function exists(filePath) {
  return fs.existsSync(filePath);
}

function filesUnder(basePath, relativePath = "") {
  const absolute = path.join(basePath, relativePath);
  if (!exists(absolute)) return [];
  const stat = fs.statSync(absolute);
  if (stat.isFile()) return [relativePath];
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) =>
    filesUnder(basePath, path.join(relativePath, entry.name))
  );
}

const immutable = [
  ...filesUnder(vendorRoot, "skills"),
  ...filesUnder(vendorRoot, "agents"),
  ...filesUnder(vendorRoot, "references"),
  "docs/agents.md",
];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function entryFor(output) {
  return inventory.generated.entries.find((entry) => entry.output === output);
}

function assertContains(relativePath, needle) {
  const filePath = path.join(root, relativePath);
  assert(exists(filePath), `Missing ${relativePath}`);
  if (exists(filePath)) {
    const normalized = text(filePath).replace(/\s+/g, " ");
    assert(normalized.includes(needle.replace(/\s+/g, " ")), `${relativePath} must include ${JSON.stringify(needle)}`);
  }
}

function assertNotContains(relativePath, needle) {
  const filePath = path.join(root, relativePath);
  assert(exists(filePath), `Missing ${relativePath}`);
  if (exists(filePath)) assert(!text(filePath).includes(needle), `${relativePath} must not include ${JSON.stringify(needle)}`);
}

const seen = new Set();
for (const entry of inventory.generated.entries) {
  assert(!seen.has(entry.output), `${entry.output} appears more than once in inventory`);
  seen.add(entry.output);
  assert(entry.classification !== "upstream-drift-preserved", `${entry.output} cannot preserve upstream drift`);
  if (entry.overlayKind === "replacement" && entry.source) {
    assert(false, `${entry.output} cannot use a source-backed full replacement`);
  }
  if (/^(skills|agents|references|docs)\//.test(entry.source || "") && entry.output !== entry.source) {
    assert(controllers.some((name) => entry.output === `skills/${name}/SKILL.md`), `${entry.output} is an unallowlisted adapter for ${entry.source}`);
  }
}

for (const output of immutable) {
  const entry = entryFor(output);
  const source = output;
  const generatedPath = path.join(root, output);
  const vendorPath = path.join(vendorRoot, source);
  assert(entry, `Missing immutable inventory entry for ${output}`);
  if (entry) {
    assert(entry.source === source, `${output} must source ${source}`);
    assert(entry.classification === "upstream-identical", `${output} must be classified upstream-identical`);
    assert((entry.overlayKind || "copy") === "copy", `${output} must use copy overlay kind`);
    assert(!entry.overlay, `${output} cannot use an overlay replacement`);
    assert(!entry.policyInjection, `${output} cannot inject MDF policy`);
    assert(!entry.exactPatches || entry.exactPatches.length === 0, `${output} cannot patch upstream content`);
  }
  assert(exists(vendorPath), `Missing pinned upstream source ${source}`);
  assert(exists(generatedPath), `Missing generated immutable surface ${output}`);
  if (exists(vendorPath) && exists(generatedPath)) {
    assert(Buffer.compare(read(vendorPath), read(generatedPath)) === 0, `${output} must be byte-identical to vendor/${source}`);
  }
}

for (const removed of ["agents/spec-evaluator.md", "agents/plan-evaluator.md"]) {
  assert(!entryFor(removed), `${removed} must not remain in inventory`);
  assert(!exists(path.join(root, removed)), `${removed} must not be generated`);
}

for (const name of controllers) {
  const output = `skills/${name}/SKILL.md`;
  const entry = entryFor(output);
  assert(entry, `Missing MDF controller inventory entry for ${output}`);
  if (entry) assert(!immutable.includes(output), `${output} must remain a controller, not an upstream primitive`);
  assertContains(output, "plugin root");
}

// Static adapter-closure checks ensure generated controllers keep their declared
// upstream handoffs without importing a controller runtime model.
for (const needle of [
  "exact canonical artifact revision/hash",
  "approval-NNN.md",
  "invalidate prior approval",
  "explicit affirmative user approval",
]) assertContains("skills/spec/SKILL.md", needle);
for (const needle of [
  "exact canonical artifact revision/hash",
  "approval-NNN.md",
  "invalidate prior approval",
  "explicit affirmative user approval",
]) assertContains("skills/plan/SKILL.md", needle);
for (const needle of [
  "exactly one selected or next pending task",
  "fresh-context upstream code review",
  "downstream-impact gate",
  "all approved plan tasks",
  "build auto", "build all",
  "clean baseline", "git status --porcelain", "git add --", "one commit per task", "resume",
]) assertContains("skills/build/SKILL.md", needle);
for (const needle of [
  "flat root orchestrator", "explicit spec approval", "explicit plan approval",
  "one-writer", "root-only synthesis", "all approved plan tasks",
  "do not run a duplicate standalone review", "whole-build review -> simplify -> ship",
  "Do not reopen a completed task", "new canonical plan revision", "ordinary task workflow",
  "There is no fixed repair-count limit", "no-progress",
]) assertContains("skills/auto-workflow/SKILL.md", needle);
for (const needle of [
  "generic subagent", "exact selected persona prompt", "capability", "root fallback",
]) assertContains("skills/use-mdf/SKILL.md", needle);
assertContains("skills/code-simplify/SKILL.md", "AGENTS.md");
assertContains("skills/code-simplify/SKILL.md", "exact unchanged HEAD");
assertNotContains("skills/code-simplify/SKILL.md", "obtain a separate upstream code review");
assertNotContains("skills/code-simplify/SKILL.md", "Read CLAUDE.md and study project conventions");
for (const needle of ["parallel", "code-reviewer", "security-auditor", "test-engineer", "GO/NO-GO"]) {
  assertContains("skills/ship/SKILL.md", needle);
}
for (const needle of ["Callers pass only", "raw command outputs", "never pass", "Release selection"]) assertContains("skills/github-pr/SKILL.md", needle);
for (const needle of [
  "review-specific resolver", "strict active-lock resolver", "completed task can be reviewed read-only",
  "lifecycle-review", "task-review", "cannot create lifecycle evidence", "review_mode",
]) assertContains("skills/review/SKILL.md", needle);
for (const needle of [
  "Review provenance boundary", "strict active-lock resolver", "completed-task review",
  "lifecycle-review", "task-review", "review_mode", "lifecycle and ship consumers accept only",
]) assertContains("skills/github-pr/SKILL.md", needle);
for (const output of ["skills/task/SKILL.md", "overlays/mdf/replacements/skills/task/SKILL.md"]) {
  for (const needle of [
    "non-idempotent task mutation",
    "already-completed handoff path",
    "does not invoke `done` or mutate the task card",
  ]) assertContains(output, needle);
}
for (const output of ["skills/github-pr/SKILL.md", "overlays/mdf/replacements/skills/github-pr/SKILL.md"]) {
  assertContains(output, "completes an incomplete current-session task or validates handoff for an already-completed task");
  for (const needle of [
    "two handoff paths",
    "incomplete task",
    "status: \"active\"",
    "already-completed task",
    "persisted `worktree` and `branch`",
    "does not require a lock",
    "do not call `task done`",
    "GitHub is the source of truth for whether an open PR already exists",
  ]) assertContains(output, needle);
}
for (const needle of [
  "two handoff paths",
  "already-completed task",
  "does not invoke `done` or mutate the task card",
  "GitHub is the source of truth for whether an open PR already exists",
]) assertContains("docs/architecture/mdf-task-system.md", needle);
for (const needle of [
  "two intentional context boundaries", "strict active-lock resolver", "review-specific resolver",
  "read-only review of a completed task", "lifecycle-review", "task-review", "review_mode",
]) assertContains("docs/architecture/mdf-task-system.md", needle);
for (const needle of ["test-driven-development", "browser-testing-with-devtools"]) assertContains("skills/test/SKILL.md", needle);
for (const needle of ["web-performance-auditor", "exact selected persona prompt", "capability", "root fallback"]) {
  assertContains("skills/webperf/SKILL.md", needle);
}

for (const output of ["skills/spec-driven-development/SKILL.md", "skills/planning-and-task-breakdown/SKILL.md", "skills/incremental-implementation/SKILL.md"]) {
  assertNotContains(output, "spec-evaluator");
  assertNotContains(output, "plan-evaluator");
  assertNotContains(output, "artifact storage rule");
}

for (const stalePath of [
  "agents/spec-evaluator.md",
  "agents/plan-evaluator.md",
  "overlays/mdf/inventory/agents/spec-evaluator.json",
  "overlays/mdf/inventory/agents/plan-evaluator.json",
  "overlays/mdf/replacements/agents/spec-evaluator.md",
  "overlays/mdf/replacements/agents/plan-evaluator.md",
]) assert(!exists(path.join(root, stalePath)), `${stalePath} must be deleted`);
assertNotContains("agents/README.md", "spec-evaluator");
assertNotContains("agents/README.md", "plan-evaluator");

const sync = spawnSync(process.execPath, [path.join(root, "scripts", "sync-agent-skills.js"), "--dry-run"], {
  cwd: root,
  encoding: "utf8",
});
const canonicalFirstGenerated = new Set(["skills/review/SKILL.md", "skills/github-pr/SKILL.md"]);
const syncMismatches = [...`${sync.stdout}${sync.stderr}`.matchAll(/^- (.+) differs from dry-run render$/gm)].map((match) => match[1]);
const unexpectedSyncMismatches = syncMismatches.filter((output) => !canonicalFirstGenerated.has(output));
assert(
  sync.status === 0 || (syncMismatches.length > 0 && unexpectedSyncMismatches.length === 0),
  `Dry-run sync must match checked-in generated outputs outside the canonical-first review contract surfaces:\n${sync.stdout}${sync.stderr}`
);

if (failures.length > 0) {
  console.error("Agent-skills port validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Agent-skills port validation passed for ${immutable.length} immutable upstream surfaces.`);
