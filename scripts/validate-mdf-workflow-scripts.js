#!/usr/bin/env node

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { WorkflowError } = require("./mdf-runtime/errors");
const { parseArgs, parseJsonInput, formatSuccess } = require("./mdf-runtime/cli");
const { canonicalRoot, projectPaths, resolveWithin } = require("./mdf-runtime/canonical-root");
const { runCommand, runGit, resolveDefaultBranch } = require("./mdf-runtime/git");

function expectCode(callback, code) {
  assert.throws(callback, (error) => error && error.code === code);
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function createFixture() {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mdf-workflow-runtime-"));
  const root = path.join(temporaryRoot, "project");
  fs.mkdirSync(path.join(root, ".worktrees", "task", "nested"), { recursive: true });
  fs.mkdirSync(path.join(root, ".mdf", "project"), { recursive: true });
  writeJson(path.join(root, ".mdf", "project", "init.json"), { version: 1 });
  const initialized = spawnSync("git", ["init", "--quiet", root], { encoding: "utf8" });
  assert.strictEqual(initialized.status, 0, initialized.stderr);
  return { temporaryRoot, root, nested: path.join(root, ".worktrees", "task", "nested") };
}

function runRuntimeTests() {
  assert.deepStrictEqual(parseArgs(["probe", "--cwd", "/tmp/project"]), {
    command: "probe",
    options: { cwd: "/tmp/project" },
  });
  assert.deepStrictEqual(parseJsonInput("{\"value\":1}"), { value: 1 });
  assert.deepStrictEqual(parseJsonInput(""), {});
  assert.deepStrictEqual(formatSuccess({ value: 1 }), { ok: true, result: { value: 1 } });
  const error = new WorkflowError("MDF_TEST_STOP", "stop", { path: "x" });
  assert.strictEqual(error.code, "MDF_TEST_STOP");
  assert.deepStrictEqual(error.details, { path: "x" });

  const fixture = createFixture();
  try {
    assert.strictEqual(canonicalRoot(fixture.root), fs.realpathSync(fixture.root));
    assert.strictEqual(canonicalRoot(fixture.nested), fs.realpathSync(fixture.root));
    assert.strictEqual(projectPaths(fixture.root).projectInit, path.join(fixture.root, ".mdf", "project", "init.json"));
    assert.strictEqual(resolveWithin(fixture.root, ".mdf/project/init.json"), fs.realpathSync(path.join(fixture.root, ".mdf", "project", "init.json")));
    expectCode(() => resolveWithin(fixture.root, "../outside"), "MDF_PATH_ESCAPE");
    fs.symlinkSync(path.join(fixture.root, ".mdf"), path.join(fixture.root, "mdf-link"));
    expectCode(() => resolveWithin(fixture.root, "mdf-link/project/init.json"), "MDF_SYMLINK_PATH");
    assert.strictEqual(runGit(["rev-parse", "--show-toplevel"], { cwd: fixture.root }), fs.realpathSync(fixture.root));

    const fakeRunner = (command, args) => {
      assert.strictEqual(command, "git");
      if (args[0] === "symbolic-ref") return { status: 0, stdout: "origin/main\n", stderr: "" };
      return { status: 0, stdout: "ok\n", stderr: "" };
    };
    assert.strictEqual(resolveDefaultBranch({ cwd: fixture.root, runner: fakeRunner }), "main");
    assert.deepStrictEqual(runCommand("git", ["status"], { cwd: fixture.root, runner: fakeRunner }), {
      status: 0,
      stdout: "ok\n",
      stderr: "",
    });
    expectCode(
      () => runCommand("git", ["status"], { cwd: fixture.root, runner: () => ({ status: 1, stdout: "", stderr: "bad" }) }),
      "MDF_COMMAND_FAILED"
    );
  } finally {
    fs.rmSync(fixture.temporaryRoot, { recursive: true, force: true });
  }
}

function main() {
  runRuntimeTests();
  console.log("mdf workflow script validation: task 1 runtime checks passed");
}

if (require.main === module) main();

module.exports = { runRuntimeTests };
