#!/usr/bin/env node

import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { join, resolve } from "node:path";

const [canonicalRootArg] = process.argv.slice(2);
const roles = new Set([
  "explorer", "tester", "reviewer", "persona", "executor", "critic",
  "ship-code-reviewer", "ship-security-auditor", "ship-test-engineer", "web-performance-auditor",
]);

if (!canonicalRootArg) {
  console.error("Usage: check-subagent-observation-links.mjs <canonical-root>");
  process.exit(2);
}

function safeComponent(value) {
  return typeof value === "string" && value !== "" && value !== "." && value !== ".." && !value.includes("/") && !value.includes("\\") && !/[\r\n\0]/.test(value);
}

function safeValue(value) {
  return typeof value === "string" && value !== "" && !/[\r\n\0]/.test(value);
}

function checkedPath(base, components, kind) {
  let current = base;
  for (let index = 0; index < components.length; index += 1) {
    const component = components[index];
    if (!safeComponent(component)) throw new Error("unsafe path component");
    current = join(current, component);
    if (!existsSync(current) || lstatSync(current).isSymbolicLink()) throw new Error("missing or symlinked path component");
    const stats = lstatSync(current);
    const isFinal = index === components.length - 1;
    if (!isFinal && !stats.isDirectory()) throw new Error("non-directory intermediate path component");
    if (isFinal && kind === "directory" && !stats.isDirectory()) throw new Error("expected directory");
    if (isFinal && kind === "file" && !stats.isFile()) throw new Error("expected file");
  }
  return current;
}

function decodeStatus(encoded) {
  if (!/^[A-Za-z0-9_-]+$/.test(encoded)) throw new Error("invalid status encoding");
  const decoded = Buffer.from(encoded, "base64url").toString("utf8");
  if (!safeValue(decoded) || Buffer.from(decoded, "utf8").toString("base64url") !== encoded) throw new Error("non-canonical status encoding");
  return decoded;
}

function attemptIdFromMalformedLine(line) {
  return /^attempt:\s*([^|\s]+)/.exec(line)?.[1] || null;
}

let canonicalRoot;
try {
  canonicalRoot = realpathSync(resolve(canonicalRootArg));
  const initPath = checkedPath(canonicalRoot, [".mdf", "project", "init.json"], "file");
  const init = JSON.parse(readFileSync(initPath, "utf8"));
  if (typeof init.canonical_root !== "string" || realpathSync(init.canonical_root) !== canonicalRoot) throw new Error("MDF init marker does not match the canonical root.");
} catch (error) {
  console.error(error.message || "Canonical root is unsafe.");
  process.exit(2);
}

const result = { status: "ok", checked_attempts: 0, legacy_rows: 0, invocations: [], errors: [] };
const observationsPath = join(canonicalRoot, ".mdf", "observations");
if (existsSync(observationsPath) && (lstatSync(observationsPath).isSymbolicLink() || !lstatSync(observationsPath).isDirectory())) {
  console.error("Observation directory is unsafe.");
  process.exit(2);
}
const candidateLogPath = join(observationsPath, "subagent-invocations.jsonl");
let content = "";
if (existsSync(candidateLogPath)) {
  let logPath;
  try {
    logPath = checkedPath(canonicalRoot, [".mdf", "observations", "subagent-invocations.jsonl"], "file");
  } catch (error) {
    console.error(error.message || "Observation journal is unsafe.");
    process.exit(2);
  }
  content = readFileSync(logPath, "utf8");
  if (content && !content.endsWith("\n")) result.errors.push("observation journal has an incomplete final row");
}
const rows = [];
for (const [index, line] of content.split("\n").filter(Boolean).entries()) {
  try {
    rows.push(JSON.parse(line));
  } catch {
    result.errors.push(`observation journal line ${index + 1} is malformed`);
  }
}

