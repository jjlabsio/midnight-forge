const fs = require("fs");
const path = require("path");

class ControllerError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

function realpath(filePath, code, message) {
  try {
    return fs.realpathSync(filePath);
  } catch (error) {
    throw new ControllerError(code, message, { path: filePath, cause: error.message });
  }
}

function isInside(parent, child) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== "..");
}

function readJson(filePath, code) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new ControllerError(code, "Failed to read controller JSON state.", { path: filePath, cause: error.message });
  }
}

function findCanonicalRoot(cwd) {
  let candidate = realpath(cwd, "MDF_CONTEXT_CWD_INVALID", "Controller cwd does not exist.");
  while (true) {
    if (fs.existsSync(path.join(candidate, ".mdf", "project", "init.json"))) return candidate;
    const parent = path.dirname(candidate);
    if (parent === candidate) break;
    candidate = parent;
  }
  throw new ControllerError("MDF_CANONICAL_ROOT_MISSING", "Could not resolve an MDF canonical project root.", { cwd });
}

function findActiveLock(canonicalRoot, cwd) {
  const lockDirectory = path.join(canonicalRoot, ".mdf", "locks");
  const worktreeRoot = realpath(
    path.join(canonicalRoot, ".worktrees"),
    "MDF_WORKTREE_DIRECTORY_MISSING",
    "Canonical worktree directory is missing."
  );
  if (!fs.existsSync(lockDirectory)) {
    throw new ControllerError("MDF_LOCK_DIRECTORY_MISSING", "MDF lock directory is missing.", { path: lockDirectory });
  }

  const matches = [];
  for (const entry of fs.readdirSync(lockDirectory, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".lock")) continue;
    const lockPath = path.join(lockDirectory, entry.name);
    const lock = readJson(lockPath, "MDF_LOCK_MALFORMED");
    if (!lock.worktree || !lock.work_id || !lock.canonical_root) continue;
    let lockWorktree;
    try {
      lockWorktree = realpath(lock.worktree, "MDF_LOCK_WORKTREE_INVALID", "Lock worktree cannot be resolved.");
    } catch (error) {
      if (path.resolve(lock.worktree) !== cwd) continue;
      throw error;
    }
    if (lockWorktree === worktreeRoot || !isInside(worktreeRoot, lockWorktree)) {
      throw new ControllerError("MDF_LOCK_WORKTREE_ESCAPE", "Active lock worktree escapes the canonical worktree directory.", {
        lock: lockPath,
        worktree: lockWorktree,
      });
    }
    if (!isInside(lockWorktree, cwd)) continue;
    const lockRoot = realpath(lock.canonical_root, "MDF_LOCK_ROOT_INVALID", "Lock canonical root cannot be resolved.");
    if (lockRoot !== canonicalRoot) {
      throw new ControllerError("MDF_LOCK_ROOT_MISMATCH", "Active lock belongs to a different canonical root.", {
        lock: lockPath,
        canonical_root: lockRoot,
      });
    }
    matches.push({ path: lockPath, value: lock });
  }

  if (matches.length === 0) {
    throw new ControllerError("MDF_ACTIVE_LOCK_MISSING", "No active MDF lock matches this working directory.", { cwd });
  }
  if (matches.length > 1) {
    throw new ControllerError("MDF_ACTIVE_LOCK_AMBIGUOUS", "More than one MDF lock matches this worktree.", {
      locks: matches.map((match) => match.path),
    });
  }
  return { ...matches[0], worktree: realpath(matches[0].value.worktree, "MDF_LOCK_WORKTREE_INVALID", "Lock worktree cannot be resolved.") };
}

function resolveWorkItem(canonicalRoot, workId) {
  const workRoot = realpath(path.join(canonicalRoot, ".mdf", "work"), "MDF_WORK_DIRECTORY_MISSING", "MDF work directory is missing.");
  if (typeof workId !== "string" || workId.length === 0 || path.isAbsolute(workId)) {
    throw new ControllerError("MDF_WORK_ID_INVALID", "Lock work_id must be a non-empty relative path.", { work_id: workId });
  }
  const candidate = path.resolve(workRoot, workId);
  if (!isInside(workRoot, candidate)) {
    throw new ControllerError("MDF_WORK_ITEM_ESCAPE", "Lock work_id escapes the canonical MDF work directory.", { work_id: workId });
  }
  const itemPath = realpath(candidate, "MDF_WORK_ITEM_MISSING", "Locked MDF work item does not exist.");
  if (!isInside(workRoot, itemPath) || !fs.existsSync(path.join(itemPath, "item.md"))) {
    throw new ControllerError("MDF_WORK_ITEM_INVALID", "Locked MDF work item is invalid.", { path: itemPath });
  }
  return { id: workId, path: itemPath, item_path: path.join(itemPath, "item.md") };
}

function resolvePluginRoot(pluginRoot) {
  const root = realpath(pluginRoot, "MDF_PLUGIN_ROOT_INVALID", "Plugin root cannot be resolved.");
  if (!fs.statSync(root).isDirectory()) {
    throw new ControllerError("MDF_PLUGIN_ROOT_INVALID", "Plugin root must be a directory.", { path: root });
  }
  return root;
}

function resolvePluginPath(pluginRoot, relativePath) {
  if (typeof relativePath !== "string" || relativePath.length === 0 || path.isAbsolute(relativePath)) {
    throw new ControllerError("MDF_PLUGIN_PATH_INVALID", "Plugin path must be a non-empty relative path.", { path: relativePath });
  }
  const candidate = path.resolve(pluginRoot, relativePath);
  if (!isInside(pluginRoot, candidate)) {
    throw new ControllerError("MDF_PLUGIN_PATH_ESCAPE", "Plugin path escapes the installed plugin root.", { path: relativePath });
  }
  const resolved = realpath(candidate, "MDF_PLUGIN_PATH_UNRESOLVED", "Plugin path is unresolved.");
  if (!isInside(pluginRoot, resolved)) {
    throw new ControllerError("MDF_PLUGIN_PATH_ESCAPE", "Plugin path resolves outside the installed plugin root.", { path: relativePath });
  }
  return resolved;
}

function resolveControllerContext({ cwd = process.cwd(), pluginRoot = path.resolve(__dirname, "..", "..") } = {}) {
  const resolvedCwd = realpath(cwd, "MDF_CONTEXT_CWD_INVALID", "Controller cwd does not exist.");
  const canonicalRoot = findCanonicalRoot(resolvedCwd);
  const lock = findActiveLock(canonicalRoot, resolvedCwd);
  const workItem = resolveWorkItem(canonicalRoot, lock.value.work_id);
  return {
    canonical_root: canonicalRoot,
    worktree: lock.worktree,
    lock: {
      path: lock.path,
      task_id: lock.value.task_id || null,
      work_id: lock.value.work_id,
      branch: lock.value.branch || null,
    },
    work_item: workItem,
    plugin_root: resolvePluginRoot(pluginRoot),
  };
}

module.exports = {
  ControllerError,
  resolveControllerContext,
  resolvePluginPath,
};
