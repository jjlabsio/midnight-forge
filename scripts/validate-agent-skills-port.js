#!/usr/bin/env node

/*
 * Packaging contract check. Workflow meaning belongs to the model and the
 * upstream skills; this validator checks only source, overlay, inventory, and
 * generated-surface facts.
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { loadInventory } = require("./overlay-inventory");

const root = path.resolve(__dirname, "..");
const vendorRoot = path.join(root, "vendor", "agent-skills");
const overlayRoot = path.join(root, "overlays", "mdf");
const inventory = loadInventory(path.join(overlayRoot, "inventory.json"));
const failures = [];

const exists = (filePath) => fs.existsSync(filePath);
const bytes = (filePath) => fs.readFileSync(filePath);
const text = (filePath) => bytes(filePath).toString("utf8");
const assert = (condition, message) => { if (!condition) failures.push(message); };

function filesUnder(basePath, relativePath = "") {
  const absolute = path.join(basePath, relativePath);
  if (!exists(absolute)) return [];
  const stat = fs.statSync(absolute);
  if (stat.isFile()) return [relativePath];
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) =>
    filesUnder(basePath, path.join(relativePath, entry.name))
  );
}

function entryFor(output) {
  return inventory.generated.entries.find((entry) => entry.output === output);
}

function inside(parent, child) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== "..");
}

function normalize(value) {
  return value.replace(/\s+/g, " ").trim();
}

function quotedField(content, pattern, label) {
  const match = content.match(pattern);
  if (!match) {
    assert(false, `${label} is missing.`);
    return null;
  }
  try {
    return JSON.parse(match[1]);
  } catch (error) {
    assert(false, `${label} is not a valid quoted string: ${error.message}`);
    return null;
  }
}

function commandPrompt(content, label) {
  const match = content.match(/^prompt\s*=\s*"""\n([\s\S]*?)\n"""/m);
  if (!match) {
    assert(false, `${label} prompt is missing.`);
    return null;
  }
  return match[1];
}

function adapterSection(content, heading, nextHeading, label) {
  const startToken = `${heading}\n\n`;
  const start = content.indexOf(startToken);
  const end = content.indexOf(`\n${nextHeading}`, start + startToken.length);
  if (start < 0 || end < 0) {
    assert(false, `${label} section boundaries are missing.`);
    return null;
  }
  return content.slice(start + startToken.length, end).trim();
}

function assertFragments(label, content, required) {
  const normalized = normalize(content);
  for (const fragment of required) {
    assert(normalized.includes(normalize(fragment)), `${label} is missing required authored-contract coverage: ${normalize(fragment)}`);
  }
}

function assertOrderedFragments(label, content, required) {
  const normalized = normalize(content);
  let offset = 0;
  for (const fragment of required) {
    const expected = normalize(fragment);
    const index = normalized.indexOf(expected, offset);
    assert(index >= 0, `${label} is missing or misorders authored-contract coverage: ${expected}`);
    if (index < 0) return;
    offset = index + expected.length;
  }
}

function assertAuthoredSurface(relativePath, required = [], ordered = []) {
  const entry = entryFor(relativePath);
  assert(Boolean(entry?.overlay), `${relativePath} must have an attributed authored overlay.`);
  if (!entry?.overlay) return;
  const sourcePath = path.join(overlayRoot, entry.overlay);
  const generatedPath = path.join(root, relativePath);
  assert(exists(sourcePath), `Missing authored source ${relativePath}.`);
  assert(exists(generatedPath), `Missing generated consumer ${relativePath}.`);
  if (!exists(sourcePath) || !exists(generatedPath)) return;

  const source = text(sourcePath);
  const generated = text(generatedPath);
  assert(Buffer.compare(bytes(sourcePath), bytes(generatedPath)) === 0, `${relativePath} generated consumer differs from its authored source.`);
  assertFragments(`${relativePath} authored source`, source, required);
  assertFragments(`${relativePath} generated consumer`, generated, required);
  assertOrderedFragments(`${relativePath} authored source`, source, ordered);
  assertOrderedFragments(`${relativePath} generated consumer`, generated, ordered);
}

const dispatchAdapted = new Set([
  "skills/doubt-driven-development/SKILL.md",
  "skills/test-driven-development/SKILL.md",
]);

const immutable = [
  ...filesUnder(vendorRoot, "skills"),
  ...filesUnder(vendorRoot, "agents"),
  ...filesUnder(vendorRoot, "references"),
  "docs/agents.md",
].filter((output) => !dispatchAdapted.has(output));

assert(!inventory.generated.entries.some((entry) => entry.output.startsWith("hooks/")), "Hooks must remain preserved vendor files, not generated output.");
assert(!inventory.generated.entries.some((entry) => entry.output.startsWith("scripts/")), "Root scripts must remain runtime exclusions.");
assert(
  !inventory.generated.entries.some((entry) => entry.output.startsWith("docs/") && entry.output !== "docs/agents.md"),
  "Ordinary docs must remain runtime exclusions."
);

assert(inventory.schemaVersion === 2, "Inventory schemaVersion must be 2.");
assert(
  JSON.stringify(inventory.upstream?.surfaceRoots) === JSON.stringify(["skills", "references", "commands", "agents", "hooks"]),
  "Inventory must define the complete upstream comparison surface."
);
assert(
  JSON.stringify(inventory.upstream?.runtimeExcludedRoots) === JSON.stringify(["scripts", "docs"]),
  "Inventory must define explicit root scripts/docs runtime exclusions."
);
assert(inventory.upstream?.skillLocalRuntimeGlob === "skills/**/scripts/**", "Inventory must define skill-local script handling.");
assert(Array.isArray(inventory.generated.entryFiles), "Inventory must declare generated entryFiles.");
assert(inventory.generated.entryFiles.length > 0, "Inventory entryFiles must not be empty.");
assert(inventory.task0041SurfaceClasses?.active?.owningTask === "0041", "Task 0041 active inventory is missing.");
assert(inventory.task0041SurfaceClasses?.historical?.owningTask === "0041", "Task 0041 historical inventory is missing.");
assert(inventory.task0041SurfaceClasses?.packaging?.owningTask === "0041", "Task 0041 packaging inventory is missing.");

const autoContractConsumers = [
  "skills/auto-workflow/SKILL.md",
  "skills/auto-workflow-pr/SKILL.md",
  "skills/quick-workflow-pr/SKILL.md",
  "skills/use-mdf/SKILL.md",
];
const autoContract = inventory.contracts?.["auto-workflow-contract"];
assert(autoContract?.output === "references/auto-workflow-contract.md", "Automatic modes must use the shared authored contract as their authority.");
assert(
  JSON.stringify([...(autoContract?.requiredConsumers || [])].sort()) === JSON.stringify([...autoContractConsumers].sort()),
  "Automatic-mode contract consumers must be complete and explicitly attributed."
);

assertAuthoredSurface("references/auto-workflow-contract.md", [
  "# Automatic Workflow Profiles",
  "## Root boundary",
  "## Operation binding",
  "## Stage reports and root handoff",
  "## Profiles",
  "## Per-slice build loop",
  "## Recovery",
  "## Completion",
  "only owner of automatic workflow composition",
  "Stage skills are mode-blind and do not load it",
  "they do not execute its writing, persistence, or confirmation instructions",
  "root review and commit replace a stage executor's commit or completion step",
  "Standalone stage behavior is unchanged",
  "node <plugin-root>/skills/auto-workflow/scripts/changed-paths.mjs",
  "executor_attempt: <invocation-id>",
  "critic_attempt: <invocation-id>",
  "executor does not calculate or claim that evidence",
  "executor_invocation_id",
  "critic_invocation_id",
  "Do not put `Next`, allowed actions, acceptance, lifecycle transitions, or mode policy in a stage report",
  "root selects one slice",
  "build executor performs RED -> GREEN -> regression -> build",
  "Do not run code simplification in a slice",
  "After every approved slice is committed",
  "Run `code-simplify` once over the complete changed scope",
  "Ship uses its exact upstream three-specialist fan-out",
  "Do not add an outer ship executor, critic, verifier, or coordinator",
  "Its bounded build is the explicit planless-target port of the upstream build contract",
  "the root owns review and commit",
  "Task completion is a post-merge operation performed by `github-after-merge`",
  "active task + held lock + merged-delivery handoff",
  "user merges the PR",
  "github-after-merge verifies the merge and finalizes task/lock",
  "delivery task remains `active` with its lock held",
], [
  "-> per-slice build loop",
  "-> whole-build verification",
  "-> whole-build review",
  "-> one whole-change simplification pass",
  "-> simplification critic",
  "-> root simplification commit when changed",
  "root selects one slice",
  "build executor performs RED -> GREEN -> regression -> build",
  "root observes the actual diff and verification",
  "slice critic reviews the slice against its plan and spec",
  "root commits exact slice paths",
  "root records the accepted slice and commit OID in its handoff",
  "root re-reads plan, card, lock, and Git before selecting another slice",
  "After every approved slice is committed",
  "Run the plan's whole-build verification matrix",
  "Dispatch one fresh read-only whole-tree critic",
  "Run `code-simplify` once over the complete changed scope",
  "Run the complete applicable test suite and build after simplification",
  "Dispatch a fresh simplification critic",
  "Commit simplification separately when it changed files",
]);

assertAuthoredSurface("skills/github-after-merge/SKILL.md", [
  "This is the user-facing post-merge finalizer",
  "the user does not need to invoke either skill separately",
  "For managed finalization, require `mergeCommitOid`",
  "recompute its SHA-256",
  "number/URL, accepted head OID, expected base",
  "the current merged PR head must equal the accepted head OID",
  "remote tip contains the reported merge commit OID",
  "apply the canonical `task` post-merge delivery finalization",
  "For `active + matching lock`",
  "For `done + matching lock`",
  "For `done + no lock`",
  "Synchronization-only path",
  "skip task finalization",
  "The synchronization-only path enters it after common merge verification",
  "Load `github-clear-gone` internally",
  "not referenced by any active lock",
  "Do not reopen the task or reacquire its lock",
], [
  "For `active + matching lock`",
  "write the card as `done`",
  "append one current index projection",
  "re-read both",
  "release the lock conditionally",
  "after task finalization and lock release",
  "Load `github-clear-gone` internally",
]);

assertAuthoredSurface("skills/github-clear-gone/SKILL.md", [
  "Read all canonical MDF locks",
  "Exclude every branch or worktree referenced by an active lock",
  "without force",
  "Never discard dirty changes implicitly",
  "Do not mutate task cards, indexes, or locks",
]);

assertAuthoredSurface("skills/task/SKILL.md", [
  "`github-after-merge` is the user-facing composite entrypoint",
  "The finalizer is idempotent across interruption boundaries",
  "`active` with the matching lock: card write -> index projection",
  "`done` with the matching lock: verify the merged delivery evidence",
  "repair or append one unambiguous current projection",
  "Branch and worktree cleanup occurs only after finalization and lock release",
], [
  "`active` with the matching lock: card write -> index projection -> reread -> conditional lock release",
  "`done` with the matching lock: verify the merged delivery evidence and repair or append one unambiguous current projection -> reread -> release only the exact lock",
  "`done` without a lock: verified no-op",
  "Branch and worktree cleanup occurs only after finalization and lock release",
]);

assertAuthoredSurface("skills/github-pr/SKILL.md", [
  "Return a merged-delivery handoff only after those gates pass",
  "Keep the task active and lock held",
  "return a root-authored merged-delivery handoff",
  "`.mdf/work/<work-id>/delivery-NNN.md`",
  "link its path and SHA-256 from the active task's `Log`",
  "This skill does not complete the task or release the lock",
]);

for (const consumer of autoContractConsumers) {
  assertAuthoredSurface(consumer, [
    "using-agent-skills",
    "auto-workflow-contract.md",
  ]);
}

assertAuthoredSurface("references/subagent-dispatch-policy.md", [
  "## Root-owned dispatch",
  "## Executor and critic",
  "## Completion and fan-out",
  "## Mandatory minimal observation",
  "requested_effort",
  "does not report the model that actually executed",
  "record-subagent-observation.mjs",
  "## Spawn boundary",
]);

assertAuthoredSurface("skills/auto-workflow/scripts/changed-paths.mjs", [
  "git",
  "--name-status",
  "--find-renames",
  "--others",
  "--exclude-standard",
  "Changed paths:",
]);

assertAuthoredSurface("skills/use-mdf/scripts/record-subagent-observation.mjs", [
  "O_APPEND",
  "requested_model",
  "requested_effort",
  "raw terminal status",
  "artifact_refs",
]);

assertAuthoredSurface("agents/README.md", [
  "`persona-backed` uses the exact `agents/<persona>.md` prompt",
  "`skill-backed` uses the exact canonical skill adapter and applicable upstream primitives without a persona",
  "A `skill-backed` workflow operation does not resolve a persona and must not invent one",
  "Missing persona resolution affects only explicitly persona-backed calls",
]);

const personaOverlayFiles = filesUnder(path.join(overlayRoot, "replacements"), "agents")
  .filter((relativePath) => relativePath !== "agents/README.md");
assert(
  personaOverlayFiles.length === 0,
  `MDF must not add synthetic persona files: ${personaOverlayFiles.join(", ")}`
);

assertAuthoredSurface("references/model-routing-5.6.md");

const commandAdapterSources = {
  spec: "commands/spec.toml",
  plan: "commands/planning.toml",
  build: "commands/build.toml",
  test: "commands/test.toml",
  review: "commands/review.toml",
  "code-simplify": "commands/code-simplify.toml",
  ship: "commands/ship.toml",
  webperf: "commands/webperf.toml",
};
const stageAdapters = Object.keys(commandAdapterSources);
const persistencePorts = {
  spec: "\n\nSave the spec as SPEC.md in the project root and confirm with the user before proceeding.",
  plan: "\n\nSave the plan to tasks/plan.md and task list to tasks/todo.md.",
};
for (const stage of stageAdapters) {
  const output = `skills/${stage}/SKILL.md`;
  const content = text(path.join(root, output));
  const entry = entryFor(output);
  if (!entry?.source) {
    assert(false, `${output} must retain its pinned upstream command source.`);
    continue;
  }
  assert(entry.source === commandAdapterSources[stage], `${output} must retain its expected upstream command source.`);
  assert(entry.classification === "mdf-rename-or-adapter", `${output} must remain an explicit command adapter.`);
  assert(entry.overlayKind === "renameAdapter", `${output} must retain renameAdapter provenance.`);
  const sourceContent = text(path.join(vendorRoot, entry.source));
  const sourceDescription = quotedField(sourceContent, /^description\s*=\s*("(?:\\.|[^"\\])*")/m, `${entry.source} description`);
  const adapterDescription = quotedField(content, /^description:\s*("(?:\\.|[^"\\])*")/m, `${output} description`);
  assert(sourceDescription === adapterDescription, `${output} must preserve the exact upstream command description.`);
  assert(content.includes("## Upstream command contract"), `${output} must separate its upstream command contract.`);
  assert(content.includes("## MDF adaptation"), `${output} must separate its MDF adaptation.`);
  const sourcePrompt = commandPrompt(sourceContent, entry.source);
  const upstreamContract = adapterSection(content, "## Upstream command contract", "## MDF adaptation", output);
  if (sourcePrompt !== null && upstreamContract !== null) {
    const persistenceInstruction = persistencePorts[stage];
    if (persistenceInstruction) {
      assert(sourcePrompt.endsWith(persistenceInstruction), `${entry.source} has an unexpected persistence contract.`);
      assert(
        upstreamContract === sourcePrompt.slice(0, -persistenceInstruction.length).trim(),
        `${output} must preserve the upstream prompt except for its explicit persistence port.`
      );
      assert(content.includes("### Persistence port"), `${output} must identify its MDF persistence port.`);
    } else {
      assert(upstreamContract === sourcePrompt.trim(), `${output} must preserve the exact upstream command prompt.`);
    }
  }
  for (const forbidden of ["auto-workflow", "quick-workflow-pr", "Two-Key", "auto-workflow-contract.md"]) {
    assert(!content.includes(forbidden), `${output} must not interpret automatic workflow policy: ${forbidden}`);
  }
  assert(!(entry?.contractRefs || []).includes("auto-workflow-contract"), `${output} must not consume the automatic workflow contract.`);
}

assertAuthoredSurface("skills/build/SKILL.md", [
  "bind `tasks/plan.md` plus `tasks/todo.md` to the approved checklist-style",
  "Standalone invocation preserves every upstream mode and step after the canonical artifact binding above",
  "one selected plan slice or one explicitly bounded planless target",
  "reserve its commit and status update for the root",
  "binding must be explicit; this adapter does not infer workflow profiles",
]);

assertAuthoredSurface("skills/spec/SKILL.md", [
  ".mdf/work/<work-id>/spec-NNN.md",
  "Preserve the upstream document content and user-confirmation checkpoint",
]);
assertAuthoredSurface("skills/plan/SKILL.md", [
  ".mdf/work/<work-id>/plan-NNN.md",
  "Preserve both upstream plan and task-list roles",
]);

const seen = new Set();
for (const entry of inventory.generated.entries) {
  assert(!seen.has(entry.output), `${entry.output} appears more than once in inventory.`);
  seen.add(entry.output);
  const outputPath = path.resolve(root, entry.output);
  assert(inside(root, outputPath) && outputPath !== root, `${entry.output} escapes the project root.`);
  assert(exists(outputPath), `${entry.output} is missing from generated output.`);
  if (entry.source) {
    const sourcePath = path.resolve(vendorRoot, entry.source);
    assert(inside(vendorRoot, sourcePath), `${entry.output} source escapes vendor/agent-skills.`);
    assert(exists(sourcePath), `${entry.output} source is missing.`);
    if (exists(sourcePath) && entry.baseSha256) {
      const crypto = require("crypto");
      const digest = crypto.createHash("sha256").update(bytes(sourcePath)).digest("hex");
      assert(digest === entry.baseSha256, `${entry.output} has stale baseSha256.`);
    }
  }
  if (entry.overlay) {
    const overlayPath = path.resolve(overlayRoot, entry.overlay);
    assert(inside(overlayRoot, overlayPath), `${entry.output} overlay escapes overlays/mdf.`);
    assert(exists(overlayPath), `${entry.output} overlay is missing.`);
    if (exists(outputPath) && exists(overlayPath) && !(entry.releaseMetadata?.length)) {
      assert(Buffer.compare(bytes(outputPath), bytes(overlayPath)) === 0, `${entry.output} differs from its overlay input.`);
    }
  }
}

for (const output of immutable) {
  const entry = entryFor(output);
  const vendorPath = path.join(vendorRoot, output);
  const generatedPath = path.join(root, output);
  assert(entry, `Missing immutable inventory entry for ${output}.`);
  if (entry) {
    assert(entry.source === output, `${output} must source ${output}.`);
    assert(entry.classification === "upstream-identical", `${output} must be upstream-identical.`);
    assert((entry.overlayKind || "copy") === "copy", `${output} must use copy overlay kind.`);
    assert(!entry.overlay, `${output} cannot use an overlay replacement.`);
  }
  assert(exists(vendorPath), `Missing pinned upstream source ${output}.`);
  assert(exists(generatedPath), `Missing generated immutable surface ${output}.`);
  if (exists(vendorPath) && exists(generatedPath)) {
    assert(Buffer.compare(bytes(vendorPath), bytes(generatedPath)) === 0, `${output} differs from pinned upstream bytes.`);
  }
}

for (const output of dispatchAdapted) {
  const entry = entryFor(output);
  const vendorPath = path.join(vendorRoot, output);
  const generatedPath = path.join(root, output);
  assert(entry, `Missing dispatch-adapted inventory entry for ${output}.`);
  if (entry) {
    assert(entry.source === output, `${output} dispatch adapter must source ${output}.`);
    assert(entry.classification === "mdf-rename-or-adapter", `${output} dispatch adapter classification is invalid.`);
    assert((entry.overlayKind || "copy") === "renameAdapter", `${output} dispatch adapter must use renameAdapter.`);
    assert(Boolean(entry.overlay), `${output} dispatch adapter must declare an overlay.`);
  }
  assert(exists(vendorPath), `Missing pinned upstream source ${output}.`);
  assert(exists(generatedPath), `Missing generated dispatch-adapted surface ${output}.`);
  if (exists(vendorPath) && exists(generatedPath)) {
    assert(Buffer.compare(bytes(vendorPath), bytes(generatedPath)) !== 0, `${output} dispatch adapter did not add an MDF boundary.`);
  }
}

for (const removed of ["agents/spec-evaluator.md", "agents/plan-evaluator.md"]) {
  assert(!entryFor(removed), `${removed} must not remain in inventory.`);
  assert(!exists(path.join(root, removed)), `${removed} must not be generated.`);
}

for (const hook of filesUnder(vendorRoot, "hooks")) {
  assert(exists(path.join(vendorRoot, hook)), `Pinned upstream hook is missing: ${hook}.`);
}
try {
  JSON.parse(text(path.join(vendorRoot, "hooks", "hooks.json")));
} catch (error) {
  assert(false, `Pinned upstream hook manifest is not valid JSON: ${error.message}`);
}

const sync = spawnSync(process.execPath, [path.join(root, "scripts", "sync-agent-skills.js"), "--dry-run"], {
  cwd: root,
  encoding: "utf8",
});
assert(sync.status === 0, `Dry-run sync failed:\n${sync.stdout}${sync.stderr}`);

if (failures.length > 0) {
  console.error("Agent-skills packaging validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Agent-skills packaging validation passed for ${immutable.length} immutable upstream surfaces.`);
