const fs = require("fs");
const { WorkflowError } = require("./errors");

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
  const seen = new Set();
  for (const entry of entries) {
    if (seen.has(entry.work_id)) {
      throw new WorkflowError("MDF_INDEX_DUPLICATE", "MDF index contains duplicate work_id entries.", { path: filePath, work_id: entry.work_id });
    }
    seen.add(entry.work_id);
  }
  return { raw, rawLines, entries, lineIndexes, newline, trailingNewline: raw.endsWith("\n") };
}

module.exports = { parseIndex, parseItem, parseScalar, serializeItem };
