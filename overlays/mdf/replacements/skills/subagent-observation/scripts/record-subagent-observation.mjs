#!/usr/bin/env node

import {
  closeSync,
  constants,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  unlinkSync,
  writeFileSync,
  writeSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { createHash, randomUUID } from "node:crypto";

const [canonicalRootArg, command, ...values] = process.argv.slice(2);
const roles = new Set([
  "explorer",
  "tester",
  "reviewer",
  "persona",
  "executor",
  "critic",
  "ship-code-reviewer",
  "ship-security-auditor",
  "ship-test-engineer",
  "web-performance-auditor",
]);

function fail(message, code = 2) {
  console.error(message);
  process.exit(code);
}

function safe(value, label) {
  if (!value || /[\r\n\0]/.test(value)) fail(`${label} must be a non-empty single-line value.`);
  return value;
}

function emit(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

function observationConflict(message, details = {}) {
  const error = new Error(message);
  error.observationConflict = true;
  Object.assign(error, details);
  throw error;
}

function unavailable(invocationId, reason) {
  emit({ status: "unavailable", invocation_id: invocationId, reason });
  process.exit(0);
}

function observationUnavailable(reason) {
  const error = new Error(reason);
  error.observationUnavailable = true;
  throw error;
}

function context() {
  const canonicalRoot = realpathSync(resolve(canonicalRootArg));
  const mdfPath = join(canonicalRoot, ".mdf");
  if (!existsSync(mdfPath) || lstatSync(mdfPath).isSymbolicLink() || !lstatSync(mdfPath).isDirectory()) {
    observationUnavailable("canonical_mdf_unavailable");
  }
  const projectPath = join(mdfPath, "project");
  const initPath = join(projectPath, "init.json");
  if (!existsSync(projectPath) || lstatSync(projectPath).isSymbolicLink() || !existsSync(initPath) || lstatSync(initPath).isSymbolicLink()) {
    observationUnavailable("canonical_init_unavailable");
  }
  const init = JSON.parse(readFileSync(initPath, "utf8"));
  if (typeof init.canonical_root !== "string" || realpathSync(init.canonical_root) !== canonicalRoot) {
    observationUnavailable("canonical_root_mismatch");
  }
  const observationsPath = join(mdfPath, "observations");
  const logPath = join(observationsPath, "subagent-invocations.jsonl");
  return { canonicalRoot, mdfPath, observationsPath, logPath };
}

function canonicalWorkId(state, value) {
  if (value === "." || value === ".." || value.includes("/") || value.includes("\\")) observationUnavailable("work_id_unavailable");
  const workRoot = join(state.mdfPath, "work");
  const workPath = join(workRoot, value);
  if (!existsSync(workRoot) || lstatSync(workRoot).isSymbolicLink() || !lstatSync(workRoot).isDirectory() || !existsSync(workPath) || lstatSync(workPath).isSymbolicLink() || !lstatSync(workPath).isDirectory()) {
    observationUnavailable("work_id_unavailable");
  }
  const realWorkRoot = realpathSync(workRoot);
  if (realpathSync(workPath) !== join(realWorkRoot, value)) observationUnavailable("work_id_unavailable");
}

function observationsDirectory(state) {
  if (existsSync(state.observationsPath) && (lstatSync(state.observationsPath).isSymbolicLink() || !lstatSync(state.observationsPath).isDirectory())) {
    observationUnavailable("journal_unavailable");
  }
  mkdirSync(state.observationsPath, { recursive: true, mode: 0o700 });
  if (existsSync(state.logPath) && lstatSync(state.logPath).isSymbolicLink()) observationUnavailable("journal_unavailable");
}

function sleep(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function lockPath(state, operation, identity) {
  const digest = createHash("sha256").update(identity).digest("hex");
  return join(state.observationsPath, `subagent-invocation-${operation}-${digest}.lock`);
}

function withJournalLock(state, operation, identity, action) {
  observationsDirectory(state);
  const scopedLockPath = lockPath(state, operation, identity);
  const token = randomUUID();
  let descriptor;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      descriptor = openSync(scopedLockPath, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
      writeFileSync(descriptor, token, "utf8");
      break;
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      sleep(10);
    }
  }
  if (descriptor === undefined) observationUnavailable("journal_lock_unavailable");
  try {
    return action();
  } finally {
    closeSync(descriptor);
    try {
      if (readFileSync(scopedLockPath, "utf8") === token) unlinkSync(scopedLockPath);
    } catch {
      // Never remove a lock whose ownership cannot be proven.
    }
  }
}

function readRows(state) {
  if (!existsSync(state.logPath)) return [];
  const content = readFileSync(state.logPath, "utf8");
  if (content && !content.endsWith("\n")) observationConflict("Observation journal is ambiguous: final row is incomplete.");
  return content.split("\n").filter(Boolean).map((line, index) => {
    try {
      const row = JSON.parse(line);
      if (!row || typeof row !== "object" || typeof row.event !== "string" || typeof row.invocation_id !== "string") {
        throw new Error("missing event or invocation_id");
      }
      return row;
    } catch (error) {
      observationConflict(`Observation journal is ambiguous at line ${index + 1}: ${error.message}`);
    }
  });
}

function append(state, row) {
  const descriptor = openSync(state.logPath, constants.O_APPEND | constants.O_CREAT | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
  try {
    writeSync(descriptor, `${JSON.stringify(row)}\n`);
  } finally {
    closeSync(descriptor);
  }
}

function sameFinish(row, status) {
  return row.event === "finish" && row.status === status;
}

if (!canonicalRootArg || !command) fail("Usage: record-subagent-observation.mjs <canonical-root> <begin|finish> <values...>");

if (command === "begin") {
  if (values.length !== 4) fail("Begin requires explicit work ID or dash, requested model, requested effort, and canonical role.");
  const [workId, requestedModel, requestedEffort, canonicalRole] = values;
  safe(workId, "work ID or dash");
  safe(requestedModel, "requested model");
  safe(requestedEffort, "requested effort");
  safe(canonicalRole, "canonical role");
  const invocationId = `mdf-${randomUUID()}`;
  const facts = {
    work_id: workId === "-" ? null : workId,
    requested_model: requestedModel,
    requested_effort: requestedEffort,
    canonical_role: canonicalRole,
  };
  try {
    const state = context();
    if (!roles.has(canonicalRole)) observationUnavailable("canonical_role_unavailable");
    if (workId !== "-") canonicalWorkId(state, workId);
    withJournalLock(state, "begin", invocationId, () => {
      append(state, { event: "begin", invocation_id: invocationId, ...facts, began_at: new Date().toISOString() });
      emit({ status: "recorded", invocation_id: invocationId });
    });
  } catch (error) {
    if (error?.observationConflict) {
      emit({
        status: "conflict",
        invocation_id: invocationId,
        ...(error.storedInvocationId ? { stored_invocation_id: error.storedInvocationId } : {}),
        reason: error.message,
      });
      process.exit(0);
    }
    unavailable(invocationId, error?.message || "journal_unavailable");
  }
} else if (command === "finish") {
  if (values.length !== 2) fail("Finish requires invocation ID and raw runtime status.");
  const [invocationId, status] = values;
  safe(invocationId, "invocation ID");
  safe(status, "raw terminal status");
  try {
    const state = context();
    withJournalLock(state, "finish", invocationId, () => {
      const rows = readRows(state).filter((row) => row.invocation_id === invocationId);
      const begins = rows.filter((row) => row.event === "begin");
      const finishes = rows.filter((row) => row.event === "finish");
      if (begins.length !== 1 || finishes.length > 1 || rows.length !== begins.length + finishes.length) {
        observationConflict("Observation facts conflict or are ambiguous for this invocation ID.");
      }
      if (finishes.length === 1) {
        if (sameFinish(finishes[0], status)) {
          emit({ status: "already_recorded", invocation_id: invocationId });
          return;
        }
        observationConflict("Observation facts conflict for this invocation ID.");
      }
      append(state, { event: "finish", invocation_id: invocationId, status, completed_at: new Date().toISOString() });
      emit({ status: "recorded", invocation_id: invocationId });
    });
  } catch (error) {
    if (error?.observationConflict) {
      emit({ status: "conflict", invocation_id: invocationId, reason: error.message });
      process.exit(0);
    }
    unavailable(invocationId, error?.message || "journal_unavailable");
  }
} else {
  fail("Command must be begin or finish.");
}
