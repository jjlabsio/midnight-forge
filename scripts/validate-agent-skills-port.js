#!/usr/bin/env node

/*
 * This is a contract test, not a prose linter.  agent-skills owns primitive
 * workflow semantics; MDF owns the Codex controllers and runtime adaptation.
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { loadInventory } = require("./overlay-inventory");
const { approvalMatches, canCompleteWholeBuild, cleanBaseline, resolveBuildMode, resolvePluginPath, reviewDisposition } = require("./controller-contracts");

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

// Static scenario contracts: these strings make accidental shortcutting visible
// in review and force controller authors to preserve the stated lifecycle.
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
]) assertContains("skills/auto-workflow/SKILL.md", needle);
for (const needle of [
  "generic subagent", "exact selected persona prompt", "capability", "root fallback",
]) assertContains("skills/use-mdf/SKILL.md", needle);
assertContains("skills/code-simplify/SKILL.md", "AGENTS.md");
assertNotContains("skills/code-simplify/SKILL.md", "Read CLAUDE.md and study project conventions");
for (const needle of ["parallel", "code-reviewer", "security-auditor", "test-engineer", "GO/NO-GO"]) {
  assertContains("skills/ship/SKILL.md", needle);
}
for (const needle of ["test-driven-development", "browser-testing-with-devtools"]) assertContains("skills/test/SKILL.md", needle);
for (const needle of ["web-performance-auditor", "exact selected persona prompt", "capability", "root fallback"]) {
  assertContains("skills/webperf/SKILL.md", needle);
}

for (const output of ["skills/spec-driven-development/SKILL.md", "skills/planning-and-task-breakdown/SKILL.md", "skills/incremental-implementation/SKILL.md"]) {
  assertNotContains(output, "spec-evaluator");
  assertNotContains(output, "plan-evaluator");
  assertNotContains(output, "artifact storage rule");
}

// Scenario fixtures exercise the controller contracts independently from prose
// so a phrase cannot accidentally stand in for revision-safe behavior.
const latest = { spec: "spec-002.md", spec_sha256: "spec-hash", plan: "plan-003.md", plan_sha256: "plan-hash" };
assert(approvalMatches({ kind: "spec", artifact: "spec-002.md", artifact_sha256: "spec-hash", latest_pointer: "spec-002.md", affirmative: true }, latest, "spec"), "matching spec approval must pass");
assert(!approvalMatches({ kind: "spec", artifact: "spec-002.md", artifact_sha256: "old-hash", latest_pointer: "spec-002.md", affirmative: true }, latest, "spec"), "artifact revision mutation must invalidate approval");
assert(!approvalMatches({ kind: "plan", artifact: "plan-003.md", artifact_sha256: "plan-hash", latest_pointer: "plan-002.md", affirmative: true }, latest, "plan"), "latest-pointer mutation must invalidate approval");
assert(resolveBuildMode([]) === "single-task", "default build must remain one-task mode");
assert(resolveBuildMode(["auto"]) === "lifecycle" && resolveBuildMode(["all"]) === "lifecycle", "build auto/all must route to lifecycle mode");
assert(cleanBaseline(""), "clean baseline must pass");
assert(!cleanBaseline(" M unrelated.md"), "dirty baseline must stop autonomous work");
assert(reviewDisposition({ freshReviewerAvailable: true, rootEscalationAllowed: false }) === "fresh", "fresh review must be used when available");
assert(reviewDisposition({ freshReviewerAvailable: false, rootEscalationAllowed: true }) === "root-fallback", "permitted root escalation must be explicit");
assert(reviewDisposition({ freshReviewerAvailable: false, rootEscalationAllowed: false }) === "block", "unavailable genuine fresh review must block advancement");
assert(!canCompleteWholeBuild({ approvedTasks: 3, passedTasks: 1, writers: 1 }), "a selected task cannot complete the whole build");
assert(!canCompleteWholeBuild({ approvedTasks: 3, passedTasks: 3, writers: 2 }), "whole-build completion requires one-writer serialization");
assert(canCompleteWholeBuild({ approvedTasks: 3, passedTasks: 3, writers: 1 }), "all approved tasks with one writer can complete the whole build");
assert(resolvePluginPath(vendorRoot, "agents/code-reviewer.md") === path.join(vendorRoot, "agents", "code-reviewer.md"), "plugin-root resolver must work from a relocated vendor root");
try {
  resolvePluginPath(vendorRoot, "../outside.md");
  assert(false, "plugin-root resolver must reject escapes");
} catch (error) {
  assert(error.message.includes("plugin path"), "plugin-root resolver must report path errors");
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
assert(sync.status === 0, `Dry-run sync must match checked-in generated outputs:\n${sync.stdout}${sync.stderr}`);

if (failures.length > 0) {
  console.error("Agent-skills port validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Agent-skills port validation passed for ${immutable.length} immutable upstream surfaces.`);
