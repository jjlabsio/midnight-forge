#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";

const [repository, base] = process.argv.slice(2);
if (!repository || !base) {
  console.error("Usage: changed-paths.mjs <worktree> <base-commit>");
  process.exit(2);
}

function git(args, options = {}) {
  return execFileSync("git", args, {
    cwd: options.cwd,
    encoding: options.encoding,
    stdio: ["ignore", "pipe", "inherit"],
  });
}

const requestedRoot = realpathSync(repository);
const repositoryRoot = realpathSync(git(
  ["rev-parse", "--show-toplevel"],
  { cwd: requestedRoot, encoding: "utf8" }
).trim());
if (requestedRoot !== repositoryRoot) {
  console.error("Worktree must name the exact Git root.");
  process.exit(2);
}
const objectFormat = git(["rev-parse", "--show-object-format"], {
  cwd: repositoryRoot,
  encoding: "utf8",
}).trim();
const oidLength = objectFormat === "sha256" ? 64 : 40;
if (!new RegExp(`^[0-9a-f]{${oidLength}}$`, "i").test(base)) {
  console.error(`Base commit must be a full ${objectFormat} object ID.`);
  process.exit(2);
}
git(["rev-parse", "--verify", `${base}^{commit}`], { cwd: repositoryRoot, encoding: "utf8" });

const fields = git(
  ["diff", "--name-status", "-z", "--find-renames", base, "--"],
  { cwd: repositoryRoot }
).toString("utf8").split("\0");

const entries = [];
for (let index = 0; index < fields.length && fields[index];) {
  const status = fields[index++];
  const firstPath = fields[index++];
  const secondPath = /^[RC]/.test(status) ? fields[index++] : null;
  entries.push({ status, firstPath, secondPath });
}

const untracked = git(["ls-files", "--others", "--exclude-standard", "-z"], {
  cwd: repositoryRoot,
}).toString("utf8").split("\0").filter(Boolean);

for (const filePath of untracked) {
  entries.push({ status: "??", firstPath: filePath, secondPath: null });
}

entries.sort((left, right) => {
  const leftKey = left.secondPath || left.firstPath;
  const rightKey = right.secondPath || right.firstPath;
  if (leftKey === rightKey) return 0;
  return leftKey < rightKey ? -1 : 1;
});

console.log("Changed paths:\n");
if (entries.length === 0) {
  console.log("- None");
} else {
  for (const { status, firstPath, secondPath } of entries) {
    const pathText = secondPath
      ? `${JSON.stringify(firstPath)} -> ${JSON.stringify(secondPath)}`
      : JSON.stringify(firstPath);
    console.log(`- ${status} ${pathText}`);
  }
}
