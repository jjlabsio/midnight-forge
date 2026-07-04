#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const vendorRoot = path.join(root, "vendor", "agent-skills");
const overlayRoot = path.join(root, "overlays", "mdf");
const inventoryPath = path.join(overlayRoot, "inventory.json");
const lockPath = path.join(root, "vendor", "agent-skills.lock.json");
const failures = [];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function exists(filePath) {
  return fs.existsSync(filePath);
}

function read(filePath) {
  return fs.readFileSync(filePath);
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function walk(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!exists(absolutePath)) return [];
  const stat = fs.statSync(absolutePath);
  if (stat.isFile()) return [relativePath];

  const result = [];
  for (const entry of fs.readdirSync(absolutePath, { withFileTypes: true })) {
    const child = path.join(relativePath, entry.name);
    if (entry.isDirectory()) result.push(...walk(child));
    else if (entry.isFile()) result.push(child);
  }
  return result;
}

function expectedEntryBytes(entry) {
  if (entry.overlay) {
    return read(path.join(overlayRoot, entry.overlay));
  }
  return read(path.join(vendorRoot, entry.source));
}

const inventory = readJson(inventoryPath);
const lock = readJson(lockPath);
const entries = inventory.generated.entries;
const outputs = new Set(entries.map((entry) => entry.output));
const allowedClassifications = new Set([
  "upstream-identical",
  "artifact-storage-only",
  "mdf-overlay-required",
  "mdf-rename-or-adapter",
  "mdf-only",
  "upstream-drift-preserved",
]);

assert(lock.repository === inventory.upstream.repository, "Vendor lock repository must match inventory.");
assert(lock.commit === inventory.upstream.commit, "Vendor lock commit must match inventory.");
assert(exists(path.join(overlayRoot, "references", "artifact-storage-override.md")), "Missing common MDF artifact storage override.");

for (const entry of entries) {
  assert(allowedClassifications.has(entry.classification), `${entry.output} has unsupported classification ${entry.classification}`);
  assert(entry.classification !== "manual-review-required", `${entry.output} still requires manual review`);

  if (entry.source) {
    assert(exists(path.join(vendorRoot, entry.source)), `${entry.output} source missing: ${entry.source}`);
  }
  if (entry.overlay) {
    assert(exists(path.join(overlayRoot, entry.overlay)), `${entry.output} overlay missing: ${entry.overlay}`);
  }
  if (entry.classification === "artifact-storage-only") {
    assert(entry.artifactStorageOverride === true, `${entry.output} must point at the common artifact storage override`);
  }

  const outputPath = path.join(root, entry.output);
  assert(exists(outputPath), `${entry.output} is missing from generated output`);
  if (exists(outputPath)) {
    const expected = expectedEntryBytes(entry);
    const actual = read(outputPath);
    assert(Buffer.compare(expected, actual) === 0, `${entry.output} differs from inventory-generated output`);
  }
}

for (const excluded of inventory.generated.excludedUpstream) {
  assert(excluded.classification === "upstream-missing-in-mdf", `${excluded.source} has unsupported excluded classification`);
  assert(exists(path.join(vendorRoot, excluded.source)), `${excluded.source} is listed as excluded but missing from vendor`);
}

for (const cleanTarget of inventory.generated.clean) {
  if (cleanTarget === "README.md") continue;
  for (const file of walk(cleanTarget)) {
    assert(outputs.has(file), `${file} exists in generated surface but is not represented in inventory`);
  }
}

const useMdf = entries.find((entry) => entry.output === "skills/use-mdf/SKILL.md");
assert(useMdf?.source === "skills/using-agent-skills/SKILL.md", "use-mdf must explicitly adapt upstream using-agent-skills.");
assert(useMdf?.classification === "mdf-rename-or-adapter", "use-mdf must use mdf-rename-or-adapter classification.");

const manual = entries.filter((entry) => entry.classification === "manual-review-required");
assert(manual.length === 0, `Manual review entries remain: ${manual.map((entry) => entry.output).join(", ")}`);

if (failures.length > 0) {
  console.error("Agent skills sync validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Agent skills sync validation passed for ${entries.length} files.`);
