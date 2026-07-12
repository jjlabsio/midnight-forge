const fs = require("fs");
const path = require("path");
const { WorkflowError } = require("./errors");

const INDEX_ENTRY_KEYS = new Set([
  "work_id", "kind", "task_id", "title", "status", "item", "latest", "track_id", "due", "order",
  "completed", "worktree", "branch", "item_id", "state", "outcome",
]);
const INDEX_ENTRY_KINDS = new Set(["task", "note", "track", "inbox", "routine"]);
const SAFE_WORK_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const ARTIFACT_FILE = /^[A-Za-z0-9][A-Za-z0-9._-]*-\d{3}\.md$/;

function invalidIndexEntry(message, details = {}) {
  throw new WorkflowError("MDF_INDEX_ENTRY_INVALID", message, details);
}

function isSafeRelativePath(value) {
  if (path.isAbsolute(value)) return false;
  const normalized = path.normalize(value);
  return normalized !== ".." && !normalized.startsWith(`..${path.sep}`);
}

function isAllowedLatestPath(value, workId) {
  if (!isSafeRelativePath(value)) return false;
  const normalized = path.normalize(value);
  const fileName = path.basename(normalized);
  if (!ARTIFACT_FILE.test(fileName)) return false;
  const directory = path.dirname(normalized);
  const workDirectory = path.join(".mdf", "work", workId);
  return directory === "." || directory === workDirectory;
}

function validateIndexEntry(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalidIndexEntry("Index entry must be an object.");
  for (const key of Object.keys(value)) {
    if (!INDEX_ENTRY_KEYS.has(key)) invalidIndexEntry("Index entry contains an unsupported field.", { field: key });
  }
  if (typeof value.work_id !== "string" || !SAFE_WORK_ID.test(value.work_id)) invalidIndexEntry("Index entry requires a safe work_id.");
  if (value.kind !== undefined && (typeof value.kind !== "string" || !INDEX_ENTRY_KINDS.has(value.kind))) {
    invalidIndexEntry("Index entry kind is invalid.", { kind: value.kind });
  }
  if (typeof value.title !== "string" || !value.title.trim()) invalidIndexEntry("Index entry requires a title.");
  const expectedItem = path.join(".mdf", "work", value.work_id, "item.md");
  if (typeof value.item !== "string" || path.normalize(value.item) !== expectedItem) {
    invalidIndexEntry("Index entry item must identify the requested work item.", { item: value.item, expected: expectedItem });
  }
  if (!value.latest || typeof value.latest !== "object" || Array.isArray(value.latest)) invalidIndexEntry("Index entry latest must be a map.");
  for (const [artifactType, artifactPath] of Object.entries(value.latest)) {
    if (typeof artifactType !== "string" || !artifactType.trim() || typeof artifactPath !== "string" || !isAllowedLatestPath(artifactPath, value.work_id)) {
      invalidIndexEntry("Index entry latest values must identify artifacts in the requested work item.", { artifact_type: artifactType, path: artifactPath });
    }
  }
  if (value.task_id !== undefined && value.task_id !== null && typeof value.task_id !== "string") invalidIndexEntry("Index entry task_id must be a string or null.");
  if (value.item_id !== undefined && typeof value.item_id !== "string") invalidIndexEntry("Index entry item_id must be a string.");
  if (value.status !== undefined && typeof value.status !== "string") invalidIndexEntry("Index entry status must be a string.");
  if (value.state !== undefined && typeof value.state !== "string") invalidIndexEntry("Index entry state must be a string.");
  if (value.order !== undefined && (!Number.isInteger(value.order) || value.order < 0)) invalidIndexEntry("Index entry order must be a non-negative integer.");
  for (const field of ["track_id", "due", "completed", "worktree", "branch", "outcome"]) {
    if (value[field] !== undefined && typeof value[field] !== "string") invalidIndexEntry(`Index entry ${field} must be a string.`);
  }
  if ((value.kind === "note" || value.kind === "track") && typeof value.item_id !== "string") {
    invalidIndexEntry("Non-task index entries require an item_id.", { kind: value.kind });
  }
  return value;
}

