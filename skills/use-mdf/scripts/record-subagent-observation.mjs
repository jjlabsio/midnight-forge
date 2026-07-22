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
  writeSync,
} from "node:fs";
import { isAbsolute, join, normalize, resolve, sep } from "node:path";

const [canonicalRootArg, event, invocationId, ...values] = process.argv.slice(2);
if (!canonicalRootArg || !event || !invocationId) {
  console.error("Usage: record-subagent-observation.mjs <canonical-root> <dispatch|terminal> <invocation-id> <values...>");
  process.exit(2);
}

const canonicalRoot = realpathSync(resolve(canonicalRootArg));
const mdfPath = join(canonicalRoot, ".mdf");
if (!existsSync(mdfPath) || lstatSync(mdfPath).isSymbolicLink()) {
  console.error("Canonical .mdf must be a real directory.");
  process.exit(2);
}
const initPath = join(canonicalRoot, ".mdf", "project", "init.json");
if (!existsSync(initPath)) {
  console.error("Canonical root is not initialized for MDF.");
  process.exit(2);
}
const init = JSON.parse(readFileSync(initPath, "utf8"));
if (typeof init.canonical_root !== "string" || realpathSync(init.canonical_root) !== canonicalRoot) {
  console.error("MDF init marker does not match the canonical root.");
  process.exit(2);
}

function safe(value, label) {
  if (!value || /[\r\n\0]/.test(value)) {
    console.error(`${label} must be a non-empty single-line value.`);
    process.exit(2);
  }
  return value;
}

function artifactReference(value) {
  const reference = safe(value, "artifact reference");
  const normalized = normalize(reference);
  const workPrefix = join(".mdf", "work") + sep;
  if (
    isAbsolute(reference) ||
    reference !== normalized ||
    !normalized.startsWith(workPrefix)
  ) {
    console.error("Artifact reference must stay under .mdf/work/.");
    process.exit(2);
  }
  return normalized;
}

safe(invocationId, "invocation ID");
let row;
if (event === "dispatch") {
  if (values.length !== 3) {
    console.error("Dispatch requires model, effort, and explicit work ID or dash.");
    process.exit(2);
  }
  const [requestedModel, requestedEffort, workId] = values;
  row = {
    event,
    invocation_id: invocationId,
    requested_model: safe(requestedModel, "requested model"),
    requested_effort: safe(requestedEffort, "requested effort"),
    work_id: workId === "-" ? null : safe(workId, "work ID"),
    status: "dispatched",
    dispatched_at: new Date().toISOString(),
  };
} else if (event === "terminal") {
  if (values.length < 1) {
    console.error("Terminal requires a raw runtime status.");
    process.exit(2);
  }
  const [status, ...artifactRefs] = values;
  row = {
    event,
    invocation_id: invocationId,
    status: safe(status, "raw terminal status"),
    completed_at: new Date().toISOString(),
    artifact_refs: artifactRefs.map(artifactReference),
  };
} else {
  console.error("Event must be dispatch or terminal.");
  process.exit(2);
}

const observationsPath = join(canonicalRoot, ".mdf", "observations");
if (existsSync(observationsPath) && lstatSync(observationsPath).isSymbolicLink()) {
  console.error("Observation directory must not be a symlink.");
  process.exit(2);
}
mkdirSync(observationsPath, { recursive: true, mode: 0o700 });
const logPath = join(observationsPath, "subagent-invocations.jsonl");
if (existsSync(logPath) && lstatSync(logPath).isSymbolicLink()) {
  console.error("Observation log must not be a symlink.");
  process.exit(2);
}
const descriptor = openSync(
  logPath,
  constants.O_APPEND | constants.O_CREAT | constants.O_WRONLY | constants.O_NOFOLLOW,
  0o600
);
try {
  writeSync(descriptor, `${JSON.stringify(row)}\n`);
} finally {
  closeSync(descriptor);
}
