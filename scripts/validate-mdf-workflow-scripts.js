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
const initScript = require("./mdf-init");
const clearGone = require("./mdf-github-clear-gone");
const afterMerge = require("./mdf-github-after-merge");

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
    artifacts.write({ root: fixture.root, work_id: workId, relative_path: "spec-001.md", content: "spec one\n" });
    artifacts.latest({ root: fixture.root, work_id: workId, artifact_type: "spec", path: ".mdf/work/2026-07-12-0001-artifact-fixture/spec-001.md" });
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
    assert.strictEqual(artifacts.allocate({ root: fixture.root, work_id: workId, artifact_type: "build" }).revision, 4);
    artifacts.write({ root: fixture.root, work_id: workId, artifact_type: "build", revision: 4, content: "build four\n" });
    artifacts.latest({ root: fixture.root, work_id: workId, artifact_type: "build", revision: 4 });
    const historicalIndex = parseIndex(indexPath);
    const historicalEntries = historicalIndex.entries.filter((entry) => entry.work_id === workId);
    assert.strictEqual(historicalEntries.length, 2);
    assert.strictEqual(historicalEntries[historicalEntries.length - 1].latest.build, ".mdf/work/2026-07-12-0001-artifact-fixture/build-004.md");
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
  fs.writeFileSync(path.join(root, ".env.test"), "SOURCE=1\n");
  try {
    const cli = (command, input) => spawnSync(process.execPath, [path.join(__dirname, "mdf-worktrees.js"), command, "--cwd", root], {
      encoding: "utf8",
      input: JSON.stringify(input),
    });
    const cliPreflight = cli("preflight", { branch: "cli-fixture" });
    assert.strictEqual(cliPreflight.status, 0, cliPreflight.stderr);
    assert.strictEqual(JSON.parse(cliPreflight.stdout).ok, true);
    assert.strictEqual(fs.existsSync(path.join(root, ".worktrees")), false);
    const cliCreate = cli("create", { branch: "cli-fixture" });
    assert.strictEqual(cliCreate.status, 0, cliCreate.stderr);
    const cliCreated = JSON.parse(cliCreate.stdout).result.path;
    assert.strictEqual(fs.existsSync(cliCreated), true);
    spawnSync("git", ["worktree", "remove", "--force", cliCreated], { cwd: root });
    spawnSync("git", ["branch", "-D", "cli-fixture"], { cwd: root });
    const rollbackTarget = path.join(root, ".worktrees", "rollback-fixture");
    const rollbackCommands = [];
    expectCode(() => worktrees.create({ root, branch: "rollback-fixture", worktree: ".worktrees/rollback-fixture", fetch: false }, { runner: (command, args) => {
      rollbackCommands.push([command, ...args]);
      if (command !== "git") return { status: 0, stdout: "", stderr: "" };
      if (args[0] === "rev-parse" && args[1] === "--git-dir") return { status: 0, stdout: ".git\n", stderr: "" };
      if (args[0] === "rev-parse" && args[1] === "--git-common-dir") return { status: 0, stdout: ".git\n", stderr: "" };
      if (args[0] === "branch" && args[1] === "--show-current") return { status: 0, stdout: "main\n", stderr: "" };
      if (args[0] === "symbolic-ref") return { status: 0, stdout: "origin/main\n", stderr: "" };
      if (args[0] === "remote" && args[1] === "get-url") return { status: 0, stdout: "origin\n", stderr: "" };
      if (args[0] === "check-ignore") return { status: 0, stdout: "", stderr: "" };
      if (args[0] === "show-ref" && args[3] === "refs/remotes/origin/main") return { status: 0, stdout: "", stderr: "" };
      if (args[0] === "show-ref") return { status: 1, stdout: "", stderr: "" };
      if (args[0] === "worktree" && args[1] === "list") return { status: 0, stdout: `worktree ${root}\nHEAD abc\nbranch refs/heads/main\n`, stderr: "" };
      if (args[0] === "worktree" && args[1] === "add") {
        fs.mkdirSync(path.join(rollbackTarget, ".mdf"), { recursive: true });
        return { status: 0, stdout: "", stderr: "" };
      }
      if (args[0] === "worktree" && args[1] === "remove") {
        fs.rmSync(rollbackTarget, { recursive: true, force: true });
        return { status: 0, stdout: "", stderr: "" };
      }
      if (args[0] === "branch" && args[1] === "-D") return { status: 0, stdout: "", stderr: "" };
      return { status: 0, stdout: "", stderr: "" };
    }}), "MDF_WORKTREE_STATE_BOUNDARY");
    assert.strictEqual(fs.existsSync(rollbackTarget), false);
    assert.ok(rollbackCommands.some((args) => args[0] === "git" && args[1] === "fetch"));
    assert.ok(rollbackCommands.some((args) => args[0] === "git" && args[1] === "worktree" && args[2] === "remove"));
    assert.ok(rollbackCommands.some((args) => args[0] === "git" && args[1] === "branch" && args[2] === "-D"));
    const cliPrepareTarget = path.join(root, ".worktrees", "cli-prepare");
    fs.mkdirSync(cliPrepareTarget, { recursive: true });
    expectCode(() => worktrees.prepare({ root, worktree_path: cliPrepareTarget }), "MDF_WORKTREE_NOT_REGISTERED");
    fs.rmSync(cliPrepareTarget, { recursive: true, force: true });
    const registeredPrepareTarget = path.join(root, ".worktrees", "registered-cli-prepare");
    result = spawnSync("git", ["worktree", "add", "--quiet", "-b", "registered-cli-prepare", registeredPrepareTarget, "origin/main"], { cwd: root, encoding: "utf8" });
    assert.strictEqual(result.status, 0, result.stderr);
    const cliPrepare = cli("prepare", { worktree_path: registeredPrepareTarget });
    assert.strictEqual(cliPrepare.status, 0, cliPrepare.stderr);
    assert.strictEqual(JSON.parse(cliPrepare.stdout).ok, true);
    result = spawnSync("git", ["worktree", "remove", "--force", registeredPrepareTarget], { cwd: root, encoding: "utf8" });
    assert.strictEqual(result.status, 0, result.stderr);
    result = spawnSync("git", ["branch", "-D", "registered-cli-prepare"], { cwd: root, encoding: "utf8" });
    assert.strictEqual(result.status, 0, result.stderr);
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
    const created = worktrees.create({ root, branch: "task-fixture", worktree: ".worktrees/task-fixture" });
    assert.strictEqual(created.base, "origin/main");
    assert.strictEqual(fs.existsSync(target), true);
    assert.strictEqual(fs.existsSync(path.join(target, ".mdf")), false);
    fs.writeFileSync(path.join(root, ".mdf", "tracked-state.txt"), "must not enter linked worktrees\n");
    for (const args of [["add", "-f", ".mdf/tracked-state.txt"], ["commit", "--quiet", "-m", "tracked MDF boundary"]]) {
      result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
      assert.strictEqual(result.status, 0, result.stderr);
    }
    result = spawnSync("git", ["push", "--quiet", "origin", "main"], { cwd: root, encoding: "utf8" });
    assert.strictEqual(result.status, 0, result.stderr);
    const trackedBoundaryTarget = path.join(root, ".worktrees", "tracked-boundary");
    expectCode(() => worktrees.create({ root, branch: "tracked-boundary", worktree: ".worktrees/tracked-boundary" }), "MDF_WORKTREE_STATE_BOUNDARY");
    assert.strictEqual(fs.existsSync(trackedBoundaryTarget), false);
    result = spawnSync("git", ["show-ref", "--verify", "--quiet", "refs/heads/tracked-boundary"], { cwd: root, encoding: "utf8" });
    assert.strictEqual(result.status, 1);
    const linkedPreflight = worktrees.preflight({ root, cwd: created.path, worktree_path: created.path });
    assert.strictEqual(linkedPreflight.current_isolated, true);
    assert.strictEqual(linkedPreflight.current_branch, "task-fixture");
    const prepareCommands = [];
    fs.writeFileSync(path.join(target, "package-lock.json"), "{}\n");
    writeJson(path.join(target, "package.json"), { scripts: { "prisma:generate": "prisma generate" }, devDependencies: { prisma: "1.0.0" } });
    const prepared = worktrees.prepare({ root, worktree: ".worktrees/task-fixture" }, { runner: (command, args, options) => {
      prepareCommands.push({ command, args, cwd: options.cwd });
      if (command === "git" && args[0] === "worktree" && args[1] === "list") return { status: 0, stdout: `worktree ${fs.realpathSync(target)}\nHEAD abc\nbranch refs/heads/task-fixture\n`, stderr: "" };
      return { status: 0, stdout: "", stderr: "" };
    }});
    assert.deepStrictEqual(prepared.environment.copied, [".env.test"]);
    assert.deepStrictEqual(prepareCommands.map((entry) => [entry.command, ...entry.args]), [["git", "worktree", "list", "--porcelain"], ["npm", "install"], ["npm", "run", "prisma:generate"]]);
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
      if (command === "git" && args[0] === "worktree" && args[1] === "list") return { status: 0, stdout: `worktree ${fs.realpathSync(failureTarget)}\nHEAD abc\nbranch refs/heads/failure\n`, stderr: "" };
      return { status: 1, stdout: "", stderr: "install failed" };
    }}), "MDF_DEPENDENCY_SETUP_FAILED");
    assert.deepStrictEqual(failureCommands, [["git", "worktree", "list", "--porcelain"], ["npm", "install"]]);
    const prismaFailureTarget = path.join(root, ".worktrees", "prisma-failure");
    fs.mkdirSync(prismaFailureTarget, { recursive: true });
    writeJson(path.join(prismaFailureTarget, "package.json"), { scripts: { generate: "prisma generate" }, devDependencies: { prisma: "1.0.0" } });
    const prismaFailureCommands = [];
    expectCode(() => worktrees.prepare({ root, worktree_path: prismaFailureTarget }, { runner: (command, args) => {
      prismaFailureCommands.push([command, ...args]);
      if (command === "git" && args[0] === "worktree" && args[1] === "list") return { status: 0, stdout: `worktree ${fs.realpathSync(prismaFailureTarget)}\nHEAD abc\nbranch refs/heads/prisma-failure\n`, stderr: "" };
      return args[0] === "run" ? { status: 1, stdout: "", stderr: "prisma failed" } : { status: 0, stdout: "", stderr: "" };
    }}), "MDF_PRISMA_SETUP_FAILED");
    assert.deepStrictEqual(prismaFailureCommands, [["git", "worktree", "list", "--porcelain"], ["npm", "install"], ["npm", "run", "generate"]]);
    fs.mkdirSync(path.join(root, ".worktrees", "state-boundary", ".mdf"), { recursive: true });
    const stateBoundaryTarget = path.join(root, ".worktrees", "state-boundary");
    expectCode(() => worktrees.prepare({ root, worktree_path: stateBoundaryTarget }, { runner: (command, args) => {
      if (command === "git" && args[0] === "worktree" && args[1] === "list") return { status: 0, stdout: `worktree ${fs.realpathSync(stateBoundaryTarget)}\nHEAD abc\nbranch refs/heads/state-boundary\n`, stderr: "" };
      return { status: 0, stdout: "", stderr: "" };
    }}), "MDF_WORKTREE_STATE_BOUNDARY");
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

