#!/usr/bin/env node

const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { runCli } = require("./mdf-runtime/cli");
const { WorkflowError } = require("./mdf-runtime/errors");
const { canonicalRoot, projectPaths } = require("./mdf-runtime/canonical-root");
const { atomicWriteFiles } = require("./mdf-runtime/atomic");
const { parseIndex } = require("./mdf-runtime/schema");
const { runCommand } = require("./mdf-runtime/git");

function rootFor(input, options) {
  return canonicalRoot(input.root || input.canonical_root || input.cwd || options.cwd || process.cwd());
}

function homeFor(input, options) {
  return path.resolve(input.home || options.home || os.homedir());
}

function userPaths(home) {
  return {
    root: path.join(home, ".mdf"),
    user: path.join(home, ".mdf", "user"),
    init: path.join(home, ".mdf", "user", "init.json"),
    preferences: path.join(home, ".mdf", "user", "preferences.json"),
    projects: path.join(home, ".mdf", "projects.json"),
  };
}

function readJson(filePath, code) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new WorkflowError(code, "MDF JSON state is malformed.", { path: filePath, cause: error.message });
  }
}

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function requireString(value, field, filePath) {
  if (typeof value !== "string" || !value.trim()) throw new WorkflowError("MDF_SCHEMA_INVALID", `${field} must be a non-empty string.`, { path: filePath, field });
}

function validatePreferences(value, filePath) {
  if (!isObject(value) || value.version !== 1) throw new WorkflowError("MDF_USER_PREFS_MALFORMED", "preferences.json must use version 1.", { path: filePath });
  requireString(value.human_language, "human_language", filePath);
}

function validateUserInit(value, filePath) {
  if (!isObject(value) || value.version !== 1) throw new WorkflowError("MDF_USER_INIT_MALFORMED", "user init.json must use version 1.", { path: filePath });
  requireString(value.initialized_at, "initialized_at", filePath);
  if (value.runtime !== "codex") throw new WorkflowError("MDF_USER_INIT_MALFORMED", "user init.json runtime must be codex.", { path: filePath });
  if (value.canonical_root !== undefined) requireString(value.canonical_root, "canonical_root", filePath);
}

function validateRegistry(value, filePath) {
  if (!isObject(value) || value.version !== 1 || !isObject(value.projects)) {
    throw new WorkflowError("MDF_PROJECTS_REGISTRY_MALFORMED", "projects.json must use version 1 with a projects map.", { path: filePath });
  }
  for (const [key, project] of Object.entries(value.projects)) {
    if (!isObject(project)) throw new WorkflowError("MDF_PROJECTS_REGISTRY_MALFORMED", "Each registered project must be an object.", { path: filePath, project: key });
    for (const field of ["id", "name", "canonical_root", "index", "last_seen"]) requireString(project[field], field, filePath);
    if (project.remote !== null && typeof project.remote !== "string") throw new WorkflowError("MDF_PROJECTS_REGISTRY_MALFORMED", "Project remote must be a string or null.", { path: filePath, project: key });
  }
}

function validateProjectJson(value, root, filePath) {
  if (!isObject(value) || value.name !== path.basename(root) || value.canonical_root !== root || (value.remote !== null && typeof value.remote !== "string")) {
    throw new WorkflowError("MDF_PROJECT_JSON_MALFORMED", "project.json does not match the canonical project schema.", { path: filePath, canonical_root: root });
  }
  requireString(value.created, "created", filePath);
}

function validateProjectInit(value, root, filePath) {
  if (!isObject(value) || value.version !== 1 || value.runtime !== "codex" || value.canonical_root !== root) {
    throw new WorkflowError("MDF_PROJECT_INIT_MALFORMED", "project/init.json does not match the canonical project schema.", { path: filePath, canonical_root: root });
  }
  requireString(value.initialized_at, "initialized_at", filePath);
}

function layoutError(candidate, expected, actual) {
  throw new WorkflowError("MDF_LAYOUT_INVALID", "MDF state path has an unexpected type.", { path: candidate, expected, actual });
}

function actualType(stat) {
  if (stat.isDirectory()) return "directory";
  if (stat.isFile()) return "file";
  if (stat.isSymbolicLink()) return "symlink";
  return "other";
}

function validateLayoutEntry(root, relative, expected) {
  let current = root;
  const parts = relative.split(path.sep);
  for (let index = 0; index < parts.length; index += 1) {
    current = path.join(current, parts[index]);
    let stat;
    try {
      stat = fs.lstatSync(current);
    } catch (error) {
      if (error.code === "ENOENT") return false;
      throw new WorkflowError("MDF_LAYOUT_INVALID", "Unable to inspect MDF state path.", { path: current, cause: error.message });
    }
    if (stat.isSymbolicLink()) throw new WorkflowError("MDF_SYMLINK_PATH", "MDF state paths cannot be symlinks.", { path: current });
    if (index < parts.length - 1 && !stat.isDirectory()) layoutError(current, "directory", actualType(stat));
    if (index === parts.length - 1 && actualType(stat) !== expected) layoutError(current, expected, actualType(stat));
  }
  return true;
}

function boundaryCheck(root) {
  const entries = [
    [".mdf", "directory"],
    [".worktrees", "directory"],
    [".mdf/project", "directory"],
    [".mdf/work", "directory"],
    [".mdf/locks", "directory"],
    [".mdf/project.json", "file"],
    [".mdf/project/init.json", "file"],
    [".mdf/index.jsonl", "file"],
  ];
  for (const [relative, expected] of entries) validateLayoutEntry(root, relative, expected);
}

