#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");
const { loadInventory } = require("./overlay-inventory");

const root = path.resolve(__dirname, "..");
const vendorRoot = path.join(root, "vendor", "agent-skills");
const overlayRoot = path.join(root, "overlays", "mdf");
const inventoryPath = path.join(overlayRoot, "inventory.json");
const lockPath = path.join(root, "vendor", "agent-skills.lock.json");
const releaseMetadataPath = path.join(overlayRoot, "release-metadata.json");
const rendererPath = path.join(root, "scripts", "sync-agent-skills.js");
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

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function sha256(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
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

function overlayKind(entry) {
  return entry.overlayKind || "copy";
}

function formatMode(mode) {
  return (mode & 0o777).toString(8).padStart(3, "0");
}

function expectedMode(entry, kind) {
  if (entry.mode !== undefined) {
    if (typeof entry.mode === "number") return entry.mode;
    if (typeof entry.mode === "string" && /^[0-7]{3,4}$/.test(entry.mode)) {
      return parseInt(entry.mode, 8);
    }
    assert(false, `${entry.output} has invalid mode ${entry.mode}`);
    return null;
  }

  if (kind === "mdfOnly" || kind === "renameAdapter") {
    if (!entry.overlay) return null;
    const overlayPath = path.resolve(overlayRoot, entry.overlay);
    if (!exists(overlayPath)) return null;
    return fs.statSync(overlayPath).mode & 0o777;
  }

  if (!entry.source) return null;
  const sourcePath = path.resolve(vendorRoot, entry.source);
  if (!exists(sourcePath)) return null;
  return fs.statSync(sourcePath).mode & 0o777;
}

function lineNumberAt(content, index) {
  return content.slice(0, index).split(/\r?\n/).length;
}

function warnRuntimeRootReferences(output, content) {
  if (!/^skills\/[^/]+\/SKILL\.md$/.test(output)) return;

  const runtimeInstructionPattern = /\b(?:read|follow|load|use|delegate(?:s|d)?(?: to)?|execute|run)\b/i;
  const bareRootPathPattern = /`?(references\/[A-Za-z0-9._/-]+\.md|agents\/[A-Za-z0-9._/-]+\.md|skills\/[A-Za-z0-9._/-]+\/SKILL\.md|scripts\/[A-Za-z0-9._/-]+)`?/g;
  const pluginRootMarkerPattern = /\bplugin[- ]root\b|\bfrom the plugin root\b/i;

  for (const match of content.matchAll(bareRootPathPattern)) {
    const preceding = match.index > 0 ? content[match.index - 1] : "";
    if (preceding === "." || preceding === "/") continue;

    const lineStart = content.lastIndexOf("\n", match.index) + 1;
    const lineEnd = content.indexOf("\n", match.index);
    const line = content.slice(lineStart, lineEnd === -1 ? content.length : lineEnd);
    if (!runtimeInstructionPattern.test(line)) continue;
    if (pluginRootMarkerPattern.test(line)) continue;

    warnings.push(
      `${output}:${lineNumberAt(content, match.index)} uses bare plugin-root path ${match[1]} in runtime instruction; prefer a skill-relative path or mark the prose as plugin-root context`
    );
  }
}

const inventoryRoot = readJson(inventoryPath);
const inventory = loadInventory(inventoryPath);
const lock = readJson(lockPath);
const releaseMetadata = readJson(releaseMetadataPath);
const entries = inventory.generated.entries;
const outputs = new Set(entries.map((entry) => entry.output));
const outputCounts = new Map();
const warnings = [];
const supportedOverlayKinds = new Set(inventory.overlayV2?.supportedKinds || []);
const allowedClassifications = new Set([
  "upstream-identical",
  "mdf-rename-or-adapter",
  "mdf-only",
]);
assert(!entries.some((entry) => entry.output.startsWith("hooks/")), "Upstream hooks must remain preserved vendor files, not generated runtime output.");
assert(!entries.some((entry) => entry.output.startsWith("scripts/")), "Upstream root scripts must remain explicit runtime exclusions.");
assert(
  !entries.some((entry) => entry.output.startsWith("docs/") && entry.output !== "docs/agents.md"),
  "Ordinary upstream docs must remain explicit runtime exclusions."
);

assert(inventory.schemaVersion === 2, "Inventory schemaVersion must be 2 for overlay v2.");
assert(
  JSON.stringify(inventory.upstream?.surfaceRoots) === JSON.stringify(["skills", "references", "commands", "agents", "hooks"]),
  "Inventory must compare the complete upstream skills/references/commands/agents/hooks surface."
);
assert(
  JSON.stringify(inventory.upstream?.runtimeExcludedRoots) === JSON.stringify(["scripts", "docs"]),
  "Inventory must explicitly exclude upstream root scripts and docs from runtime import."
);
assert(inventory.upstream?.skillLocalRuntimeGlob === "skills/**/scripts/**", "Inventory must preserve skill-local scripts.");
assert(!Array.isArray(inventoryRoot.generated?.entries), "Inventory root must load generated entries from shards, not generated.entries.");
assert(
  Array.isArray(inventoryRoot.generated?.entryFiles) && inventoryRoot.generated.entryFiles.length > 0,
  "Inventory root must declare generated.entryFiles."
);
const entryFileCounts = new Map();
for (const entryFile of inventoryRoot.generated?.entryFiles || []) {
  entryFileCounts.set(entryFile, (entryFileCounts.get(entryFile) || 0) + 1);
  const shardPath = path.resolve(overlayRoot, entryFile);
  assert(shardPath.startsWith(path.join(overlayRoot, "inventory") + path.sep), `${entryFile} must live under overlays/mdf/inventory`);
  assert(exists(shardPath), `${entryFile} inventory shard is missing`);
}
for (const [entryFile, count] of entryFileCounts) {
  assert(count === 1, `${entryFile} appears ${count} times in generated.entryFiles`);
}
const entryByOutput = new Map(entries.map((entry) => [entry.output, entry]));
const contracts = inventory.contracts;
assert(
  contracts && typeof contracts === "object" && !Array.isArray(contracts),
  "Inventory must declare contracts as an object registry."
);
const contractOutputOwners = new Map();
for (const [contractId, contract] of Object.entries(contracts || {})) {
  assert(
    /^[a-z0-9][a-z0-9-]*$/.test(contractId),
    `Contract ID must be lowercase kebab-case: ${contractId}`
  );
  assert(
    contract && typeof contract === "object" && !Array.isArray(contract),
    `Contract ${contractId} must be an object.`
  );
  if (!contract || typeof contract !== "object" || Array.isArray(contract)) continue;

  assert(
    typeof contract.output === "string" && contract.output.length > 0,
    `Contract ${contractId} must declare a generated output path.`
  );
  if (typeof contract.output === "string" && contract.output.length > 0) {
    const previous = contractOutputOwners.get(contract.output);
    assert(!previous, `Contract output ${contract.output} is claimed by both ${previous} and ${contractId}`);
    contractOutputOwners.set(contract.output, contractId);
    assert(outputs.has(contract.output), `Contract ${contractId} references missing generated output ${contract.output}`);
  }

  assert(
    Array.isArray(contract.requiredConsumers) && contract.requiredConsumers.length > 0,
    `Contract ${contractId} must declare at least one required consumer.`
  );
  const requiredConsumerSet = new Set();
  for (const consumer of contract.requiredConsumers || []) {
    assert(typeof consumer === "string" && consumer.length > 0, `Contract ${contractId} has an invalid required consumer.`);
    if (typeof consumer !== "string" || consumer.length === 0) continue;
    assert(!requiredConsumerSet.has(consumer), `Contract ${contractId} lists duplicate consumer ${consumer}`);
    requiredConsumerSet.add(consumer);
    const entry = entryByOutput.get(consumer);
    assert(entry, `Contract ${contractId} references missing consumer ${consumer}`);
    if (entry) {
      assert(
        Array.isArray(entry.contractRefs) && entry.contractRefs.includes(contractId),
        `${consumer} must declare contractRefs including ${contractId}`
      );
    }
  }
}
for (const entry of entries) {
  if (entry.contractRefs === undefined) continue;
  assert(Array.isArray(entry.contractRefs), `${entry.output} contractRefs must be an array.`);
  if (!Array.isArray(entry.contractRefs)) continue;
  const seenContractRefs = new Set();
  for (const contractId of entry.contractRefs) {
    assert(typeof contractId === "string" && contractId.length > 0, `${entry.output} has an invalid contract reference.`);
    if (typeof contractId !== "string" || contractId.length === 0) continue;
    assert(!seenContractRefs.has(contractId), `${entry.output} lists duplicate contract reference ${contractId}`);
    seenContractRefs.add(contractId);
    assert(Object.prototype.hasOwnProperty.call(contracts || {}, contractId), `${entry.output} references unknown contract ${contractId}`);
  }
}
assert(exists(releaseMetadataPath), "Missing overlays/mdf/release-metadata.json.");
const rendererSource = readText(rendererPath);
for (const removedHelper of ["artifactStorageParagraph", "applyExactPatches", "applyPolicyInjection"]) {
  assert(!rendererSource.includes(removedHelper), `Renderer still implements removed transform helper ${removedHelper}`);
}
assert(/^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(releaseMetadata.version), "Release metadata version must be semver.");
assert(releaseMetadata.marketplaceRef === `v${releaseMetadata.version}`, "Release metadata marketplaceRef must match v{version}.");
for (const kind of ["copy", "mdfOnly", "renameAdapter"]) {
  assert(supportedOverlayKinds.has(kind), `Overlay v2 must support ${kind}.`);
}
assert(lock.repository === inventory.upstream.repository, "Vendor lock repository must match inventory.");
assert(lock.commit === inventory.upstream.commit, "Vendor lock commit must match inventory.");
assert(
  exists(path.join(root, ".agents", "skills", "update-agent-skills-upstream", "references", "agent-skills-port-notes.md")),
  "Missing repository-local upstream update packaging reference."
);
for (const entry of entries) {
  outputCounts.set(entry.output, (outputCounts.get(entry.output) || 0) + 1);
}
for (const [output, count] of outputCounts) {
  assert(count === 1, `${output} appears ${count} times in generated entries`);
}

for (const cleanTarget of inventory.generated.clean) {
  const resolved = path.resolve(root, cleanTarget);
  assert(resolved === root || resolved.startsWith(root + path.sep), `Unsafe clean target: ${cleanTarget}`);
}

for (const entry of entries) {
  const kind = overlayKind(entry);
  const outputResolved = path.resolve(root, entry.output);
  assert(outputResolved !== root && outputResolved.startsWith(root + path.sep), `${entry.output} is an unsafe output path`);
  assert(supportedOverlayKinds.has(kind), `${entry.output} has unsupported overlayKind ${kind}`);
  assert(allowedClassifications.has(entry.classification), `${entry.output} has unsupported classification ${entry.classification}`);
  assert(entry.classification !== "manual-review-required", `${entry.output} still requires manual review`);
  assert(!entry.policyInjection, `${entry.output} cannot inject MDF policy into a generated surface`);
  assert(!entry.exactPatches || entry.exactPatches.length === 0, `${entry.output} cannot patch a generated surface`);
  assert(kind !== "fragment" && kind !== "patch" && kind !== "replacement", `${entry.output} uses a disallowed semantic overlay kind`);

  if (entry.source) {
    const sourcePath = path.resolve(vendorRoot, entry.source);
    assert(sourcePath.startsWith(vendorRoot + path.sep), `${entry.output} source is outside vendor/agent-skills`);
    assert(exists(sourcePath), `${entry.output} source missing: ${entry.source}`);
    if (exists(sourcePath) && entry.baseSha256) {
      assert(sha256(read(sourcePath)) === entry.baseSha256, `${entry.output} has stale baseSha256`);
    }
  }
  if (entry.overlay) {
    const overlayPath = path.resolve(overlayRoot, entry.overlay);
    assert(exists(overlayPath), `${entry.output} overlay missing: ${entry.overlay}`);
    assert(path.resolve(overlayPath).startsWith(overlayRoot + path.sep), `${entry.output} overlay is outside overlays/mdf`);
  }
  for (const mapping of entry.releaseMetadata || []) {
    assert(Array.isArray(mapping.path) && mapping.path.length > 0, `${entry.output} release metadata mapping must declare a JSON path`);
    assert(typeof mapping.value === "string" && mapping.value, `${entry.output} release metadata mapping must declare a metadata key`);
    assert(Object.prototype.hasOwnProperty.call(releaseMetadata, mapping.value), `${entry.output} release metadata references missing key ${mapping.value}`);
    if (exists(path.join(root, entry.output))) {
      let generated;
      try {
        generated = JSON.parse(readText(path.join(root, entry.output)));
      } catch (error) {
        assert(false, `${entry.output} release metadata target must be valid JSON: ${error.message}`);
        continue;
      }
      let node = generated;
      for (const key of mapping.path) {
        node = node?.[key];
      }
      assert(node === releaseMetadata[mapping.value], `${entry.output} release metadata ${mapping.path.join(".")} must match overlays/mdf/release-metadata.json ${mapping.value}`);
    }
  }
  if (kind === "renameAdapter") {
    assert(entry.source && entry.overlay, `${entry.output} renameAdapter must declare source and overlay`);
  }

  const outputPath = path.join(root, entry.output);
  assert(exists(outputPath), `${entry.output} is missing from generated output`);
  if (exists(outputPath)) {
    const mode = expectedMode(entry, kind);
    if (mode !== null) {
      const actualMode = fs.statSync(outputPath).mode & 0o777;
      assert(
        actualMode === mode,
        `${entry.output} mode must be ${formatMode(mode)}, found ${formatMode(actualMode)}`
      );
    }
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

const generatedMarkdown = [...outputs].filter((output) => output.endsWith(".md"));
const referencedPathPattern = /(?:\.agents\/skills\/[A-Za-z0-9._/-]+\/SKILL\.md|\b(?:references\/[A-Za-z0-9._/-]+\.md|agents\/[A-Za-z0-9._/-]+\.md|skills\/[A-Za-z0-9._/-]+\/SKILL\.md|scripts\/[A-Za-z0-9._/-]+))/g;
function isExternalUrlPath(content, index) {
  const tokenStart = Math.max(
    content.lastIndexOf(" ", index),
    content.lastIndexOf("\n", index),
    content.lastIndexOf("\t", index),
    content.lastIndexOf("(", index),
    content.lastIndexOf("<", index),
    content.lastIndexOf("\"", index),
    content.lastIndexOf("'", index),
    content.lastIndexOf("`", index)
  ) + 1;
  return content.slice(tokenStart, index).includes("://");
}

for (const output of generatedMarkdown) {
  const outputPath = path.join(root, output);
  if (!exists(outputPath)) continue;
  const content = readText(outputPath);
  // Exact upstream primitives retain their original prose. Their installed
  // plugin-root resolution is an MDF runtime-surface concern, not a reason to
  // patch the primitive or emit a false portability warning.
  if (entryByOutput.get(output)?.classification !== "upstream-identical") {
    warnRuntimeRootReferences(output, content);
  }
  for (const match of content.matchAll(referencedPathPattern)) {
    if (isExternalUrlPath(content, match.index)) continue;
    const referenced = match[0].replace(/[).,;:]+$/, "");
    const rootRelative = path.join(root, referenced);
    const outputRelative = path.join(path.dirname(outputPath), referenced);
    assert(
      exists(rootRelative) || exists(outputRelative),
      `${output} references missing generated path ${referenced}`
    );
  }
}

const useMdf = entries.find((entry) => entry.output === "skills/use-mdf/SKILL.md");
assert(useMdf?.classification === "mdf-only", "use-mdf must be an independent MDF-only routing skill.");
assert(overlayKind(useMdf || {}) === "mdfOnly", "use-mdf must use mdfOnly overlayKind.");
assert(!useMdf?.source, "use-mdf must not claim an upstream source.");
assert(!useMdf?.baseSha256, "use-mdf must not claim an upstream source hash.");
const usingAgentSkills = entries.find((entry) => entry.output === "skills/using-agent-skills/SKILL.md");
assert(usingAgentSkills?.classification === "upstream-identical", "using-agent-skills must remain an exact upstream primitive.");
const manual = entries.filter((entry) => entry.classification === "manual-review-required");
assert(manual.length === 0, `Manual review entries remain: ${manual.map((entry) => entry.output).join(", ")}`);

const releaseMetadataOutputs = new Set(
  entries
    .filter((entry) => Array.isArray(entry.releaseMetadata) && entry.releaseMetadata.length > 0)
    .map((entry) => entry.output)
);
for (const output of [".codex-plugin/plugin.json", ".agents/plugins/marketplace.json"]) {
  assert(releaseMetadataOutputs.has(output), `${output} must render from overlays/mdf/release-metadata.json`);
}

const syncCheck = spawnSync(process.execPath, [path.join(root, "scripts", "sync-agent-skills.js"), "--dry-run"], {
  cwd: root,
  encoding: "utf8",
});
if (syncCheck.status !== 0) {
  failures.push(`Dry-run sync comparison failed:\n${syncCheck.stdout}${syncCheck.stderr}`);
}

if (failures.length > 0) {
  console.error("Agent skills sync validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

if (warnings.length > 0) {
  console.warn("Agent skills sync validation warnings:");
  for (const warning of warnings) console.warn(`- ${warning}`);
}

console.log(`Agent skills sync validation passed for ${entries.length} files.`);
