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
  "skills/spec/SKILL.md",
  "skills/plan/SKILL.md",
  "skills/build/SKILL.md",
  "skills/test/SKILL.md",
  "skills/review/SKILL.md",
  "skills/code-simplify/SKILL.md",
  "skills/ship/SKILL.md",
];
const autoContract = inventory.contracts?.["auto-workflow-contract"];
assert(autoContract?.output === "references/auto-workflow-contract.md", "Automatic modes must use the shared authored contract as their authority.");
assert(
  JSON.stringify([...(autoContract?.requiredConsumers || [])].sort()) === JSON.stringify([...autoContractConsumers].sort()),
  "Automatic-mode contract consumers must be complete and explicitly attributed."
);

const operationMatrixRows = [
  "| Intent and authority preflight | root-only; unresolved intent blocks | root-only; unresolved intent blocks | root-only; unresolved scope blocks |",
  "| Specification | Two-Key | Two-Key when created or revised | omitted |",
  "| Planning | Two-Key | Two-Key when created or revised | omitted |",
  "| Each plan slice or bounded build | Two-Key | Two-Key | Two-Key |",
  "| Simplification | Two-Key when applicable; otherwise explicitly not applicable | Two-Key when applicable; otherwise explicitly not applicable | omitted |",
  "| Each slice review | Two-Key | Two-Key | one bounded-change review: Two-Key |",
  "| Slice commit | root-only after review `PASS` | root-only after review `PASS` | root-only after review `PASS` |",
  "| Whole-build verification | Two-Key | Two-Key | covered by bounded-build verification |",
  "| Whole-tree review | Two-Key | Two-Key | covered by bounded-change review |",
  "| Ship or release assessment | omitted by local authority | Two-Key with complete upstream fan-out | omitted |",
  "| Whole-task completion | omitted by local authority | root-only after every consumer gate | root-only after every consumer gate |",
  "| Push, PR mutation, and PR consumer checks | omitted by local authority | root-only external authority and actual-state checks | root-only external authority and actual-state checks |",
];

assertAuthoredSurface("references/auto-workflow-contract.md", [
  ...operationMatrixRows,
  "exact upstream `using-agent-skills` primitive",
  "load every other applicable upstream primitive it selects",
  "only active writer in the shared worktree",
  "positively confirms that the producer invocation has ended and its write capability no longer exists",
  "task-card path, bytes, hash, and lifecycle fields",
  "lock path, bytes, hash, and ownership fields",
  "handoff path, bytes, and hash",
  "canonical output bytes and hashes, actual owned changed paths, and unrelated dirt",
  "worktree, branch, base, tree, index, pre/post `HEAD`, and complete diff",
  "exact argv or command, cwd, exit status, relevant output reference, pre/post `HEAD`, and artifact/hash binding",
  "Producer-authored evidence is a claim until this observation binds it to the actual canonical and Git state",
  "original stage contract, acceptance criteria, exact discovery and adapter requirements, and the complete root-observed bundle",
  "Exclude producer reasoning, recommendations, hidden conversation, and self-selected evidence",
  "distinct fresh-context verifier",
  "read-only, cannot delegate, and assesses the same canonical artifact, diff, verification target, or release target",
  "two distinct independent assessors of the same underlying target",
  "dynamically selects a reviewed GPT-5.6 capability for each key",
  "Both keys must independently meet the stage's required quality floor",
  "Never use a fast or speed-only profile, a fixed stage-to-model table, benchmark equivalence, silent downgrade",
  "The root alone reconciles actual state and the two keys into exactly",
  "`PASS`: accept the canonical result and continue within current authority",
  "at most three total cycles",
  "`REWORK` is never a terminal unattended result",
  "Every automatic run ends in verified success within its authority or a safe final `BLOCKED` result",
  "The root remains sole owner of intent, authority, stage selection",
  "external mutations, and final synthesis",
  "do not prove runtime dispatch, tool denial, process termination, model quality, context reduction, or end-to-end behavior",
], [
  "positive producer terminality",
  "root independently re-reads",
  "Dispatch a distinct fresh-context verifier",
]);

const automaticEntrypoints = new Set(autoContractConsumers.slice(0, 3));
for (const consumer of autoContractConsumers) {
  const discoverySelection = consumer === "skills/use-mdf/SKILL.md"
    ? "Load every other applicable upstream primitive it selects"
    : automaticEntrypoints.has(consumer)
      ? "load every other applicable upstream primitive it selects"
      : "every other applicable primitive selected by discovery";
  const canonicalResolution = automaticEntrypoints.has(consumer)
    ? "resolve this canonical entrypoint"
    : consumer === "skills/use-mdf/SKILL.md"
      ? "resolve the canonical MDF adapter"
      : "resolve this canonical adapter";
  assertAuthoredSurface(consumer, [
    "`../using-agent-skills/SKILL.md`",
    discoverySelection,
    canonicalResolution,
    "../../references/auto-workflow-contract.md",
  ]);
}

