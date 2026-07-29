#!/usr/bin/env node

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const [repository, numberArgument, ...extra] = process.argv.slice(2);

function fail(code, message) {
  process.stderr.write(`${JSON.stringify({ ok: false, error: { code, message } })}\n`);
  process.exitCode = 2;
}

function validRepository(value) {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9_.-]+$/.test(value);
}

function positivePrNumber(value) {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : null;
}

async function ghJson(args, label) {
  try {
    const { stdout } = await execFileAsync("gh", args, { encoding: "utf8", maxBuffer: 1024 * 1024 });
    return JSON.parse(stdout);
  } catch (error) {
    if (error instanceof SyntaxError) throw { code: "MALFORMED_PROVIDER_JSON", message: `${label} returned malformed JSON` };
    throw { code: "COMMAND_FAILED", message: `${label} failed` };
  }
}

function nonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}

function oid(value) {
  return typeof value === "string" && /^[0-9a-f]{7,64}$/i.test(value);
}

function facts(pr, checks, repo, repository, number) {
  if (!pr || typeof pr !== "object" || Array.isArray(pr) || !nonEmptyString(pr.url) || !nonEmptyString(pr.mergedAt)) {
    throw { code: "UNMERGED_PR", message: "PR is not merged" };
  }
  if (!oid(pr.headRefOid) || !nonEmptyString(pr.baseRefName) || !oid(pr.mergeCommit?.oid)
    || !repo || typeof repo !== "object" || Array.isArray(repo) || !nonEmptyString(repo.defaultBranchRef?.name)) {
    throw { code: "MALFORMED_PROVIDER_JSON", message: "GitHub response is missing required merge facts" };
  }
  if (!Array.isArray(checks)) {
    throw { code: "MALFORMED_PROVIDER_JSON", message: "required checks response is not an array" };
  }
  const requiredChecks = checks.map((check) => {
    if (!check || typeof check !== "object" || Array.isArray(check) || !nonEmptyString(check.name) || !nonEmptyString(check.state) || !nonEmptyString(check.bucket)) {
      throw { code: "MALFORMED_PROVIDER_JSON", message: "required checks response has an invalid check" };
    }
    return { name: check.name, state: check.state, bucket: check.bucket };
  });
  if (requiredChecks.some((check) => check.bucket.toLowerCase() !== "pass")) {
    throw { code: "REQUIRED_CHECKS_NOT_PASSING", message: "required checks are pending or failing" };
  }
  return {
    ok: true,
    repository,
    pr: { number, url: pr.url, merged_at: pr.mergedAt, head_oid: pr.headRefOid, base_branch: pr.baseRefName, merge_commit_oid: pr.mergeCommit.oid },
    default_branch: repo.defaultBranchRef.name,
    required_checks: requiredChecks,
  };
}

if (extra.length > 0 || !validRepository(repository)) {
  fail("INVALID_REPOSITORY", "repository must be exactly owner/repo");
} else {
  const number = positivePrNumber(numberArgument);
  if (number === null) {
    fail("INVALID_PR_NUMBER", "PR number must be a positive integer");
  } else {
    try {
      const [pr, checks, repo] = await Promise.all([
        ghJson(["pr", "view", String(number), "--repo", repository, "--json", "url,mergedAt,headRefOid,baseRefName,mergeCommit"], "gh pr view"),
        ghJson(["pr", "checks", String(number), "--repo", repository, "--required", "--json", "name,state,bucket"], "gh pr checks --required"),
        ghJson(["repo", "view", repository, "--json", "defaultBranchRef"], "gh repo view"),
      ]);
      process.stdout.write(`${JSON.stringify(facts(pr, checks, repo, repository, number))}\n`);
    } catch (error) {
      fail(error?.code || "COMMAND_FAILED", error?.message || "GitHub fact lookup failed");
    }
  }
}
