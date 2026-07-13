const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");
const { parseScalar } = require("../mdf-runtime/schema");

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

const REVIEW_TASK_KEYS = new Set([
  "work_id", "task_id", "kind", "title", "order", "status", "created", "due",
  "completed", "depends_on", "track_id", "latest", "worktree", "branch",
]);
const REVIEW_LOCK_KEYS = new Set(["task_id", "work_id", "canonical_root", "worktree", "branch", "started", "runtime"]);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function reviewError(code, message, details = {}) {
  return new ControllerError(code, message, details);
}

function hashBytes(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function metadataError(filePath, field, message, details = {}) {
  throw reviewError("MDF_REVIEW_TASK_METADATA_INVALID", message, { path: filePath, field, ...details });
}

function readStrictFrontmatter(filePath) {
  let content;
  try {
    content = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    throw reviewError("MDF_REVIEW_TASK_METADATA_INVALID", "Review task card could not be read.", { path: filePath, cause: error.message });
  }
  if (!content.startsWith("---\n")) metadataError(filePath, "frontmatter", "Review task card has no frontmatter.");
  const end = content.indexOf("\n---\n", 4);
  if (end < 0) metadataError(filePath, "frontmatter", "Review task card frontmatter is unterminated.");
  const data = {};
  const seen = new Set();
  let mapKey = null;
  for (const line of content.slice(4, end).split(/\r?\n/)) {
    if (!line.trim()) continue;
    const child = line.match(/^  ([A-Za-z0-9_-]+):\s*(.*)$/);
    if (child) {
      if (mapKey !== "latest" || !data.latest || typeof data.latest !== "object" || Array.isArray(data.latest)) {
        metadataError(filePath, mapKey || "frontmatter", "Only latest may contain nested metadata.");
      }
      if (Object.prototype.hasOwnProperty.call(data.latest, child[1])) {
        metadataError(filePath, `latest.${child[1]}`, "Duplicate frontmatter key.");
      }
      try {
        data.latest[child[1]] = parseScalar(child[2]);
      } catch (error) {
        metadataError(filePath, `latest.${child[1]}`, "Nested frontmatter value is malformed.", { cause: error.message });
      }
      continue;
    }
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) metadataError(filePath, "frontmatter", "Unsupported frontmatter line.", { line });
    const key = match[1];
    if (!REVIEW_TASK_KEYS.has(key)) metadataError(filePath, key, "Unknown frontmatter key.");
    if (seen.has(key)) metadataError(filePath, key, "Duplicate frontmatter key.");
    seen.add(key);
    mapKey = null;
    try {
      data[key] = parseScalar(match[2]);
    } catch (error) {
      metadataError(filePath, key, "Frontmatter value is malformed.", { cause: error.message });
    }
    if (match[2].trim() === "") {
      data[key] = {};
      mapKey = key;
    }
  }
  return { data, bytes: fs.readFileSync(filePath) };
}

