#!/usr/bin/env node

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const helper = path.join(root, "skills", "task", "scripts", "task-brief.mjs");

function write(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function card({ taskId, workId, title, status, worktree, branch, dependsOn = [] }) {
  return [
    "---",
    `work_id: ${JSON.stringify(workId)}`,
    `task_id: ${JSON.stringify(taskId)}`,
    'kind: "task"',
    `title: ${JSON.stringify(title)}`,
    "order: 1",
    `status: ${JSON.stringify(status)}`,
    'created: "2026-07-23"',
    `depends_on: ${JSON.stringify(dependsOn)}`,
    `worktree: ${JSON.stringify(worktree)}`,
    `branch: ${JSON.stringify(branch)}`,
    "latest:",
    '  quick_handoff: "quick-handoff-001.md"',
    "---",
    "## Context",
    "",
    "A deterministic briefing fixture.",
    "",
    "## Files",
    "",
    "- `overlays/mdf/replacements/skills/task/SKILL.md`",
    "",
    "## Criteria",
    "",
    "- [ ] Reports task facts without writing state.",
    "",
    "## Log",
    "",
    "- 2026-07-23: fixture",
    "",
  ].join("\n");
}

function fixture({ duplicate = false, malformed = false, unsafeWorktree = false, missingLock = false } = {}) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "mdf-task-brief-"));
  const project = path.join(base, "project");
  const home = path.join(base, "home");
  const worktree = path.join(project, ".worktrees", "task-0077-fixture");
  const workId = "2026-07-23-0077-fixture";
  const taskDir = path.join(project, ".mdf", "work", workId);
  const dependencyDir = path.join(project, ".mdf", "work", "2026-07-23-0076-fixture");

  write(path.join(home, ".mdf", "user", "init.json"), '{"version":1}\n');
  write(path.join(home, ".mdf", "user", "preferences.json"), '{"human_language":"en"}\n');
  write(
    path.join(project, ".mdf", "project", "init.json"),
    `${JSON.stringify({ version: 1, canonical_root: project })}\n`
  );
  fs.mkdirSync(path.join(project, ".mdf", "locks"), { recursive: true });
  fs.mkdirSync(worktree, { recursive: true });
  const realProject = fs.realpathSync(project);
  const realWorktree = fs.realpathSync(worktree);
  write(path.join(project, ".mdf", "index.jsonl"), "\n");
  write(
    path.join(dependencyDir, "item.md"),
    card({
      taskId: "0076",
      workId: "2026-07-23-0076-fixture",
      title: "Dependency",
      status: "done",
      worktree: path.join(project, ".worktrees", "task-0076-fixture"),
      branch: "task-0076-fixture",
    })
  );
  write(
    path.join(taskDir, "item.md"),
    malformed
      ? "---\ntask_id: \"0077\"\ndepends_on: not-an-array\n"
      : card({
          taskId: "0077",
          workId,
          title: "Fixture task",
          status: "active",
          worktree: unsafeWorktree ? "/tmp/outside" : realWorktree,
          branch: "task-0077-fixture",
          dependsOn: ["0076"],
        })
  );
  if (duplicate) {
    write(
      path.join(project, ".mdf", "work", "2026-07-23-0077-duplicate", "item.md"),
      card({
        taskId: "0077",
        workId: "2026-07-23-0077-duplicate",
        title: "Duplicate task",
        status: "queue",
        worktree: path.join(project, ".worktrees", "task-0077-duplicate"),
        branch: "task-0077-duplicate",
      })
    );
  }
  if (!malformed && !unsafeWorktree && !missingLock) {
    write(
      path.join(project, ".mdf", "locks", "0077.lock"),
      `${JSON.stringify({
        task_id: "0077",
        work_id: workId,
        canonical_root: project,
        worktree: realWorktree,
        branch: "task-0077-fixture",
        started: "2026-07-23T00:00:00Z",
        runtime: "test",
      })}\n`
    );
  }
  return { base, project: realProject, home, worktree: realWorktree, workId };
}

function run(fixtureRoot, taskId = "77") {
  return spawnSync(process.execPath, [helper, taskId], {
    cwd: fixtureRoot.worktree,
    env: { ...process.env, HOME: fixtureRoot.home },
    encoding: "utf8",
  });
}

function snapshot(directory) {
  const files = [];
  function visit(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const filePath = path.join(current, entry.name);
      if (entry.isDirectory()) visit(filePath);
      else files.push([path.relative(directory, filePath), fs.readFileSync(filePath)]);
    }
  }
  visit(directory);
  return files;
}

function errorResult(result, code) {
  assert.strictEqual(result.status, 2, result.stderr);
  assert.strictEqual(JSON.parse(result.stderr).error.code, code);
}

const fixtures = [];
try {
  const valid = fixture();
  fixtures.push(valid);
  const before = snapshot(valid.project);
  const result = run(valid);
  assert.strictEqual(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.strictEqual(report.ok, true);
  assert.strictEqual(report.task.task_id, "0077");
  assert.strictEqual(report.task.work_id, valid.workId);
  assert.strictEqual(report.task.title, "Fixture task");
  assert.strictEqual(report.task.status, "active");
  assert.strictEqual(report.task.worktree, valid.worktree);
  assert.strictEqual(report.task.branch, "task-0077-fixture");
  assert.deepStrictEqual(report.dependencies, [{ task_id: "0076", status: "done", lock_present: false }]);
  assert.deepStrictEqual(report.lock, {
    present: true,
    task_id: "0077",
    work_id: valid.workId,
    worktree: valid.worktree,
    branch: "task-0077-fixture",
  });
  assert.deepStrictEqual(snapshot(valid.project), before);

  const missing = fixture();
  fixtures.push(missing);
  errorResult(run(missing, "9999"), "TASK_NOT_FOUND");

  const duplicate = fixture({ duplicate: true });
  fixtures.push(duplicate);
  errorResult(run(duplicate), "DUPLICATE_TASK_ID");

  const malformed = fixture({ malformed: true });
  fixtures.push(malformed);
  errorResult(run(malformed), "MALFORMED_CARD");

  const unsafe = fixture({ unsafeWorktree: true });
  fixtures.push(unsafe);
  errorResult(run(unsafe), "UNSAFE_WORKTREE");

  const missingLock = fixture({ missingLock: true });
  fixtures.push(missingLock);
  errorResult(run(missingLock), "LOCK_MISMATCH");

  console.log("task-brief helper tests passed");
} finally {
  for (const fixtureRoot of fixtures) fs.rmSync(fixtureRoot.base, { recursive: true, force: true });
}