function validateItem(item) {
  if (!item || !item.data || typeof item.data !== "object" || Array.isArray(item.data)) {
    throw new WorkflowError("MDF_ITEM_SCHEMA_INVALID", "MDF item data must be an object.", { path: item?.path });
  }
  const data = item.data;
  if (typeof data.work_id !== "string" || !SAFE_WORK_ID.test(data.work_id)) {
    throw new WorkflowError("MDF_ITEM_SCHEMA_INVALID", "MDF item requires a safe work_id.", { path: item.path });
  }
  if (typeof data.kind !== "string" || !INDEX_ENTRY_KINDS.has(data.kind)) {
    throw new WorkflowError("MDF_ITEM_SCHEMA_INVALID", "MDF item kind is invalid.", { path: item.path, kind: data.kind });
  }
  if (typeof data.title !== "string" || !data.title.trim()) {
    throw new WorkflowError("MDF_ITEM_SCHEMA_INVALID", "MDF item requires a title.", { path: item.path });
  }
  if (!data.latest || typeof data.latest !== "object" || Array.isArray(data.latest)) {
    throw new WorkflowError("MDF_ITEM_SCHEMA_INVALID", "MDF item latest must be a map.", { path: item.path });
  }
  if (data.kind === "task" && (typeof data.status !== "string" || !data.status.trim())) {
    throw new WorkflowError("MDF_ITEM_SCHEMA_INVALID", "Task items require a non-empty status.", { path: item.path });
  }
  if ((data.kind === "note" || data.kind === "track") && (typeof data.item_id !== "string" || !data.item_id.trim())) {
    throw new WorkflowError("MDF_ITEM_SCHEMA_INVALID", "Non-task items require a non-empty item_id.", { path: item.path, kind: data.kind });
  }
  return item;
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

function parseItem(filePath, { fsImpl = fs } = {}) {
  let content;
  try {
    content = fsImpl.readFileSync(filePath, "utf8");
  } catch (error) {
    throw new WorkflowError("MDF_ITEM_MISSING", "Unable to read MDF item.", { path: filePath, cause: error.message });
  }
  try {
    if (!content.startsWith("---\n")) throw new Error("missing frontmatter");
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
  } catch (error) {
    if (error instanceof WorkflowError) throw error;
    throw new WorkflowError("MDF_ITEM_MALFORMED", "MDF item frontmatter is malformed.", { path: filePath, cause: error.message });
  }
}

function quoteYaml(value) {
  if (value === null) return "null";
  if (Array.isArray(value) || (typeof value === "object" && value !== null)) return JSON.stringify(value);
  if (typeof value === "number") return String(value);
  return JSON.stringify(String(value));
}

function serializeItem(item) {
  if (!item || !item.data || typeof item.body !== "string") {
    throw new WorkflowError("MDF_ITEM_INVALID", "An item requires data and body.");
  }
  const preferred = [
    "work_id", "task_id", "item_id", "kind", "title", "order", "status", "created", "due", "completed",
    "worktree", "branch", "depends_on", "track_id", "state", "outcome", "members", "latest",
  ];
  const keys = [
    ...preferred.filter((key) => Object.prototype.hasOwnProperty.call(item.data, key)),
    ...Object.keys(item.data).filter((key) => !preferred.includes(key)),
  ];
  const frontmatter = keys.map((key) => {
    const value = item.data[key];
    if (value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length > 0) {
      return `${key}:\n${Object.entries(value).map(([childKey, childValue]) => `  ${childKey}: ${quoteYaml(childValue)}`).join("\n")}`;
    }
    return `${key}: ${quoteYaml(value)}`;
  }).join("\n");
  return `---\n${frontmatter}\n---\n${item.body}`;
}

function parseIndex(filePath, { fsImpl = fs } = {}) {
  let raw;
  try {
    raw = fsImpl.readFileSync(filePath, "utf8");
  } catch (error) {
    throw new WorkflowError("MDF_INDEX_MISSING", "Unable to read MDF index.", { path: filePath, cause: error.message });
  }
  const newline = raw.includes("\r\n") ? "\r\n" : "\n";
  const rawLines = raw.split(/\r?\n/);
  const entries = [];
  const lineIndexes = [];
  try {
    rawLines.forEach((line, index) => {
      if (!line.trim()) return;
      const value = JSON.parse(line);
      if (!value || typeof value !== "object" || Array.isArray(value) || typeof value.work_id !== "string" || !value.work_id) {
        throw new Error("index entry requires work_id");
      }
      entries.push(value);
      lineIndexes.push(index);
    });
  } catch (error) {
    throw new WorkflowError("MDF_INDEX_MALFORMED", "MDF index contains malformed JSONL.", { path: filePath, cause: error.message });
  }
  // index.jsonl is an append-only history of item snapshots. Repeated work_id
  // entries are valid; callers resolve the current snapshot from the latest
  // matching line while older entries remain available as history.
  return { raw, rawLines, entries, lineIndexes, newline, trailingNewline: raw.endsWith("\n") };
}

module.exports = { parseIndex, parseItem, parseScalar, serializeItem, validateIndexEntry, validateItem };
