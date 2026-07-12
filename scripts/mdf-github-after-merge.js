#!/usr/bin/env node

const { runCli } = require("./mdf-runtime/cli");
const { WorkflowError } = require("./mdf-runtime/errors");
const { canonicalRoot } = require("./mdf-runtime/canonical-root");
const { resolveDefaultBranch, runCommand } = require("./mdf-runtime/git");

function rootFor(input, options) {
  return canonicalRoot(input.root || input.cwd || options.cwd || process.cwd());
}

function executionCwd(input, options, root) {
  return input.cwd || options.cwd || (input.root ? root : process.cwd());
}

function invalidPrReference(value) {
  throw new WorkflowError("MDF_PR_REF_INVALID", "The pull request reference must be a positive number or a GitHub pull request URL.", { reference: value });
}

function prReference(input) {
  const value = input.pr ?? input.pr_number ?? input.pr_url;
  if (value === undefined || value === null || (typeof value === "string" && !value.trim())) return null;
  if (typeof value === "number") {
    if (Number.isInteger(value) && value > 0) return { value: String(value), repository: null };
    invalidPrReference(value);
  }
  if (typeof value !== "string") invalidPrReference(value);
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed) && Number(trimmed) > 0) return { value: trimmed, repository: null };
  if (trimmed.startsWith("-")) invalidPrReference(value);
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch (error) {
    invalidPrReference(value);
  }
  if (!parsed || !["http:", "https:"].includes(parsed.protocol) || parsed.hostname.toLowerCase() !== "github.com") invalidPrReference(value);
  const match = parsed.pathname.match(/^\/([^/]+)\/([^/]+)\/pull\/(\d+)\/?$/);
  if (!match || parsed.search || parsed.hash) invalidPrReference(value);
  return { value: trimmed, repository: `github.com/${match[1].toLowerCase()}/${match[2].replace(/\.git$/i, "").toLowerCase()}` };
}

function repositoryKey(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const trimmed = value.trim().replace(/\/+$/, "").replace(/\.git$/i, "");
  let host;
  let repositoryPath;
  if (!trimmed.includes("://")) {
    const scp = trimmed.match(/^(?:[^@/]+@)?([^:]+):(.+)$/);
    if (!scp) return null;
    host = scp[1];
    repositoryPath = scp[2];
  } else {
    let parsed;
    try {
      parsed = new URL(trimmed);
    } catch (error) {
      return null;
    }
    if (!["http:", "https:", "ssh:"].includes(parsed.protocol)) return null;
    host = parsed.hostname;
    repositoryPath = parsed.pathname;
  }
  const parts = repositoryPath.replace(/^\/+/, "").split("/").filter(Boolean);
  if (parts.length === 2) return `${host.toLowerCase()}/${parts[0].toLowerCase()}/${parts[1].replace(/\.git$/i, "").toLowerCase()}`;
  if (parts.length === 4 && parts[2] === "pull" && /^\d+$/.test(parts[3])) return `${host.toLowerCase()}/${parts[0].toLowerCase()}/${parts[1].replace(/\.git$/i, "").toLowerCase()}`;
  return null;
}

function pullRequestStateUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  let parsed;
  try {
    parsed = new URL(value.trim());
  } catch (error) {
    return null;
  }
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.hostname.toLowerCase() !== "github.com" || parsed.search || parsed.hash) return null;
  const match = parsed.pathname.match(/^\/([^/]+)\/([^/]+)\/pull\/(\d+)\/?$/);
  if (!match || Number(match[3]) < 1) return null;
  return `github.com/${match[1].toLowerCase()}/${match[2].replace(/\.git$/i, "").toLowerCase()}`;
}

function verify(input = {}, options = {}) {
  const root = rootFor(input, options);
  const cwd = executionCwd(input, options, root);
  const reference = prReference(input);
  const ref = reference && reference.value;
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
  if (!data || typeof data !== "object" || Array.isArray(data) || typeof data.headRefName !== "string" || !data.headRefName.trim() || typeof data.baseRefName !== "string" || !data.baseRefName.trim()) {
    throw new WorkflowError("MDF_PR_STATE_MALFORMED", "Pull request state is missing head/base refs.", { reference: ref });
  }
  if (data.state !== "MERGED" || !data.mergedAt) {
    throw new WorkflowError("MDF_PR_NOT_MERGED", "The pull request is not confirmed merged; local sync and cleanup are blocked.", { state: data.state || null, merged_at: data.mergedAt || null, url: data.url || null });
  }
  const mergedAt = typeof data.mergedAt === "string" && data.mergedAt.trim() && !Number.isNaN(Date.parse(data.mergedAt));
  if (!mergedAt) throw new WorkflowError("MDF_PR_STATE_MALFORMED", "Pull request state contains an invalid merged timestamp.", { reference: ref, merged_at: data.mergedAt });
  const pullRequestRepository = pullRequestStateUrl(data.url);
  if (!pullRequestRepository) throw new WorkflowError("MDF_PR_STATE_MALFORMED", "Pull request state is missing a valid GitHub pull request URL.", { reference: ref, url: data.url || null });
  const origin = runCommand("git", ["remote", "get-url", "origin"], { cwd: root, runner: options.runner, allowFailure: true });
  if (origin.status !== 0 || !origin.stdout.trim()) throw new WorkflowError("MDF_ORIGIN_MISSING", "The canonical checkout must have an origin remote.", { canonical_root: root });
  const originRepository = repositoryKey(origin.stdout.trim());
  if (!originRepository) throw new WorkflowError("MDF_ORIGIN_INVALID", "The canonical checkout origin is not a recognizable repository URL.", { canonical_root: root, origin: origin.stdout.trim() });
  if (reference && reference.repository && reference.repository !== originRepository) {
    throw new WorkflowError("MDF_PR_REPOSITORY_MISMATCH", "The requested pull request does not belong to the canonical repository.", { expected: originRepository, actual: reference.repository, reference: ref });
  }
  if (pullRequestRepository !== originRepository) {
    throw new WorkflowError("MDF_PR_REPOSITORY_MISMATCH", "The merged pull request does not belong to the canonical repository.", { expected: originRepository, actual: pullRequestRepository, url: data.url });
  }
  if (input.expected_head && input.expected_head !== data.headRefName) throw new WorkflowError("MDF_PR_HEAD_MISMATCH", "The pull request head does not match the expected branch.", { expected: input.expected_head, actual: data.headRefName });
  return { merged: true, url: data.url || null, merged_at: data.mergedAt.trim(), head_branch: data.headRefName, base_branch: data.baseRefName, state: data.state };
}

function sync(input = {}, options = {}) {
  const verification = verify(input, options);
  const root = rootFor(input, options);
  const runner = options.runner;
  const origin = runCommand("git", ["remote", "get-url", "origin"], { cwd: root, runner, allowFailure: true });
  if (origin.status !== 0 || !origin.stdout.trim()) throw new WorkflowError("MDF_ORIGIN_MISSING", "The canonical checkout must have an origin remote.", { canonical_root: root });
  const defaultBranch = resolveDefaultBranch({ cwd: root, runner });
  if (input.default_branch && input.default_branch !== defaultBranch) throw new WorkflowError("MDF_DEFAULT_BRANCH_MISMATCH", "The requested default branch does not match the resolved remote default branch.", { expected: defaultBranch, actual: input.default_branch });
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
