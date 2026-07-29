#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

class StoreError extends Error { constructor(code, message) { super(message); this.code = code; } }
const fail = (code, message) => { throw new StoreError(code, message); };
const taskId = (value) => {
  if (typeof value !== "string" || !/^\d{1,4}$/.test(value)) fail("INVALID_TASK_ID", "Task ID must contain one to four decimal digits");
  return value.padStart(4, "0");
};
const digest = (content) => crypto.createHash("sha256").update(content).digest("hex");
function regularFile(file, required = false) {
  const stat = fs.lstatSync(file, { throwIfNoEntry: false });
  if (!stat) {
    if (required) fail("MALFORMED_TASK", `Missing task file: ${file}`);
    return false;
  }
  if (!stat.isFile()) fail("MALFORMED_TASK", `Task file must be a regular file: ${file}`);
  return true;
}
function readStateFromValue(value, file) {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || value.version !== 1
    || typeof value.task_id !== "string" || !/^\d{4}$/.test(value.task_id)
    || typeof value.work_id !== "string" || !value.work_id
    || typeof value.title !== "string" || !value.title
    || !["queue", "active", "done", "cancelled"].includes(value.status)
    || !Number.isInteger(value.order) || value.order < 0
    || typeof value.created !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.created)
    || !Array.isArray(value.depends_on) || !value.depends_on.every((id) => typeof id === "string" && /^\d{4}$/.test(id))) {
    fail("MALFORMED_TASK", `Invalid current task schema: ${file}`);
  }
  return value;
}
function readState(file) {
  let content, value;
  regularFile(file, true);
  try { content = fs.readFileSync(file, "utf8"); value = JSON.parse(content); } catch { fail("MALFORMED_TASK", `Invalid task state: ${file}`); }
  return { value: readStateFromValue(value, file), digest: digest(content) };
}
function scan(root) {
  const work = path.join(root, ".mdf", "work");
  if (!fs.statSync(work, { throwIfNoEntry: false })?.isDirectory()) fail("MISSING_STATE", `Missing work directory: ${work}`);
  const tasks = [];
  for (const entry of fs.readdirSync(work, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
    const file = path.join(work, entry.name, "task.json");
    if (!regularFile(file)) continue;
    const { value: state, digest: stateDigest } = readState(file);
    if (state.work_id !== entry.name || !regularFile(path.join(work, entry.name, "item.md"))) fail("MALFORMED_TASK", `Task state and intent must share ${entry.name}`);
    tasks.push({ ...state, path: file, digest: stateDigest });
  }
  const ids = new Set();
  for (const task of tasks) { if (ids.has(task.task_id)) fail("DUPLICATE_TASK_ID", `Duplicate task ID: ${task.task_id}`); ids.add(task.task_id); }
  return tasks.sort((a, b) => a.task_id.localeCompare(b.task_id));
}
function replace(file, next, expectedDigest) {
  let current;
  try { current = fs.readFileSync(file, "utf8"); } catch { fail("STATE_CHANGED", `Task state changed: ${file}`); }
  if (digest(current) !== expectedDigest) fail("STATE_CHANGED", `Task state changed: ${file}`);
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temporary, file);
}
try {
  const [root, operation, rawId, ...arguments_] = process.argv.slice(2);
  if (!root || !operation) fail("USAGE", "Usage: task-store.mjs <root> inspect|list|set-status ...");
  const tasks = scan(path.resolve(root));
  if (operation === "list") process.stdout.write(`${JSON.stringify({ ok: true, tasks: tasks.map(({ path, ...task }) => task) })}\n`);
  else {
    const id = taskId(rawId); const task = tasks.find((candidate) => candidate.task_id === id);
    if (!task) fail("TASK_NOT_FOUND", `No task matched ${id}`);
    if (operation === "inspect") process.stdout.write(`${JSON.stringify({ ok: true, task: (({ path, digest, ...value }) => value)(task), digest: task.digest })}\n`);
    else if (operation === "set-status") {
      const [nextStatus, expectedStatus, expectedDigest] = arguments_;
      if (!['queue', 'active', 'done', 'cancelled'].includes(nextStatus) || !['queue', 'active', 'done', 'cancelled'].includes(expectedStatus) || !/^[a-f0-9]{64}$/.test(expectedDigest || "")) fail("USAGE", "Invalid status or expected digest");
      if (task.status !== expectedStatus) fail("STATE_CHANGED", `Expected ${expectedStatus}, found ${task.status}`);
      if (task.digest !== expectedDigest) fail("STATE_CHANGED", `Task state changed: ${task.path}`);
      const { path: file, digest: priorDigest, ...next } = task; next.status = nextStatus; replace(file, next, priorDigest);
      const nextContent = `${JSON.stringify(next, null, 2)}\n`;
      process.stdout.write(`${JSON.stringify({ ok: true, task: next, digest: digest(nextContent) })}\n`);
    } else if (operation === "replace") {
      const [expectedDigest, rawNext] = arguments_;
      if (!/^[a-f0-9]{64}$/.test(expectedDigest || "") || typeof rawNext !== "string") fail("USAGE", "Replace requires an expected digest and complete task JSON");
      if (task.digest !== expectedDigest) fail("STATE_CHANGED", `Task state changed: ${task.path}`);
      let next;
      try { next = JSON.parse(rawNext); } catch { fail("MALFORMED_TASK", "Replacement task state must be valid JSON"); }
      const file = task.path;
      const validated = readStateFromValue(next, file);
      if (validated.work_id !== task.work_id || validated.task_id !== task.task_id) fail("MALFORMED_TASK", "Replacement cannot change task identity");
      replace(file, validated, task.digest);
      const nextContent = `${JSON.stringify(validated, null, 2)}\n`;
      process.stdout.write(`${JSON.stringify({ ok: true, task: validated, digest: digest(nextContent) })}\n`);
    } else fail("USAGE", "Unknown operation");
  }
} catch (error) {
  const item = error instanceof StoreError ? error : new StoreError("INTERNAL_ERROR", error.message || String(error));
  process.stderr.write(`${JSON.stringify({ ok: false, error: { code: item.code, message: item.message } })}\n`); process.exitCode = 2;
}
