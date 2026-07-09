const fs = require("fs");
const path = require("path");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function assertInside(baseRoot, relativePath, label) {
  if (typeof relativePath !== "string" || relativePath.length === 0) {
    throw new Error(`${label} must be a non-empty relative path`);
  }
  if (path.isAbsolute(relativePath)) {
    throw new Error(`${label} must be relative: ${relativePath}`);
  }
  const resolved = path.resolve(baseRoot, relativePath);
  if (resolved !== baseRoot && !resolved.startsWith(baseRoot + path.sep)) {
    throw new Error(`${label} escapes ${baseRoot}: ${relativePath}`);
  }
  return resolved;
}

function normalizeShardEntries(shardPath, shard) {
  if (Array.isArray(shard)) return shard;
  if (Array.isArray(shard.entries)) return shard.entries;
  if (shard && typeof shard === "object" && typeof shard.output === "string") return [shard];
  throw new Error(`${shardPath} must contain an entry object or an entries array`);
}

function loadInventory(inventoryPath) {
  const inventory = readJson(inventoryPath);
  const overlayRoot = path.dirname(inventoryPath);
  const generated = inventory.generated || {};
  const inlineEntries = Array.isArray(generated.entries) ? generated.entries : [];
  const entryFiles = Array.isArray(generated.entryFiles) ? generated.entryFiles : [];

  if (inlineEntries.length > 0 && entryFiles.length > 0) {
    throw new Error("Inventory must use either generated.entries or generated.entryFiles, not both");
  }

  if (entryFiles.length === 0) {
    return inventory;
  }

  const entries = [];
  const seenEntryFiles = new Set();
  for (const entryFile of entryFiles) {
    if (seenEntryFiles.has(entryFile)) {
      throw new Error(`Duplicate inventory shard file: ${entryFile}`);
    }
    seenEntryFiles.add(entryFile);

    const shardPath = assertInside(overlayRoot, entryFile, "Inventory shard path");
    const shard = readJson(shardPath);
    entries.push(...normalizeShardEntries(shardPath, shard));
  }

  return {
    ...inventory,
    generated: {
      ...generated,
      entries,
    },
  };
}

module.exports = {
  loadInventory,
};
