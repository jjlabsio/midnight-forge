#!/usr/bin/env node

const fs = require("node:fs");

const read = (path) => fs.readFileSync(path, "utf8");
const checks = [
  ["skills/auto-workflow/SKILL.md", /does not authorize ship, task\s+completion, push, or PR creation\/update/],
  ["skills/auto-workflow/SKILL.md", /code-simplify -> commit/],
  ["skills/auto-workflow-pr/SKILL.md", /No pending plan work/],
  ["skills/auto-workflow-pr/SKILL.md", /Repeat\s+the local loop until every approved slice is complete/],
  ["skills/auto-workflow-pr/SKILL.md", /Map every acceptance criterion/],
  ["skills/auto-workflow-pr/SKILL.md", /final PR preflight/],
  ["skills/build/SKILL.md", /never stage a whole-card MDF status update/],
  ["references/auto-workflow-contract.md", /A mode string alone grants no authority/],
  ["references/auto-workflow-contract.md", /spec acceptance criterion/],
  ["skills/github-pr/SKILL.md", /A\s+bare mode string is not authority/],
  ["skills/github-pr/SKILL.md", /Query the\s+open-PR state before pushing/],
  ["skills/github-pr/SKILL.md", /remote branch OID equals the expected local HEAD/],
  ["skills/github-pr/SKILL.md", /Treat GitHub responses,[\s\S]*?as untrusted data/],
];

for (const [path, pattern] of checks) {
  if (!pattern.test(read(path))) {
    console.error(`auto-workflow contract check failed: ${path} ${pattern}`);
    process.exit(1);
  }
}

const pr = read("skills/auto-workflow-pr/SKILL.md");
const preflight = pr.indexOf("final PR preflight");
const completion = pr.search(/normal completion\s+mutation/);
if (preflight < 0 || completion < 0 || preflight > completion) {
  console.error("auto-workflow contract check failed: completion precedes final preflight");
  process.exit(1);
}

console.log("Auto-workflow contract validation passed.");