const byId = new Map();
const malformedEventIds = new Set();
for (const row of rows) {
  if (row?.event === "dispatch" || row?.event === "terminal") {
    result.legacy_rows += 1;
    continue;
  }
  if ((row?.event !== "begin" && row?.event !== "finish") || !safeValue(row?.invocation_id)) {
    if (safeValue(row?.invocation_id)) malformedEventIds.add(row.invocation_id);
    result.errors.push(safeValue(row?.invocation_id)
      ? `${row.invocation_id}: observation journal contains an unknown or malformed event`
      : "observation journal contains an unknown or malformed event");
    continue;
  }
  const events = byId.get(row.invocation_id) || [];
  events.push(row);
  byId.set(row.invocation_id, events);
  if (row.event === "begin") {
    if (!roles.has(row.canonical_role)) result.errors.push(`${row.invocation_id}: uncontrolled canonical role`);
    if (row.work_id !== null && !safeComponent(row.work_id)) result.errors.push(`${row.invocation_id}: missing or unsafe work linkage`);
    if (!safeValue(row.requested_model)) result.errors.push(`${row.invocation_id}: invalid requested_model`);
    if (!safeValue(row.requested_effort)) result.errors.push(`${row.invocation_id}: invalid requested_effort`);
  }
  if (row.event === "finish" && !safeValue(row.status)) result.errors.push(`${row.invocation_id}: missing terminal status`);
}

const attemptsById = new Map();
const malformedAttemptIds = new Map();
const validInvocationIds = new Set();
function validBeginFacts(begin) {
  return begin
    && (begin.work_id === null || safeComponent(begin.work_id))
    && roles.has(begin.canonical_role)
    && safeValue(begin.requested_model)
    && safeValue(begin.requested_effort);
}

function validFinishFacts(finish) {
  return finish && safeValue(finish.status);
}

let workRoot;
try {
  workRoot = checkedPath(canonicalRoot, [".mdf", "work"], "directory");
} catch (error) {
  result.errors.push(`work directory: ${error.message}`);
}
if (workRoot) {
  for (const workId of readdirSync(workRoot).sort()) {
    if (!safeComponent(workId)) {
      result.errors.push("work directory contains an unsafe component");
      continue;
    }
    let workPath;
    try {
      workPath = checkedPath(workRoot, [workId], "directory");
    } catch (error) {
      result.errors.push(`${workId}: ${error.message}`);
      continue;
    }
    for (const name of readdirSync(workPath).filter((file) => /^(handoff|synthesis)-\d+\.md$/.test(file)).sort()) {
      let handoffPath;
      try {
        handoffPath = checkedPath(workPath, [name], "file");
      } catch (error) {
        result.errors.push(`${workId}/${name}: ${error.message}`);
        continue;
      }
      for (const [lineNumber, line] of readFileSync(handoffPath, "utf8").split("\n").entries()) {
        if (!line.startsWith("attempt:")) continue;
        const match = /^attempt: ([^|]+) \| role: ([^|]+) \| report: ([^|]+) \| status_b64: ([^|]+) \| disposition: (accepted|not_used|unresolved)$/.exec(line);
        if (!match) {
          const invocationId = attemptIdFromMalformedLine(line);
          if (invocationId) malformedAttemptIds.set(invocationId, (malformedAttemptIds.get(invocationId) || 0) + 1);
          result.errors.push(`${workId}/${name}:${lineNumber + 1}: malformed generic attempt index`);
          continue;
        }
        const [, invocationId, role, report, encodedStatus, disposition] = match;
        try {
          if (!safeValue(invocationId) || !roles.has(role) || !safeValue(report)) throw new Error("unsafe invocation, role, or report");
          const status = decodeStatus(encodedStatus);
          const attempts = attemptsById.get(invocationId) || [];
          attempts.push({ workId, name, lineNumber: lineNumber + 1, role, report, status, disposition });
          attemptsById.set(invocationId, attempts);
        } catch (error) {
          malformedAttemptIds.set(invocationId, (malformedAttemptIds.get(invocationId) || 0) + 1);
          result.errors.push(`${workId}/${name}:${lineNumber + 1}: ${error.message}`);
        }
      }
    }
  }
}

for (const [invocationId, attempts] of attemptsById) {
  if (!byId.has(invocationId)) result.errors.push(`${invocationId}: generic attempt index is orphaned from the journal`);
  if (attempts.length > 1) result.errors.push(`${invocationId}: duplicated generic attempt indexes`);
  if (malformedAttemptIds.has(invocationId)) result.errors.push(`${invocationId}: valid and malformed generic attempt indexes are duplicated`);
}

