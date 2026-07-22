#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

class BriefError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function fail(code, message) {
  throw new BriefError(code, message);
}

function lstat(filePath, code = "UNSAFE_PATH") {
  let stats;
  try {
    stats = fs.lstatSync(filePath);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    fail(code, `Cannot inspect ${filePath}: ${error.message}`);
  }
  if (stats.isSymbolicLink()) {
    fail(code === "UNSAFE_WORKTREE" ? code : "UNSAFE_PATH", `Symbolic links are not allowed: ${filePath}`);
  }
  return stats;
}

function requireDirectory(directoryPath, code = "MISSING_STATE") {
  const stats = lstat(directoryPath, code);
  if (!stats || !stats.isDirectory()) fail(code, `Expected a directory: ${directoryPath}`);
}

function requireFile(filePath, code = "MISSING_STATE") {
  const stats = lstat(filePath, code);
  if (!stats || !stats.isFile()) fail(code, `Expected a regular file: ${filePath}`);
}

function readJson(filePath, code) {
  requireFile(filePath, code);
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    fail(code, `Invalid JSON in ${filePath}: ${error.message}`);
  }
}

function relativePath(root, filePath) {
  return path.relative(root, filePath).split(path.sep).join("/");
}

function canonicalizePath(rawPath, root, code, allowRoot = false) {
  if (typeof rawPath !== "string" || !path.isAbsolute(rawPath)) fail(code, `Expected an absolute path: ${rawPath}`);
  let current = path.resolve(rawPath);
  const suffix = [];
  while (!lstat(current, code)) {
    const parent = path.dirname(current);
    if (parent === current) fail(code, `Path does not resolve: ${rawPath}`);
    suffix.unshift(path.basename(current));
    current = parent;
  }
  const canonical = path.join(fs.realpathSync(current), ...suffix);
  const relative = path.relative(root, canonical);
  if (relative.startsWith("..") || path.isAbsolute(relative) || (!allowRoot && relative === "")) {
    fail(code, `Path is outside the canonical project root: ${canonical}`);
  }
  if (relative !== "") assertNoSymlinkComponents(root, path.dirname(canonical));
  return canonical;
}

function assertNoSymlinkComponents(root, start) {
  const relative = path.relative(root, start);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    fail("UNSAFE_PATH", `Path is outside the canonical root: ${start}`);
  }
  let current = root;
  for (const component of relative ? relative.split(path.sep) : []) {
    current = path.join(current, component);
    const stats = lstat(current);
    if (stats?.isSymbolicLink()) fail("UNSAFE_PATH", `Symbolic path component: ${current}`);
  }
}

function resolveRoot(start) {
  const absoluteStart = path.resolve(start);
  let current = absoluteStart;
  while (true) {
    const initPath = path.join(current, ".mdf", "project", "init.json");
    if (lstat(initPath, "MALFORMED_PROJECT_INIT")) {
      const root = fs.realpathSync(current);
      const realStart = fs.realpathSync(absoluteStart);
      assertNoSymlinkComponents(root, realStart);
      const init = readJson(initPath, "MALFORMED_PROJECT_INIT");
      if (!init || typeof init !== "object" || Array.isArray(init) || typeof init.canonical_root !== "string") {
        fail("MALFORMED_PROJECT_INIT", `canonical_root is required in ${initPath}`);
      }
      const declaredStats = lstat(init.canonical_root, "MALFORMED_PROJECT_INIT");
      if (!declaredStats?.isDirectory()) fail("MALFORMED_PROJECT_INIT", `canonical_root is not a directory: ${init.canonical_root}`);
      const declared = fs.realpathSync(init.canonical_root);
      if (declared !== root) fail("CANONICAL_ROOT_MISMATCH", `Project init points to ${declared}, not ${root}`);
      return root;
    }
    const parent = path.dirname(current);
    if (parent === current) fail("ROOT_NOT_FOUND", "No canonical .mdf project root was found");
    current = parent;
  }
}

function normalizeTaskId(value) {
  if (typeof value !== "string" || !/^\d{1,4}$/.test(value)) {
    fail("INVALID_TASK_ID", "Task ID must contain one to four decimal digits");
  }
  return value.padStart(4, "0");
}

function validateBranch(value, filePath, code = "UNSAFE_BRANCH") {
  if (typeof value !== "string" || !value || !/^[A-Za-z0-9._/-]+$/.test(value)) {
    fail(code, `Invalid branch in ${filePath}`);
  }
  if (value.split("/").some((part) => part === "" || part === "." || part === "..") || value.includes("..")) {
    fail(code, `Invalid branch in ${filePath}`);
  }
  return value;
}

