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
  "Treat task creation/activation and this workflow as independent operations",
  "without requiring a workflow-readiness field or task-level action grant",
  "use `interview-me` for materially different user outcomes",
  "use `idea-refine` only for requested ideation",
  "do not request per-stage ceremonial approval",
  "root review and commit replaces an executor commit or completion step",
  "Standalone stage behavior is unchanged",
  "node <plugin-root>/skills/auto-workflow/scripts/changed-paths.mjs",
  "executor_attempt: <invocation-id>",
  "critic_attempt: <invocation-id>",
  "The executor does not calculate or claim it",
  "executor_invocation_id",
  "critic_invocation_id",
  "Do not put `Next`, allowed actions, acceptance, lifecycle transitions, or mode policy in a stage report",
  "Root selects one slice",
  "Build executor runs RED, GREEN, regression, and build",
  "Do not run code simplification in a slice",
  "After every approved slice is committed, run the whole-build sequence",
  "Run `code-simplify` once over the complete changed scope",
  "Ship uses the exact upstream three-specialist parallel fan-out and root merge",
  "Do not add an outer ship executor, critic, verifier, or coordinator",
  "The bounded build is the planless port of upstream build",
  "keep review and commit in the root",
  "After merge, run `github-after-merge` finalization",
  "Keep a delivery task `active` with its lock held until `github-after-merge`",
], [
  "Run the per-slice build loop",
  "Run the whole-build sequence",
  "Root selects one slice",
  "Build executor runs RED, GREEN, regression, and build",
  "Root observes the actual diff and verification",
  "Slice critic reviews against the plan and spec",
  "Root commits exact slice paths",
  "Root records the accepted slice and commit OID in the handoff",
  "Root re-reads plan, card, lock, and Git before selecting another slice",
  "After every approved slice is committed, run the whole-build sequence",
  "Run the plan's whole-build verification matrix",
  "Run one fresh read-only whole-tree critic",
  "Run `code-simplify` once over the complete changed scope",
  "Run the complete applicable test suite and build after simplification",
  "Run a fresh simplification critic",
  "Commit simplification separately when changed",
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
  "mdf-preserved-contract.md",
  "Keep semantic judgment in the model",
  "node <plugin-root>/skills/task/scripts/task-brief.mjs <task-id>",
  "Task does not select, route, authorize, or execute a later operation",
  "| create or queue |",
  "| bare `task <id> work` |",
  "| `task <id> work` with explicit subsequent work |",
  "| `task <id> done` |",
  "| `task <id> drop` |",
  "### Intent",
  "### Decisions",
  "Write `Not stated` or `Unresolved` instead of inventing intent",
  "does not require a complete specification, workflow readiness",
  "contract markers, digest, approval note, action allowlist, or execution envelope",
  "authorizes that exact card mutation",
  "Do not ask the user to approve the card",
  "Duplicate historical index rows are expected",
  "`task <id> work` changes local lifecycle only",
  "A bare work invocation is terminal",
  "Never infer implementation or another operation from the task card",
  "Do not emit a standalone briefing",
  "Continue only with the explicitly requested operation",
  "Skipping the briefing never skips task, dependency, worktree, branch, lock, or projection verification",
  "Load `using-git-worktrees` to prepare a clean isolated worktree and branch",
  "Hard dependencies are exact `depends_on` IDs",
  "Use only `queue`, `active`, and `done`",
  "Treat the exact `task <id> drop` request as authority for that task only",
  "Use persisted branch/worktree facts for read-only review or handoff",
  "After `github-after-merge` independently verifies the exact merged revision",
  "Cleanup occurs only after finalization and lock release",
  "does not pre-authorize a consuming workflow or external action",
  "An explicit invocation authorizes its named operation",
  "The skill performing an action owns its current target",
], [
  "`active` with matching lock: card -> projection -> reread -> conditional release",
  "`done` with matching lock: verify delivery evidence, repair one unambiguous projection if needed, reread, then release without replaying `done`",
  "`done` without lock: verified no-op",
  "Cleanup occurs only after finalization and lock release",
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
  "## Select",
  "## Instruction source",
  "## Dispatch",
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

assertAuthoredSurface("references/model-routing-5.6.md", [
  "## Inputs",
  "## Default",
  "## Availability exclusions",
  "## Exploration exception",
  "## Fallback",
  "## Record",
  "## Prohibited",
  "gpt-5.3-codex-spark",
  "runtime-native model and reasoning settings",
  "Exclude every GPT-5.6 Luna profile from MDF-managed subagent selection",
  "observational context, not selectable candidates",
  "runtime-availability exclusion",
  "requested model as the model that actually executed",
]);

assertAuthoredSurface("references/model-routing-performance.md", [
  "| Luna | medium |",
  "| Luna | max |",
]);

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
]);

for (const stage of ["build", "test", "code-simplify"]) {
  const output = `skills/${stage}/SKILL.md`;
  const content = text(path.join(root, output));
  for (const rootOwnedPhrase of [
    "root workflow operation",
    "bounded planless target",
    "reserve its commit",
    "changed paths",
    "changed test paths",
  ]) {
    assert(
      !content.includes(rootOwnedPhrase),
      `${output} must leave root operation binding and Git path evidence to the workflow driver: ${rootOwnedPhrase}`
    );
  }
}

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
