#!/usr/bin/env node

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const helper = path.join(root, "skills", "task", "scripts", "task-store.mjs");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "mdf-task-store-"));
const project = path.join(temp, "project");
const work = path.join(project, ".mdf", "work");

function write(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, value); }
function run(...args) { return spawnSync(process.execPath, [helper, project, ...args], { encoding: "utf8" }); }
function state(workId, value) { write(path.join(work, workId, "task.json"), `${JSON.stringify(value)}\n`); }
function error(result) { return JSON.parse(result.stderr).error.code; }

try {
  write(path.join(project, ".mdf", "project", "init.json"), JSON.stringify({ version: 1, canonical_root: project }));
  write(path.join(work, "2026-07-29-0001-alpha", "item.md"), "# Alpha intent\n");
  state("2026-07-29-0001-alpha", { version: 1, task_id: "0001", work_id: "2026-07-29-0001-alpha", title: "Alpha", status: "queue", order: 1, created: "2026-07-29", depends_on: [] });

  const before = fs.readFileSync(path.join(work, "2026-07-29-0001-alpha", "task.json"));
  const inspected = run("inspect", "1");
  assert.strictEqual(inspected.status, 0, inspected.stderr);
  assert.strictEqual(JSON.parse(inspected.stdout).task.status, "queue");
  assert.match(JSON.parse(inspected.stdout).digest, /^[a-f0-9]{64}$/);
  assert.deepStrictEqual(fs.readFileSync(path.join(work, "2026-07-29-0001-alpha", "task.json")), before);

  const listed = run("list");
  assert.strictEqual(listed.status, 0, listed.stderr);
  assert.deepStrictEqual(JSON.parse(listed.stdout).tasks.map((task) => task.task_id), ["0001"]);
  assert.deepStrictEqual(fs.readFileSync(path.join(work, "2026-07-29-0001-alpha", "task.json")), before, "board list must not rewrite current state");
  assert.strictEqual(fs.readFileSync(path.join(work, "2026-07-29-0001-alpha", "item.md"), "utf8"), "# Alpha intent\n", "board list must not rewrite intent");

  fs.renameSync(path.join(work, "2026-07-29-0001-alpha", "item.md"), path.join(work, "2026-07-29-0001-alpha", "missing-item.md"));
  const unlinked = run("list");
  assert.strictEqual(unlinked.status, 2, unlinked.stderr);
  assert.strictEqual(error(unlinked), "MALFORMED_TASK");
  fs.renameSync(path.join(work, "2026-07-29-0001-alpha", "missing-item.md"), path.join(work, "2026-07-29-0001-alpha", "item.md"));

  const set = run("set-status", "0001", "active", "queue", JSON.parse(inspected.stdout).digest);
  assert.strictEqual(set.status, 0, set.stderr);
  assert.strictEqual(JSON.parse(set.stdout).task.status, "active");
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(work, "2026-07-29-0001-alpha", "task.json"))).status, "active");

  const conflict = run("set-status", "0001", "cancelled", "queue", JSON.parse(set.stdout).digest);
  assert.strictEqual(conflict.status, 2);
  assert.strictEqual(error(conflict), "STATE_CHANGED");

  const cancel = run("set-status", "0001", "cancelled", "active", JSON.parse(set.stdout).digest);
  assert.strictEqual(cancel.status, 0, cancel.stderr);
  assert.ok(fs.existsSync(path.join(work, "2026-07-29-0001-alpha")));

  const cancelledInspection = run("inspect", "0001");
  const withExecutionFacts = { ...JSON.parse(cancelledInspection.stdout).task, latest: { pr: "https://example.test/pr/1" } };
  const replace = run("replace", "0001", JSON.parse(cancelledInspection.stdout).digest, JSON.stringify(withExecutionFacts));
  assert.strictEqual(replace.status, 0, replace.stderr);
  assert.deepStrictEqual(JSON.parse(replace.stdout).task.latest, withExecutionFacts.latest);
  assert.strictEqual(fs.readFileSync(path.join(work, "2026-07-29-0001-alpha", "item.md"), "utf8"), "# Alpha intent\n", "state replacement must not write intent");

  const staleReplacement = run("replace", "0001", JSON.parse(cancelledInspection.stdout).digest, JSON.stringify(withExecutionFacts));
  assert.strictEqual(staleReplacement.status, 2, staleReplacement.stderr);
  assert.strictEqual(error(staleReplacement), "STATE_CHANGED");

  for (const [field, value] of [["order", undefined], ["created", 123], ["depends_on", "0001"]]) {
    const malformed = { version: 1, task_id: "0002", work_id: "2026-07-29-0002-malformed", title: "Malformed", status: "queue", order: 2, created: "2026-07-29", depends_on: [] };
    malformed[field] = value;
    write(path.join(work, malformed.work_id, "item.md"), "# Malformed intent\n");
    state(malformed.work_id, malformed);
    const result = run("list");
    assert.strictEqual(result.status, 2, `${field}: ${result.stderr}`);
    assert.strictEqual(error(result), "MALFORMED_TASK");
    fs.rmSync(path.join(work, malformed.work_id), { recursive: true, force: true });
  }

  const active = JSON.parse(fs.readFileSync(path.join(work, "2026-07-29-0001-alpha", "task.json")));
  active.status = "active";
  active.latest = { pr: "https://example.test/pr/1" };
  state(active.work_id, active);
  const activeInspection = run("inspect", "0001");
  assert.strictEqual(activeInspection.status, 0, activeInspection.stderr);
  active.latest.pr = "https://example.test/pr/2";
  state(active.work_id, active);
  const stale = run("set-status", "0001", "done", "active", JSON.parse(activeInspection.stdout).digest);
  assert.strictEqual(stale.status, 2, stale.stderr);
  assert.strictEqual(error(stale), "STATE_CHANGED");
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(work, active.work_id, "task.json"))).latest.pr, "https://example.test/pr/2");
  console.log("task-store helper tests passed");
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
