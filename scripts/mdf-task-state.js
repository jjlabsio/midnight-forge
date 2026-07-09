#!/usr/bin/env node

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const TASK_STATUS = new Set(["queue", "active", "done"]);

function fail(code, message, details = {}) {
  const error = { ok: false, error: { code, message, ...details } };
  console.error(JSON.stringify(error, null, 2));
  process.exit(1);
}

function outputJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function readJson(filePath, code) {
  try {
    return JSON.parse(readText(filePath));
  } catch (error) {
    fail(code, `Failed to read JSON: ${filePath}`, { cause: error.message, path: filePath });
  }
}

function exists(filePath) {
  return fs.existsSync(filePath);
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function atomicWrite(filePath, content) {
  ensureDir(path.dirname(filePath));
  const tempPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`
  );
  fs.writeFileSync(tempPath, content);
  fs.renameSync(tempPath, filePath);
}

function runGit(args, cwd) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.status !== 0) return null;
  return result.stdout.trim();
}

function projectRootFromWorktree(cwd) {
  const parts = path.resolve(cwd).split(path.sep);
  const marker = parts.lastIndexOf(".worktrees");
  if (marker <= 0) return null;
  const root = parts.slice(0, marker).join(path.sep) || path.sep;
  return exists(path.join(root, ".mdf", "project", "init.json")) ? root : null;
}

function canonicalRoot(cwd = process.cwd()) {
  const fromWorktree = projectRootFromWorktree(cwd);
  if (fromWorktree) return fromWorktree;
  const gitRoot = runGit(["rev-parse", "--show-toplevel"], cwd);
  return gitRoot || path.resolve(cwd);
}

function pathsFor(root) {
  return {
    root,
    userInit: path.join(os.homedir(), ".mdf", "user", "init.json"),
    userPrefs: path.join(os.homedir(), ".mdf", "user", "preferences.json"),
    userProjects: path.join(os.homedir(), ".mdf", "projects.json"),
    mdf: path.join(root, ".mdf"),
    projectJson: path.join(root, ".mdf", "project.json"),
    projectInit: path.join(root, ".mdf", "project", "init.json"),
    index: path.join(root, ".mdf", "index.jsonl"),
    work: path.join(root, ".mdf", "work"),
    locks: path.join(root, ".mdf", "locks"),
  };
}

function validateUserState(projectPaths) {
  if (!exists(projectPaths.userInit)) {
    fail("MDF_USER_INIT_MISSING", "Missing ~/.mdf/user/init.json", { path: projectPaths.userInit });
  }
  const prefs = readJson(projectPaths.userPrefs, "MDF_USER_PREFS_MALFORMED");
  if (!prefs.human_language || typeof prefs.human_language !== "string") {
    fail("MDF_USER_LANGUAGE_MISSING", "Missing non-empty human_language in ~/.mdf/user/preferences.json", {
      path: projectPaths.userPrefs,
    });
  }
  return prefs;
}

function validateProjectState(root) {
  const projectPaths = pathsFor(root);
  validateUserState(projectPaths);
  const required = [
    ["MDF_PROJECT_INIT_MISSING", projectPaths.projectInit],
    ["MDF_PROJECT_JSON_MISSING", projectPaths.projectJson],
    ["MDF_INDEX_MISSING", projectPaths.index],
    ["MDF_WORK_DIR_MISSING", projectPaths.work],
    ["MDF_LOCKS_DIR_MISSING", projectPaths.locks],
  ];
  for (const [code, filePath] of required) {
    if (!exists(filePath)) fail(code, `Missing MDF project state: ${filePath}`, { path: filePath });
  }
  return projectPaths;
}

function parseScalar(value) {
  const trimmed = value.trim();
  if (trimmed === "null") return null;
  if (trimmed === "{}") return {};
  if (trimmed === "[]") return [];
  if (/^-?\d+$/.test(trimmed)) return Number(trimmed);
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) return JSON.parse(trimmed);
  return trimmed;
}

function parseItem(filePath) {
  const content = readText(filePath);
  if (!content.startsWith("---\n")) {
    throw new Error("missing frontmatter");
  }
  const end = content.indexOf("\n---\n", 4);
  if (end === -1) throw new Error("unterminated frontmatter");
  const rawFrontmatter = content.slice(4, end);
  const body = content.slice(end + "\n---\n".length);
  const data = {};
  let currentMapKey = null;
  for (const line of rawFrontmatter.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const childMatch = line.match(/^  ([A-Za-z0-9_-]+):\s*(.*)$/);
    if (childMatch && currentMapKey) {
      data[currentMapKey][childMatch[1]] = parseScalar(childMatch[2]);
      continue;
    }
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) throw new Error(`unsupported frontmatter line: ${line}`);
    currentMapKey = null;
    if (match[2].trim() === "") {
      data[match[1]] = {};
      currentMapKey = match[1];
    } else {
      data[match[1]] = parseScalar(match[2]);
    }
  }
  return { path: filePath, data, body };
}

function quoteYaml(value) {
  if (value === null) return "null";
  if (Array.isArray(value) || (typeof value === "object" && value !== null)) return JSON.stringify(value);
  if (typeof value === "number") return String(value);
  return JSON.stringify(String(value));
}

function serializeItem(item) {
  const preferred = [
    "work_id",
    "task_id",
    "item_id",
    "kind",
    "title",
    "order",
    "status",
    "created",
    "due",
    "completed",
    "worktree",
    "branch",
    "depends_on",
    "track_id",
    "state",
    "outcome",
    "members",
    "latest",
  ];
  const keys = [
    ...preferred.filter((key) => Object.prototype.hasOwnProperty.call(item.data, key)),
    ...Object.keys(item.data).filter((key) => !preferred.includes(key)),
  ];
  const frontmatter = keys
    .map((key) => {
      const value = item.data[key];
      if (
        value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        Object.keys(value).length > 0
      ) {
        return `${key}:\n${Object.entries(value)
          .map(([childKey, childValue]) => `  ${childKey}: ${quoteYaml(childValue)}`)
          .join("\n")}`;
      }
      return `${key}: ${quoteYaml(value)}`;
    })
    .join("\n");
  return `---\n${frontmatter}\n---\n${item.body}`;
}

function normalizeTaskId(id) {
  const digits = String(id || "").trim().replace(/^task-?/, "");
  if (!/^\d+$/.test(digits)) fail("INVALID_TASK_ID", "Task ID must be numeric", { task_id: id });
  return digits.padStart(4, "0");
}

function walkItemFiles(projectPaths) {
  if (!exists(projectPaths.work)) return [];
  const result = [];
  for (const entry of fs.readdirSync(projectPaths.work, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const itemPath = path.join(projectPaths.work, entry.name, "item.md");
    if (exists(itemPath)) result.push(itemPath);
  }
  return result.sort();
}

function loadItems(projectPaths) {
  const warnings = [];
  const items = [];
  for (const itemPath of walkItemFiles(projectPaths)) {
    try {
      items.push(parseItem(itemPath));
    } catch (error) {
      warnings.push({ code: "ITEM_MALFORMED", path: itemPath, message: error.message });
    }
  }
  return { items, warnings };
}

function loadLocks(projectPaths) {
  const locks = new Map();
  const warnings = [];
  if (!exists(projectPaths.locks)) return { locks, warnings };
  for (const entry of fs.readdirSync(projectPaths.locks, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".lock")) continue;
    const lockPath = path.join(projectPaths.locks, entry.name);
    try {
      const lock = JSON.parse(readText(lockPath));
      if (lock.task_id) locks.set(normalizeTaskId(lock.task_id), { ...lock, path: lockPath });
    } catch (error) {
      warnings.push({ code: "LOCK_MALFORMED", path: lockPath, message: error.message });
    }
  }
  return { locks, warnings };
}

function resolveTask(projectPaths, rawTaskId) {
  const taskId = normalizeTaskId(rawTaskId);
  const { items, warnings } = loadItems(projectPaths);
  if (warnings.length > 0) {
    fail("ITEM_SCAN_WARNINGS", "Cannot resolve task while item files are malformed", { warnings });
  }
  const matches = items.filter((item) => (item.data.kind || "task") === "task" && item.data.task_id === taskId);
  if (matches.length === 0) fail("TASK_NOT_FOUND", `No MDF task matches ${taskId}`, { task_id: taskId });
  if (matches.length > 1) {
    fail("TASK_DUPLICATE", `Multiple MDF tasks match ${taskId}`, {
      task_id: taskId,
      paths: matches.map((item) => item.path),
    });
  }
  return matches[0];
}

function derivedStatus(item, locks) {
  const taskId = item.data.task_id;
  if (taskId && locks.has(taskId)) return "active";
  if (item.data.status === "done" || item.data.completed) return "done";
  return item.data.status || "queue";
}

function indexLine(item) {
  const data = item.data;
  const entry = {
    work_id: data.work_id,
    kind: data.kind || "task",
    title: data.title,
    item: path.relative(canonicalRoot(), item.path),
    latest: data.latest || {},
  };
  if (entry.kind === "task") {
    entry.task_id = data.task_id;
    entry.status = data.status;
    if (data.order !== undefined) entry.order = data.order;
    if (data.completed) entry.completed = data.completed;
    if (data.worktree) entry.worktree = data.worktree;
    if (data.branch) entry.branch = data.branch;
    if (data.track_id) entry.track_id = data.track_id;
  } else {
    entry.item_id = data.item_id;
    if (data.state) entry.state = data.state;
    if (data.track_id) entry.track_id = data.track_id;
  }
  return JSON.stringify(entry);
}

function appendIndex(projectPaths, item) {
  fs.appendFileSync(projectPaths.index, `${indexLine(item)}\n`);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function appendLog(item, message) {
  const marker = "\n## Log\n";
  const line = `\n- ${today()}: ${message}\n`;
  if (item.body.includes(marker)) {
    item.body = item.body.replace(marker, `${marker}${line}`);
  } else {
    item.body += `${marker}${line}`;
  }
}

function boardForProject(root) {
  const projectPaths = validateProjectState(root);
  const { items, warnings } = loadItems(projectPaths);
  const lockState = loadLocks(projectPaths);
  warnings.push(...lockState.warnings);
  const tasks = [];
  const tracks = [];
  const context = [];
  for (const item of items) {
    const kind = item.data.kind || "task";
    const record = {
      kind,
      task_id: item.data.task_id,
      item_id: item.data.item_id,
      work_id: item.data.work_id,
      title: item.data.title,
      status: kind === "task" ? derivedStatus(item, lockState.locks) : undefined,
      order: item.data.order,
      created: item.data.created,
      completed: item.data.completed,
      track_id: item.data.track_id,
      worktree: item.data.worktree,
      branch: item.data.branch,
      path: item.path,
      lock: item.data.task_id ? lockState.locks.get(item.data.task_id) || null : null,
    };
    if (kind === "task") tasks.push(record);
    else if (kind === "track") tracks.push(record);
    else context.push(record);
  }
  return {
    ok: true,
    canonical_root: root,
    active: tasks.filter((task) => task.status === "active"),
    queue: tasks.filter((task) => task.status === "queue").sort((a, b) => (a.order || 0) - (b.order || 0)),
    done: tasks.filter((task) => task.status === "done").sort((a, b) => String(b.completed || "").localeCompare(String(a.completed || ""))).slice(0, 5),
    tracks,
    context,
    warnings,
  };
}

function projectStoreWarning(project) {
  const root = project && project.canonical_root;
  if (!root || typeof root !== "string") {
    return { code: "PROJECT_REGISTRY_ENTRY_MALFORMED", canonical_root: root || null, message: "Missing canonical_root" };
  }
  const projectPaths = pathsFor(root);
  const required = [projectPaths.projectInit, projectPaths.index, projectPaths.work, projectPaths.locks];
  for (const requiredPath of required) {
    if (!exists(requiredPath)) {
      return { code: "PROJECT_SKIPPED", canonical_root: root, message: `Missing project MDF state: ${requiredPath}` };
    }
  }
  return null;
}

function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "task";
}

function nextTaskId(items) {
  let max = 0;
  for (const item of items) {
    if ((item.data.kind || "task") !== "task") continue;
    if (/^\d+$/.test(item.data.task_id || "")) max = Math.max(max, Number(item.data.task_id));
  }
  return String(max + 1).padStart(4, "0");
}

function createTask(projectPaths, args) {
  const title = requireArg(args, "--title");
  const contextFile = args.get("--context-file");
  const context = contextFile ? readText(path.resolve(process.cwd(), contextFile)) : "";
  const { items, warnings } = loadItems(projectPaths);
  if (warnings.length > 0) fail("ITEM_SCAN_WARNINGS", "Cannot add task while item files are malformed", { warnings });
  const taskId = nextTaskId(items);
  const queueOrders = items
    .filter((item) => (item.data.kind || "task") === "task" && item.data.status === "queue")
    .map((item) => Number(item.data.order || 0));
  const order = queueOrders.length ? Math.max(...queueOrders) + 1 : 1;
  const created = today();
  const workId = `${created}-${taskId}-${slugify(title)}`;
  const itemPath = path.join(projectPaths.work, workId, "item.md");
  if (exists(itemPath)) fail("ITEM_ALREADY_EXISTS", "Refusing to overwrite existing task item", { path: itemPath });
  const item = {
    path: itemPath,
    data: {
      work_id: workId,
      task_id: taskId,
      kind: "task",
      title,
      order,
      status: "queue",
      created,
      latest: {},
    },
    body: `## Context\n\n${context.trim()}\n\n## Files\n\n## Criteria\n\n## Log\n\n- ${created}: Created task.\n`,
  };
  atomicWrite(itemPath, serializeItem(item));
  appendIndex(projectPaths, item);
  return { ok: true, task_id: taskId, work_id: workId, item: itemPath };
}

