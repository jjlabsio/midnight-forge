#!/usr/bin/env node

const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const tests = [
  "test-changed-paths.js",
  "test-subagent-observation.js",
  "test-task-brief.js",
];

for (const test of tests) {
  const result = spawnSync(process.execPath, [path.join(__dirname, test)], {
    cwd: root,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    process.stderr.write(result.stdout);
    process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }
  process.stdout.write(result.stdout);
}

console.log("Workflow helper validation passed.");