for (const [invocationId, events] of byId) {
  if (malformedEventIds.has(invocationId) || malformedAttemptIds.has(invocationId)) continue;
  const begins = events.filter((row) => row.event === "begin");
  const finishes = events.filter((row) => row.event === "finish");
  if (begins.length === 1 && begins[0].work_id === null && finishes.length === 1 && events.length === begins.length + finishes.length) {
    if ((attemptsById.get(invocationId) || []).length > 0) {
      result.errors.push(`${invocationId}: unlinked invocation must not have a generic attempt index`);
    }
    continue;
  }
  if (begins.length !== 1 || finishes.length !== 1 || events.length !== begins.length + finishes.length) {
    result.errors.push(`${invocationId}: expected exactly one begin and one finish`);
    continue;
  }
  const [begin] = begins;
  const [finish] = finishes;
  if (!validBeginFacts(begin) || !validFinishFacts(finish)) continue;
  const attempts = attemptsById.get(invocationId) || [];
  if (attempts.length !== 1) {
    result.errors.push(`${invocationId}: expected exactly one generic attempt index, found ${attempts.length}`);
    continue;
  }
  const [attempt] = attempts;
  if (attempt.workId !== begin.work_id || attempt.role !== begin.canonical_role || attempt.status !== finish.status) {
    result.errors.push(`${invocationId}: attempt work, role, or status does not match journal`);
    continue;
  }
  if (attempt.report !== "none") {
    const reportParts = attempt.report.split("/");
    if (reportParts.length < 4 || reportParts[0] !== ".mdf" || reportParts[1] !== "work" || reportParts[2] !== begin.work_id) {
      result.errors.push(`${invocationId}: report path is outside its work directory`);
      continue;
    }
    try {
      const reportPath = checkedPath(canonicalRoot, reportParts, "file");
      if (lstatSync(reportPath).size > 1024 * 1024) throw new Error("report exceeds 1 MiB inspection limit");
      const declarations = readFileSync(reportPath, "utf8").split("\n").filter((line) => line.startsWith("invocation_id:"));
      if (declarations.length !== 1 || declarations[0] !== `invocation_id: ${invocationId}`) throw new Error("report must declare exactly one matching invocation ID");
    } catch (error) {
      result.errors.push(`${invocationId}: ${error.message}`);
      continue;
    }
  }
  result.checked_attempts += 1;
  validInvocationIds.add(invocationId);
}

if (result.errors.length > 0) result.status = "invalid";
const classifiedIds = new Set([...byId.keys(), ...attemptsById.keys(), ...malformedAttemptIds.keys(), ...malformedEventIds]);
for (const invocationId of [...classifiedIds].sort()) {
  const events = byId.get(invocationId) || [];
  const begins = events.filter((row) => row.event === "begin");
  const finishes = events.filter((row) => row.event === "finish");
  let status;
  if (validInvocationIds.has(invocationId)) {
    status = "valid";
  } else if (
    begins.length === 1
    && validBeginFacts(begins[0])
    && validFinishFacts(finishes[0])
    && begins[0].work_id === null
    && finishes.length === 1
    && events.length === begins.length + finishes.length
    && (attemptsById.get(invocationId) || []).length === 0
    && !malformedEventIds.has(invocationId)
  ) {
    status = "unlinked";
  } else if (
    begins.length === 1
    && validBeginFacts(begins[0])
    && finishes.length === 0
    && events.length === 1
    && !attemptsById.has(invocationId)
    && !malformedAttemptIds.has(invocationId)
    && !malformedEventIds.has(invocationId)
  ) {
    status = "incomplete";
  } else if (
    events.length === 0
    && (attemptsById.has(invocationId) || malformedAttemptIds.has(invocationId))
  ) {
    status = "linkage_invalid";
  } else if (
    begins.length !== 1
    || finishes.length > 1
    || events.length !== begins.length + finishes.length
    || malformedEventIds.has(invocationId)
    || (begins[0] && (
      (begins[0].work_id !== null && !safeComponent(begins[0].work_id))
      || !roles.has(begins[0].canonical_role)
      || !safeValue(begins[0].requested_model)
      || !safeValue(begins[0].requested_effort)
    ))
    || (finishes[0] && !safeValue(finishes[0].status))
  ) {
    status = "malformed";
  } else {
    status = "linkage_invalid";
  }
  result.invocations.push({ invocation_id: invocationId, status });
}
process.stdout.write(`${JSON.stringify(result)}\n`);
process.exit(result.status === "ok" ? 0 : 1);