function ignoreStatus(root, runner) {
  const missing = [];
  for (const relative of [".mdf/", ".worktrees/"]) {
    const result = runCommand("git", ["check-ignore", "-q", "--", path.join(root, relative)], { cwd: root, runner, allowFailure: true });
    if (result.status !== 0) missing.push(relative);
  }
  return { valid: missing.length === 0, missing };
}

function gitStatus(root, runner) {
  const result = runCommand("git", ["rev-parse", "--is-inside-work-tree"], { cwd: root, runner, allowFailure: true });
  return result.status === 0 && result.stdout.trim() === "true";
}

function remoteFor(root, runner) {
  const result = runCommand("git", ["remote", "get-url", "origin"], { cwd: root, runner, allowFailure: true });
  return result.status === 0 && result.stdout.trim() ? result.stdout.trim() : null;
}

function validateUser(home) {
  const paths = userPaths(home);
  const missing = [];
  let preferences = null;
  let init = null;
  let projects = null;
  if (fs.existsSync(paths.preferences)) {
    preferences = readJson(paths.preferences, "MDF_USER_PREFS_MALFORMED");
    validatePreferences(preferences, paths.preferences);
  } else missing.push(paths.preferences);
  if (fs.existsSync(paths.init)) {
    init = readJson(paths.init, "MDF_USER_INIT_MALFORMED");
    validateUserInit(init, paths.init);
  } else missing.push(paths.init);
  if (fs.existsSync(paths.projects)) {
    projects = readJson(paths.projects, "MDF_PROJECTS_REGISTRY_MALFORMED");
    validateRegistry(projects, paths.projects);
  } else {
    missing.push(paths.projects);
    projects = { version: 1, projects: {} };
  }
  return { valid: missing.length === 0, missing, paths, preferences, init, projects };
}

function validateProject(root) {
  const paths = projectPaths(root);
  const missing = [];
  let project = null;
  let init = null;
  if (fs.existsSync(paths.projectJson)) {
    project = readJson(paths.projectJson, "MDF_PROJECT_JSON_MALFORMED");
    validateProjectJson(project, root, paths.projectJson);
  } else missing.push(paths.projectJson);
  if (fs.existsSync(paths.projectInit)) {
    init = readJson(paths.projectInit, "MDF_PROJECT_INIT_MALFORMED");
    validateProjectInit(init, root, paths.projectInit);
  } else missing.push(paths.projectInit);
  if (fs.existsSync(paths.index)) parseIndex(paths.index);
  else missing.push(paths.index);
  if (!fs.existsSync(paths.work)) missing.push(paths.work);
  if (!fs.existsSync(paths.locks)) missing.push(paths.locks);
  return { valid: missing.length === 0, missing, paths, project, init };
}

function validate(input = {}, options = {}) {
  const root = rootFor(input, options);
  const home = homeFor(input, options);
  boundaryCheck(root);
  const isGit = gitStatus(root, options.runner);
  const ignore = isGit ? ignoreStatus(root, options.runner) : { valid: true, missing: [] };
  const user = validateUser(home);
  const project = validateProject(root);
  return { canonical_root: root, home, git: isGit, ignore_policy: ignore, user, project, valid: ignore.valid && user.valid && project.valid };
}

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function apply(input = {}, options = {}) {
  const root = rootFor(input, options);
  const home = homeFor(input, options);
  boundaryCheck(root);
  const runner = options.runner;
  const isGit = gitStatus(root, runner);
  const ignore = isGit ? ignoreStatus(root, runner) : { valid: true, missing: [] };
  if (!ignore.valid) throw new WorkflowError("MDF_IGNORE_POLICY_MISSING", "MDF project state will not be created until local workflow paths are ignored.", { canonical_root: root, missing: ignore.missing });
  const user = validateUser(home);
  const project = validateProject(root);
  const language = user.preferences ? user.preferences.human_language : input.human_language;
  if (!language || typeof language !== "string" || !language.trim()) throw new WorkflowError("MDF_HUMAN_LANGUAGE_REQUIRED", "An explicit human_language is required before creating preferences.json.");
  const now = new Date().toISOString();
  const userEntries = [];
  if (!user.preferences) userEntries.push({ path: user.paths.preferences, content: json({ version: 1, human_language: language.trim() }) });
  if (!user.init) userEntries.push({ path: user.paths.init, content: json({ version: 1, initialized_at: now, runtime: "codex" }) });
  const projects = user.projects || { version: 1, projects: {} };
  const remote = remoteFor(root, runner);
  const id = crypto.createHash("sha256").update(remote || root).digest("hex").slice(0, 12);
  projects.projects[root] = { id, name: path.basename(root), canonical_root: root, remote, index: ".mdf/index.jsonl", last_seen: now };
  userEntries.push({ path: user.paths.projects, content: json(projects) });
  const projectEntries = [];
  if (!project.project) projectEntries.push({ path: project.paths.projectJson, content: json({ name: path.basename(root), canonical_root: root, remote, created: now }) });
  if (!project.init) projectEntries.push({ path: project.paths.projectInit, content: json({ version: 1, initialized_at: now, runtime: "codex", canonical_root: root }) });
  if (!fs.existsSync(project.paths.index)) projectEntries.push({ path: project.paths.index, content: "" });
  atomicWriteFiles([...userEntries, ...projectEntries]);
  fs.mkdirSync(project.paths.work, { recursive: true });
  fs.mkdirSync(project.paths.locks, { recursive: true });
  return { canonical_root: root, home, human_language: user.preferences ? user.preferences.human_language : language.trim(), user_init: user.init ? "verified" : "created", project_init: project.project || project.init ? "verified" : "created", paths: project.paths, no_tracked_setup: true };
}

function main() {
  const exitCode = runCli({ operations: { validate, apply } });
  if (exitCode) process.exitCode = exitCode;
}

if (require.main === module) main();

module.exports = { apply, validate };