function isValidIsoDate(value) {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function assertNoSymlinkAncestors(filePath, code, message, details = {}) {
  if (!path.isAbsolute(filePath)) throw reviewError(code, message, { ...details, actual: filePath });
  const parsed = path.parse(filePath);
  let current = parsed.root;
  for (const part of path.relative(parsed.root, filePath).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    if (!fs.existsSync(current)) continue;
    let stat;
    try { stat = fs.lstatSync(current); } catch (error) {
      throw reviewError(code, message, { ...details, path: current, cause: error.message });
    }
    if (stat.isSymbolicLink()) throw reviewError(code, message, { ...details, path: current, symlink: true });
  }
}

function canonicalPath(filePath, code, message, details = {}) {
  assertNoSymlinkAncestors(filePath, code, message, details);
  return realpath(filePath, code, message);
}

function canonicalDirectory(filePath, code, message, details = {}) {
  const resolved = canonicalPath(filePath, code, message, details);
  let stat;
  try { stat = fs.statSync(resolved); } catch (error) {
    throw reviewError(code, message, { ...details, path: resolved, cause: error.message });
  }
  if (!stat.isDirectory()) throw reviewError(code, message, { ...details, path: resolved });
  return resolved;
}

function containedCanonicalPath(filePath, boundary, code, message, details = {}) {
  const resolved = canonicalPath(filePath, code, message, details);
  if (!isInside(boundary, resolved)) throw reviewError(code, message, { ...details, expected: boundary, actual: resolved });
  return resolved;
}

function reviewTask(filePath, itemDirectory, canonicalRoot, worktreesRoot, parsed = readStrictFrontmatter(filePath)) {
  const data = parsed.data;
  if (data.kind !== "task") metadataError(filePath, "kind", "Review candidate must be a task.", { actual: data.kind });
  if (typeof data.work_id !== "string" || !data.work_id || path.basename(itemDirectory) !== data.work_id) {
    metadataError(filePath, "work_id", "Task work_id must match its work-item directory.", { actual: data.work_id, directory: path.basename(itemDirectory) });
  }
  if (typeof data.task_id !== "string" || !/^\d{4}$/.test(data.task_id)) metadataError(filePath, "task_id", "Task ID must be exactly four digits.", { actual: data.task_id });
  if (typeof data.title !== "string" || !data.title.trim()) metadataError(filePath, "title", "Task title must be a non-empty string.");
  if (!Number.isInteger(data.order)) metadataError(filePath, "order", "Task order must be numeric.", { actual: data.order });
  if (!isValidIsoDate(data.created)) metadataError(filePath, "created", "Task created date must be ISO YYYY-MM-DD.", { actual: data.created });
  if (data.due !== undefined && !isValidIsoDate(data.due)) metadataError(filePath, "due", "Task due date must be ISO YYYY-MM-DD.", { actual: data.due });
  if (data.completed !== undefined && !isValidIsoDate(data.completed)) metadataError(filePath, "completed", "Task completed date must be ISO YYYY-MM-DD.", { actual: data.completed });
  if (data.depends_on !== undefined && (!Array.isArray(data.depends_on) || data.depends_on.some((value) => typeof value !== "string"))) metadataError(filePath, "depends_on", "Task dependencies must be a string list.");
  if (data.track_id !== undefined && (typeof data.track_id !== "string" || !data.track_id.trim())) metadataError(filePath, "track_id", "Task track_id must be a non-empty string.");
  if (data.latest !== undefined && (!data.latest || typeof data.latest !== "object" || Array.isArray(data.latest))) metadataError(filePath, "latest", "Task latest must be a map.");
  if (!["queue", "active", "done"].includes(data.status)) {
    if (typeof data.status !== "string") metadataError(filePath, "status", "Task status must be a string.", { actual: data.status });
    throw reviewError("MDF_REVIEW_TASK_STATE_INVALID", "Task status is not supported for review resolution.", { path: filePath, field: "status", actual: data.status });
  }
  if (data.completed !== undefined && ["queue", "active"].includes(data.status)) {
    throw reviewError("MDF_REVIEW_TASK_METADATA_CONTRADICTORY", "Task completion metadata contradicts its status.", { path: filePath, field: "completed", status: data.status });
  }
  if (["active", "done"].includes(data.status) && (typeof data.worktree !== "string" || !data.worktree.trim() || typeof data.branch !== "string" || !data.branch.trim())) {
    metadataError(filePath, "worktree/branch", "Active and completed tasks require persisted worktree and branch.");
  }
  if (data.worktree !== undefined && (typeof data.worktree !== "string" || !path.isAbsolute(data.worktree))) metadataError(filePath, "worktree", "Persisted worktree must be an absolute path.", { actual: data.worktree });
  if (data.branch !== undefined && (typeof data.branch !== "string" || !data.branch.trim())) metadataError(filePath, "branch", "Persisted branch must be a non-empty string.");
  let worktree = null;
  let worktree_error = null;
  if (data.worktree !== undefined) {
    try {
      worktree = containedCanonicalPath(data.worktree, worktreesRoot, "MDF_REVIEW_TASK_METADATA_INVALID", "Persisted worktree is not a canonical in-root worktree.", { path: filePath, field: "worktree" });
      if (data.worktree !== worktree) {
        worktree_error = reviewError("MDF_REVIEW_TASK_METADATA_INVALID", "Persisted worktree must equal its canonical realpath.", { path: filePath, field: "worktree", expected: worktree, actual: data.worktree });
      }
    } catch (error) {
      worktree_error = error;
    }
  }
  return { path: filePath, directory: itemDirectory, data, worktree, worktree_error, card_sha256: hashBytes(parsed.bytes) };
}

function scanReviewTasks(canonicalRoot, worktreesRoot) {
  const workRoot = canonicalDirectory(path.join(canonicalRoot, ".mdf", "work"), "MDF_REVIEW_TASK_METADATA_INVALID", "Review work-item directory is invalid.");
  const tasks = [];
  for (const entry of fs.readdirSync(workRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) throw reviewError("MDF_REVIEW_TASK_METADATA_INVALID", "Review work-item directory must be a real directory.", { path: path.join(workRoot, entry.name) });
    const directory = path.join(workRoot, entry.name);
    const itemPath = path.join(directory, "item.md");
    if (!fs.existsSync(itemPath) || fs.lstatSync(itemPath).isSymbolicLink() || !fs.statSync(itemPath).isFile()) {
      throw reviewError("MDF_REVIEW_TASK_METADATA_INVALID", "Review work-item must contain a regular item.md.", { path: itemPath });
    }
    const parsed = readStrictFrontmatter(itemPath);
    if (parsed.data.kind !== "task") continue;
    tasks.push(reviewTask(itemPath, directory, canonicalRoot, worktreesRoot, parsed));
  }
  return tasks;
}

function candidateIdentity(task) {
  return { task_id: task.data.task_id, work_id: task.data.work_id, status: task.data.status, worktree: task.worktree, branch: task.data.branch, path: task.path };
}

function assertNoReviewCollisions(tasks) {
  for (const field of ["task_id", "work_id", "worktree", "branch"]) {
    const groups = new Map();
    for (const task of tasks) {
      const value = field === "worktree" ? task.worktree : field === "branch" ? task.data.branch : task.data[field];
      if (!value) continue;
      const list = groups.get(value) || [];
      list.push(task);
      groups.set(value, list);
    }
    for (const [value, group] of groups) {
      if (group.length > 1) throw reviewError("MDF_REVIEW_CONTEXT_AMBIGUOUS", "Review task identity collides on a persisted checkout field.", { field, value, candidates: group.map(candidateIdentity) });
    }
  }
}

function strictLockObject(filePath) {
  let content;
  try { content = fs.readFileSync(filePath, "utf8"); } catch (error) {
    throw reviewError("MDF_REVIEW_LOCK_MALFORMED", "Review lock could not be read.", { path: filePath, cause: error.message });
  }
  const keys = [...content.matchAll(/"((?:\\.|[^"\\])*)"\s*:/g)].map((match) => JSON.parse(`"${match[1]}"`));
  if (new Set(keys).size !== keys.length) throw reviewError("MDF_REVIEW_LOCK_MALFORMED", "Review lock contains duplicate JSON keys.", { path: filePath });
  let value;
  try { value = JSON.parse(content); } catch (error) {
    throw reviewError("MDF_REVIEW_LOCK_MALFORMED", "Review lock JSON is malformed.", { path: filePath, cause: error.message });
  }
  if (!value || typeof value !== "object" || Array.isArray(value) || JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...REVIEW_LOCK_KEYS].sort())) {
    throw reviewError("MDF_REVIEW_LOCK_MALFORMED", "Review lock schema is invalid.", { path: filePath, keys: Object.keys(value || {}) });
  }
  for (const key of REVIEW_LOCK_KEYS) if (typeof value[key] !== "string" || !value[key].trim()) throw reviewError("MDF_REVIEW_LOCK_MALFORMED", "Review lock fields must be non-empty strings.", { path: filePath, field: key });
  return value;
}

