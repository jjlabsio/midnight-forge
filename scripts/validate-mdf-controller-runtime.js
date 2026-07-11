#!/usr/bin/env node

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { resolveControllerContext, resolvePluginPath } = require("./controller-runtime/context");

const root = path.resolve(__dirname, "..");
const cliPath = path.join(root, "scripts", "mdf-controller.js");

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function createFixture() {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mdf-controller-context-"));
  const canonicalRoot = path.join(temporaryRoot, "project");
  const worktree = path.join(canonicalRoot, ".worktrees", "task-0032");
  const workId = "2026-07-11-0032-context";
  const workItem = path.join(canonicalRoot, ".mdf", "work", workId);
  fs.mkdirSync(worktree, { recursive: true });
  writeJson(path.join(canonicalRoot, ".mdf", "project", "init.json"), { version: 1 });
  writeJson(path.join(canonicalRoot, ".mdf", "project.json"), { version: 1 });
  fs.mkdirSync(path.join(canonicalRoot, ".mdf", "locks"), { recursive: true });
  fs.mkdirSync(workItem, { recursive: true });
  fs.writeFileSync(path.join(canonicalRoot, ".mdf", "index.jsonl"), "");
  fs.writeFileSync(path.join(workItem, "item.md"), "---\nwork_id: \"2026-07-11-0032-context\"\n---\n");
  writeJson(path.join(canonicalRoot, ".mdf", "locks", "0032.lock"), {
    task_id: "0032",
    work_id: workId,
    canonical_root: canonicalRoot,
    worktree,
    branch: "codex/task-0032",
  });
  return { temporaryRoot, canonicalRoot, worktree, workId };
}

function expectCode(callback, code) {
  assert.throws(callback, (error) => error && error.code === code);
}

function runContextTests() {
  const fixture = createFixture();
  try {
    const nestedCwd = path.join(fixture.worktree, "packages", "controller");
    fs.mkdirSync(nestedCwd, { recursive: true });
    const context = resolveControllerContext({ cwd: fixture.worktree, pluginRoot: root });
    assert.strictEqual(context.canonical_root, fs.realpathSync(fixture.canonicalRoot));
    assert.strictEqual(context.worktree, fs.realpathSync(fixture.worktree));
    assert.strictEqual(context.lock.work_id, fixture.workId);
    assert.strictEqual(context.work_item.path, fs.realpathSync(path.join(fixture.canonicalRoot, ".mdf", "work", fixture.workId)));
    assert.strictEqual(context.plugin_root, fs.realpathSync(root));
    assert.strictEqual(resolvePluginPath(context.plugin_root, "agents/code-reviewer.md"), path.join(context.plugin_root, "agents", "code-reviewer.md"));
    expectCode(() => resolvePluginPath(context.plugin_root, "../outside.md"), "MDF_PLUGIN_PATH_ESCAPE");
    assert.strictEqual(resolveControllerContext({ cwd: nestedCwd, pluginRoot: root }).worktree, fs.realpathSync(fixture.worktree));

    const cli = spawnSync(process.execPath, [cliPath, "context", "--cwd", nestedCwd, "--plugin-root", root], {
      encoding: "utf8",
    });
    assert.strictEqual(cli.status, 0, cli.stderr);
    const response = JSON.parse(cli.stdout);
    assert.strictEqual(response.ok, true);
    assert.strictEqual(response.context.lock.work_id, fixture.workId);

    writeJson(path.join(fixture.canonicalRoot, ".mdf", "locks", "duplicate.lock"), {
      task_id: "9999",
      work_id: fixture.workId,
      canonical_root: fixture.canonicalRoot,
      worktree: fixture.worktree,
      branch: "codex/duplicate",
    });
    expectCode(
      () => resolveControllerContext({ cwd: fixture.worktree, pluginRoot: root }),
      "MDF_ACTIVE_LOCK_AMBIGUOUS"
    );
    const failedCli = spawnSync(process.execPath, [cliPath, "context", "--cwd", fixture.worktree, "--plugin-root", root], {
      encoding: "utf8",
    });
    assert.strictEqual(failedCli.status, 1);
    assert.strictEqual(JSON.parse(failedCli.stderr).error.code, "MDF_ACTIVE_LOCK_AMBIGUOUS");
  } finally {
    fs.rmSync(fixture.temporaryRoot, { recursive: true, force: true });
  }

  const escapedFixture = createFixture();
  try {
    writeJson(path.join(escapedFixture.canonicalRoot, ".mdf", "locks", "0032.lock"), {
      task_id: "0032",
      work_id: escapedFixture.workId,
      canonical_root: escapedFixture.canonicalRoot,
      worktree: escapedFixture.canonicalRoot,
      branch: "main",
    });
    expectCode(
      () => resolveControllerContext({ cwd: escapedFixture.canonicalRoot, pluginRoot: root }),
      "MDF_LOCK_WORKTREE_ESCAPE"
    );
  } finally {
    fs.rmSync(escapedFixture.temporaryRoot, { recursive: true, force: true });
  }
}

const args = new Set(process.argv.slice(2));
if (!args.has("--group") || !args.has("context") || args.size !== 2) {
  console.error("Usage: node scripts/validate-mdf-controller-runtime.js --group context");
  process.exit(1);
}

runContextTests();
console.log("MDF controller runtime validation passed for context.");
