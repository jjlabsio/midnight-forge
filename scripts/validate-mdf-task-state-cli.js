#!/usr/bin/env node

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const cli = path.join(root, "scripts", "mdf-task-state.js");
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mdf-task-state-cli-"));
const home = path.join(tempRoot, "home");
const project = path.join(tempRoot, "project");
const failures = [];

function write(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function run(args, options = {}) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd: options.cwd || project,
    env: { ...process.env, HOME: home },
    encoding: "utf8",
  });
  const output = result.stdout || result.stderr;
  let json = null;
  try {
    json = JSON.parse(output);
  } catch {
    failures.push(`Command ${args.join(" ")} did not produce JSON:\n${output}`);
  }
  if (options.expectFailure) {
    if (result.status === 0) failures.push(`Command ${args.join(" ")} unexpectedly succeeded`);
  } else if (result.status !== 0) {
    failures.push(`Command ${args.join(" ")} failed:\n${output}`);
  }
  return json;
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function item(id, title, status = "queue", latest = "latest: {}") {
  return `---
work_id: "2026-07-10-${id}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}"
task_id: "${id}"
kind: "task"
title: "${title}"
order: ${Number(id)}
status: "${status}"
created: "2026-07-10"
due: "2026-07-20"
${latest}
---

## Context

Seed context.

## Files

## Criteria

## Log

- 2026-07-10: Created task.
`;
}

try {
  fs.mkdirSync(project, { recursive: true });
  spawnSync("git", ["init"], { cwd: project, stdio: "ignore" });
  write(path.join(home, ".mdf", "user", "init.json"), "{}\n");
  write(path.join(home, ".mdf", "user", "preferences.json"), '{"human_language":"Korean"}\n');
  write(
    path.join(home, ".mdf", "projects.json"),
    JSON.stringify({
      version: 1,
      projects: {
        [project]: {
          id: "fixture",
          name: "project",
          canonical_root: project,
          remote: null,
          index: ".mdf/index.jsonl",
          last_seen: "2026-07-10T00:00:00Z",
        },
        [path.join(tempRoot, "missing-project")]: {
          id: "missing",
          name: "missing-project",
          canonical_root: path.join(tempRoot, "missing-project"),
          remote: null,
          index: ".mdf/index.jsonl",
          last_seen: "2026-07-10T00:00:00Z",
        },
      },
    }) + "\n"
  );
  write(path.join(project, ".mdf", "project.json"), JSON.stringify({ name: "project", canonical_root: project }) + "\n");
  write(path.join(project, ".mdf", "project", "init.json"), "{}\n");
  write(path.join(project, ".mdf", "index.jsonl"), "");
  fs.mkdirSync(path.join(project, ".mdf", "locks"), { recursive: true });
  write(
    path.join(project, ".mdf", "work", "2026-07-10-0001-seed-task", "item.md"),
    item("0001", "Seed Task", "queue", 'latest:\n  spec: "spec-001.md"')
  );

  const validation = run(["validate", "--json"]);
  assert(validation.ok === true, "validate should succeed");

  const resolved = run(["resolve", "--task-id", "1", "--json"]);
  assert(resolved.task.task_id === "0001", "resolve should normalize task IDs");
  assert(resolved.task.latest.spec === "spec-001.md", "resolve should parse nested latest frontmatter");

  const board = run(["board", "--project", "--json"]);
  assert(board.queue.length === 1, "project board should include queued task");

  const userBoard = run(["board", "--user", "--json"]);
  assert(userBoard.projects.length === 1, "user board should render valid registered projects");
  assert(userBoard.warnings.length === 1, "user board should warn and skip missing registered projects");

  const completedSeed = run(["done", "1", "--message", "Completed seed task.", "--json"]);
  assert(completedSeed.task_id === "0001", "done should update the seeded task");
  const indexEntries = fs.readFileSync(path.join(project, ".mdf", "index.jsonl"), "utf8").trim().split(/\n/).map(JSON.parse);
  assert(indexEntries.at(-1).due === "2026-07-20", "task index updates should preserve due metadata");

  const contextFile = path.join(tempRoot, "context.md");
  write(contextFile, "Created by fixture.\n");
  const added = run(["add", "--kind", "task", "--title", "New Task", "--context-file", contextFile, "--json"]);
  assert(added.task_id === "0002", "add should choose the next task ID");

  write(
    path.join(project, ".mdf", "locks", "0002.lock"),
    JSON.stringify({ task_id: "0002", work_id: added.work_id, canonical_root: project }) + "\n"
  );
  const completed = run(["done", "2", "--message", "Completed from test.", "--json"]);
  assert(completed.task_id === "0002", "done should normalize task IDs");
  assert(!fs.existsSync(path.join(project, ".mdf", "locks", "0002.lock")), "done should delete the matching lock");
  assert(
    fs.readFileSync(added.item, "utf8").includes("Completed from test."),
    "done should append the completion message"
  );
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

if (failures.length > 0) {
  console.error("MDF task-state CLI validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("MDF task-state CLI validation passed.");