function reviewLock(canonicalRoot, worktreesRoot, task, currentWorktree, currentBranch) {
  const locksRoot = path.join(canonicalRoot, ".mdf", "locks");
  if (!fs.existsSync(locksRoot)) throw reviewError("MDF_REVIEW_LOCK_MISSING", "Review task lock directory is missing.", { path: locksRoot });
  try { canonicalDirectory(locksRoot, "MDF_REVIEW_LOCK_MALFORMED", "Review lock directory is not canonical."); } catch (error) {
    if (error.code === "MDF_REVIEW_LOCK_MALFORMED") throw error;
    throw reviewError("MDF_REVIEW_LOCK_MALFORMED", "Review lock directory is invalid.", { path: locksRoot, cause: error.message });
  }
  const lockPath = path.join(locksRoot, `${task.data.task_id}.lock`);
  if (!fs.existsSync(lockPath)) throw reviewError("MDF_REVIEW_LOCK_MISSING", "Matching review task lock is missing.", { path: lockPath, task_id: task.data.task_id });
  let stat;
  try { stat = fs.lstatSync(lockPath); } catch (error) { throw reviewError("MDF_REVIEW_LOCK_MALFORMED", "Matching review task lock cannot be inspected.", { path: lockPath, cause: error.message }); }
  if (stat.isSymbolicLink() || !stat.isFile()) throw reviewError("MDF_REVIEW_LOCK_MALFORMED", "Matching review task lock must be a regular non-symlink file.", { path: lockPath });
  const lock = strictLockObject(lockPath);
  const lockRoot = canonicalPath(lock.canonical_root, "MDF_REVIEW_LOCK_MALFORMED", "Review lock canonical_root is invalid.", { path: lockPath, field: "canonical_root" });
  const lockWorktree = canonicalPath(lock.worktree, "MDF_REVIEW_LOCK_MALFORMED", "Review lock worktree is invalid.", { path: lockPath, field: "worktree" });
  if (lock.canonical_root !== lockRoot) throw reviewError("MDF_REVIEW_LOCK_MALFORMED", "Review lock canonical_root must equal its canonical realpath.", { path: lockPath, field: "canonical_root", expected: lockRoot, actual: lock.canonical_root });
  if (lock.worktree !== lockWorktree) throw reviewError("MDF_REVIEW_LOCK_MALFORMED", "Review lock worktree must equal its canonical realpath.", { path: lockPath, field: "worktree", expected: lockWorktree, actual: lock.worktree });
  if (!isInside(worktreesRoot, lockWorktree)) throw reviewError("MDF_REVIEW_LOCK_MALFORMED", "Review lock worktree escapes .worktrees.", { path: lockPath, field: "worktree", expected: worktreesRoot, actual: lockWorktree });
  const expected = { task_id: task.data.task_id, work_id: task.data.work_id, canonical_root: canonicalRoot, worktree: task.worktree, branch: task.data.branch };
  const actual = { task_id: lock.task_id, work_id: lock.work_id, canonical_root: lockRoot, worktree: lockWorktree, branch: lock.branch };
  for (const field of Object.keys(expected)) if (expected[field] !== actual[field]) throw reviewError("MDF_REVIEW_LOCK_MISMATCH", "Review lock does not match canonical task and checkout identity.", { path: lockPath, field, expected: expected[field], actual: actual[field] });
  if (lockWorktree !== currentWorktree) throw reviewError("MDF_REVIEW_WORKTREE_MISMATCH", "Active review lock worktree does not match the current checkout.", { path: lockPath, field: "worktree", expected: currentWorktree, actual: lockWorktree });
  if (lock.branch !== currentBranch) throw reviewError("MDF_REVIEW_BRANCH_MISMATCH", "Active review lock branch does not match the current checkout.", { path: lockPath, field: "branch", expected: currentBranch, actual: lock.branch });
  return { path: lockPath, ...lock, canonical_root: lockRoot, worktree: lockWorktree };
}

