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
const worktrees = require("./mdf-worktrees");

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

function runWorktreeTests() {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mdf-worktree-fixture-"));
  const root = path.join(temporaryRoot, "project");
  const remote = path.join(temporaryRoot, "origin.git");
  fs.mkdirSync(root, { recursive: true });
  fs.mkdirSync(path.join(root, ".mdf", "project"), { recursive: true });
  writeJson(path.join(root, ".mdf", "project", "init.json"), { version: 1 });
  fs.writeFileSync(path.join(root, ".gitignore"), ".worktrees/\n.mdf/\n");
  for (const args of [["init", "--quiet", root], ["config", "user.email", "mdf@example.com"], ["config", "user.name", "MDF Test"]]) {
    const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
    assert.strictEqual(result.status, 0, result.stderr);
  }
  fs.writeFileSync(path.join(root, "README.md"), "fixture\n");
  for (const args of [["add", "."], ["commit", "--quiet", "-m", "fixture"], ["branch", "-M", "main"], ["init", "--quiet", "--bare", remote]]) {
    const cwd = args[0] === "init" && args.includes("--bare") ? temporaryRoot : root;
    const result = spawnSync("git", args, { cwd, encoding: "utf8" });
    assert.strictEqual(result.status, 0, result.stderr);
  }
  let result = spawnSync("git", ["remote", "add", "origin", remote], { cwd: root, encoding: "utf8" });
  assert.strictEqual(result.status, 0, result.stderr);
  result = spawnSync("git", ["push", "--quiet", "-u", "origin", "main"], { cwd: root, encoding: "utf8" });
  assert.strictEqual(result.status, 0, result.stderr);
  result = spawnSync("git", ["symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/main"], { cwd: root, encoding: "utf8" });
  assert.strictEqual(result.status, 0, result.stderr);
  const target = path.join(root, ".worktrees", "task-fixture");
  fs.mkdirSync(path.join(root, ".worktrees"), { recursive: true });
  fs.writeFileSync(path.join(root, ".env.test"), "SOURCE=1\n");
  try {
    const cli = (command, input) => spawnSync(process.execPath, [path.join(__dirname, "mdf-worktrees.js"), command, "--cwd", root], {
      encoding: "utf8",
      input: JSON.stringify(input),
    });
    const cliPreflight = cli("preflight", { branch: "cli-fixture" });
    assert.strictEqual(cliPreflight.status, 0, cliPreflight.stderr);
    assert.strictEqual(JSON.parse(cliPreflight.stdout).ok, true);
    const cliCreate = cli("create", { branch: "cli-fixture" });
    assert.strictEqual(cliCreate.status, 0, cliCreate.stderr);
    const cliCreated = JSON.parse(cliCreate.stdout).result.path;
    assert.strictEqual(fs.existsSync(cliCreated), true);
    spawnSync("git", ["worktree", "remove", "--force", cliCreated], { cwd: root });
    spawnSync("git", ["branch", "-D", "cli-fixture"], { cwd: root });
    const cliPrepareTarget = path.join(root, ".worktrees", "cli-prepare");
    fs.mkdirSync(cliPrepareTarget, { recursive: true });
    const cliPrepare = cli("prepare", { worktree_path: cliPrepareTarget });
    assert.strictEqual(cliPrepare.status, 0, cliPrepare.stderr);
    assert.strictEqual(JSON.parse(cliPrepare.stdout).ok, true);
    fs.rmSync(cliPrepareTarget, { recursive: true, force: true });
    const preflight = worktrees.preflight({ root, branch: "task-fixture" });
    assert.strictEqual(preflight.default_branch, "main");
    assert.strictEqual(preflight.canonical_root, fs.realpathSync(root));
    assert.strictEqual(preflight.ignore_policy, true);
    assert.deepStrictEqual(preflight.conflicts, []);
    const reportRunner = (command, args) => {
      if (args[0] === "rev-parse" && args[1] === "--git-dir") return { status: 0, stdout: ".git\n", stderr: "" };
      if (args[0] === "rev-parse" && args[1] === "--git-common-dir") return { status: 0, stdout: ".git\n", stderr: "" };
      if (args[0] === "branch") return { status: 0, stdout: "main\n", stderr: "" };
      if (args[0] === "symbolic-ref") return { status: 0, stdout: "origin/main\n", stderr: "" };
      if (args[0] === "remote" && args[1] === "get-url") return { status: 0, stdout: "origin\n", stderr: "" };
      if (args[0] === "check-ignore") return { status: 0, stdout: "", stderr: "" };
      if (args[0] === "fetch") return { status: 0, stdout: "", stderr: "" };
      if (args[0] === "show-ref" && args[3] === "refs/remotes/origin/main") return { status: 0, stdout: "", stderr: "" };
      if (args[0] === "show-ref") return { status: 1, stdout: "", stderr: "" };
      if (args[0] === "worktree") return { status: 0, stdout: `worktree ${root}\nHEAD abc\nbranch refs/heads/main\n\nworktree ${path.join(root, ".worktrees", "gone")}\nHEAD def\nbroken\nprunable\n`, stderr: "" };
      return { status: 0, stdout: "", stderr: "" };
    };
    const reported = worktrees.preflight({ root, branch: "reported" }, { runner: reportRunner });
    assert.strictEqual(reported.broken_worktrees.length, 1);
    assert.strictEqual(reported.prunable_worktrees.length, 1);
    const created = worktrees.create({ root, branch: "task-fixture" });
    assert.strictEqual(created.base, "origin/main");
    assert.strictEqual(fs.existsSync(target), true);
    assert.strictEqual(fs.existsSync(path.join(target, ".mdf")), false);
    const linkedPreflight = worktrees.preflight({ root, cwd: created.path, worktree_path: created.path });
    assert.strictEqual(linkedPreflight.current_isolated, true);
    assert.strictEqual(linkedPreflight.current_branch, "task-fixture");
    const prepareCommands = [];
    fs.writeFileSync(path.join(target, "package-lock.json"), "{}\n");
    writeJson(path.join(target, "package.json"), { scripts: { "prisma:generate": "prisma generate" }, devDependencies: { prisma: "1.0.0" } });
    const prepared = worktrees.prepare({ root, worktree_path: target }, { runner: (command, args, options) => {
      prepareCommands.push({ command, args, cwd: options.cwd });
      return { status: 0, stdout: "", stderr: "" };
    }});
    assert.deepStrictEqual(prepared.environment.copied, [".env.test"]);
    assert.deepStrictEqual(prepareCommands.map((entry) => [entry.command, ...entry.args]), [["npm", "install"], ["npm", "run", "prisma:generate"]]);
    assert.strictEqual(fs.readFileSync(path.join(target, ".env.test"), "utf8"), "SOURCE=1\n");
    const conflict = worktrees.preflight({ root, branch: "task-fixture" });
    assert.ok(conflict.conflicts.some((entry) => entry.kind === "branch"));
    expectCode(() => worktrees.create({ root, branch: "task-fixture" }), "MDF_WORKTREE_CONFLICT");
    const failureCommands = [];
    const failureTarget = path.join(root, ".worktrees", "failure");
    fs.mkdirSync(failureTarget, { recursive: true });
    writeJson(path.join(failureTarget, "package.json"), { scripts: { generate: "prisma generate" }, devDependencies: { prisma: "1.0.0" } });
    expectCode(() => worktrees.prepare({ root, worktree_path: failureTarget }, { runner: (command, args) => {
      failureCommands.push([command, ...args]);
      return { status: 1, stdout: "", stderr: "install failed" };
    }}), "MDF_DEPENDENCY_SETUP_FAILED");
    assert.deepStrictEqual(failureCommands, [["npm", "install"]]);
    const prismaFailureTarget = path.join(root, ".worktrees", "prisma-failure");
    fs.mkdirSync(prismaFailureTarget, { recursive: true });
    writeJson(path.join(prismaFailureTarget, "package.json"), { scripts: { generate: "prisma generate" }, devDependencies: { prisma: "1.0.0" } });
    const prismaFailureCommands = [];
    expectCode(() => worktrees.prepare({ root, worktree_path: prismaFailureTarget }, { runner: (command, args) => {
      prismaFailureCommands.push([command, ...args]);
      return args[0] === "run" ? { status: 1, stdout: "", stderr: "prisma failed" } : { status: 0, stdout: "", stderr: "" };
    }}), "MDF_PRISMA_SETUP_FAILED");
    assert.deepStrictEqual(prismaFailureCommands, [["npm", "install"], ["npm", "run", "generate"]]);
    fs.mkdirSync(path.join(root, ".worktrees", "state-boundary", ".mdf"), { recursive: true });
    expectCode(() => worktrees.prepare({ root, worktree_path: path.join(root, ".worktrees", "state-boundary") }), "MDF_WORKTREE_STATE_BOUNDARY");
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

function main() {
  runRuntimeTests();
  runArtifactTests();
  runWorktreeTests();
  console.log("mdf workflow script validation: task 1, task 2, and task 3 checks passed");
}

if (require.main === module) main();

module.exports = { runRuntimeTests };
