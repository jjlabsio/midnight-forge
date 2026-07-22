#!/usr/bin/env node

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync, spawn, spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const helper = path.join(root, "skills", "use-mdf", "scripts", "record-subagent-observation.mjs");
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "mdf-observation-"));
fs.mkdirSync(path.join(fixture, ".mdf", "project"), { recursive: true });
fs.writeFileSync(
  path.join(fixture, ".mdf", "project", "init.json"),
  `${JSON.stringify({ canonical_root: fixture })}\n`
);

function run(args) {
  execFileSync(process.execPath, [helper, fixture, ...args], { encoding: "utf8" });
}

function runAsync(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [helper, fixture, ...args]);
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`helper exited ${code}`)));
  });
}

async function main() {
  try {
    run(["dispatch", "invocation-1", "gpt-test", "high", "work-1"]);
    run(["terminal", "invocation-1", "runtime-custom-status", ".mdf/work/work-1/stage.md"]);
    await Promise.all(Array.from({ length: 8 }, (_, index) =>
      runAsync(["dispatch", `parallel-${index}`, "gpt-test", "medium", "-"])
    ));

    const logPath = path.join(fixture, ".mdf", "observations", "subagent-invocations.jsonl");
    const rows = fs.readFileSync(logPath, "utf8").trim().split("\n").map(JSON.parse);
    assert.strictEqual(rows.length, 10);
    assert.strictEqual(rows[0].work_id, "work-1");
    assert.strictEqual(rows[1].status, "runtime-custom-status");
    assert.deepStrictEqual(rows[1].artifact_refs, [".mdf/work/work-1/stage.md"]);
    assert.strictEqual(new Set(rows.map(({ event, invocation_id }) => `${event}:${invocation_id}`)).size, 10);

    const traversal = spawnSync(process.execPath, [
      helper,
      fixture,
      "terminal",
      "bad-traversal",
      "completed",
      ".mdf/work/a/../b/report.md",
    ]);
    assert.strictEqual(traversal.status, 2);

    const symlinkRoot = path.join(fixture, "symlink-root");
    const outside = path.join(fixture, "outside");
    fs.mkdirSync(path.join(symlinkRoot, ".mdf", "project"), { recursive: true });
    fs.mkdirSync(outside);
    fs.writeFileSync(
      path.join(symlinkRoot, ".mdf", "project", "init.json"),
      `${JSON.stringify({ canonical_root: symlinkRoot })}\n`
    );
    fs.symlinkSync(outside, path.join(symlinkRoot, ".mdf", "observations"));
    const symlinked = spawnSync(process.execPath, [
      helper,
      symlinkRoot,
      "dispatch",
      "bad-symlink",
      "gpt-test",
      "high",
      "-",
    ]);
    assert.strictEqual(symlinked.status, 2);
    console.log("subagent observation helper tests passed");
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
