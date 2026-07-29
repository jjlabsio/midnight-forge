#!/usr/bin/env node

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const helper = path.join(root, "skills", "github-after-merge", "scripts", "post-merge-facts.mjs");
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "mdf-post-merge-facts-"));
const bin = path.join(fixture, "bin");

function write(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, { mode: 0o755 });
}

function ghScript({ pr = {}, checks = [], repo = {}, status = {}, waitForPeers = false } = {}) {
  return `#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const command = process.argv.slice(2);
const status = ${JSON.stringify(status)};
const output = {
  "pr view": ${JSON.stringify(pr)},
  "pr checks": ${JSON.stringify(checks)},
  "repo view": ${JSON.stringify(repo)},
};
const key = command.slice(0, 2).join(" ");
if (${JSON.stringify(waitForPeers)}) {
  fs.writeFileSync(path.join(process.env.MDF_GH_CALLS, key.replace(" ", "-")), "");
  const deadline = Date.now() + 1000;
  while (fs.readdirSync(process.env.MDF_GH_CALLS).length < 3 && Date.now() < deadline) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
  }
  if (fs.readdirSync(process.env.MDF_GH_CALLS).length < 3) process.exit(3);
}
if (status[key]) {
  process.stderr.write(status[key]);
  process.exit(1);
}
process.stdout.write(JSON.stringify(output[key]));
`;
}

function installGh(options) {
  write(path.join(bin, "gh"), ghScript(options));
}

function run(...args) {
  return runWithEnv({}, ...args);
}

function runWithEnv(extraEnv, ...args) {
  return spawnSync(process.execPath, [helper, ...args], {
    cwd: root,
    env: { ...process.env, ...extraEnv, PATH: `${bin}${path.delimiter}${process.env.PATH}` },
    encoding: "utf8",
  });
}

function failure(result, code) {
  assert.strictEqual(result.status, 2, result.stderr);
  const report = JSON.parse(result.stderr);
  assert.strictEqual(report.ok, false);
  assert.strictEqual(report.error.code, code);
  assert.strictEqual(result.stdout, "");
}

try {
  installGh({
    pr: {
      url: "https://github.com/acme/widgets/pull/17",
      mergedAt: "2026-07-29T12:00:00Z",
      headRefOid: "0123456789abcdef0123456789abcdef01234567",
      baseRefName: "main",
      mergeCommit: { oid: "89abcdef0123456789abcdef0123456789abcdef" },
    },
    checks: [{ name: "test", state: "SUCCESS", bucket: "pass" }],
    repo: { defaultBranchRef: { name: "main" } },
  });
  const success = run("acme/widgets", "17");
  assert.strictEqual(success.status, 0, success.stderr);
  assert.deepStrictEqual(JSON.parse(success.stdout), {
    ok: true,
    repository: "acme/widgets",
    pr: {
      number: 17,
      url: "https://github.com/acme/widgets/pull/17",
      merged_at: "2026-07-29T12:00:00Z",
      head_oid: "0123456789abcdef0123456789abcdef01234567",
      base_branch: "main",
      merge_commit_oid: "89abcdef0123456789abcdef0123456789abcdef",
    },
    default_branch: "main",
    required_checks: [{ name: "test", state: "SUCCESS", bucket: "pass" }],
  });

  const calls = path.join(fixture, "calls");
  fs.mkdirSync(calls);
  installGh({
    pr: {
      url: "https://github.com/acme/widgets/pull/17",
      mergedAt: "2026-07-29T12:00:00Z",
      headRefOid: "0123456789abcdef0123456789abcdef01234567",
      baseRefName: "main",
      mergeCommit: { oid: "89abcdef0123456789abcdef0123456789abcdef" },
    },
    checks: [{ name: "test", state: "SUCCESS", bucket: "pass" }],
    repo: { defaultBranchRef: { name: "main" } },
    waitForPeers: true,
  });
  assert.strictEqual(runWithEnv({ MDF_GH_CALLS: calls }, "acme/widgets", "17").status, 0);
  assert.deepStrictEqual(fs.readdirSync(calls).sort(), ["pr-checks", "pr-view", "repo-view"]);

  failure(run("acme/widgets", "0"), "INVALID_PR_NUMBER");
  failure(run("acme/widgets/extra", "17"), "INVALID_REPOSITORY");
  failure(run("acme/widgets", "17", "extra"), "INVALID_REPOSITORY");

  installGh({ status: { "pr view": "provider unavailable" } });
  failure(run("acme/widgets", "17"), "COMMAND_FAILED");

  write(path.join(bin, "gh"), "#!/usr/bin/env node\nprocess.stdout.write('{')\n");
  failure(run("acme/widgets", "17"), "MALFORMED_PROVIDER_JSON");

  installGh({
    pr: {
      url: "https://github.com/acme/widgets/pull/17",
      mergedAt: null,
      headRefOid: "0123456789abcdef0123456789abcdef01234567",
      baseRefName: "main",
      mergeCommit: { oid: "89abcdef0123456789abcdef0123456789abcdef" },
    },
    checks: [],
    repo: { defaultBranchRef: { name: "main" } },
  });
  failure(run("acme/widgets", "17"), "UNMERGED_PR");

  installGh({
    pr: {
      url: "https://github.com/acme/widgets/pull/17",
      mergedAt: "2026-07-29T12:00:00Z",
      headRefOid: "0123456789abcdef0123456789abcdef01234567",
      baseRefName: "main",
      mergeCommit: { oid: "89abcdef0123456789abcdef0123456789abcdef" },
    },
    checks: [{ name: "test", state: "IN_PROGRESS", bucket: "pending" }],
    repo: { defaultBranchRef: { name: "main" } },
  });
  failure(run("acme/widgets", "17"), "REQUIRED_CHECKS_NOT_PASSING");

  console.log("post-merge facts helper tests passed");
} finally {
  fs.rmSync(fixture, { recursive: true, force: true });
}
