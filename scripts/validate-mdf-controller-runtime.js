#!/usr/bin/env node

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { resolveControllerContext, resolvePluginPath } = require("./controller-runtime/context");
const { recordArtifact, recordCommand, recordInteraction, recordDecision, recordGitFacts, verifySidecar } = require("./controller-runtime/evidence");

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

function runEvidenceTests() {
  const fixture = createFixture();
  try {
    const git = (args) => {
      const result = spawnSync("git", args, { cwd: fixture.worktree, encoding: "utf8" });
      assert.strictEqual(result.status, 0, result.stderr);
    };
    git(["init", "--quiet"]);
    git(["config", "user.email", "test@example.com"]);
    git(["config", "user.name", "MDF test"]);
    fs.writeFileSync(path.join(fixture.worktree, "tracked.txt"), "tree one\n");
    git(["add", "tracked.txt"]);
    git(["commit", "--quiet", "-m", "initial"]);

    const context = resolveControllerContext({ cwd: fixture.worktree, pluginRoot: root });
    const artifact = path.join(context.work_item.path, "upstream-result.md");
    const output = path.join(context.work_item.path, "command-output.log");
    fs.writeFileSync(artifact, "raw upstream result\n");
    fs.writeFileSync(output, "command output\n");
    const rawBefore = fs.readFileSync(artifact);
    const artifactSidecar = recordArtifact(context, "upstream-result.md");
    assert.deepStrictEqual(fs.readFileSync(artifact), rawBefore);
    assert.strictEqual(verifySidecar(context, artifactSidecar.file).kind, "artifact");
    const commandSidecar = recordCommand(context, { command: ["tool", "--check"], output_path: "command-output.log", exit_code: 0 });
    assert.strictEqual(verifySidecar(context, commandSidecar.file).kind, "command");
    const gitSidecar = recordGitFacts(context);
    assert.strictEqual(verifySidecar(context, gitSidecar.file).kind, "git");
    const interactionSidecar = recordInteraction(context, {
      invocation: { agent_id: "reviewer", invocation_id: "inv-1" },
      input_paths: ["upstream-result.md"],
    });
    const decisionSidecar = recordDecision(context, {
      interaction_file: interactionSidecar.file,
      conclusion: { disposition: "pass" },
    });
    assert.strictEqual(verifySidecar(context, decisionSidecar.file).kind, "decision");
    expectCode(
      () => recordDecision(context, { interaction_file: interactionSidecar.file, conclusion: true }),
      "MDF_DECISION_INVALID"
    );

    fs.writeFileSync(artifact, "changed\n");
    expectCode(() => verifySidecar(context, artifactSidecar.file), "MDF_EVIDENCE_STALE");
    expectCode(() => verifySidecar(context, decisionSidecar.file), "MDF_EVIDENCE_STALE");
    const sidecarPath = path.join(context.work_item.path, "evidence", artifactSidecar.file);
    const altered = JSON.parse(fs.readFileSync(sidecarPath, "utf8"));
    altered.artifact.sha256 = "0".repeat(64);
    fs.writeFileSync(sidecarPath, JSON.stringify(altered));
    expectCode(() => verifySidecar(context, artifactSidecar.file), "MDF_EVIDENCE_FABRICATED");
    fs.symlinkSync(artifact, path.join(context.work_item.path, "escaped.md"));
    expectCode(() => recordArtifact(context, "escaped.md"), "MDF_EVIDENCE_SYMLINK");
  } finally {
    fs.rmSync(fixture.temporaryRoot, { recursive: true, force: true });
  }

  const symlinkFixture = createFixture();
  try {
    const context = resolveControllerContext({ cwd: symlinkFixture.worktree, pluginRoot: root });
    fs.writeFileSync(path.join(context.work_item.path, "raw.md"), "raw\n");
    const outside = path.join(symlinkFixture.temporaryRoot, "outside");
    fs.mkdirSync(outside);
    fs.symlinkSync(outside, path.join(context.work_item.path, "evidence"));
    expectCode(() => recordArtifact(context, "raw.md"), "MDF_EVIDENCE_SYMLINK");
    assert.deepStrictEqual(fs.readdirSync(outside), []);
  } finally {
    fs.rmSync(symlinkFixture.temporaryRoot, { recursive: true, force: true });
  }
}

const args = new Set(process.argv.slice(2));
const group = process.argv[3];
if (process.argv.length !== 4 || process.argv[2] !== "--group" || !["context", "evidence"].includes(group)) {
  console.error("Usage: node scripts/validate-mdf-controller-runtime.js --group context|evidence");
  process.exit(1);
}

if (group === "context") runContextTests();
else runEvidenceTests();
console.log(`MDF controller runtime validation passed for ${group}.`);
