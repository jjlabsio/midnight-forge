#!/usr/bin/env node

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createHash } = require("crypto");
const { execFileSync, spawn, spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const observationPolicy = path.join(root, "references", "subagent-dispatch-policy");
const helper = path.join(observationPolicy, "record-subagent-observation.mjs");
const checker = path.join(observationPolicy, "check-subagent-observation-links.mjs");
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

function expectIneligibleBegin(requestedModel, requestedEffort) {
  const journal = path.join(fixture, ".mdf", "observations", "subagent-invocations.jsonl");
  const before = fs.existsSync(journal) ? fs.readFileSync(journal, "utf8") : null;
  const result = spawnSync(
    process.execPath,
    [helper, fixture, "begin", "work-1", requestedModel, requestedEffort, "executor"],
    { encoding: "utf8" }
  );
  assert.strictEqual(result.status, 2, result.stderr);
  assert.match(result.stderr, /ineligible/i);
  if (before === null) assert(!fs.existsSync(journal));
  else assert.strictEqual(fs.readFileSync(journal, "utf8"), before);
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

function expectInvalidCheckerCase(name, rows, handoff, errorFragment, expectedInvocations) {
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
    if (expectedInvocations) assert.deepStrictEqual(result.json.invocations, expectedInvocations, `${name}: ${result.stdout}`);
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
    assert(!fs.existsSync(path.join(root, "skills", "subagent-observation")), "observation support must not be exposed as a user-facing skill");
    assert(fs.existsSync(helper), "the recorder must be owned by the dispatch policy");
    assert(fs.existsSync(checker), "the checker must be owned by the dispatch policy");
    assert(!fs.existsSync(path.join(root, "skills", "use-mdf", "scripts", "record-subagent-observation.mjs")), "use-mdf must not retain an observation recorder");
    assert(!fs.existsSync(path.join(root, "skills", "use-mdf", "scripts", "check-subagent-observation-links.mjs")), "use-mdf must not retain an observation checker");

    expectIneligibleBegin("gpt-5.6-luna", "low");
    expectIneligibleBegin("gpt-5.6-luna-future", "medium");
    for (const effort of ["high", "xhigh", "max", "ultra"]) {
      expectIneligibleBegin("gpt-5.6-sol", effort);
    }
    const eligibleSol = runJson(["begin", "-", "gpt-5.6-sol", "medium", "executor"]);
    assert.strictEqual(eligibleSol.status, "recorded");
    expectIneligibleBegin("gpt-5.6-sol", "high");
    assert.strictEqual(runJson(["finish", eligibleSol.invocation_id, "finished"]).status, "recorded");

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
      const roleBegin = runJson(["begin", "-", "gpt-test", "medium", role]);
      assert.strictEqual(roleBegin.status, "recorded");
      assert.strictEqual(runJson(["finish", roleBegin.invocation_id, "finished"]).status, "recorded");
    }
    const parallelBegins = await Promise.all(Array.from({ length: 8 }, () =>
      runAsync(["begin", "-", "gpt-test", "medium", "ship-test-engineer"])
    ));
    assert.strictEqual(new Set(parallelBegins.map(({ invocation_id }) => invocation_id)).size, 8);
    assert(parallelBegins.every(({ status }) => status === "recorded"));
    await Promise.all(parallelBegins.map(({ invocation_id }) =>
      runAsync(["finish", invocation_id, "finished"])
    ));

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
    assert.deepStrictEqual(
      checked.invocations.filter(({ invocation_id }) => invocation_id === begin.invocation_id),
      [{ invocation_id: begin.invocation_id, status: "valid" }]
    );

    fs.appendFileSync(reportPath, `invocation_id: ${begin.invocation_id}\n`);
    assert.strictEqual(spawnSync(process.execPath, [checker, fixture]).status, 1);
    fs.writeFileSync(reportPath, `invocation_id: ${begin.invocation_id}\n`);

    const malformedId = "mdf-malformed";
    expectInvalidCheckerCase("malformed-candidate", completeRows(malformedId),
      attemptLine(malformedId, "executor", "none", "finished", "not_used")
      + `attempt: ${malformedId} | role: executor | report: none | status_b64: **bad** | disposition: not_used\n`,
      "invalid status encoding",
      [{ invocation_id: malformedId, status: "linkage_invalid" }]);
    const orphanId = "mdf-orphan";
    expectInvalidCheckerCase("orphan-attempt", completeRows("mdf-known"),
      attemptLine("mdf-known", "executor", "none", "finished", "not_used")
      + attemptLine(orphanId, "executor", "none", "finished", "not_used"));
    const unlinkedId = "mdf-unlinked";
    const unlinkedRows = completeRows(unlinkedId);
    unlinkedRows[0].work_id = null;
    expectInvalidCheckerCase("unlinked-attempt", unlinkedRows,
      attemptLine(unlinkedId, "executor", "none", "finished", "not_used"),
      "unlinked invocation must not have a generic attempt index");
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
    const fanoutRows = [
      ...completeRows("mdf-ship-code", "ship-code-reviewer"),
      ...completeRows("mdf-ship-security", "ship-security-auditor"),
      ...completeRows("mdf-ship-test", "ship-test-engineer"),
      ...completeRows("mdf-rework-executor", "executor"),
      ...completeRows("mdf-rework-critic", "critic"),
    ];
    expectValidCheckerCase("ship-fanout-and-rework", fanoutRows,
      attemptLine("mdf-ship-code", "ship-code-reviewer", "none", "finished")
      + attemptLine("mdf-ship-security", "ship-security-auditor", "none", "finished")
      + attemptLine("mdf-ship-test", "ship-test-engineer", "none", "finished")
      + attemptLine("mdf-rework-executor", "executor", "none", "finished")
      + attemptLine("mdf-rework-critic", "critic", "none", "finished"));
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
    {
      const invalidRoutingRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mdf-invalid-routing-status-"));
      try {
        initialize(invalidRoutingRoot);
        const invalidId = "mdf-invalid-routing-status";
        const rows = completeRows(invalidId);
        rows[0].requested_model = "";
        fs.mkdirSync(path.join(invalidRoutingRoot, ".mdf", "observations"), { recursive: true });
        fs.writeFileSync(
          path.join(invalidRoutingRoot, ".mdf", "observations", "subagent-invocations.jsonl"),
          `${rows.map(JSON.stringify).join("\n")}\n`
        );
        fs.writeFileSync(
          path.join(invalidRoutingRoot, ".mdf", "work", "work-1", "handoff-001.md"),
          attemptLine(invalidId, "executor", "none", "finished", "not_used")
        );
        const result = checkerResult(invalidRoutingRoot);
        assert.strictEqual(result.json.status, "invalid");
        assert.deepStrictEqual(result.json.invocations, [{ invocation_id: invalidId, status: "malformed" }]);
      } finally {
        fs.rmSync(invalidRoutingRoot, { recursive: true, force: true });
      }
    }
    {
      const malformedIncompleteRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mdf-malformed-incomplete-"));
      try {
        initialize(malformedIncompleteRoot);
        const invalidId = "mdf-malformed-incomplete";
        const [begin] = completeRows(invalidId);
        begin.requested_model = "";
        fs.mkdirSync(path.join(malformedIncompleteRoot, ".mdf", "observations"), { recursive: true });
        fs.writeFileSync(
          path.join(malformedIncompleteRoot, ".mdf", "observations", "subagent-invocations.jsonl"),
          `${JSON.stringify(begin)}\n`
        );
        const result = checkerResult(malformedIncompleteRoot);
        assert.strictEqual(result.json.status, "invalid");
        assert.deepStrictEqual(result.json.invocations, [{ invocation_id: invalidId, status: "malformed" }]);
      } finally {
        fs.rmSync(malformedIncompleteRoot, { recursive: true, force: true });
      }
    }
    {
      const sameIdMalformedRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mdf-same-id-malformed-"));
      try {
        initialize(sameIdMalformedRoot);
        const malformedId = "mdf-same-id-malformed";
        const validId = "mdf-unrelated-valid";
        const rows = [
          ...completeRows(malformedId),
          { event: "unknown", invocation_id: malformedId },
          ...completeRows(validId),
        ];
        fs.mkdirSync(path.join(sameIdMalformedRoot, ".mdf", "observations"), { recursive: true });
        fs.writeFileSync(
          path.join(sameIdMalformedRoot, ".mdf", "observations", "subagent-invocations.jsonl"),
          `${rows.map(JSON.stringify).join("\n")}\n`
        );
        fs.writeFileSync(
          path.join(sameIdMalformedRoot, ".mdf", "work", "work-1", "handoff-001.md"),
          attemptLine(malformedId, "executor", "none", "finished", "not_used")
            + attemptLine(validId, "executor", "none", "finished", "not_used")
        );
        const result = checkerResult(sameIdMalformedRoot);
        assert.strictEqual(result.json.status, "invalid");
        assert.deepStrictEqual(result.json.invocations, [
          { invocation_id: malformedId, status: "malformed" },
          { invocation_id: validId, status: "valid" },
        ]);
      } finally {
        fs.rmSync(sameIdMalformedRoot, { recursive: true, force: true });
      }
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

    const damagedRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mdf-damaged-journal-"));
    try {
      initialize(damagedRoot);
      const damagedObservations = path.join(damagedRoot, ".mdf", "observations");
      fs.mkdirSync(damagedObservations, { recursive: true });
      const damagedLog = path.join(damagedObservations, "subagent-invocations.jsonl");
      fs.writeFileSync(damagedLog, "{\"event\":\"begin\"");
      const before = fs.readFileSync(damagedLog, "utf8");
      const damagedBegin = runJson(["begin", "work-1", "gpt-test", "high", "executor"], damagedRoot);
      assert.strictEqual(damagedBegin.status, "unavailable");
      assert.strictEqual(fs.readFileSync(damagedLog, "utf8"), before);
    } finally {
      fs.rmSync(damagedRoot, { recursive: true, force: true });
    }

    for (const [name, tailRow] of [
      ["unknown-event", { event: "unknown", invocation_id: "mdf-unknown-event" }],
      ["incomplete-begin", { event: "begin", invocation_id: "mdf-incomplete-begin" }],
    ]) {
      const malformedTailRoot = fs.mkdtempSync(path.join(os.tmpdir(), `mdf-malformed-tail-${name}-`));
      try {
        initialize(malformedTailRoot);
        const observations = path.join(malformedTailRoot, ".mdf", "observations");
        fs.mkdirSync(observations, { recursive: true });
        const journal = path.join(observations, "subagent-invocations.jsonl");
        fs.writeFileSync(journal, `${JSON.stringify(tailRow)}\n`);
        const before = fs.readFileSync(journal, "utf8");
        const result = runJson(["begin", "work-1", "gpt-test", "high", "executor"], malformedTailRoot);
        assert.strictEqual(result.status, "unavailable");
        assert.strictEqual(fs.readFileSync(journal, "utf8"), before);
      } finally {
        fs.rmSync(malformedTailRoot, { recursive: true, force: true });
      }
    }

    const mixedRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mdf-mixed-checker-"));
    try {
      initialize(mixedRoot);
      const mixedObservations = path.join(mixedRoot, ".mdf", "observations");
      fs.mkdirSync(mixedObservations, { recursive: true });
      const validId = "mdf-mixed-valid";
      const incompleteId = "mdf-mixed-incomplete";
      fs.writeFileSync(
        path.join(mixedObservations, "subagent-invocations.jsonl"),
        `${[...completeRows(validId), completeRows(incompleteId)[0]].map(JSON.stringify).join("\n")}\n`
      );
      fs.writeFileSync(
        path.join(mixedRoot, ".mdf", "work", "work-1", "handoff-001.md"),
        attemptLine(validId, "executor", "none", "finished", "not_used")
      );
      const mixed = checkerResult(mixedRoot);
      assert.strictEqual(mixed.status, 1);
      assert.deepStrictEqual(mixed.json.invocations, [
        { invocation_id: incompleteId, status: "incomplete" },
        { invocation_id: validId, status: "valid" },
      ]);
    } finally {
      fs.rmSync(mixedRoot, { recursive: true, force: true });
    }

    const boundedRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mdf-bounded-finish-"));
    try {
      initialize(boundedRoot);
      const oldBegin = runJson(["begin", "work-1", "gpt-test", "high", "executor"], boundedRoot);
      const boundedLog = path.join(boundedRoot, ".mdf", "observations", "subagent-invocations.jsonl");
      const paddingRow = `${JSON.stringify({
        event: "begin",
        invocation_id: `mdf-padding-${"x".repeat(200)}`,
        work_id: null,
        requested_model: "gpt-test",
        requested_effort: "low",
        canonical_role: "tester",
      })}\n`;
      fs.appendFileSync(boundedLog, paddingRow.repeat(Math.ceil((1024 * 1024) / Buffer.byteLength(paddingRow)) + 2));
      const boundedFinish = runJson(["finish", oldBegin.invocation_id, "finished"], boundedRoot);
      assert.strictEqual(boundedFinish.status, "unavailable");
      assert.strictEqual(boundedFinish.reason, "invocation_not_in_journal_tail");
    } finally {
      fs.rmSync(boundedRoot, { recursive: true, force: true });
    }

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