function completeTask(projectPaths, taskId, message) {
  const item = resolveTask(projectPaths, taskId);
  if (item.data.status === "done" || item.data.completed) {
    fail("TASK_ALREADY_DONE", "Task is already completed", { task_id: item.data.task_id, path: item.path });
  }
  item.data.status = "done";
  item.data.completed = today();
  appendLog(item, message || "Completed task.");
  atomicWrite(item.path, serializeItem(item));
  const lockPath = path.join(projectPaths.locks, `${item.data.task_id}.lock`);
  if (exists(lockPath)) fs.rmSync(lockPath);
  appendIndex(projectPaths, item);
  return { ok: true, task_id: item.data.task_id, work_id: item.data.work_id, item: item.path };
}

function requireArg(args, name) {
  const value = args.get(name);
  if (!value) fail("MISSING_ARGUMENT", `Missing required argument ${name}`, { argument: name });
  return value;
}

function parseArgs(raw) {
  const positionals = [];
  const options = new Map();
  for (let index = 0; index < raw.length; index += 1) {
    const arg = raw[index];
    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }
    const next = raw[index + 1];
    if (!next || next.startsWith("--")) {
      options.set(arg, true);
    } else {
      options.set(arg, next);
      index += 1;
    }
  }
  return { positionals, options };
}

