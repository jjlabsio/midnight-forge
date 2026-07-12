const fs = require("fs");
const path = require("path");
const { WorkflowError } = require("./errors");

function safeUnlink(fsImpl, filePath) {
  try {
    if (fsImpl.existsSync(filePath)) fsImpl.unlinkSync(filePath);
  } catch (_) {
    // Cleanup is best effort; the original operation error remains authoritative.
  }
}

function temporaryPath(filePath, suffix) {
  return path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.${suffix}`
  );
}

function atomicWriteFiles(entries, { fsImpl = fs } = {}) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new WorkflowError("MDF_ATOMIC_INPUT_INVALID", "At least one atomic file entry is required.");
  }
  const normalized = entries.map((entry) => {
    if (!entry || typeof entry.path !== "string" || typeof entry.content !== "string") {
      throw new WorkflowError("MDF_ATOMIC_INPUT_INVALID", "Atomic file entries require string path and content.");
    }
    return { path: entry.path, content: entry.content };
  });
  const duplicatePaths = new Set();
  for (const entry of normalized) {
    if (duplicatePaths.has(entry.path)) {
      throw new WorkflowError("MDF_ATOMIC_INPUT_INVALID", "Atomic file paths must be unique.", { path: entry.path });
    }
    duplicatePaths.add(entry.path);
  }

  const staged = [];
  const backups = [];
  const committed = [];
  try {
    for (const entry of normalized) {
      fsImpl.mkdirSync(path.dirname(entry.path), { recursive: true });
      if (fsImpl.existsSync(entry.path) && fsImpl.lstatSync(entry.path).isSymbolicLink()) {
        throw new WorkflowError("MDF_SYMLINK_PATH", "Refusing to atomically replace a symlink.", { path: entry.path });
      }
      const tempPath = temporaryPath(entry.path, "tmp");
      fsImpl.writeFileSync(tempPath, entry.content, "utf8");
      staged.push({ ...entry, tempPath });
    }
    for (const entry of staged) {
      if (fsImpl.existsSync(entry.path)) {
        const backupPath = temporaryPath(entry.path, "bak");
        fsImpl.renameSync(entry.path, backupPath);
        backups.push({ path: entry.path, backupPath });
      }
      fsImpl.renameSync(entry.tempPath, entry.path);
      committed.push(entry.path);
    }
    for (const backup of backups) safeUnlink(fsImpl, backup.backupPath);
  } catch (error) {
    for (const filePath of committed) safeUnlink(fsImpl, filePath);
    for (const entry of staged) safeUnlink(fsImpl, entry.tempPath);
    for (const backup of backups.slice().reverse()) {
      if (!fsImpl.existsSync(backup.path) && fsImpl.existsSync(backup.backupPath)) {
        try {
          fsImpl.renameSync(backup.backupPath, backup.path);
        } catch (_) {
          // Preserve the original error; the caller receives a typed stop.
        }
      }
      safeUnlink(fsImpl, backup.backupPath);
    }
    if (error instanceof WorkflowError) throw error;
    throw new WorkflowError("MDF_ATOMIC_WRITE_FAILED", "Atomic file replacement failed.", { cause: error.message });
  }
  return normalized.map((entry) => entry.path);
}

function atomicWriteText(filePath, content, options = {}) {
  return atomicWriteFiles([{ path: filePath, content }], options);
}

module.exports = { atomicWriteFiles, atomicWriteText };
