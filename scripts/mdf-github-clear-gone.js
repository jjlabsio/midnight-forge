#!/usr/bin/env node

const fs = require("fs");
const os = require("os");
const path = require("path");
const { runCli } = require("./mdf-runtime/cli");
const { WorkflowError } = require("./mdf-runtime/errors");
const { canonicalRoot, projectPaths } = require("./mdf-runtime/canonical-root");
const { runCommand } = require("./mdf-runtime/git");

function rootFor(input, options) {
  return canonicalRoot(input.root || input.cwd || options.cwd || process.cwd());
}

function homeFor(input, options) {
  return path.resolve(input.home || options.home || os.homedir());
}

function requireInit(root, home) {
  const paths = projectPaths(root);
  const userInit = path.join(home, ".mdf", "user", "init.json");
  const preferences = path.join(home, ".mdf", "user", "preferences.json");
  if (!fs.existsSync(paths.projectInit) || !fs.existsSync(userInit) || !fs.existsSync(preferences)) {
    throw new WorkflowError("MDF_INIT_REQUIRED", "Run mdf init before using gone-branch cleanup.", { canonical_root: root, command: "mdf init" });
  }
  try {
    const prefs = JSON.parse(fs.readFileSync(preferences, "utf8"));
    if (!prefs || prefs.version !== 1 || typeof prefs.human_language !== "string" || !prefs.human_language.trim()) throw new Error("invalid preferences schema");
  } catch (error) {
    throw new WorkflowError("MDF_INIT_MALFORMED", "MDF user preferences are malformed.", { path: preferences, cause: error.message });
  }
}

function parseBranches(output) {
  return output.split(/\r?\n/).map((line) => line.trimEnd()).filter(Boolean).map((line) => {
    const current = line.startsWith("*");
    const worktree = line.startsWith("+");
    const normalized = line.replace(/^[*+ ]+\s*/, "");
    const branch = normalized.split(/\s+/)[0];
    const track = normalized.match(/\[([^\]]+)\]/)?.[1] || "";
    return { branch, current, worktree, gone: /(?:^|:)\s*gone$/.test(track) || track === "gone" };
  }).filter((branch) => branch.branch && branch.branch !== "(HEAD");
}

function parseWorktrees(output) {
  return output.trim() ? output.trim().split(/\n\s*\n/).map((block) => {
    const record = { path: null, branch: null, broken: false, prunable: false };
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith("worktree ")) record.path = line.slice("worktree ".length);
      if (line.startsWith("branch ")) record.branch = line.slice("branch ".length).replace(/^refs\/heads\//, "");
      if (line.includes("broken")) record.broken = true;
      if (line.includes("prunable")) record.prunable = true;
    }
    return record;
  }) : [];
}

function inspect(input = {}, options = {}) {
  const root = rootFor(input, options);
  const home = homeFor(input, options);
  requireInit(root, home);
  const runner = options.runner;
  try {
    runCommand("git", ["fetch", "--prune"], { cwd: root, runner });
  } catch (error) {
    throw new WorkflowError("MDF_GONE_FETCH_FAILED", "Could not refresh gone-branch state.", { cause: error.message });
  }
  const branchOutput = runCommand("git", ["branch", "-vv"], { cwd: root, runner }).stdout;
  const worktreeOutput = runCommand("git", ["worktree", "list", "--porcelain"], { cwd: root, runner }).stdout;
  const current = runCommand("git", ["branch", "--show-current"], { cwd: root, runner, allowFailure: true }).stdout.trim();
  const worktrees = parseWorktrees(worktreeOutput);
  const canonical = fs.realpathSync(root);
  const clean = [];
  const dirty = [];
  const protectedEntries = [];
  const skipped = [];
  const gone = parseBranches(branchOutput).filter((entry) => entry.gone);
  for (const branch of gone) {
    const associated = worktrees.find((entry) => entry.branch === branch.branch);
    const record = { branch: branch.branch, current: branch.current || branch.branch === current, path: associated?.path || null, status: "clean" };
    if (record.current || (associated?.path && path.resolve(associated.path) === path.resolve(canonical))) {
      record.reason = "protected-current-or-canonical";
      protectedEntries.push(record);
      continue;
    }
    if (associated?.broken || associated?.prunable || (associated?.path && !fs.existsSync(associated.path))) {
      record.status = "unknown";
      record.reason = associated?.broken ? "broken-worktree" : associated?.prunable ? "prunable-worktree" : "missing-worktree";
      skipped.push(record);
      continue;
    }
    if (associated?.path) {
      let status;
      try {
        status = runCommand("git", ["status", "--short"], { cwd: associated.path, runner }).stdout;
      } catch (error) {
        throw new WorkflowError("MDF_WORKTREE_STATUS_FAILED", "Could not classify worktree cleanliness.", { branch: branch.branch, path: associated.path, cause: error.message });
      }
      record.status_output = status;
      if (status.trim()) {
        record.status = "dirty";
        dirty.push(record);
      } else clean.push(record);
    } else clean.push(record);
  }
  return { canonical_root: root, current_branch: current || null, gone, clean, dirty, protected: protectedEntries, skipped, refreshed: true };
}

function removeCandidate(root, candidate, runner) {
  try {
    if (candidate.path) runCommand("git", ["worktree", "remove", "--force", candidate.path], { cwd: root, runner });
    runCommand("git", ["branch", "-D", candidate.branch], { cwd: root, runner });
  } catch (error) {
    throw new WorkflowError("MDF_CLEANUP_FAILED", "Gone-branch cleanup stopped after a deletion failure.", { branch: candidate.branch, path: candidate.path, cause: error.message });
  }
  return { branch: candidate.branch, path: candidate.path, status: candidate.status };
}

function applyClean(input = {}, options = {}) {
  const root = rootFor(input, options);
  const inspection = inspect(input, options);
  const removed = inspection.clean.map((candidate) => removeCandidate(root, candidate, options.runner));
  return { canonical_root: root, removed, remaining_dirty: inspection.dirty, waiting_confirmation: inspection.dirty.concat(inspection.skipped) };
}

function applyDirty(input = {}, options = {}) {
  const root = rootFor(input, options);
  const inspection = inspect(input, options);
  const confirmations = Array.isArray(input.confirmations) ? input.confirmations : [];
  const expected = inspection.dirty.map((candidate) => path.resolve(candidate.path)).sort();
  const supplied = confirmations.map((confirmation) => {
    if (!confirmation || typeof confirmation.path !== "string" || confirmation.acknowledge_uncommitted !== true) return null;
    return path.resolve(confirmation.path);
  });
  if (supplied.includes(null) || supplied.length !== expected.length || supplied.slice().sort().some((value, index) => value !== expected[index])) {
    throw new WorkflowError("MDF_DIRTY_CONFIRMATION_MISMATCH", "Dirty cleanup requires an exact confirmation for every dirty worktree and acknowledgement of discarded changes.", { expected, supplied });
  }
  const removed = inspection.dirty.map((candidate) => removeCandidate(root, candidate, options.runner));
  return { canonical_root: root, removed, remaining_dirty: [], waiting_confirmation: inspection.skipped };
}

function main() {
  const exitCode = runCli({ operations: { inspect, "apply-clean": applyClean, "apply-dirty": applyDirty } });
  if (exitCode) process.exitCode = exitCode;
}

if (require.main === module) main();

module.exports = { applyClean, applyDirty, inspect };
