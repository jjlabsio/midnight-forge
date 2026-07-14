#!/usr/bin/env node

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { autoHandoffGate, normalizeCanonicalMdfPath } = require("./auto-workflow-policy");

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) throw new Error(`Unexpected argument: ${value}`);
    const key = value.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) throw new Error(`Missing value for --${key}`);
    args[key] = next;
    index += 1;
  }
  return args;
}

function resolveRecordPath(canonicalRoot, recordPath) {
  const normalized = normalizeCanonicalMdfPath(recordPath);
  if (!normalized) throw new Error("Handoff path must be a canonical .mdf/work/{work_id}/handoff-NNN.json path");
  const root = fs.realpathSync(canonicalRoot);
  const resolved = path.resolve(root, normalized);
  const real = fs.realpathSync(resolved);
  if (real !== root && !real.startsWith(`${root}${path.sep}`)) throw new Error("Handoff path escapes canonical root");
  return { normalized, real };
}

function verifyAutoHandoff({ canonicalRoot, recordPath, expectedSha256 }) {
  if (typeof expectedSha256 !== "string" || !/^[a-f0-9]{64}$/i.test(expectedSha256)) throw new Error("Expected handoff SHA-256 is required");
  const resolved = resolveRecordPath(canonicalRoot, recordPath);
  const bytes = fs.readFileSync(resolved.real);
  const actualSha256 = sha256(bytes);
  if (actualSha256 !== expectedSha256.toLowerCase()) throw new Error("Handoff SHA-256 does not match the canonical file");

  let record;
  try {
    record = JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    throw new Error(`Handoff record is not valid JSON: ${error.message}`);
  }
  if (record?.schema_version !== 1) throw new Error("Handoff record schema_version must be 1");

  const context = {
    ...record,
    handoffRecord: { path: resolved.normalized, sha256: actualSha256 }
  };
  const gate = autoHandoffGate(context, record);
  if (!gate.valid) throw new Error(`Handoff record rejected: ${gate.reasons.join(", ")}`);
  return { valid: true, path: resolved.normalized, sha256: actualSha256, run_id: record.run_id, current_phase: record.current_phase };
}

if (require.main === module) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const result = verifyAutoHandoff({
      canonicalRoot: args.root,
      recordPath: args.record,
      expectedSha256: args.sha256
    });
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(`auto-handoff verification failed: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { verifyAutoHandoff };