function gitFact(cwd, args, code, message) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.status !== 0) throw reviewError(code, message, { args, stderr: result.stderr });
  return result.stdout.trim();
}

function resolveReviewControllerContext({ cwd = process.cwd(), pluginRoot = path.resolve(__dirname, "..", "..") } = {}) {
  const resolvedCwd = realpath(cwd, "MDF_CONTEXT_CWD_INVALID", "Controller cwd does not exist.");
  const canonicalRoot = findCanonicalRoot(resolvedCwd);
  const worktreesRoot = canonicalDirectory(path.join(canonicalRoot, ".worktrees"), "MDF_REVIEW_TASK_METADATA_INVALID", "Canonical .worktrees directory is invalid.");
  const currentWorktree = containedCanonicalPath(gitFact(resolvedCwd, ["rev-parse", "--show-toplevel"], "MDF_REVIEW_GIT_CONTEXT_FAILED", "Could not resolve the current Git worktree."), worktreesRoot, "MDF_REVIEW_WORKTREE_MISMATCH", "Current Git worktree is outside canonical .worktrees.", { field: "worktree" });
  const currentBranch = gitFact(resolvedCwd, ["branch", "--show-current"], "MDF_REVIEW_GIT_CONTEXT_FAILED", "Could not resolve the current Git branch.");
  const tasks = scanReviewTasks(canonicalRoot, worktreesRoot);
  assertNoReviewCollisions(tasks);
  const candidates = tasks.filter((task) => task.worktree === currentWorktree || (currentBranch && task.data.branch === currentBranch));
  if (candidates.length === 0) throw reviewError("MDF_REVIEW_CONTEXT_AMBIGUOUS", "No review task matches the current checkout.", { worktree: currentWorktree, branch: currentBranch, candidates: tasks.map(candidateIdentity) });
  if (candidates.length > 1) throw reviewError("MDF_REVIEW_CONTEXT_AMBIGUOUS", "More than one review task matches the current checkout.", { worktree: currentWorktree, branch: currentBranch, candidates: candidates.map(candidateIdentity) });
  const task = candidates[0];
  if (task.worktree_error) throw task.worktree_error;
  if (task.worktree !== currentWorktree) throw reviewError("MDF_REVIEW_WORKTREE_MISMATCH", "Persisted task worktree does not match the current checkout.", { path: task.path, field: "worktree", expected: currentWorktree, actual: task.worktree });
  if (task.data.branch !== currentBranch) throw reviewError("MDF_REVIEW_BRANCH_MISMATCH", "Persisted task branch does not match the current checkout.", { path: task.path, field: "branch", expected: currentBranch, actual: task.data.branch });
  if (task.data.status === "queue") throw reviewError("MDF_REVIEW_TASK_NOT_ACTIVE_OR_COMPLETED", "Queued tasks are not reviewable.", { path: task.path, task_id: task.data.task_id, status: task.data.status });
  let lock = null;
  if (task.data.status === "active") lock = reviewLock(canonicalRoot, worktreesRoot, task, currentWorktree, currentBranch);
  if (task.data.status === "done") {
    const expectedLock = path.join(canonicalRoot, ".mdf", "locks", `${task.data.task_id}.lock`);
    if (fs.existsSync(expectedLock)) throw reviewError("MDF_REVIEW_TASK_STATE_INVALID", "Completed review task unexpectedly has a matching lock.", { path: expectedLock, task_id: task.data.task_id });
  }
  const workItem = { id: task.data.work_id, path: task.directory, item_path: task.path };
  return {
    canonical_root: canonicalRoot,
    worktree: currentWorktree,
    lock,
    task: { ...task.data, task_id: task.data.task_id, work_id: task.data.work_id, item_path: task.path, card_sha256: task.card_sha256, worktree: task.worktree },
    work_item: workItem,
    plugin_root: resolvePluginRoot(pluginRoot),
  };
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

function readLatestPointer(context, key) {
  if (typeof key !== "string" || !/^[A-Za-z0-9_-]+$/.test(key)) {
    throw new ControllerError("MDF_ITEM_LATEST_INVALID", "Latest pointer key is invalid.", { key });
  }
  let content;
  try {
    content = fs.readFileSync(context.work_item.item_path, "utf8");
  } catch (error) {
    throw new ControllerError("MDF_ITEM_LATEST_INVALID", "Could not read canonical item metadata.", { cause: error.message });
  }
  if (!content.startsWith("---\n")) throw new ControllerError("MDF_ITEM_LATEST_INVALID", "Canonical item metadata has no frontmatter.");
  const end = content.indexOf("\n---\n", 4);
  if (end < 0) throw new ControllerError("MDF_ITEM_LATEST_INVALID", "Canonical item metadata frontmatter is unterminated.");
  const lines = content.slice(4, end).split(/\r?\n/);
  let inLatest = false;
  for (const line of lines) {
    if (/^latest:\s*(?:\{\})?\s*$/.test(line)) {
      inLatest = true;
      continue;
    }
    if (inLatest && !line.startsWith("  ") && line.trim()) inLatest = false;
    if (!inLatest) continue;
    const match = line.match(new RegExp(`^  ${key}:\\s*(?:"([^"]*)"|'([^']*)'|(\\S+))\\s*$`));
    if (match) return match[1] ?? match[2] ?? match[3];
  }
  return null;
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
  readLatestPointer,
  resolveReviewControllerContext,
  resolveControllerContext,
  resolvePluginPath,
};
