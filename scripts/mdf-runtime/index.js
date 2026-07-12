const fs = require("fs");
const { WorkflowError } = require("./errors");
const { atomicWriteText } = require("./atomic");
const { parseIndex } = require("./schema");

function reconciledIndexContent(indexPath, entry, { fsImpl = fs } = {}) {
  if (!entry || typeof entry.work_id !== "string" || !entry.work_id) {
    throw new WorkflowError("MDF_INDEX_ENTRY_INVALID", "Index reconciliation requires a work_id.");
  }
  const parsed = parseIndex(indexPath, { fsImpl });
  const matches = parsed.entries
    .map((value, position) => ({ value, line: parsed.lineIndexes[position] }))
    .filter(({ value }) => value.work_id === entry.work_id);
  const lines = parsed.rawLines.slice();
  const serialized = JSON.stringify(entry);
  if (matches.length > 0) lines[matches[matches.length - 1].line] = serialized;
  else {
    if (parsed.trailingNewline) lines.splice(lines.length - 1, 0, serialized);
    else lines.push(serialized);
  }
  let result = lines.join(parsed.newline);
  if (parsed.trailingNewline && !result.endsWith(parsed.newline)) result += parsed.newline;
  if (!parsed.trailingNewline && result.endsWith(parsed.newline)) result = result.slice(0, -parsed.newline.length);
  return result;
}

function reconcileIndex(indexPath, entry, options = {}) {
  const content = reconciledIndexContent(indexPath, entry, options);
  atomicWriteText(indexPath, content, options);
  return { path: indexPath, work_id: entry.work_id };
}

module.exports = { reconcileIndex, reconciledIndexContent };
