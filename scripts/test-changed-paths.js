#!/usr/bin/env node

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const helper = path.join(root, "skills", "auto-workflow", "scripts", "changed-paths.mjs");
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "mdf-changed-paths-"));

function git(args) {
  return execFileSync("git", args, { cwd: fixture, encoding: "utf8" }).trim();
}

function write(relativePath, content) {
  fs.writeFileSync(path.join(fixture, relativePath), content);
}

function report(base) {
  return execFileSync(process.execPath, [helper, fixture, base], {
    cwd: root,
    encoding: "utf8",
  });
}

try {
  git(["init", "-q"]);
  git(["config", "user.email", "test@example.com"]);
  git(["config", "user.name", "Test"]);
  write("modify.txt", "before\n");
  write("delete.txt", "delete\n");
  write("rename.txt", "rename-only-content\n");
  write("recreate.txt", "original\n");
  git(["add", "."]);
  git(["commit", "-qm", "baseline"]);
  const base = git(["rev-parse", "HEAD"]);

  assert.strictEqual(report(base), "Changed paths:\n\n- None\n");

  write("modify.txt", "after\n");
  fs.unlinkSync(path.join(fixture, "delete.txt"));
  fs.renameSync(path.join(fixture, "rename.txt"), path.join(fixture, "renamed.txt"));
  git(["add", "-A", "--", "rename.txt", "renamed.txt"]);
  write("tracked-add.txt", "tracked\n");
  git(["add", "tracked-add.txt"]);
  git(["rm", "-q", "recreate.txt"]);
  write("recreate.txt", "untracked replacement\n");
  write("odd name [x].txt", "untracked\n");

  const output = report(base);
  assert.match(output, /- M "modify\.txt"/);
  assert.match(output, /- D "delete\.txt"/);
  assert.match(output, /- R100 "rename\.txt" -> "renamed\.txt"/);
  assert.match(output, /- A "tracked-add\.txt"/);
  assert.match(output, /- \?\? "odd name \[x\]\.txt"/);
  assert.match(output, /- D "recreate\.txt"/);
  assert.match(output, /- \?\? "recreate\.txt"/);

  const subdirectory = path.join(fixture, "subdirectory");
  fs.mkdirSync(subdirectory);
  const rejected = spawnSync(process.execPath, [helper, subdirectory, base], {
    encoding: "utf8",
  });
  assert.strictEqual(rejected.status, 2);

  console.log("changed-paths helper tests passed");
} finally {
  fs.rmSync(fixture, { recursive: true, force: true });
}
