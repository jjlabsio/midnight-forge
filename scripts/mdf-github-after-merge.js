#!/usr/bin/env node

const { runCli } = require("./mdf-runtime/cli");
const { WorkflowError } = require("./mdf-runtime/errors");
const { canonicalRoot } = require("./mdf-runtime/canonical-root");
const { resolveDefaultBranch, runCommand } = require("./mdf-runtime/git");

function rootFor(input, options) {
  return canonicalRoot(input.root || input.cwd || options.cwd || process.cwd());
}

function prRef(input) {
  return input.pr || input.pr_number || input.pr_url || null;
}

function verify(input = {}, options = {}) {
  const cwd = input.cwd || options.cwd || process.cwd();
  const ref = prRef(input);
  const args = ["pr", "view"];
  if (ref) args.push(String(ref));
  args.push("--json", "state,mergedAt,headRefName,baseRefName,url");
  let result;
  try {
    result = runCommand("gh", args, { cwd, runner: options.runner });
  } catch (error) {
    throw new WorkflowError("MDF_PR_LOOKUP_FAILED", "Could not retrieve pull request state.", { reference: ref, cause: error.message });
  }
  let data;
  try {
    data = JSON.parse(result.stdout);
  } catch (error) {
    throw new WorkflowError("MDF_PR_STATE_MALFORMED", "GitHub returned malformed pull request state.", { cause: error.message });
  }
  if (!data || typeof data !== "object" || Array.isArray(data) || typeof data.headRefName !== "string" || typeof data.baseRefName !== "string") {
    throw new WorkflowError("MDF_PR_STATE_MALFORMED", "Pull request state is missing head/base refs.", { reference: ref });
  }
  if (data.state !== "MERGED" || !data.mergedAt) {
    throw new WorkflowError("MDF_PR_NOT_MERGED", "The pull request is not confirmed merged; local sync and cleanup are blocked.", { state: data.state || null, merged_at: data.mergedAt || null, url: data.url || null });
  }
  if (input.expected_head && input.expected_head !== data.headRefName) throw new WorkflowError("MDF_PR_HEAD_MISMATCH", "The pull request head does not match the expected branch.", { expected: input.expected_head, actual: data.headRefName });
  return { merged: true, url: data.url || null, merged_at: data.mergedAt, head_branch: data.headRefName, base_branch: data.baseRefName, state: data.state };
}

function sync(input = {}, options = {}) {
  const verification = verify(input, options);
  const root = rootFor(input, options);
  const runner = options.runner;
  const origin = runCommand("git", ["remote", "get-url", "origin"], { cwd: root, runner, allowFailure: true });
  if (origin.status !== 0 || !origin.stdout.trim()) throw new WorkflowError("MDF_ORIGIN_MISSING", "The canonical checkout must have an origin remote.", { canonical_root: root });
  const defaultBranch = resolveDefaultBranch({ cwd: root, runner });
  if (verification.base_branch !== defaultBranch) throw new WorkflowError("MDF_PR_BASE_MISMATCH", "The merged pull request base does not match the remote default branch.", { expected: defaultBranch, actual: verification.base_branch });
  const status = runCommand("git", ["status", "--short"], { cwd: root, runner }).stdout;
  if (status.trim()) throw new WorkflowError("MDF_CANONICAL_DIRTY", "The canonical checkout has uncommitted changes; sync stopped before checkout.", { canonical_root: root, status });
  try {
    runCommand("git", ["checkout", defaultBranch], { cwd: root, runner });
  } catch (error) {
    throw new WorkflowError("MDF_SYNC_CHECKOUT_FAILED", "Could not checkout the remote default branch.", { branch: defaultBranch, cause: error.message });
  }
  try {
    runCommand("git", ["fetch", "--prune", "origin"], { cwd: root, runner });
  } catch (error) {
    throw new WorkflowError("MDF_SYNC_FETCH_FAILED", "Could not fetch the remote after merge.", { cause: error.message });
  }
  try {
    runCommand("git", ["pull", "--ff-only", "origin", defaultBranch], { cwd: root, runner });
  } catch (error) {
    throw new WorkflowError("MDF_SYNC_FAST_FORWARD_FAILED", "The canonical checkout could not be fast-forwarded.", { branch: defaultBranch, cause: error.message });
  }
  let head;
  try {
    head = runCommand("git", ["rev-parse", "HEAD"], { cwd: root, runner }).stdout.trim();
  } catch (error) {
    throw new WorkflowError("MDF_SYNC_HEAD_FAILED", "Could not read the synchronized canonical HEAD.", { cause: error.message });
  }
  return {
    canonical_root: root,
    merged_pr: verification.url,
    merged_at: verification.merged_at,
    head_branch: verification.head_branch,
    base_branch: verification.base_branch,
    default_branch: defaultBranch,
    head,
    cleanup_handoff: { script: "scripts/mdf-github-clear-gone.js", operation: "inspect", branch: verification.head_branch, canonical_root: root },
  };
}

function main() {
  const exitCode = runCli({ operations: { verify, sync } });
  if (exitCode) process.exitCode = exitCode;
}

if (require.main === module) main();

module.exports = { sync, verify };
