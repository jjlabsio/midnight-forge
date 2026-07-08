#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const vendorRoot = path.join(root, "vendor", "agent-skills");
const overlayRoot = path.join(root, "overlays", "mdf");
const inventoryPath = path.join(overlayRoot, "inventory.json");
const lockPath = path.join(root, "vendor", "agent-skills.lock.json");
const releaseMetadataPath = path.join(overlayRoot, "release-metadata.json");
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
  if (entry.overlayKind) return entry.overlayKind;
  if (!entry.source && entry.overlay) return "mdfOnly";
  if (entry.classification === "mdf-rename-or-adapter") return "renameAdapter";
  if (entry.source && entry.overlay) return "replacement";
  return "copy";
}

function stripFrontmatter(content) {
  if (!content.startsWith("---\n")) return content;
  const end = content.indexOf("\n---\n", 4);
  if (end === -1) return content;
  return content.slice(end + "\n---\n".length);
}

function validateArtifactStoragePlacement(entry, generated) {
  const body = stripFrontmatter(generated);
  const lines = body.split(/\r?\n/);
  const h1Index = lines.findIndex((line) => /^# [^#]/.test(line));
  assert(h1Index !== -1, `${entry.output} artifact storage injection requires a first H1 after frontmatter`);

  const marker = "MDF artifact storage rule";
  const markerLines = [];
  lines.forEach((line, index) => {
    if (line.includes(marker)) markerLines.push(index);
  });
  assert(markerLines.length === 1, `${entry.output} artifact storage policy must appear exactly once; found ${markerLines.length}`);
  if (h1Index === -1 || markerLines.length !== 1) return;

  const markerIndex = markerLines[0];
  const firstH2Index = lines.findIndex((line) => /^## [^#]/.test(line));
  assert(markerIndex > h1Index, `${entry.output} artifact storage policy must render after the first H1`);
  assert(firstH2Index === -1 || markerIndex < firstH2Index, `${entry.output} artifact storage policy must render before the first H2`);

  const firstContentAfterH1 = lines.findIndex((line, index) => index > h1Index && line.trim() !== "");
  assert(firstContentAfterH1 === markerIndex, `${entry.output} artifact storage policy must be the first content after the first H1`);
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

const inventory = readJson(inventoryPath);
const lock = readJson(lockPath);
const releaseMetadata = readJson(releaseMetadataPath);
const entries = inventory.generated.entries;
const outputs = new Set(entries.map((entry) => entry.output));
const outputCounts = new Map();
const warnings = [];
const supportedOverlayKinds = new Set(inventory.overlayV2?.supportedKinds || []);
const allowedClassifications = new Set([
  "upstream-identical",
  "artifact-storage-only",
  "mdf-overlay-required",
  "mdf-rename-or-adapter",
  "mdf-only",
  "upstream-drift-preserved",
]);

assert(inventory.schemaVersion === 2, "Inventory schemaVersion must be 2 for overlay v2.");
assert(exists(releaseMetadataPath), "Missing overlays/mdf/release-metadata.json.");
assert(/^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(releaseMetadata.version), "Release metadata version must be semver.");
assert(releaseMetadata.marketplaceRef === `v${releaseMetadata.version}`, "Release metadata marketplaceRef must match v{version}.");
for (const kind of ["copy", "mdfOnly", "fragment", "patch", "replacement", "renameAdapter"]) {
  assert(supportedOverlayKinds.has(kind), `Overlay v2 must support ${kind}.`);
}
assert(lock.repository === inventory.upstream.repository, "Vendor lock repository must match inventory.");
assert(lock.commit === inventory.upstream.commit, "Vendor lock commit must match inventory.");
assert(exists(path.join(overlayRoot, "references", "artifact-storage-override.md")), "Missing common MDF artifact storage override.");
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
  if (entry.classification === "artifact-storage-only") {
    assert(entry.artifactStorageOverride === true, `${entry.output} must point at the common artifact storage override`);
    assert(kind === "fragment" || kind === "patch", `${entry.output} artifact storage entry must use fragment or patch overlay v2`);
    assert(!entry.overlay, `${entry.output} artifact storage entry must not use a full replacement overlay`);
    assert(entry.policyInjection, `${entry.output} artifact storage entry must declare a policy injection`);
    if (exists(path.join(root, entry.output))) {
      const generated = readText(path.join(root, entry.output));
      validateArtifactStoragePlacement(entry, generated);
      for (const forbidden of [/`docs\//, /\bdocs\/[A-Za-z0-9._/-]+/, /`SPEC\.md`/, /`tasks\/plan\.md`/, /`tasks\/todo\.md`/]) {
        assert(!forbidden.test(generated), `${entry.output} retains an upstream tracked artifact storage path matching ${forbidden}`);
      }
    }
  }
  if (kind === "fragment") {
    assert(entry.source, `${entry.output} fragment overlay must have a source`);
    assert(entry.policyInjection?.anchor, `${entry.output} fragment overlay must have an anchor`);
    if (entry.source && entry.policyInjection?.anchor && exists(path.join(vendorRoot, entry.source))) {
      const source = readText(path.join(vendorRoot, entry.source));
      const matches = source.split(entry.policyInjection.anchor).length - 1;
      assert(matches === 1, `${entry.output} fragment anchor must occur exactly once; found ${matches}`);
      if (entry.policyInjection.anchorSha256) {
        assert(sha256(entry.policyInjection.anchor) === entry.policyInjection.anchorSha256, `${entry.output} fragment anchor hash is stale`);
      }
    }
  }
  for (const patch of entry.exactPatches || []) {
    assert(kind === "fragment" || kind === "patch", `${entry.output} exact patch is only allowed on fragment or patch entries`);
    assert(patch.id && patch.search && patch.replace, `${entry.output} exact patch is missing id/search/replace`);
    if (entry.source && exists(path.join(vendorRoot, entry.source))) {
      const source = readText(path.join(vendorRoot, entry.source));
      const matches = source.split(patch.search).length - 1;
      assert(matches === 1, `${entry.output} exact patch ${patch.id} must match once; found ${matches}`);
    }
  }
  if (kind === "replacement" && entry.source) {
    assert(entry.baseSha256, `${entry.output} replacement must declare baseSha256`);
    assert(entry.replacementRationale, `${entry.output} replacement must declare replacementRationale`);
    assert(entry.reviewRisk, `${entry.output} replacement must declare reviewRisk`);
  }
  if (kind === "renameAdapter") {
    assert(entry.source && entry.overlay, `${entry.output} renameAdapter must declare source and overlay`);
  }

  const outputPath = path.join(root, entry.output);
  assert(exists(outputPath), `${entry.output} is missing from generated output`);
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
const referencedPathPattern = /\b(?:references\/[A-Za-z0-9._/-]+\.md|agents\/[A-Za-z0-9._/-]+\.md|skills\/[A-Za-z0-9._/-]+\/SKILL\.md|scripts\/[A-Za-z0-9._/-]+)/g;
for (const output of generatedMarkdown) {
  const outputPath = path.join(root, output);
  if (!exists(outputPath)) continue;
  const content = readText(outputPath);
  warnRuntimeRootReferences(output, content);
  for (const match of content.matchAll(referencedPathPattern)) {
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
assert(useMdf?.source === "skills/using-agent-skills/SKILL.md", "use-mdf must explicitly adapt upstream using-agent-skills.");
assert(useMdf?.classification === "mdf-rename-or-adapter", "use-mdf must use mdf-rename-or-adapter classification.");
assert(overlayKind(useMdf || {}) === "renameAdapter", "use-mdf must use renameAdapter overlayKind.");

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