assertAuthoredSurface("references/subagent-dispatch-policy.md", [
  "one bounded producer or primary assessor and, only after positive producer terminality plus root re-observation, one distinct fresh-context read-only verifier",
  "Neither key may delegate",
  "exact upstream `using-agent-skills` discovery primitive",
  "complete root-observed canonical/Git/command-evidence bundle",
  "excluding producer reasoning",
  "same target read-only",
  "root-selected dynamic GPT-5.6 quality floor for both keys",
  "fast profiles, fixed stage tables, benchmark equivalence, and silent downgrade cannot satisfy either key",
  "at most three total cycles",
  "`REWORK` starts fresh keys or ends `BLOCKED`; it is not a terminal unattended result",
], [
  "positive producer terminality plus root re-observation",
  "one distinct fresh-context read-only verifier",
]);

assertAuthoredSurface("references/model-routing-5.6.md", [
  "based on task difficulty, risk, ambiguity, novelty, consequence, required quality, runtime capability, and transport compatibility",
  "Both must meet the same root-selected GPT-5.6 quality floor",
  "Topology never substitutes for capability",
  "The `fast` option and speed-only profiles are prohibited",
  "it is not a fixed task table, benchmark calculator, or lifecycle controller",
]);

const terminalEntrypoints = [
  "skills/auto-workflow/SKILL.md",
  "skills/auto-workflow-pr/SKILL.md",
  "skills/quick-workflow-pr/SKILL.md",
];
for (const consumer of terminalEntrypoints) {
  assertAuthoredSurface(consumer, [
    "three exhausted cycles",
    "finish `BLOCKED`",
    "terminal `REWORK`",
  ]);
}

assertAuthoredSurface("skills/auto-workflow/SKILL.md", [
  "omits ship, whole-task completion, push, PR mutation, and PR consumer checks",
  "must not create empty gates for them",
  "root alone creates each focused slice commit after review `PASS`",
]);

assertAuthoredSurface("skills/auto-workflow-pr/SKILL.md", [
  "Commits, task completion, push, PR mutation, and PR consumer checks are root-only",
  "Ship assessment is model-led Two-Key",
], [
  "Invoke canonical `ship`",
  "let the root invoke canonical `github-pr`",
  "latest-head consumer checks",
  "may the root invoke canonical `task`",
]);

assertAuthoredSurface("skills/quick-workflow-pr/SKILL.md", [
  "Specification, planning, simplification, ship, separate whole-build verification, and separate whole-tree review are omitted",
  "do not create empty gates for omitted operations",
  "Commit, whole-task completion, push, PR mutation, and PR consumer checks are root-only",
], [
  "canonical build Two-Key PASS",
  "root exact-path review-candidate staging",
  "canonical review Two-Key PASS",
  "root github-commit",
  "root github-pr and latest-head consumer checks",
  "root task completion and lock release",
]);

assertAuthoredSurface("skills/use-mdf/SKILL.md", [
  "shared contract and canonical consumers are authoritative for the complete automatic-mode behavior",
  "Root-only ownership never substitutes for a missing model-led gate",
  "Keep one writer per shared worktree",
], [
  "`github-commit`",
  "`github-pr` push/PR mutation/latest-head consumer and mergeability gates",
  "`task` completion and lock release",
]);

const stageRealizations = new Map([
  ["skills/spec/SKILL.md", [
    "After positive producer terminality",
    "root observes the actual saved bytes and hash plus the complete canonical and Git evidence",
    "distinct fresh-context, read-only, non-delegating verifier assesses those actual bytes",
  ]],
  ["skills/plan/SKILL.md", [
    "After positive producer terminality",
    "root observes the actual plan bytes and hash plus the complete canonical and Git evidence",
    "distinct fresh-context, read-only, non-delegating verifier assesses those actual bytes",
  ]],
  ["skills/build/SKILL.md", [
    "After positive producer terminality",
    "root independently observes the actual diff",
    "each command's exact invocation, cwd, exit status, output reference, pre/post `HEAD`, and binding to the observed diff",
    "distinct fresh-context, read-only, non-delegating verifier receives the original build contract and complete root-observed bundle without producer reasoning",
  ]],
  ["skills/test/SKILL.md", [
    "After positive producer or primary-assessor terminality",
    "root observes the actual tests, diff when any, results, and command evidence and binds them to current canonical and Git state",
    "distinct fresh-context, read-only, non-delegating verifier assesses the same actual tests, results, and evidence",
  ]],
  ["skills/review/SKILL.md", [
    "The root observes and binds one canonical target bundle",
    "the actual canonical diff or artifact",
    "original acceptance context for the selected scope",
    "complete verification evidence",
    "current canonical and Git state",
    "two distinct fresh-context independent primary assessors of that same bundle",
    "Both are read-only and non-delegating",
    "neither receives, reviews, summarizes, or validates the other's report",
    "root confirms both actual assessments returned terminally and the target remained unchanged",
  ]],
  ["skills/code-simplify/SKILL.md", [
    "After positive producer terminality",
    "root observes the actual before and after bytes, complete diff, changed and unrelated paths, canonical and Git state, and bound command evidence",
    "distinct fresh-context, read-only, non-delegating verifier then assesses that actual result",
  ]],
  ["skills/ship/SKILL.md", [
    "Only after the primary key is positively terminal",
    "root independently observe the actual reports or result, release target, canonical and Git state, and command evidence",
    "dispatch one distinct fresh-context verifier",
    "same actual assembled release target",
    "read-only and nondelegating",
  ]],
]);
for (const [consumer, ordered] of stageRealizations) {
  assertAuthoredSurface(consumer, [], ordered);
}

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
