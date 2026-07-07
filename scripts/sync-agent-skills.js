#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

const root = path.resolve(__dirname, "..");
const vendorRoot = path.join(root, "vendor", "agent-skills");
const overlayRoot = path.join(root, "overlays", "mdf");
const inventoryPath = path.join(overlayRoot, "inventory.json");

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
    `When saving ${policy.summary}, follow the MDF artifact storage override in \`references/artifact-storage-override.md\`: verify MDF user and project init state, resolve the current MDF work item, and write \`.mdf/work/{work_id}/${policy.artifactType}-NNN.md\`.`,
    "If init state is missing, stop and instruct the user to run `mdf init`.",
    `Repeated saves create new revisions and update \`item.md\` \`latest.${policy.latestKey}\` plus \`.mdf/index.jsonl\`.`,
    "Promote artifacts into tracked project docs only when the user explicitly asks or project policy requires it.",
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

const inventory = readJson(inventoryPath);

function renderEntry(entry) {
  const kind = overlayKind(entry);

  if (["mdfOnly", "replacement", "renameAdapter"].includes(kind)) {
    return fs.readFileSync(assertInside(overlayRoot, entry.overlay));
  }

  if (!entry.source) {
    throw new Error(`Inventory entry has no source: ${entry.output}`);
  }

  const sourcePath = assertInside(vendorRoot, entry.source);
  let content = readText(sourcePath);
  if (entry.baseSha256 && sha256(content) !== entry.baseSha256) {
    throw new Error(`${entry.output} source hash changed; refresh the overlay base metadata`);
  }

  content = applyExactPatches(content, entry);
  content = applyPolicyInjection(content, entry);
  return Buffer.from(content);
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
    fs.chmodSync(outputPath, 0o644);
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
