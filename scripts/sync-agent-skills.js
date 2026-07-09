#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { loadInventory } = require("./overlay-inventory");

const root = path.resolve(__dirname, "..");
const vendorRoot = path.join(root, "vendor", "agent-skills");
const overlayRoot = path.join(root, "overlays", "mdf");
const inventoryPath = path.join(overlayRoot, "inventory.json");
const releaseMetadataPath = path.join(overlayRoot, "release-metadata.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function sha256(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function rmTarget(baseRoot, relativePath) {
  fs.rmSync(path.join(baseRoot, relativePath), { recursive: true, force: true });
}

function ensureParent(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function assertInside(baseRoot, relativePath) {
  const resolved = path.resolve(baseRoot, relativePath);
  if (resolved !== baseRoot && !resolved.startsWith(baseRoot + path.sep)) {
    throw new Error(`Refusing to access outside target root: ${relativePath}`);
  }
  return resolved;
}

function overlayKind(entry) {
  if (entry.overlayKind) return entry.overlayKind;
  if (!entry.source && entry.overlay) return "mdfOnly";
  if (entry.classification === "mdf-rename-or-adapter") return "renameAdapter";
  if (entry.source && entry.overlay) return "replacement";
  return "copy";
}

function artifactStorageParagraph(policy) {
  return [
    `When saving ${policy.summary}, use the MDF artifact storage rule in \`../../references/artifact-storage-override.md\` instead of any upstream default persistence rule: verify MDF user and project init state, resolve the current MDF work item, and write \`.mdf/work/{work_id}/${policy.artifactType}-NNN.md\`.`,
    "If init state is missing, stop and instruct the user to run `mdf init`.",
    `Repeated saves create new revisions and update \`item.md\` \`latest.${policy.latestKey}\` plus \`.mdf/index.jsonl\`.`,
    "Do not save this artifact to upstream tracked documentation paths by default.",
  ].join(" ");
}

function applyExactPatches(content, entry) {
  let next = content;
  for (const patch of entry.exactPatches || []) {
    const matches = next.split(patch.search).length - 1;
    if (matches !== 1) {
      throw new Error(`${entry.output} patch ${patch.id} expected one match, found ${matches}`);
    }
    next = next.replace(patch.search, patch.replace);
  }
  return next;
}

function applyPolicyInjection(content, entry) {
  if (!entry.policyInjection) return content;

  const injection = artifactStorageParagraph(entry.policyInjection);
  const anchor = entry.policyInjection.anchor;
  const matches = content.split(anchor).length - 1;
  if (matches !== 1) {
    throw new Error(`${entry.output} policy anchor expected one match, found ${matches}`);
  }
  if (entry.policyInjection.anchorSha256 && sha256(anchor) !== entry.policyInjection.anchorSha256) {
    throw new Error(`${entry.output} policy anchor hash is stale`);
  }

  if (entry.policyInjection.position === "before") {
    return content.replace(anchor, `${injection}\n\n${anchor}`);
  }
  return content.replace(anchor, `${anchor}\n${injection}\n`);
}

const inventory = loadInventory(inventoryPath);
const releaseMetadata = readJson(releaseMetadataPath);

function setJsonPath(target, pathParts, value) {
  let node = target;
  for (let index = 0; index < pathParts.length - 1; index += 1) {
    const key = pathParts[index];
    if (node[key] === undefined) {
      throw new Error(`Release metadata target path does not exist: ${pathParts.join(".")}`);
    }
    node = node[key];
  }

  const key = pathParts[pathParts.length - 1];
  if (node[key] === undefined) {
    throw new Error(`Release metadata target path does not exist: ${pathParts.join(".")}`);
  }
  node[key] = value;
}

function applyReleaseMetadata(content, entry) {
  if (!entry.releaseMetadata) return content;

  const json = JSON.parse(content);
  for (const mapping of entry.releaseMetadata) {
    if (!Object.prototype.hasOwnProperty.call(releaseMetadata, mapping.value)) {
      throw new Error(`${entry.output} references missing release metadata key: ${mapping.value}`);
    }
    setJsonPath(json, mapping.path, releaseMetadata[mapping.value]);
  }
  return JSON.stringify(json, null, 2) + "\n";
}

function renderEntry(entry) {
  const kind = overlayKind(entry);
  let content;

  if (["mdfOnly", "replacement", "renameAdapter"].includes(kind)) {
    content = readText(assertInside(overlayRoot, entry.overlay));
    return Buffer.from(applyReleaseMetadata(content, entry));
  }

  if (!entry.source) {
    throw new Error(`Inventory entry has no source: ${entry.output}`);
  }

  const sourcePath = assertInside(vendorRoot, entry.source);
  content = readText(sourcePath);
  if (entry.baseSha256 && sha256(content) !== entry.baseSha256) {
    throw new Error(`${entry.output} source hash changed; refresh the overlay base metadata`);
  }

  content = applyExactPatches(content, entry);
  content = applyPolicyInjection(content, entry);
  content = applyReleaseMetadata(content, entry);
  return Buffer.from(content);
}

function readMode(baseRoot, relativePath) {
  return fs.statSync(assertInside(baseRoot, relativePath)).mode & 0o777;
}

function parseMode(entry) {
  if (entry.mode === undefined) return null;
  if (typeof entry.mode === "number") return entry.mode;
  if (typeof entry.mode === "string" && /^[0-7]{3,4}$/.test(entry.mode)) {
    return parseInt(entry.mode, 8);
  }
  throw new Error(`${entry.output} has invalid mode ${entry.mode}`);
}

function renderMode(entry) {
  const explicitMode = parseMode(entry);
  if (explicitMode !== null) return explicitMode;

  const kind = overlayKind(entry);
  if (["mdfOnly", "replacement", "renameAdapter"].includes(kind)) {
    return readMode(overlayRoot, entry.overlay);
  }
  return readMode(vendorRoot, entry.source);
}

function formatMode(mode) {
  return (mode & 0o777).toString(8).padStart(3, "0");
}

function renderTo(targetRoot) {
  for (const target of inventory.generated.clean) {
    assertInside(targetRoot, target);
    rmTarget(targetRoot, target);
  }

  for (const entry of inventory.generated.entries) {
    assertInside(targetRoot, entry.output);
    const outputPath = path.join(targetRoot, entry.output);
    ensureParent(outputPath);
    fs.writeFileSync(outputPath, renderEntry(entry));
    fs.chmodSync(outputPath, renderMode(entry));
  }
}

function compareRendered(renderRoot) {
  const mismatches = [];
  for (const entry of inventory.generated.entries) {
    const rendered = fs.readFileSync(path.join(renderRoot, entry.output));
    const actualPath = path.join(root, entry.output);
    if (!fs.existsSync(actualPath)) {
      mismatches.push(`${entry.output} is missing from generated output`);
      continue;
    }
    const actual = fs.readFileSync(actualPath);
    if (Buffer.compare(rendered, actual) !== 0) {
      mismatches.push(`${entry.output} differs from dry-run render`);
    }
    const renderedMode = fs.statSync(path.join(renderRoot, entry.output)).mode & 0o777;
    const actualMode = fs.statSync(actualPath).mode & 0o777;
    if (renderedMode !== actualMode) {
      mismatches.push(
        `${entry.output} mode differs from dry-run render: expected ${formatMode(renderedMode)}, found ${formatMode(actualMode)}`
      );
    }
  }
  return mismatches;
}

const args = new Set(process.argv.slice(2));
if (args.has("--dry-run")) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mdf-agent-skills-render-"));
  try {
    renderTo(tempRoot);
    const mismatches = compareRendered(tempRoot);
    if (mismatches.length > 0) {
      console.error("Dry-run render differs from checked-in generated output:");
      for (const mismatch of mismatches) console.error(`- ${mismatch}`);
      process.exit(1);
    }
    console.log(`Dry-run render matched ${inventory.generated.entries.length} generated files.`);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
} else {
  renderTo(root);
  console.log(`Synced ${inventory.generated.entries.length} files from vendor/agent-skills plus overlays/mdf.`);
}