function runInitTests() {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mdf-init-fixture-"));
  const project = path.join(temporaryRoot, "project");
  const home = path.join(temporaryRoot, "home");
  fs.mkdirSync(project, { recursive: true });
  fs.mkdirSync(home, { recursive: true });
  fs.writeFileSync(path.join(project, ".gitignore"), "node_modules/\n.mdf/\n.worktrees/\n");
  let result = spawnSync("git", ["init", "--quiet", project], { encoding: "utf8" });
  assert.strictEqual(result.status, 0, result.stderr);
  const unrelated = { "/other/project": { id: "other", name: "other", canonical_root: "/other/project", remote: null, index: ".mdf/index.jsonl", last_seen: "2026-01-01T00:00:00Z" } };
  fs.mkdirSync(path.join(home, ".mdf"), { recursive: true });
  writeJson(path.join(home, ".mdf", "projects.json"), { version: 1, projects: unrelated });
  try {
    const applied = initScript.apply({ canonical_root: project, home, human_language: "Korean" });
    assert.strictEqual(applied.human_language, "Korean");
    assert.strictEqual(applied.canonical_root, fs.realpathSync(project));
    assert.strictEqual(fs.existsSync(path.join(project, ".mdf", "project.json")), true);
    assert.strictEqual(fs.existsSync(path.join(project, ".mdf", "project", "init.json")), true);
    assert.strictEqual(fs.existsSync(path.join(project, ".mdf", "work")), true);
    assert.strictEqual(fs.existsSync(path.join(project, ".mdf", "locks")), true);
    const registry = JSON.parse(fs.readFileSync(path.join(home, ".mdf", "projects.json"), "utf8"));
    assert.deepStrictEqual(registry.projects["/other/project"], unrelated["/other/project"]);
    assert.strictEqual(registry.projects[fs.realpathSync(project)].name, "project");
    assert.strictEqual(initScript.validate({ root: project, home }).project.valid, true);
    const cliValidate = spawnSync(process.execPath, [path.join(__dirname, "mdf-init.js"), "validate", "--cwd", project], { encoding: "utf8", input: JSON.stringify({ home }) });
    assert.strictEqual(cliValidate.status, 0, cliValidate.stderr);
    assert.strictEqual(JSON.parse(cliValidate.stdout).ok, true);
    const cliApply = spawnSync(process.execPath, [path.join(__dirname, "mdf-init.js"), "apply", "--cwd", project], { encoding: "utf8", input: JSON.stringify({ home, human_language: "Korean" }) });
    assert.strictEqual(cliApply.status, 0, cliApply.stderr);
    expectCode(() => initScript.apply({ root: project, home: path.join(temporaryRoot, "missing-home") }), "MDF_HUMAN_LANGUAGE_REQUIRED");
    const malformedPrefs = path.join(temporaryRoot, "malformed-prefs");
    writeJson(path.join(malformedPrefs, ".mdf", "user", "init.json"), { version: 1, initialized_at: "now", runtime: "codex" });
    fs.mkdirSync(path.join(malformedPrefs, ".mdf", "user"), { recursive: true });
    fs.writeFileSync(path.join(malformedPrefs, ".mdf", "user", "preferences.json"), "not-json\n");
    expectCode(() => initScript.apply({ root: project, home: malformedPrefs }), "MDF_USER_PREFS_MALFORMED");
    const malformedRegistryHome = path.join(temporaryRoot, "malformed-registry");
    fs.mkdirSync(path.join(malformedRegistryHome, ".mdf"), { recursive: true });
    fs.writeFileSync(path.join(malformedRegistryHome, ".mdf", "projects.json"), "{\"version\":2}\n");
    expectCode(() => initScript.apply({ root: project, home: malformedRegistryHome, human_language: "Korean" }), "MDF_PROJECTS_REGISTRY_MALFORMED");
    const noIgnore = path.join(temporaryRoot, "no-ignore");
    fs.mkdirSync(noIgnore, { recursive: true });
    result = spawnSync("git", ["init", "--quiet", noIgnore], { encoding: "utf8" });
    assert.strictEqual(result.status, 0, result.stderr);
    expectCode(() => initScript.apply({ root: noIgnore, home: path.join(temporaryRoot, "no-ignore-home"), human_language: "Korean" }), "MDF_IGNORE_POLICY_MISSING");
    assert.strictEqual(fs.existsSync(path.join(noIgnore, ".mdf")), false);
    const malformedProject = path.join(temporaryRoot, "malformed-project");
    fs.mkdirSync(path.join(malformedProject, ".mdf", "project"), { recursive: true });
    fs.writeFileSync(path.join(malformedProject, ".gitignore"), ".mdf/\n.worktrees/\n");
    result = spawnSync("git", ["init", "--quiet", malformedProject], { encoding: "utf8" });
    assert.strictEqual(result.status, 0, result.stderr);
    writeJson(path.join(malformedProject, ".mdf", "project", "init.json"), { version: 99 });
    expectCode(() => initScript.apply({ root: malformedProject, home: path.join(temporaryRoot, "malformed-project-home"), human_language: "Korean" }), "MDF_PROJECT_INIT_MALFORMED");
    const symlinkProject = path.join(temporaryRoot, "symlink-project");
    const symlinkOutside = path.join(temporaryRoot, "symlink-outside");
    fs.mkdirSync(path.join(symlinkProject, ".mdf"), { recursive: true });
    fs.mkdirSync(symlinkOutside, { recursive: true });
    fs.writeFileSync(path.join(symlinkProject, ".gitignore"), ".mdf/\n.worktrees/\n");
    result = spawnSync("git", ["init", "--quiet", symlinkProject], { encoding: "utf8" });
    assert.strictEqual(result.status, 0, result.stderr);
    fs.symlinkSync(symlinkOutside, path.join(symlinkProject, ".mdf", "project"));
    expectCode(() => initScript.apply({ root: symlinkProject, home: path.join(temporaryRoot, "symlink-project-home"), human_language: "Korean" }), "MDF_SYMLINK_PATH");
    assert.strictEqual(fs.existsSync(path.join(symlinkOutside, "init.json")), false);
    const wrongTypeProject = path.join(temporaryRoot, "wrong-type-project");
    fs.mkdirSync(path.join(wrongTypeProject, ".mdf", "project"), { recursive: true });
    fs.mkdirSync(path.join(wrongTypeProject, ".mdf", "locks"), { recursive: true });
    fs.writeFileSync(path.join(wrongTypeProject, ".mdf", "work"), "not a directory\n");
    fs.writeFileSync(path.join(wrongTypeProject, ".gitignore"), ".mdf/\n.worktrees/\n");
    result = spawnSync("git", ["init", "--quiet", wrongTypeProject], { encoding: "utf8" });
    assert.strictEqual(result.status, 0, result.stderr);
    expectCode(() => initScript.validate({ root: wrongTypeProject, home: path.join(temporaryRoot, "wrong-type-home") }), "MDF_LAYOUT_INVALID");
    const wrongIndexTypeProject = path.join(temporaryRoot, "wrong-index-type-project");
    fs.mkdirSync(path.join(wrongIndexTypeProject, ".mdf", "project"), { recursive: true });
    fs.mkdirSync(path.join(wrongIndexTypeProject, ".mdf", "work"), { recursive: true });
    fs.mkdirSync(path.join(wrongIndexTypeProject, ".mdf", "locks"), { recursive: true });
    fs.mkdirSync(path.join(wrongIndexTypeProject, ".mdf", "index.jsonl"), { recursive: true });
    fs.writeFileSync(path.join(wrongIndexTypeProject, ".gitignore"), ".mdf/\n.worktrees/\n");
    result = spawnSync("git", ["init", "--quiet", wrongIndexTypeProject], { encoding: "utf8" });
    assert.strictEqual(result.status, 0, result.stderr);
    expectCode(() => initScript.validate({ root: wrongIndexTypeProject, home: path.join(temporaryRoot, "wrong-index-type-home") }), "MDF_LAYOUT_INVALID");
    const symlinkUserProject = path.join(temporaryRoot, "symlink-user-project");
    const symlinkUserHome = path.join(temporaryRoot, "symlink-user-home");
    const symlinkUserOutside = path.join(temporaryRoot, "symlink-user-outside");
    fs.mkdirSync(symlinkUserProject, { recursive: true });
    fs.mkdirSync(symlinkUserHome, { recursive: true });
    fs.mkdirSync(symlinkUserOutside, { recursive: true });
    fs.writeFileSync(path.join(symlinkUserProject, ".gitignore"), ".mdf/\n.worktrees/\n");
    result = spawnSync("git", ["init", "--quiet", symlinkUserProject], { encoding: "utf8" });
    assert.strictEqual(result.status, 0, result.stderr);
    fs.mkdirSync(path.join(symlinkUserHome, ".mdf"), { recursive: true });
    fs.symlinkSync(symlinkUserOutside, path.join(symlinkUserHome, ".mdf", "user"));
    expectCode(() => initScript.apply({ root: symlinkUserProject, home: symlinkUserHome, human_language: "Korean" }), "MDF_SYMLINK_PATH");
    assert.deepStrictEqual(fs.readdirSync(symlinkUserOutside), []);
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

function runCleanupTests() {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mdf-cleanup-fixture-"));
  const root = path.join(temporaryRoot, "project");
  const remote = path.join(temporaryRoot, "origin.git");
  const home = path.join(temporaryRoot, "home");
  fs.mkdirSync(root, { recursive: true });
  fs.mkdirSync(path.join(root, ".mdf", "project"), { recursive: true });
  fs.writeFileSync(path.join(root, ".mdf", "project", "init.json"), "{\"version\":1}\n");
  fs.writeFileSync(path.join(root, ".gitignore"), ".mdf/\n.worktrees/\n");
  const git = (args, cwd = root) => {
    const result = spawnSync("git", args, { cwd, encoding: "utf8" });
    assert.strictEqual(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  git(["init", "--quiet", root]);
  git(["config", "user.email", "mdf@example.com"]);
  git(["config", "user.name", "MDF Test"]);
  fs.writeFileSync(path.join(root, "README.md"), "fixture\n");
  git(["add", "."]); git(["commit", "--quiet", "-m", "fixture"]); git(["branch", "-M", "main"]);
  git(["init", "--quiet", "--bare", remote], temporaryRoot);
  git(["remote", "add", "origin", remote]);
  git(["push", "--quiet", "-u", "origin", "main"]);
  git(["branch", "clean-gone"]); git(["branch", "dirty-gone"]);
  git(["push", "--quiet", "-u", "origin", "clean-gone"]);
  git(["push", "--quiet", "-u", "origin", "dirty-gone"]);
  const dirtyPath = path.join(root, ".worktrees", "dirty-gone");
  git(["worktree", "add", "--quiet", dirtyPath, "dirty-gone"]);
  fs.writeFileSync(path.join(dirtyPath, "uncommitted.txt"), "discard me\n");
  git(["push", "--quiet", "origin", "--delete", "clean-gone", "dirty-gone"]);
  fs.mkdirSync(path.join(home, ".mdf", "user"), { recursive: true });
  fs.writeFileSync(path.join(home, ".mdf", "user", "init.json"), "{\"version\":1,\"initialized_at\":\"now\",\"runtime\":\"codex\"}\n");
  fs.writeFileSync(path.join(home, ".mdf", "user", "preferences.json"), "{\"version\":1,\"human_language\":\"Korean\"}\n");
  const inspection = clearGone.inspect({ root, home });
  assert.deepStrictEqual(inspection.clean.map((entry) => entry.branch), ["clean-gone"]);
  assert.deepStrictEqual(inspection.dirty.map((entry) => entry.branch), ["dirty-gone"]);
  assert.strictEqual(inspection.dirty[0].path, fs.realpathSync(dirtyPath));
  const cliInspect = spawnSync(process.execPath, [path.join(__dirname, "mdf-github-clear-gone.js"), "inspect", "--cwd", root], { encoding: "utf8", input: JSON.stringify({ home }) });
  assert.strictEqual(cliInspect.status, 0, cliInspect.stderr);
  assert.strictEqual(JSON.parse(cliInspect.stdout).ok, true);
  const cleanResult = clearGone.applyClean({ root, home });
  assert.deepStrictEqual(cleanResult.removed.map((entry) => entry.branch), ["clean-gone"]);
  const cleanRef = spawnSync("git", ["show-ref", "--verify", "--quiet", "refs/heads/clean-gone"], { cwd: root, encoding: "utf8" });
  assert.notStrictEqual(cleanRef.status, 0);
  try {
    expectCode(() => clearGone.applyDirty({ root, home, confirmations: [] }), "MDF_DIRTY_CONFIRMATION_MISMATCH");
    assert.strictEqual(fs.existsSync(dirtyPath), true);
    const dirtyResult = clearGone.applyDirty({ root, home, confirmed_dirty_worktrees: [fs.realpathSync(dirtyPath)] });
    assert.deepStrictEqual(dirtyResult.removed.map((entry) => entry.branch), ["dirty-gone"]);
    assert.strictEqual(fs.existsSync(dirtyPath), false);
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

function runAfterMergeTests() {
  const fixture = createFixture();
  const calls = [];
  const mergedPayload = JSON.stringify({ state: "MERGED", mergedAt: "2026-07-12T00:00:00Z", headRefName: "feature", baseRefName: "main", url: "https://github.com/example/project/pull/1" });
  const runner = (command, args, options) => {
    calls.push({ command, args, cwd: options.cwd });
    if (command === "gh") return { status: 0, stdout: mergedPayload + "\n", stderr: "" };
    if (args[0] === "symbolic-ref") return { status: 0, stdout: "origin/main\n", stderr: "" };
    if (args[0] === "remote" && args[1] === "get-url") return { status: 0, stdout: "https://github.com/example/project.git\n", stderr: "" };
    if (args[0] === "status") return { status: 0, stdout: "", stderr: "" };
    if (args[0] === "rev-parse" && args[1] === "HEAD") return { status: 0, stdout: "abc123\n", stderr: "" };
    return { status: 0, stdout: "", stderr: "" };
  };
  try {
    expectCode(() => afterMerge.verify({ root: fixture.root, pr: "--repo=attacker/other" }, { runner }), "MDF_PR_REF_INVALID");
    const crossRepositoryRunner = (command, args, options) => {
      if (command === "gh") return { status: 0, stdout: JSON.stringify({ state: "MERGED", mergedAt: "now", headRefName: "feature", baseRefName: "main", url: "https://github.com/attacker/other/pull/1" }), stderr: "" };
      if (args[0] === "remote" && args[1] === "get-url") return { status: 0, stdout: "https://github.com/example/project.git\n", stderr: "" };
      return { status: 0, stdout: "", stderr: "" };
    };
    expectCode(() => afterMerge.verify({ root: fixture.root, pr: "https://github.com/attacker/other/pull/1" }, { runner: crossRepositoryRunner }), "MDF_PR_REPOSITORY_MISMATCH");
    const verified = afterMerge.verify({ root: fixture.root, pr: "1" }, { runner });
    assert.strictEqual(verified.merged, true);
    assert.strictEqual(verified.head_branch, "feature");
    const synced = afterMerge.sync({ root: fixture.root, pr: "1", default_branch: "main" }, { runner });
    assert.strictEqual(synced.default_branch, "main");
    assert.strictEqual(synced.head_branch, "feature");
    assert.strictEqual(synced.head, "abc123");
    assert.strictEqual(synced.cleanup_handoff.operation, "inspect");
    assert.strictEqual(calls.some((call) => call.args[0] === "branch" || call.args[0] === "worktree"), false);
    const unmergedRunner = (command, args) => command === "gh" ? { status: 0, stdout: JSON.stringify({ state: "OPEN", mergedAt: null, headRefName: "feature", baseRefName: "main", url: "url" }), stderr: "" } : (() => { throw new Error("git must not run"); })();
    expectCode(() => afterMerge.verify({ root: fixture.root, pr: "1" }, { runner: unmergedRunner }), "MDF_PR_NOT_MERGED");
    const wrongBaseRunner = (command, args, options) => {
      if (command === "gh") return { status: 0, stdout: JSON.stringify({ state: "MERGED", mergedAt: "now", headRefName: "feature", baseRefName: "develop", url: "https://github.com/example/project/pull/1" }), stderr: "" };
      wrongBaseCalls.push({ command, args, cwd: options.cwd });
      if (args[0] === "symbolic-ref") return { status: 0, stdout: "origin/main\n", stderr: "" };
      if (args[0] === "remote") return { status: 0, stdout: "https://github.com/example/project.git\n", stderr: "" };
      return { status: 0, stdout: "", stderr: "" };
    };
    const wrongBaseCalls = [];
    expectCode(() => afterMerge.sync({ root: fixture.root, pr: "1" }, { runner: wrongBaseRunner }), "MDF_PR_BASE_MISMATCH");
    assert.strictEqual(wrongBaseCalls.some((call) => call.args[0] === "checkout" || call.args[0] === "pull"), false);
    const dirtyRunner = (command, args, options) => {
      if (command === "gh") return { status: 0, stdout: mergedPayload + "\n", stderr: "" };
      if (args[0] === "symbolic-ref") return { status: 0, stdout: "origin/main\n", stderr: "" };
      if (args[0] === "remote") return { status: 0, stdout: "https://github.com/example/project.git\n", stderr: "" };
      if (args[0] === "status") return { status: 0, stdout: " M dirty\n", stderr: "" };
      throw new Error(`unexpected command ${command} ${args.join(" ")}`);
    };
    expectCode(() => afterMerge.sync({ root: fixture.root, pr: "1" }, { runner: dirtyRunner }), "MDF_CANONICAL_DIRTY");
    const fetchFailureRunner = (command, args, options) => {
      if (command === "gh") return { status: 0, stdout: mergedPayload + "\n", stderr: "" };
      if (args[0] === "symbolic-ref") return { status: 0, stdout: "origin/main\n", stderr: "" };
      if (args[0] === "remote") return { status: 0, stdout: "https://github.com/example/project.git\n", stderr: "" };
      if (args[0] === "status" || args[0] === "checkout") return { status: 0, stdout: "", stderr: "" };
      if (args[0] === "fetch") return { status: 1, stdout: "", stderr: "fetch failed" };
      return { status: 0, stdout: "", stderr: "" };
    };
    expectCode(() => afterMerge.sync({ root: fixture.root, pr: "1" }, { runner: fetchFailureRunner }), "MDF_SYNC_FETCH_FAILED");
    const pullFailureRunner = (command, args) => {
      if (command === "gh") return { status: 0, stdout: mergedPayload + "\n", stderr: "" };
      if (args[0] === "symbolic-ref") return { status: 0, stdout: "origin/main\n", stderr: "" };
      if (args[0] === "remote") return { status: 0, stdout: "https://github.com/example/project.git\n", stderr: "" };
      if (args[0] === "status" || args[0] === "checkout" || args[0] === "fetch") return { status: 0, stdout: "", stderr: "" };
      if (args[0] === "pull") return { status: 1, stdout: "", stderr: "not fast forward" };
      return { status: 0, stdout: "abc123\n", stderr: "" };
    };
    expectCode(() => afterMerge.sync({ root: fixture.root, pr: "1" }, { runner: pullFailureRunner }), "MDF_SYNC_FAST_FORWARD_FAILED");
  } finally {
    fs.rmSync(fixture.temporaryRoot, { recursive: true, force: true });
  }
}

function main() {
  runRuntimeTests();
  runArtifactTests();
  runWorktreeTests();
  runInitTests();
  runCleanupTests();
  runAfterMergeTests();
  console.log("mdf workflow script validation: task 1, task 2, task 3, task 4, task 5, and task 6 checks passed");
}

if (require.main === module) main();

module.exports = { runRuntimeTests };
