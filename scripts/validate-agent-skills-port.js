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

const immutable = [
  ...filesUnder(vendorRoot, "skills"),
  ...filesUnder(vendorRoot, "agents"),
  ...filesUnder(vendorRoot, "references"),
  "docs/agents.md",
];

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

for (const removed of ["agents/spec-evaluator.md", "agents/plan-evaluator.md"]) {
  assert(!entryFor(removed), `${removed} must not remain in inventory.`);
  assert(!exists(path.join(root, removed)), `${removed} must not be generated.`);
}

for (const requiredOutput of [
  "skills/update-agent-skills-upstream/SKILL.md",
  "references/upstream-agent-skills-update-policy.md",
  "references/upstream-agent-skills-surface-map.md",
]) {
  const entry = entryFor(requiredOutput);
  assert(entry, `Missing required upstream-update surface ${requiredOutput}.`);
  assert(entry?.classification === "mdf-only", `${requiredOutput} must be MDF-only.`);
  assert((entry?.overlayKind || "copy") === "mdfOnly", `${requiredOutput} must use mdfOnly.`);
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
