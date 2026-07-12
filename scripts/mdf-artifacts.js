#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { runCli } = require("./mdf-runtime/cli");
const { WorkflowError } = require("./mdf-runtime/errors");
const { canonicalRoot, projectPaths, resolveWithin } = require("./mdf-runtime/canonical-root");
const { atomicWriteFiles, atomicWriteText } = require("./mdf-runtime/atomic");
const { parseIndex, parseItem, serializeItem } = require("./mdf-runtime/schema");
const { reconciledIndexContent } = require("./mdf-runtime/index");

function required(value, name) {
  if (typeof value !== "string" || !value.trim()) throw new WorkflowError("MDF_INPUT_REQUIRED", `${name} is required.`, { field: name });
  return value.trim();
}

function segment(value, name) {
  const result = required(value, name);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(result) || result === "." || result === "..") {
    throw new WorkflowError("MDF_INPUT_INVALID", `${name} must be a safe path segment.`, { field: name, value });
  }
  return result;
}

function revision(value) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) throw new WorkflowError("MDF_REVISION_INVALID", "Revision must be a positive integer.", { revision: value });
  return number;
}

function rootFor(input, options) {
  const requested = input.root || input.canonical_root || input.cwd || options.cwd;
  return canonicalRoot(requested || process.cwd());
}

function artifactInput(input) {
  if (input.relative_path) {
    if (typeof input.relative_path !== "string" || path.isAbsolute(input.relative_path) || path.dirname(input.relative_path) !== ".") {
      throw new WorkflowError("MDF_ARTIFACT_PATH_INVALID", "relative_path must be a filename within the work item.", { path: input.relative_path });
    }
    const match = input.relative_path.match(/^(.+)-(\d{3})\.md$/);
    if (!match) throw new WorkflowError("MDF_ARTIFACT_PATH_INVALID", "relative_path must use <artifact-type>-NNN.md.", { path: input.relative_path });
    return { artifactType: segment(match[1], "artifact_type"), number: revision(match[2]) };
  }
  return { artifactType: segment(input.artifact_type || input.kind, "artifact_type"), number: input.revision === undefined ? null : revision(input.revision) };
}

function state(input, options) {
  const root = rootFor(input, options);
  const paths = projectPaths(root);
  const workId = segment(input.work_id, "work_id");
  const workDir = resolveWithin(root, path.join(".mdf", "work", workId), { allowMissing: false });
  const itemPath = resolveWithin(root, path.join(".mdf", "work", workId, "item.md"), { allowMissing: false });
  const item = parseItem(itemPath);
  if (item.data.work_id !== workId) throw new WorkflowError("MDF_ITEM_ID_MISMATCH", "MDF item work_id does not match its directory.", { path: itemPath, work_id: workId });
  if (!item.data.latest || typeof item.data.latest !== "object" || Array.isArray(item.data.latest)) {
    throw new WorkflowError("MDF_ITEM_LATEST_MALFORMED", "MDF item latest must be a map.", { path: itemPath });
  }
  const index = parseIndex(paths.index);
  return { root, paths, workId, workDir, itemPath, item, index };
}

function artifactPath(root, workId, artifactType, number) {
  const type = segment(artifactType, "artifact_type");
  return resolveWithin(root, path.join(".mdf", "work", workId, `${type}-${String(number).padStart(3, "0")}.md`));
}

function indexEntry(item, root) {
  const data = item.data;
  const entry = {
    work_id: data.work_id,
    kind: data.kind || "task",
    title: data.title,
    item: path.relative(root, item.path),
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
  return entry;
}

function allocate(input, options = {}) {
  const current = state(input, options);
  const artifactType = artifactInput(input).artifactType;
  const prefix = `${artifactType}-`;
  let maximum = 0;
  for (const name of fs.readdirSync(current.workDir)) {
    const match = name.match(new RegExp(`^${prefix}(\\d{3})\\.md$`));
    if (match) maximum = Math.max(maximum, Number(match[1]));
  }
  return { root: current.root, work_id: current.workId, artifact_type: artifactType, revision: maximum + 1 };
}

function write(input, options = {}) {
  const current = state(input, options);
  const artifact = artifactInput(input);
  const artifactType = artifact.artifactType;
  const number = artifact.number;
  if (number === null) throw new WorkflowError("MDF_REVISION_INVALID", "write requires a revision or relative_path.");
  if (typeof input.content !== "string") throw new WorkflowError("MDF_CONTENT_INVALID", "Artifact content must be a string.");
  const target = artifactPath(current.root, current.workId, artifactType, number);
  if (fs.existsSync(target)) throw new WorkflowError("MDF_ARTIFACT_EXISTS", "Refusing to overwrite an existing artifact revision.", { path: target });
  atomicWriteText(target, input.content);
  return { root: current.root, work_id: current.workId, artifact_type: artifactType, revision: number, path: path.relative(current.root, target) };
}

function latest(input, options = {}) {
  const current = state(input, options);
  const artifact = artifactInput(input);
  const artifactType = artifact.artifactType;
  const number = artifact.number || (() => {
    if (typeof input.path !== "string") throw new WorkflowError("MDF_REVISION_INVALID", "latest requires revision or path.");
    const candidate = resolveWithin(current.root, input.path, { allowMissing: false });
    const relative = path.relative(current.root, candidate);
    const match = relative.match(new RegExp(`^\\.mdf/work/${current.workId}/(.+)-(\\d{3})\\.md$`));
    if (!match || match[1] !== artifactType) throw new WorkflowError("MDF_ARTIFACT_PATH_INVALID", "latest path must identify the requested work item and artifact type.", { path: input.path });
    return revision(match[2]);
  })();
  const target = artifactPath(current.root, current.workId, artifactType, number);
  if (!fs.existsSync(target)) throw new WorkflowError("MDF_ARTIFACT_MISSING", "Cannot point latest at a missing artifact.", { path: target });
  const relative = path.relative(current.root, target);
  const nextItem = { ...current.item, data: { ...current.item.data, latest: { ...current.item.data.latest, [artifactType]: relative } } };
  const nextEntry = indexEntry(nextItem, current.root);
  const nextIndex = reconciledIndexContent(current.paths.index, nextEntry);
  atomicWriteFiles([
    { path: current.itemPath, content: serializeItem(nextItem) },
    { path: current.paths.index, content: nextIndex },
  ]);
  return { root: current.root, work_id: current.workId, artifact_type: artifactType, revision: number, latest: relative, item: current.itemPath, index: current.paths.index };
}

function reconcile(input, options = {}) {
  const current = state(input, options);
  const entry = input.entry && typeof input.entry === "object" ? input.entry : indexEntry(current.item, current.root);
  if (entry.work_id !== current.workId) throw new WorkflowError("MDF_INDEX_ENTRY_INVALID", "Index entry work_id does not match the requested item.");
  const content = reconciledIndexContent(current.paths.index, entry);
  atomicWriteText(current.paths.index, content);
  return { root: current.root, work_id: current.workId, index: current.paths.index };
}

function main() {
  const exitCode = runCli({ operations: { allocate, write, latest, "reconcile-index": reconcile } });
  if (exitCode) process.exitCode = exitCode;
}

if (require.main === module) main();

module.exports = { allocate, artifactPath, indexEntry, latest, reconcile, write };