function parseScalar(raw, filePath, key) {
  const value = raw.trim();
  if (!value) fail("MALFORMED_CARD", `Missing value for ${key} in ${filePath}`);
  if (/^[\[{"\d-]/.test(value) || /^(true|false|null)$/.test(value)) {
    try {
      return JSON.parse(value);
    } catch (error) {
      fail("MALFORMED_CARD", `Invalid value for ${key} in ${filePath}: ${error.message}`);
    }
  }
  return value;
}

function parseCard(filePath, root) {
  requireFile(filePath, "MALFORMED_CARD");
  const content = fs.readFileSync(filePath, "utf8").replace(/\r\n?/g, "\n");
  if (!content.startsWith("---\n")) fail("MALFORMED_CARD", `Missing frontmatter in ${filePath}`);
  const end = content.indexOf("\n---\n", 4);
  if (end < 0) fail("MALFORMED_CARD", `Unclosed frontmatter in ${filePath}`);

  const fields = {};
  for (const line of content.slice(4, end).split("\n")) {
    if (!line.trim() || line.trimStart().startsWith("#") || /^\s/.test(line)) continue;
    const match = line.match(/^([A-Za-z][A-Za-z0-9_-]*):(?:[ \t]*(.*))?$/);
    if (!match) fail("MALFORMED_CARD", `Invalid frontmatter line in ${filePath}: ${line}`);
    const [, key, raw = ""] = match;
    if (Object.prototype.hasOwnProperty.call(fields, key)) fail("MALFORMED_CARD", `Duplicate field ${key} in ${filePath}`);
    if (key === "latest") {
      fields[key] = {};
      continue;
    }
    fields[key] = parseScalar(raw, filePath, key);
  }

  if (fields.kind !== undefined && fields.kind !== "task") return null;
  const taskId = normalizeTaskId(fields.task_id);
  if (typeof fields.work_id !== "string" || !fields.work_id) fail("MALFORMED_CARD", `work_id is required in ${filePath}`);
  if (typeof fields.title !== "string" || !fields.title) fail("MALFORMED_CARD", `title is required in ${filePath}`);
  if (typeof fields.status !== "string" || !/^(queue|active|done)$/.test(fields.status)) {
    fail("MALFORMED_CARD", `Invalid status in ${filePath}`);
  }
  const dependsOn = fields.depends_on ?? [];
  if (!Array.isArray(dependsOn) || dependsOn.some((id) => typeof id !== "string")) {
    fail("MALFORMED_CARD", `depends_on must be an array of task IDs in ${filePath}`);
  }
  const normalizedDependencies = dependsOn.map(normalizeTaskId);
  if (new Set(normalizedDependencies).size !== normalizedDependencies.length) {
    fail("MALFORMED_CARD", `depends_on contains duplicates in ${filePath}`);
  }
  if (normalizedDependencies.includes(taskId)) fail("MALFORMED_CARD", `Task ${taskId} depends on itself`);

  let worktree = null;
  if (fields.worktree !== undefined) {
    if (typeof fields.worktree !== "string" || !path.isAbsolute(fields.worktree)) {
      fail("UNSAFE_WORKTREE", `worktree must be an absolute path in ${filePath}`);
    }
    worktree = canonicalizePath(fields.worktree, root, "UNSAFE_WORKTREE", fields.status === "done");
  }
  let branch = null;
  if (fields.branch !== undefined) {
    if (path.isAbsolute(fields.branch)) fail("UNSAFE_BRANCH", `Invalid branch in ${filePath}`);
    branch = validateBranch(fields.branch, filePath);
  }
  if (fields.status === "active" && (!worktree || !branch)) {
    fail("MALFORMED_CARD", `Active task ${taskId} requires worktree and branch`);
  }

  const sections = {};
  const body = content.slice(end + 5);
  for (const sectionName of ["Files", "Criteria"]) {
    const section = body.match(new RegExp(`^## ${sectionName}\\n([\\s\\S]*?)(?=^## |\\s*$)`, "m"));
    sections[sectionName.toLowerCase()] = section
      ? section[1].split("\n").map((line) => line.trim()).filter(Boolean)
      : [];
  }

  return {
    task_id: taskId,
    work_id: fields.work_id,
    title: fields.title,
    status: fields.status,
    order: fields.order ?? null,
    worktree,
    branch,
    depends_on: normalizedDependencies,
    path: relativePath(root, filePath),
    sections,
  };
}

function scanCards(root) {
  const workRoot = path.join(root, ".mdf", "work");
  requireDirectory(workRoot);
  const cards = [];
  for (const entry of fs.readdirSync(workRoot, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const entryPath = path.join(workRoot, entry.name);
    const entryStats = lstat(entryPath, "MALFORMED_CARD");
    if (!entryStats?.isDirectory()) continue;
    const itemPath = path.join(entryPath, "item.md");
    if (!lstat(itemPath, "MALFORMED_CARD")) continue;
    const card = parseCard(itemPath, root);
    if (card) cards.push(card);
  }
  const seen = new Set();
  for (const card of cards) {
    if (seen.has(card.task_id)) fail("DUPLICATE_TASK_ID", `Multiple task cards matched ${card.task_id}`);
    seen.add(card.task_id);
  }
  return cards;
}

function lockFor(root, taskId, expectedCard, required = false) {
  const lockPath = path.join(root, ".mdf", "locks", `${taskId}.lock`);
  const stats = lstat(lockPath, "MALFORMED_LOCK");
  if (!stats) {
    if (required) fail("LOCK_MISMATCH", `Active task ${taskId} has no matching lock`);
    return { present: false };
  }
  const lock = readJson(lockPath, "MALFORMED_LOCK");
  const requiredFields = ["task_id", "work_id", "canonical_root", "worktree", "branch", "started", "runtime"];
  if (!lock || typeof lock !== "object" || Array.isArray(lock) || requiredFields.some((field) => typeof lock[field] !== "string" || !lock[field])) {
    fail("MALFORMED_LOCK", `Lock ${lockPath} is missing required fields`);
  }
  const lockRoot = canonicalizePath(lock.canonical_root, root, "MALFORMED_LOCK", true);
  const lockWorktree = canonicalizePath(lock.worktree, root, "MALFORMED_LOCK", expectedCard.worktree === root);
  const lockBranch = validateBranch(lock.branch, lockPath, "MALFORMED_LOCK");
  if (lock.task_id !== taskId || lock.work_id !== expectedCard.work_id || lockRoot !== root) {
    fail("LOCK_MISMATCH", `Lock ${lockPath} does not match task ${taskId}`);
  }
  if (lockWorktree !== expectedCard.worktree || lockBranch !== expectedCard.branch) {
    fail("LOCK_MISMATCH", `Lock ${lockPath} does not match card ${expectedCard.path}`);
  }
  return {
    present: true,
    task_id: lock.task_id,
    work_id: lock.work_id,
    worktree: lockWorktree,
    branch: lockBranch,
  };
}

function readIndex(root) {
  const indexPath = path.join(root, ".mdf", "index.jsonl");
  requireFile(indexPath);
  const rows = fs.readFileSync(indexPath, "utf8").split(/\r?\n/).filter(Boolean);
  let valid = 0;
  let malformed = 0;
  for (const row of rows) {
    try {
      JSON.parse(row);
      valid += 1;
    } catch {
      malformed += 1;
    }
  }
  return { path: relativePath(root, indexPath), valid_rows: valid, malformed_rows: malformed };
}

function main() {
  if (process.argv.length !== 3) fail("USAGE", "Usage: task-brief.mjs <task-id>");
  const taskId = normalizeTaskId(process.argv[2]);
  const root = resolveRoot(process.cwd());
  const userInit = readJson(path.join(os.homedir(), ".mdf", "user", "init.json"), "MALFORMED_USER_INIT");
  const preferences = readJson(path.join(os.homedir(), ".mdf", "user", "preferences.json"), "MALFORMED_PREFERENCES");
  if (!userInit || typeof userInit !== "object" || Array.isArray(userInit)) fail("MALFORMED_USER_INIT", "User init must be a JSON object");
  if (!preferences || typeof preferences !== "object" || Array.isArray(preferences)) fail("MALFORMED_PREFERENCES", "Preferences must be a JSON object");
  requireDirectory(path.join(root, ".mdf", "locks"));
  const index = readIndex(root);
  const cards = scanCards(root);
  const matches = cards.filter((card) => card.task_id === taskId);
  if (matches.length === 0) fail("TASK_NOT_FOUND", `No task card matched ${taskId}`);
  if (matches.length > 1) fail("DUPLICATE_TASK_ID", `Multiple task cards matched ${taskId}`);
  const task = matches[0];
  const lock = lockFor(root, taskId, task, task.status === "active");
  const byId = new Map(cards.map((card) => [card.task_id, card]));
  const dependencies = task.depends_on.map((dependencyId) => {
    const dependency = byId.get(dependencyId);
    if (!dependency) fail("MISSING_DEPENDENCY", `Dependency ${dependencyId} is missing`);
    const dependencyLock = lockFor(root, dependencyId, dependency);
    return { task_id: dependencyId, status: dependency.status, lock_present: dependencyLock.present };
  });

  process.stdout.write(`${JSON.stringify({
    ok: true,
    canonical_root: root,
    index,
    task,
    lock,
    dependencies,
  })}\n`);
}

try {
  main();
} catch (error) {
  const briefError = error instanceof BriefError
    ? error
    : new BriefError("INTERNAL_ERROR", error.message || String(error));
  process.stderr.write(`${JSON.stringify({ ok: false, error: { code: briefError.code, message: briefError.message } })}\n`);
  process.exitCode = 2;
}
