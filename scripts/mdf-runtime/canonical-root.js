const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { WorkflowError } = require("./errors");

function isInside(parent, child) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== "..");
}

function realpath(filePath, code = "MDF_PATH_INVALID", message = "Path does not exist.") {
  try {
    return fs.realpathSync(filePath);
  } catch (error) {
    throw new WorkflowError(code, message, { path: filePath, cause: error.message });
  }
}

function rootFromLinkedWorktree(cwd) {
  const parts = path.resolve(cwd).split(path.sep);
  const marker = parts.lastIndexOf(".worktrees");
  if (marker <= 0) return null;
  const root = parts.slice(0, marker).join(path.sep) || path.sep;
  if (!fs.existsSync(path.join(root, ".git")) && !fs.existsSync(path.join(root, ".mdf"))) return null;
  return root;
}

function canonicalRoot(cwd = process.cwd()) {
  const resolvedCwd = realpath(cwd, "MDF_CWD_INVALID", "Working directory does not exist.");
  const linkedRoot = rootFromLinkedWorktree(resolvedCwd);
  if (linkedRoot) return realpath(linkedRoot, "MDF_CANONICAL_ROOT_INVALID", "Canonical root cannot be resolved.");
  const result = spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd: resolvedCwd, encoding: "utf8" });
  if (result.status === 0 && result.stdout.trim()) return realpath(result.stdout.trim(), "MDF_CANONICAL_ROOT_INVALID", "Canonical root cannot be resolved.");
  return resolvedCwd;
}

function projectPaths(root) {
  return {
    root,
    mdf: path.join(root, ".mdf"),
    project: path.join(root, ".mdf", "project"),
    projectJson: path.join(root, ".mdf", "project.json"),
    projectInit: path.join(root, ".mdf", "project", "init.json"),
    index: path.join(root, ".mdf", "index.jsonl"),
    work: path.join(root, ".mdf", "work"),
    locks: path.join(root, ".mdf", "locks"),
  };
}

function resolveWithin(parent, relativePath, { allowMissing = true } = {}) {
  if (typeof relativePath !== "string" || path.isAbsolute(relativePath)) {
    throw new WorkflowError("MDF_PATH_INVALID", "Path must be a relative path.", { path: relativePath });
  }
  const resolvedParent = realpath(parent, "MDF_PATH_INVALID", "Path boundary does not exist.");
  const candidate = path.resolve(resolvedParent, relativePath);
  if (!isInside(resolvedParent, candidate)) throw new WorkflowError("MDF_PATH_ESCAPE", "Path escapes its allowed boundary.", { path: relativePath });
  let component = resolvedParent;
  for (const part of path.relative(resolvedParent, candidate).split(path.sep).filter(Boolean)) {
    component = path.join(component, part);
    if (fs.existsSync(component) && fs.lstatSync(component).isSymbolicLink()) {
      throw new WorkflowError("MDF_SYMLINK_PATH", "Symlink path components are not allowed.", { path: relativePath });
    }
  }
  if (!fs.existsSync(candidate)) {
    if (allowMissing) return candidate;
    throw new WorkflowError("MDF_PATH_MISSING", "Path does not exist.", { path: relativePath });
  }
  const stat = fs.lstatSync(candidate);
  if (stat.isSymbolicLink()) throw new WorkflowError("MDF_SYMLINK_PATH", "Symlink paths are not allowed.", { path: relativePath });
  const resolved = realpath(candidate, "MDF_PATH_INVALID", "Path cannot be resolved.");
  if (!isInside(resolvedParent, resolved)) throw new WorkflowError("MDF_PATH_ESCAPE", "Resolved path escapes its allowed boundary.", { path: relativePath });
  return resolved;
}

module.exports = { canonicalRoot, isInside, projectPaths, realpath, resolveWithin };
