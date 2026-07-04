#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const vendorRoot = path.join(root, "vendor", "agent-skills");
const overlayRoot = path.join(root, "overlays", "mdf");
const inventoryPath = path.join(overlayRoot, "inventory.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function rmTarget(relativePath) {
  fs.rmSync(path.join(root, relativePath), { recursive: true, force: true });
}

function ensureParent(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function copyFile(from, to) {
  ensureParent(to);
  fs.copyFileSync(from, to);
  fs.chmodSync(to, 0o644);
}

function assertInsideRoot(relativePath) {
  const resolved = path.resolve(root, relativePath);
  if (!resolved.startsWith(root + path.sep)) {
    throw new Error(`Refusing to write outside repository root: ${relativePath}`);
  }
}

const inventory = readJson(inventoryPath);

for (const target of inventory.generated.clean) {
  assertInsideRoot(target);
  rmTarget(target);
}

for (const entry of inventory.generated.entries) {
  assertInsideRoot(entry.output);
  const outputPath = path.join(root, entry.output);

  if (entry.source) {
    copyFile(path.join(vendorRoot, entry.source), outputPath);
  }

  if (entry.overlay) {
    copyFile(path.join(overlayRoot, entry.overlay), outputPath);
  }

  if (!entry.source && !entry.overlay) {
    throw new Error(`Inventory entry has no source or overlay: ${entry.output}`);
  }
}

console.log(`Synced ${inventory.generated.entries.length} files from vendor/agent-skills plus overlays/mdf.`);
