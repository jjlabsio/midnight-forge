#!/usr/bin/env node

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createHash } = require("crypto");
const { execFileSync, spawn, spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const observationSkill = path.join(root, "skills", "subagent-observation");
const helper = path.join(observationSkill, "scripts", "record-subagent-observation.mjs");
const checker = path.join(observationSkill, "scripts", "check-subagent-observation-links.mjs");
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "mdf-observation-"));

function initialize(directory) {
  fs.mkdirSync(path.join(directory, ".mdf", "project"), { recursive: true });
  fs.mkdirSync(path.join(directory, ".mdf", "work", "work-1"), { recursive: true });
  fs.writeFileSync(path.join(directory, ".mdf", "project", "init.json"), `${JSON.stringify({ canonical_root: directory })}\n`);
}

initialize(fixture);

function run(args, directory = fixture) {
  return execFileSync(process.execPath, [helper, directory, ...args], { encoding: "utf8" });
}

function runJson(args, directory = fixture) {
  return JSON.parse(run(args, directory));
}

function runAsync(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [helper, fixture, ...args]);
    let stdout = "";
    child.on("error", reject);
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.on("exit", (code) => code === 0 ? resolve(JSON.parse(stdout)) : reject(new Error(`helper exited ${code}`)));
  });
}

function attemptLine(invocationId, role, report, status, disposition = "accepted") {
  return `attempt: ${invocationId} | role: ${role} | report: ${report} | status_b64: ${Buffer.from(status, "utf8").toString("base64url")} | disposition: ${disposition}\n`;
}

function checkerResult(directory) {
  const result = spawnSync(process.execPath, [checker, directory], { encoding: "utf8" });
  return { ...result, json: JSON.parse(result.stdout) };
}

function completeRows(invocationId, role = "executor", status = "finished") {
  return [
    { event: "begin", invocation_id: invocationId, work_id: "work-1", requested_model: "gpt-test", requested_effort: "high", canonical_role: role },
    { event: "finish", invocation_id: invocationId, status },
  ];
}

