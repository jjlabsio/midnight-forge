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

function assertAuthoredSurface(relativePath) {
  const entry = entryFor(relativePath);
  assert(Boolean(entry?.overlay), `${relativePath} must have an attributed authored overlay.`);
  if (!entry?.overlay) return;
  const sourcePath = path.join(overlayRoot, entry.overlay);
  const generatedPath = path.join(root, relativePath);
  assert(exists(sourcePath), `Missing authored source ${relativePath}.`);
  assert(exists(generatedPath), `Missing generated consumer ${relativePath}.`);
  if (!exists(sourcePath) || !exists(generatedPath)) return;

  assert(Buffer.compare(bytes(sourcePath), bytes(generatedPath)) === 0, `${relativePath} generated consumer differs from its authored source.`);
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

const automaticContracts = {
  "automatic-operation-contract": {
    output: "references/automatic-operation-contract.md",
    consumers: [
      "references/auto-workflow-contract.md",
      "references/auto-workflow-pr-contract.md",
      "references/quick-workflow-pr-contract.md",
      "references/subagent-dispatch-policy.md",
      "skills/auto-doubt-driven-development/SKILL.md",
      "skills/auto-workflow/SKILL.md",
      "skills/auto-workflow/scripts/changed-paths.mjs",
      "skills/auto-workflow-pr/SKILL.md",
      "skills/quick-workflow-pr/SKILL.md",
      "skills/use-mdf/SKILL.md",
    ],
  },
  "auto-workflow-contract": {
    output: "references/auto-workflow-contract.md",
    consumers: [
      "skills/auto-workflow/SKILL.md",
      "skills/auto-workflow-pr/SKILL.md",
      "skills/use-mdf/SKILL.md",
    ],
  },
  "auto-workflow-pr-contract": {
    output: "references/auto-workflow-pr-contract.md",
    consumers: [
      "skills/auto-workflow-pr/SKILL.md",
      "skills/use-mdf/SKILL.md",
    ],
  },
  "quick-workflow-pr-contract": {
    output: "references/quick-workflow-pr-contract.md",
    consumers: [
      "skills/quick-workflow-pr/SKILL.md",
      "skills/use-mdf/SKILL.md",
    ],
  },
};
for (const [contractId, expected] of Object.entries(automaticContracts)) {
  const contract = inventory.contracts?.[contractId];
  assert(contract?.output === expected.output, `${contractId} must retain its authored output.`);
  assert(
    JSON.stringify([...(contract?.requiredConsumers || [])].sort()) === JSON.stringify([...expected.consumers].sort()),
    `${contractId} consumers must be complete and explicitly attributed.`
  );
  assertAuthoredSurface(expected.output);
  for (const consumer of expected.consumers) assertAuthoredSurface(consumer);
}

assertAuthoredSurface("skills/github-after-merge/SKILL.md");
assertAuthoredSurface("skills/github-clear-gone/SKILL.md");
assertAuthoredSurface("skills/task/SKILL.md");

const observationSkill = "skills/subagent-observation";
const observationRuntime = [
  `${observationSkill}/SKILL.md`,
  `${observationSkill}/scripts/record-subagent-observation.mjs`,
  `${observationSkill}/scripts/check-subagent-observation-links.mjs`,
];
for (const output of observationRuntime) assertAuthoredSurface(output);
for (const legacyOutput of [
  path.join("skills", "use-mdf", "scripts", "record-subagent-observation.mjs"),
  path.join("skills", "use-mdf", "scripts", "check-subagent-observation-links.mjs"),
]) {
  assert(!entryFor(legacyOutput), `${legacyOutput} must not return to the generated inventory.`);
  assert(!exists(path.join(root, legacyOutput)), `${legacyOutput} must not return to generated output.`);
  assert(!exists(path.join(overlayRoot, "replacements", legacyOutput)), `${legacyOutput} must not return to overlay source.`);
}
assertAuthoredSurface("agents/README.md");

const personaOverlayFiles = filesUnder(path.join(overlayRoot, "replacements"), "agents")
  .filter((relativePath) => relativePath !== "agents/README.md");
assert(
  personaOverlayFiles.length === 0,
  `MDF must not add synthetic persona files: ${personaOverlayFiles.join(", ")}`
);

assertAuthoredSurface("references/model-routing-5.6.md");
assertAuthoredSurface("references/model-routing-performance.md");

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
    } else {
      assert(upstreamContract === sourcePrompt.trim(), `${output} must preserve the exact upstream command prompt.`);
    }
  }
  for (const contractId of Object.keys(automaticContracts)) {
    assert(!(entry?.contractRefs || []).includes(contractId), `${output} must not consume automatic contract ${contractId}.`);
  }
}

assertAuthoredSurface("skills/build/SKILL.md");
assertAuthoredSurface("skills/spec/SKILL.md");
assertAuthoredSurface("skills/plan/SKILL.md");

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