function main() {
  const { positionals, options } = parseArgs(process.argv.slice(2));
  const command = positionals[0];
  const root = canonicalRoot();

  if (command === "validate") {
    const projectPaths = validateProjectState(root);
    outputJson({ ok: true, canonical_root: root, paths: projectPaths });
    return;
  }

  if (command === "board" && options.has("--project")) {
    outputJson(boardForProject(root));
    return;
  }

  if (command === "board" && options.has("--user")) {
    const projectPaths = pathsFor(root);
    validateUserState(projectPaths);
    const registry = readJson(projectPaths.userProjects, "MDF_PROJECTS_REGISTRY_MALFORMED");
    if (registry.version !== 1 || !registry.projects || typeof registry.projects !== "object") {
      fail("MDF_PROJECTS_REGISTRY_MALFORMED", "Invalid ~/.mdf/projects.json schema", { path: projectPaths.userProjects });
    }
    const projects = [];
    const warnings = [];
    for (const project of Object.values(registry.projects)) {
      const warning = projectStoreWarning(project);
      if (warning) {
        warnings.push(warning);
        continue;
      }
      projects.push(boardForProject(project.canonical_root));
    }
    outputJson({ ok: true, projects, warnings });
    return;
  }

  const projectPaths = validateProjectState(root);
  if (command === "resolve") {
    const item = resolveTask(projectPaths, requireArg(options, "--task-id"));
    outputJson({ ok: true, task: item.data, item: item.path });
    return;
  }
  if (command === "add") {
    const kind = options.get("--kind") || "task";
    if (kind !== "task") fail("UNSUPPORTED_KIND", "The first deterministic add slice only supports --kind task", { kind });
    outputJson(createTask(projectPaths, options));
    return;
  }
  if (command === "done") {
    outputJson(completeTask(projectPaths, positionals[1], options.get("--message")));
    return;
  }
  fail("UNKNOWN_COMMAND", "Unknown mdf-task-state command", { command, usage: "validate | board --project --json | board --user --json | resolve --task-id <id> --json | add --kind task --title <title> [--context-file file] --json | done <id> --message <message> --json" });
}

main();