function expectInvalidCheckerCase(name, rows, handoff, errorFragment) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), `mdf-observation-${name}-`));
  try {
    initialize(directory);
    fs.mkdirSync(path.join(directory, ".mdf", "observations"), { recursive: true });
    fs.writeFileSync(path.join(directory, ".mdf", "observations", "subagent-invocations.jsonl"), `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`);
    fs.writeFileSync(path.join(directory, ".mdf", "work", "work-1", "handoff-001.md"), handoff);
    const result = checkerResult(directory);
    assert.strictEqual(result.status, 1, `${name}: ${result.stdout}`);
    assert.strictEqual(result.json.status, "invalid");
    if (errorFragment) assert(result.json.errors.some((error) => error.includes(errorFragment)), `${name}: ${result.stdout}`);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

function expectValidCheckerCase(name, rows, handoff) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), `mdf-observation-${name}-`));
  try {
    initialize(directory);
    fs.mkdirSync(path.join(directory, ".mdf", "observations"), { recursive: true });
    fs.writeFileSync(path.join(directory, ".mdf", "observations", "subagent-invocations.jsonl"), `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`);
    fs.writeFileSync(path.join(directory, ".mdf", "work", "work-1", "handoff-001.md"), handoff);
    const result = checkerResult(directory);
    assert.strictEqual(result.status, 0, `${name}: ${result.stdout}`);
    assert.strictEqual(result.json.status, "ok");
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

function expectInvalidWithoutJournal(name, journalState, handoff, errorFragment) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), `mdf-observation-${name}-`));
  try {
    initialize(directory);
    const observations = path.join(directory, ".mdf", "observations");
    if (journalState === "absent-log") fs.mkdirSync(observations, { recursive: true });
    if (journalState === "empty-log") {
      fs.mkdirSync(observations, { recursive: true });
      fs.writeFileSync(path.join(observations, "subagent-invocations.jsonl"), "");
    }
    fs.writeFileSync(path.join(directory, ".mdf", "work", "work-1", "handoff-001.md"), handoff);
    const result = checkerResult(directory);
    assert.strictEqual(result.status, 1, `${name}: ${result.stdout}`);
    assert.strictEqual(result.json.status, "invalid");
    assert(result.json.errors.some((error) => error.includes(errorFragment)), `${name}: ${result.stdout}`);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

function expectInvalidRequestedFact(name, field, value) {
  const invocationId = `mdf-${name}`;
  const rows = completeRows(invocationId);
  if (value === undefined) delete rows[0][field];
  else rows[0][field] = value;
  expectInvalidCheckerCase(name, rows, attemptLine(invocationId, "executor", "none", "finished", "not_used"), `invalid ${field}`);
}

async function main() {
  try {
    assert(fs.existsSync(path.join(observationSkill, "SKILL.md")), "the observation entrypoint must have a dedicated skill");
    assert(fs.existsSync(helper), "the recorder must be owned by the observation skill");
    assert(fs.existsSync(checker), "the checker must be owned by the observation skill");
    assert(!fs.existsSync(path.join(root, "skills", "use-mdf", "scripts", "record-subagent-observation.mjs")), "use-mdf must not retain an observation recorder");
    assert(!fs.existsSync(path.join(root, "skills", "use-mdf", "scripts", "check-subagent-observation-links.mjs")), "use-mdf must not retain an observation checker");

    const unavailableRoot = runJson(["begin", "work-1", "gpt-test", "high", "executor"], path.join(fixture, "missing-root"));
    assert.strictEqual(unavailableRoot.status, "unavailable");
    assert.match(unavailableRoot.invocation_id, /^mdf-/);

    const unavailable = runJson(["begin", "missing-work", "gpt-test", "high", "executor"]);
    assert.strictEqual(unavailable.status, "unavailable");
    assert.match(unavailable.invocation_id, /^mdf-/);

    const begin = runJson(["begin", "work-1", "gpt-test", "high", "executor"]);
    assert.strictEqual(begin.status, "recorded");
    const distinct = runJson(["begin", "work-1", "gpt-test", "high", "executor"]);
    assert.strictEqual(distinct.status, "recorded");
    assert.notStrictEqual(distinct.invocation_id, begin.invocation_id);
    assert.strictEqual(spawnSync(process.execPath, [helper, fixture, "begin", "work-1", "gpt-test", "high", "executor", "unexpected-key"]).status, 2);

    const roles = [
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
    ];
    for (const role of roles) {
      assert.strictEqual(runJson(["begin", "-", "gpt-test", "medium", role]).status, "recorded");
    }
    const parallelBegins = await Promise.all(Array.from({ length: 8 }, () =>
      runAsync(["begin", "-", "gpt-test", "medium", "ship-test-engineer"])
    ));
    assert.strictEqual(new Set(parallelBegins.map(({ invocation_id }) => invocation_id)).size, 8);
    assert(parallelBegins.every(({ status }) => status === "recorded"));

    const rawStatus = " interrupted | provider detail ";
    assert.strictEqual(runJson(["finish", begin.invocation_id, rawStatus]).status, "recorded");
    assert.strictEqual(runJson(["finish", begin.invocation_id, rawStatus]).status, "already_recorded");
    const rowCountBeforeConflictingFinish = fs.readFileSync(path.join(fixture, ".mdf", "observations", "subagent-invocations.jsonl"), "utf8").trim().split("\n").length;
    const conflictingFinish = JSON.parse(run(["finish", begin.invocation_id, "different-status"]));
    assert.deepStrictEqual(conflictingFinish, { status: "conflict", invocation_id: begin.invocation_id, reason: "Observation facts conflict for this invocation ID." });
    assert.strictEqual(fs.readFileSync(path.join(fixture, ".mdf", "observations", "subagent-invocations.jsonl"), "utf8").trim().split("\n").length, rowCountBeforeConflictingFinish);
    assert.strictEqual(runJson(["finish", distinct.invocation_id, "not used"]).status, "recorded");

    const logPath = path.join(fixture, ".mdf", "observations", "subagent-invocations.jsonl");
    const rows = fs.readFileSync(logPath, "utf8").trim().split("\n").map(JSON.parse);
    const beginRows = rows.filter((row) => row.event === "begin");
    assert(beginRows.every((row) => !Object.hasOwn(row, "dispatch_key")));
    assert.strictEqual(beginRows.filter((row) => row.invocation_id === begin.invocation_id || row.invocation_id === distinct.invocation_id).length, 2);
    assert.strictEqual(rows.find((row) => row.event === "finish" && row.invocation_id === begin.invocation_id).status, rawStatus);

    const workPath = path.join(fixture, ".mdf", "work", "work-1");
    const reportPath = path.join(workPath, "executor-report.md");
    fs.writeFileSync(reportPath, `invocation_id: ${begin.invocation_id}\n`);
    const handoffPath = path.join(workPath, "handoff-001.md");
    fs.writeFileSync(
      handoffPath,
      attemptLine(begin.invocation_id, "executor", ".mdf/work/work-1/executor-report.md", rawStatus)
        + attemptLine(distinct.invocation_id, "executor", "none", "not used", "not_used")
    );
    const checked = JSON.parse(execFileSync(process.execPath, [checker, fixture], { encoding: "utf8" }));
    assert.strictEqual(checked.status, "ok");
    assert.strictEqual(checked.checked_attempts, 2);

    fs.appendFileSync(reportPath, `invocation_id: ${begin.invocation_id}\n`);
    assert.strictEqual(spawnSync(process.execPath, [checker, fixture]).status, 1);
    fs.writeFileSync(reportPath, `invocation_id: ${begin.invocation_id}\n`);

    const malformedId = "mdf-malformed";
    expectInvalidCheckerCase("malformed-candidate", completeRows(malformedId),
      attemptLine(malformedId, "executor", "none", "finished", "not_used")
      + `attempt: ${malformedId} | role: executor | report: none | status_b64: **bad** | disposition: not_used\n`);
    const orphanId = "mdf-orphan";
    expectInvalidCheckerCase("orphan-attempt", completeRows("mdf-known"),
      attemptLine("mdf-known", "executor", "none", "finished", "not_used")
      + attemptLine(orphanId, "executor", "none", "finished", "not_used"));
    const duplicateId = "mdf-duplicate";
    expectInvalidCheckerCase("duplicate-attempt", completeRows(duplicateId),
      attemptLine(duplicateId, "executor", "none", "finished", "not_used")
      + attemptLine(duplicateId, "executor", "none", "finished", "not_used"));
    const uncontrolledId = "mdf-uncontrolled";
    expectInvalidCheckerCase("uncontrolled-role", completeRows(uncontrolledId, "uncontrolled"),
      attemptLine(uncontrolledId, "uncontrolled", "none", "finished", "not_used"));
    const legacyExtraRows = [
      ...completeRows("mdf-key-one"),
      ...completeRows("mdf-key-two"),
    ];
    legacyExtraRows[0].dispatch_key = "historical-key";
    legacyExtraRows[2].dispatch_key = "historical-key";
    expectValidCheckerCase("legacy-dispatch-key-extra-data", legacyExtraRows,
      attemptLine("mdf-key-one", "executor", "none", "finished", "not_used")
      + attemptLine("mdf-key-two", "executor", "none", "finished", "not_used"));
    const mismatchId = "mdf-mismatch";
    expectInvalidCheckerCase("mismatched-events", completeRows(mismatchId),
      attemptLine(mismatchId, "tester", "none", "finished", "not_used"));
    for (const field of ["requested_model", "requested_effort"]) {
      expectInvalidRequestedFact(`missing-${field}`, field, undefined);
      expectInvalidRequestedFact(`empty-${field}`, field, "");
      expectInvalidRequestedFact(`multiline-${field}`, field, "line-one\nline-two");
      expectInvalidRequestedFact(`nul-${field}`, field, "contains\0nul");
      expectInvalidRequestedFact(`nonstring-${field}`, field, 7);
    }
    expectInvalidWithoutJournal("absent-observations-orphan", "absent-directory",
      attemptLine("mdf-absent-directory", "executor", "none", "finished", "not_used"),
      "generic attempt index is orphaned from the journal");
    expectInvalidWithoutJournal("absent-log-malformed", "absent-log",
      "attempt: mdf-absent-log | role: executor | report: none | status_b64: **bad** | disposition: not_used\n",
      "invalid status encoding");
    expectInvalidWithoutJournal("empty-log-duplicate", "empty-log",
      attemptLine("mdf-empty-log", "executor", "none", "finished", "not_used")
      + attemptLine("mdf-empty-log", "executor", "none", "finished", "not_used"),
      "duplicated generic attempt indexes");
    fs.appendFileSync(reportPath, "invocation_id: other-invocation\n");
    assert.strictEqual(spawnSync(process.execPath, [checker, fixture]).status, 1);
    fs.writeFileSync(reportPath, `invocation_id: ${begin.invocation_id}\n`);

    const outside = path.join(fixture, "outside");
    fs.mkdirSync(outside);
    fs.writeFileSync(path.join(outside, "escaped.md"), `invocation_id: ${begin.invocation_id}\n`);
    fs.symlinkSync(outside, path.join(workPath, "reports"));
    fs.writeFileSync(handoffPath, attemptLine(begin.invocation_id, "executor", ".mdf/work/work-1/reports/escaped.md", rawStatus));
    assert.strictEqual(spawnSync(process.execPath, [checker, fixture]).status, 1);
    fs.unlinkSync(path.join(workPath, "reports"));
    fs.writeFileSync(
      handoffPath,
      attemptLine(begin.invocation_id, "executor", ".mdf/work/work-1/executor-report.md", rawStatus)
        + attemptLine(distinct.invocation_id, "executor", "none", "not used", "not_used")
    );

    const symlinkRoot = path.join(fixture, "symlink-root");
    const symlinkState = path.join(fixture, "symlink-state");
    initialize(symlinkState);
    fs.mkdirSync(symlinkRoot);
    fs.symlinkSync(path.join(symlinkState, ".mdf"), path.join(symlinkRoot, ".mdf"));
    fs.writeFileSync(path.join(symlinkState, ".mdf", "project", "init.json"), `${JSON.stringify({ canonical_root: symlinkRoot })}\n`);
    const symlinkedBegin = runJson(["begin", "work-1", "gpt-test", "high", "executor"], symlinkRoot);
    assert.strictEqual(symlinkedBegin.status, "unavailable");
    assert.strictEqual(spawnSync(process.execPath, [checker, symlinkRoot]).status, 2);

    const traversal = spawnSync(process.execPath, [helper, fixture, "begin", "work-1\ninvalid", "gpt-test", "high", "executor"]);
    assert.strictEqual(traversal.status, 2);

    const isolatedLockRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mdf-isolated-lock-"));
    try {
      initialize(isolatedLockRoot);
      const isolatedObservations = path.join(isolatedLockRoot, ".mdf", "observations");
      fs.mkdirSync(isolatedObservations, { recursive: true });
      const blockedInvocationId = "mdf-blocked-invocation";
      const blockedHash = createHash("sha256").update(blockedInvocationId).digest("hex");
      fs.writeFileSync(path.join(isolatedObservations, `subagent-invocation-finish-${blockedHash}.lock`), "stale");
      const unrelated = runJson(["begin", "work-1", "gpt-test", "high", "executor"], isolatedLockRoot);
      assert.strictEqual(unrelated.status, "recorded");
      assert.strictEqual(runJson(["finish", unrelated.invocation_id, "finished"], isolatedLockRoot).status, "recorded");
    } finally {
      fs.rmSync(isolatedLockRoot, { recursive: true, force: true });
    }
    console.log("subagent observation helper tests passed");
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
