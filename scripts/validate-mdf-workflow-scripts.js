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
const { atomicWriteText, atomicWriteFiles } = require("./mdf-runtime/atomic");
const { parseIndex, parseItem, serializeItem } = require("./mdf-runtime/schema");
const { reconcileIndex } = require("./mdf-runtime/index");
const artifacts = require("./mdf-artifacts");

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

function runArtifactTests() {
  const fixture = createFixture();
  const workId = "2026-07-12-0001-artifact-fixture";
  const workDir = path.join(fixture.root, ".mdf", "work", workId);
  fs.mkdirSync(workDir, { recursive: true });
  const itemPath = path.join(workDir, "item.md");
  const item = {
    path: itemPath,
    data: { work_id: workId, task_id: "0001", kind: "task", title: "Artifact fixture", status: "active", latest: {} },
    body: "## Context\n\nfixture\n",
  };
  fs.writeFileSync(itemPath, serializeItem(item));
  fs.writeFileSync(path.join(fixture.root, ".mdf", "index.jsonl"), `${JSON.stringify({ work_id: "other", title: "preserve"})}\n${JSON.stringify({ work_id: workId, item: path.relative(fixture.root, itemPath), latest: {}})}\n`);
  try {
    const cli = (command, input) => spawnSync(process.execPath, [path.join(__dirname, "mdf-artifacts.js"), command, "--cwd", fixture.root], {
      encoding: "utf8",
      input: JSON.stringify(input),
    });
    const cliAllocate = cli("allocate", { work_id: workId, artifact_type: "build" });
    assert.strictEqual(cliAllocate.status, 0, cliAllocate.stderr);
    assert.strictEqual(JSON.parse(cliAllocate.stdout).ok, true);
    assert.strictEqual(artifacts.allocate({ root: fixture.root, work_id: workId, artifact_type: "build" }).revision, 1);
    artifacts.write({ root: fixture.root, work_id: workId, artifact_type: "build", revision: 1, content: "build one\n" });
    assert.strictEqual(artifacts.allocate({ root: fixture.root, work_id: workId, artifact_type: "build" }).revision, 2);
    expectCode(() => artifacts.write({ root: fixture.root, work_id: workId, artifact_type: "build", revision: 1, content: "collision\n" }), "MDF_ARTIFACT_EXISTS");
    artifacts.write({ root: fixture.root, work_id: workId, artifact_type: "build", revision: 2, content: "build two\n" });
    artifacts.latest({ root: fixture.root, work_id: workId, artifact_type: "build", revision: 2 });
    const cliWrite = cli("write", { work_id: workId, artifact_type: "build", revision: 3, content: "build three\n" });
    assert.strictEqual(cliWrite.status, 0, cliWrite.stderr);
    const cliLatest = cli("latest", { work_id: workId, artifact_type: "build", revision: 3 });
    assert.strictEqual(cliLatest.status, 0, cliLatest.stderr);
    const cliReconcile = cli("reconcile-index", { work_id: workId });
    assert.strictEqual(cliReconcile.status, 0, cliReconcile.stderr);
    const cliUnknown = cli("unknown", {});
    assert.strictEqual(cliUnknown.status, 1);
    assert.strictEqual(JSON.parse(cliUnknown.stderr).error.code, "MDF_USAGE");
    const parsed = parseItem(itemPath);
    assert.strictEqual(parsed.data.latest.build, ".mdf/work/2026-07-12-0001-artifact-fixture/build-003.md");
    const index = parseIndex(path.join(fixture.root, ".mdf", "index.jsonl"));
    assert.deepStrictEqual(index.entries[0], { work_id: "other", title: "preserve" });
    assert.strictEqual(index.entries[1].latest.build, parsed.data.latest.build);
    assert.strictEqual(fs.readFileSync(path.join(workDir, "build-001.md"), "utf8"), "build one\n");
    expectCode(() => artifacts.allocate({ root: fixture.root, work_id: "../escape", artifact_type: "build" }), "MDF_INPUT_INVALID");
    fs.symlinkSync(workDir, path.join(fixture.root, ".mdf", "work", "linked"));
    expectCode(() => artifacts.allocate({ root: fixture.root, work_id: "linked", artifact_type: "build" }), "MDF_SYMLINK_PATH");
    fs.unlinkSync(path.join(fixture.root, ".mdf", "work", "linked"));
    const malformedItem = fs.readFileSync(itemPath, "utf8");
    fs.writeFileSync(itemPath, "not frontmatter\n");
    expectCode(() => artifacts.allocate({ root: fixture.root, work_id: workId, artifact_type: "build" }), "MDF_ITEM_MALFORMED");
    fs.writeFileSync(itemPath, malformedItem);
    const indexPath = path.join(fixture.root, ".mdf", "index.jsonl");
    const validIndex = fs.readFileSync(indexPath, "utf8");
    fs.writeFileSync(indexPath, `${validIndex}not-json\n`);
    expectCode(() => artifacts.allocate({ root: fixture.root, work_id: workId, artifact_type: "build" }), "MDF_INDEX_MALFORMED");
    fs.writeFileSync(indexPath, validIndex);
    fs.writeFileSync(indexPath, `${validIndex}${validIndex.split("\n")[1]}\n`);
    expectCode(() => artifacts.allocate({ root: fixture.root, work_id: workId, artifact_type: "build" }), "MDF_INDEX_DUPLICATE");
    fs.writeFileSync(indexPath, validIndex);
    const before = fs.readFileSync(itemPath, "utf8");
    expectCode(() => atomicWriteText(path.join(workDir, "missing", "target.md"), "x", { fsImpl: { ...fs, renameSync() { throw new Error("injected"); } } }), "MDF_ATOMIC_WRITE_FAILED");
    assert.strictEqual(fs.readFileSync(itemPath, "utf8"), before);
    const indexBefore = fs.readFileSync(path.join(fixture.root, ".mdf", "index.jsonl"), "utf8");
    expectCode(() => reconcileIndex(path.join(fixture.root, ".mdf", "index.jsonl"), { work_id: workId, item: path.relative(fixture.root, itemPath), latest: parsed.data.latest }, { fsImpl: { ...fs, renameSync() { throw new Error("injected"); } } }), "MDF_ATOMIC_WRITE_FAILED");
    assert.strictEqual(fs.readFileSync(path.join(fixture.root, ".mdf", "index.jsonl"), "utf8"), indexBefore);
  } finally {
    fs.rmSync(fixture.temporaryRoot, { recursive: true, force: true });
  }
}

function main() {
  runRuntimeTests();
  runArtifactTests();
  console.log("mdf workflow script validation: task 1 and task 2 checks passed");
}

if (require.main === module) main();

module.exports = { runRuntimeTests };
