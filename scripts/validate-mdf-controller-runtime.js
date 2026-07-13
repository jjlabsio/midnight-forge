#!/usr/bin/env node

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { resolveControllerContext, resolvePluginPath } = require("./controller-runtime/context");
const { recordArtifact, recordCommand, recordInteraction, recordDecision, recordGitFacts, verifySidecar } = require("./controller-runtime/evidence");
const { issueAction, issueCapability, prepareAdapter, submitOutcome } = require("./controller-runtime/adapter");
const { EDGES, next: nextLifecycle, recordEvent, resumeLifecycle, validateEdge } = require("./controller-runtime/lifecycle");
const { advanceSpec, approveSpec, registerSpec } = require("./controller-runtime/spec");
const { advancePlan, approvePlan, createPlanMetadata, registerPlan } = require("./controller-runtime/plan");
const { authorizeTaskCommit, completeBuildTask, recordDownstreamImpact, runVerification, selectBuildTask, selectRepairTask } = require("./controller-runtime/build-task");
const { beginWholeBuild, finalizeWholeBuild, resumeAutoBuild, runWholeVerification, wholeReviewInputs } = require("./controller-runtime/whole-build");
const { decideRecovery, decideWholeBuildRecovery, recoveryDisposition, registerRepairPlan } = require("./controller-runtime/recovery");
const { registerTechnicalRevision } = require("./controller-runtime/revision");
const { authorizeCandidateRejection, completeCandidateRejection, createSimplificationScope, finalizeNoChange, registerSimplification, selectSimplificationCandidate } = require("./controller-runtime/simplify");
const { createReviewContext, registerReview } = require("./controller-runtime/review");
const { createShipContext, recordRiskAcceptance, registerShip } = require("./controller-runtime/ship");
const { observeGithubPrBoundary, prepareGithubPrHandoff, recordGithubPrAuthority } = require("./controller-runtime/github-pr");

const root = path.resolve(__dirname, "..");
const cliPath = path.join(root, "scripts", "mdf-controller.js");

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function setOriginHead(cwd) {
  const head = spawnSync("git", ["rev-parse", "HEAD"], { cwd, encoding: "utf8" }).stdout.trim();
  spawnSync("git", ["update-ref", "refs/remotes/origin/main", head], { cwd });
  spawnSync("git", ["symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/main"], { cwd });
}

function createFixture() {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mdf-controller-context-"));
  const canonicalRoot = path.join(temporaryRoot, "project");
  const worktree = path.join(canonicalRoot, ".worktrees", "task-0032");
  const workId = "2026-07-11-0032-context";
  const workItem = path.join(canonicalRoot, ".mdf", "work", workId);
  fs.mkdirSync(worktree, { recursive: true });
  writeJson(path.join(canonicalRoot, ".mdf", "project", "init.json"), { version: 1 });
  writeJson(path.join(canonicalRoot, ".mdf", "project.json"), { version: 1 });
  fs.mkdirSync(path.join(canonicalRoot, ".mdf", "locks"), { recursive: true });
  fs.mkdirSync(workItem, { recursive: true });
  fs.writeFileSync(path.join(canonicalRoot, ".mdf", "index.jsonl"), "");
  fs.writeFileSync(path.join(workItem, "item.md"), "---\nwork_id: \"2026-07-11-0032-context\"\nlatest: {}\n---\n");
  writeJson(path.join(canonicalRoot, ".mdf", "locks", "0032.lock"), {
    task_id: "0032",
    work_id: workId,
    canonical_root: canonicalRoot,
    worktree,
    branch: "codex/task-0032",
  });
  return { temporaryRoot, canonicalRoot, worktree, workId };
}

function expectCode(callback, code) {
  assert.throws(callback, (error) => error && error.code === code);
}

function setLatest(context, key, value) {
  const itemPath = context.work_item.item_path;
  const current = fs.readFileSync(itemPath, "utf8");
  const child = new RegExp(`^  ${key}:.*$`, "m");
  const latest = current.includes("latest: {}")
    ? current.replace("latest: {}", `latest:\n  ${key}: \"${value}\"`)
    : child.test(current)
      ? current.replace(child, `  ${key}: \"${value}\"`)
      : current.replace(/^latest:\n/m, `latest:\n  ${key}: \"${value}\"\n`);
  fs.writeFileSync(itemPath, latest);
}

function runContextTests() {
  const fixture = createFixture();
  try {
    const nestedCwd = path.join(fixture.worktree, "packages", "controller");
    fs.mkdirSync(nestedCwd, { recursive: true });
    const context = resolveControllerContext({ cwd: fixture.worktree, pluginRoot: root });
    assert.strictEqual(context.canonical_root, fs.realpathSync(fixture.canonicalRoot));
    assert.strictEqual(context.worktree, fs.realpathSync(fixture.worktree));
    assert.strictEqual(context.lock.work_id, fixture.workId);
    assert.strictEqual(context.work_item.path, fs.realpathSync(path.join(fixture.canonicalRoot, ".mdf", "work", fixture.workId)));
    assert.strictEqual(context.plugin_root, fs.realpathSync(root));
    assert.strictEqual(resolvePluginPath(context.plugin_root, "agents/code-reviewer.md"), path.join(context.plugin_root, "agents", "code-reviewer.md"));
    expectCode(() => resolvePluginPath(context.plugin_root, "../outside.md"), "MDF_PLUGIN_PATH_ESCAPE");
    assert.strictEqual(resolveControllerContext({ cwd: nestedCwd, pluginRoot: root }).worktree, fs.realpathSync(fixture.worktree));

    const cli = spawnSync(process.execPath, [cliPath, "context", "--cwd", nestedCwd, "--plugin-root", root], {
      encoding: "utf8",
    });
    assert.strictEqual(cli.status, 0, cli.stderr);
    const response = JSON.parse(cli.stdout);
    assert.strictEqual(response.ok, true);
    assert.strictEqual(response.context.lock.work_id, fixture.workId);

    writeJson(path.join(fixture.canonicalRoot, ".mdf", "locks", "duplicate.lock"), {
      task_id: "9999",
      work_id: fixture.workId,
      canonical_root: fixture.canonicalRoot,
      worktree: fixture.worktree,
      branch: "codex/duplicate",
    });
    expectCode(
      () => resolveControllerContext({ cwd: fixture.worktree, pluginRoot: root }),
      "MDF_ACTIVE_LOCK_AMBIGUOUS"
    );
    const failedCli = spawnSync(process.execPath, [cliPath, "context", "--cwd", fixture.worktree, "--plugin-root", root], {
      encoding: "utf8",
    });
    assert.strictEqual(failedCli.status, 1);
    assert.strictEqual(JSON.parse(failedCli.stderr).error.code, "MDF_ACTIVE_LOCK_AMBIGUOUS");
  } finally {
    fs.rmSync(fixture.temporaryRoot, { recursive: true, force: true });
  }

  const escapedFixture = createFixture();
  try {
    writeJson(path.join(escapedFixture.canonicalRoot, ".mdf", "locks", "0032.lock"), {
      task_id: "0032",
      work_id: escapedFixture.workId,
      canonical_root: escapedFixture.canonicalRoot,
      worktree: escapedFixture.canonicalRoot,
      branch: "main",
    });
    expectCode(
      () => resolveControllerContext({ cwd: escapedFixture.canonicalRoot, pluginRoot: root }),
      "MDF_LOCK_WORKTREE_ESCAPE"
    );
  } finally {
    fs.rmSync(escapedFixture.temporaryRoot, { recursive: true, force: true });
  }
}

function runEvidenceTests() {
  const fixture = createFixture();
  try {
    const git = (args) => {
      const result = spawnSync("git", args, { cwd: fixture.worktree, encoding: "utf8" });
      assert.strictEqual(result.status, 0, result.stderr);
    };
    git(["init", "--quiet"]);
    git(["config", "user.email", "test@example.com"]);
    git(["config", "user.name", "MDF test"]);
    fs.writeFileSync(path.join(fixture.worktree, "tracked.txt"), "tree one\n");
    git(["add", "tracked.txt"]);
    git(["commit", "--quiet", "-m", "initial"]);

    const context = resolveControllerContext({ cwd: fixture.worktree, pluginRoot: root });
    const artifact = path.join(context.work_item.path, "upstream-result.md");
    const output = path.join(context.work_item.path, "command-output.log");
    fs.writeFileSync(artifact, "raw upstream result\n");
    fs.writeFileSync(output, "command output\n");
    const rawBefore = fs.readFileSync(artifact);
    const artifactSidecar = recordArtifact(context, "upstream-result.md");
    assert.deepStrictEqual(fs.readFileSync(artifact), rawBefore);
    assert.strictEqual(verifySidecar(context, artifactSidecar.file).kind, "artifact");
    const commandSidecar = recordCommand(context, { command: ["tool", "--check"], output_path: "command-output.log", exit_code: 0 });
    assert.strictEqual(verifySidecar(context, commandSidecar.file).kind, "command");
    const gitSidecar = recordGitFacts(context);
    assert.strictEqual(verifySidecar(context, gitSidecar.file).kind, "git");
    const interactionSidecar = recordInteraction(context, {
      invocation: { agent_id: "reviewer", invocation_id: "inv-1" },
      input_paths: ["upstream-result.md"],
    });
    const decisionSidecar = recordDecision(context, {
      interaction_file: interactionSidecar.file,
      conclusion: { disposition: "pass" },
    });
    assert.strictEqual(verifySidecar(context, decisionSidecar.file).kind, "decision");
    expectCode(
      () => recordDecision(context, { interaction_file: interactionSidecar.file, conclusion: true }),
      "MDF_DECISION_INVALID"
    );

    fs.writeFileSync(artifact, "changed\n");
    expectCode(() => verifySidecar(context, artifactSidecar.file), "MDF_EVIDENCE_STALE");
    expectCode(() => verifySidecar(context, decisionSidecar.file), "MDF_EVIDENCE_STALE");
    const sidecarPath = path.join(context.work_item.path, "evidence", artifactSidecar.file);
    const altered = JSON.parse(fs.readFileSync(sidecarPath, "utf8"));
    altered.artifact.sha256 = "0".repeat(64);
    fs.writeFileSync(sidecarPath, JSON.stringify(altered));
    expectCode(() => verifySidecar(context, artifactSidecar.file), "MDF_EVIDENCE_FABRICATED");
    fs.symlinkSync(artifact, path.join(context.work_item.path, "escaped.md"));
    expectCode(() => recordArtifact(context, "escaped.md"), "MDF_EVIDENCE_SYMLINK");
  } finally {
    fs.rmSync(fixture.temporaryRoot, { recursive: true, force: true });
  }

  const symlinkFixture = createFixture();
  try {
    const context = resolveControllerContext({ cwd: symlinkFixture.worktree, pluginRoot: root });
    fs.writeFileSync(path.join(context.work_item.path, "raw.md"), "raw\n");
    const outside = path.join(symlinkFixture.temporaryRoot, "outside");
    fs.mkdirSync(outside);
    fs.symlinkSync(outside, path.join(context.work_item.path, "evidence"));
    expectCode(() => recordArtifact(context, "raw.md"), "MDF_EVIDENCE_SYMLINK");
    assert.deepStrictEqual(fs.readdirSync(outside), []);
  } finally {
    fs.rmSync(symlinkFixture.temporaryRoot, { recursive: true, force: true });
  }
}

function runAdapterTests() {
  const fixture = createFixture();
  try {
    for (const [args, input] of [
      [["init", "--quiet"], null],
      [["config", "user.email", "test@example.com"], null],
      [["config", "user.name", "MDF test"], null],
      [["add", "adapter.txt"], "adapter\n"],
      [["commit", "--quiet", "-m", "adapter"], null],
    ]) {
      if (input !== null) fs.writeFileSync(path.join(fixture.worktree, "adapter.txt"), input);
      const git = spawnSync("git", args, { cwd: fixture.worktree, encoding: "utf8" });
      assert.strictEqual(git.status, 0, git.stderr);
    }
    const relocated = path.join(fixture.temporaryRoot, "installed-plugin");
    for (const relative of ["skills/use-mdf/SKILL.md", "agents/code-reviewer.md"]) {
      fs.mkdirSync(path.dirname(path.join(relocated, relative)), { recursive: true });
      fs.copyFileSync(path.join(root, relative), path.join(relocated, relative));
    }
    const input = path.join(fixture.canonicalRoot, ".mdf", "work", fixture.workId, "adapter-input.md");
    fs.writeFileSync(input, "bounded input\n");
    fs.writeFileSync(path.join(path.dirname(input), "capability-observation.json"), JSON.stringify({ executor: "subagent", observed: true }));
    fs.writeFileSync(path.join(path.dirname(input), "agent-report.md"), "review result\n");
    const context = resolveControllerContext({ cwd: fixture.worktree, pluginRoot: relocated });
    const actionRequest = {
      action_id: "review-1",
      action: "review",
      skill_path: "skills/use-mdf/SKILL.md",
      persona_path: "agents/code-reviewer.md",
      input_paths: ["adapter-input.md"],
    };
    const invocation = { agent_id: "reviewer", invocation_id: "inv-1", executor: "subagent", model_capability: "independent-review-capable", freshness: "fresh", capability: { persona_loaded: true, reasoning_capable: true, model_suitable: true, fresh_context: true, source: "runtime-verified" } };
    const issued = issueAction(context, actionRequest);
    const capability = issueCapability(context, { ...invocation, persona_path: actionRequest.persona_path, evidence_path: "capability-observation.json" });
    const request = { action_file: issued.action_file, capability_file: capability.capability_file, invocation };
    const adapter = prepareAdapter(context, request);
    assert.strictEqual(adapter.invocation.freshness, "fresh");
    assert(adapter.skill.bytes_sha256 && adapter.persona.bytes_sha256);
    expectCode(() => prepareAdapter(context, { ...request, invocation: { ...request.invocation, capability: { ...request.invocation.capability, fresh_context: false } } }), "MDF_ADAPTER_MODE_INCONSISTENT");
    expectCode(() => prepareAdapter(context, { ...request, invocation: { ...request.invocation, capability: { ...request.invocation.capability, persona_loaded: false } } }), "MDF_ADAPTER_CAPABILITY_UNSUPPORTED");
    const rootAction = issueAction(context, { ...actionRequest, action_id: "root-synthesis", action: "root-synthesis", persona_path: null });
    const rootInvocation = { agent_id: "root", invocation_id: "root-synthesis-inv", executor: "root", model_capability: "root-reasoning", freshness: "root-fallback", capability: { persona_loaded: false, reasoning_capable: true, model_suitable: true, fresh_context: false, source: "root-observed" }, fallback: { source: "runtime-limited", reason: "root owns synthesis" } };
    const rootCapability = issueCapability(context, { ...rootInvocation, persona_path: null, evidence_path: "capability-observation.json" });
    const rootAdapter = prepareAdapter(context, { action_file: rootAction.action_file, capability_file: rootCapability.capability_file, invocation: rootInvocation });
    assert.strictEqual(rootAdapter.persona, null);
    expectCode(() => issueCapability(context, { ...invocation, capability: { ...invocation.capability, persona_loaded: false }, persona_path: null, evidence_path: "capability-observation.json" }), "MDF_ADAPTER_CAPABILITY_UNSUPPORTED");

    for (const relative of ["scripts/mdf-controller.js", "scripts/controller-runtime/context.js", "scripts/controller-runtime/evidence.js", "scripts/controller-runtime/adapter.js", "scripts/controller-runtime/lifecycle.js", "scripts/controller-runtime/spec.js", "scripts/controller-runtime/plan.js", "scripts/controller-runtime/build-task.js", "scripts/controller-runtime/whole-build.js", "scripts/controller-runtime/recovery.js", "scripts/controller-runtime/revision.js", "scripts/controller-runtime/simplify.js", "scripts/controller-runtime/review.js", "scripts/controller-runtime/ship.js", "scripts/controller-runtime/github-pr.js"]) {
      fs.mkdirSync(path.dirname(path.join(relocated, relative)), { recursive: true });
      fs.copyFileSync(path.join(root, relative), path.join(relocated, relative));
    }
    const relocatedCli = path.join(relocated, "scripts", "mdf-controller.js");
    const issue = spawnSync(process.execPath, [relocatedCli, "adapter", "issue", "--cwd", fixture.worktree, "--plugin-root", relocated], { cwd: fixture.worktree, encoding: "utf8", input: JSON.stringify(actionRequest) });
    assert.strictEqual(issue.status, 0, issue.stderr);
    const capabilityIssue = spawnSync(process.execPath, [relocatedCli, "adapter", "capability", "--cwd", fixture.worktree, "--plugin-root", relocated], { cwd: fixture.worktree, encoding: "utf8", input: JSON.stringify({ ...invocation, persona_path: actionRequest.persona_path, evidence_path: "capability-observation.json" }) });
    assert.strictEqual(capabilityIssue.status, 0, capabilityIssue.stderr);
    const cliRequest = { action_file: JSON.parse(issue.stdout).adapter.action_file, capability_file: JSON.parse(capabilityIssue.stdout).adapter.capability_file, invocation };
    fs.copyFileSync(path.join(relocated, "agents/code-reviewer.md"), path.join(relocated, "agents/code-reviewer-copy.md"));
    const wrongPersonaCapability = spawnSync(process.execPath, [relocatedCli, "adapter", "capability", "--cwd", fixture.worktree, "--plugin-root", relocated], { cwd: fixture.worktree, encoding: "utf8", input: JSON.stringify({ ...invocation, persona_path: "agents/code-reviewer-copy.md", evidence_path: "capability-observation.json" }) });
    const wrongPersona = spawnSync(process.execPath, [relocatedCli, "adapter", "prepare", "--cwd", fixture.worktree, "--plugin-root", relocated], { cwd: fixture.worktree, encoding: "utf8", input: JSON.stringify({ ...cliRequest, capability_file: JSON.parse(wrongPersonaCapability.stdout).adapter.capability_file }) });
    assert.strictEqual(JSON.parse(wrongPersona.stderr).error.code, "MDF_ADAPTER_CAPABILITY_MISMATCH");
    const missingSource = spawnSync(process.execPath, [relocatedCli, "adapter", "capability", "--cwd", fixture.worktree, "--plugin-root", relocated], { cwd: fixture.worktree, encoding: "utf8", input: JSON.stringify({ ...invocation, capability: { ...invocation.capability, source: undefined }, persona_path: actionRequest.persona_path, evidence_path: "capability-observation.json" }) });
    assert.strictEqual(JSON.parse(missingSource.stderr).error.code, "MDF_ADAPTER_CAPABILITY_UNSUPPORTED");
    const prepare = spawnSync(process.execPath, [relocatedCli, "adapter", "prepare", "--cwd", fixture.worktree, "--plugin-root", relocated], { cwd: fixture.worktree, encoding: "utf8", input: JSON.stringify(cliRequest) });
    assert.strictEqual(prepare.status, 0, prepare.stderr);
    const prepared = JSON.parse(prepare.stdout).adapter;
    assert(prepared.skill.path.startsWith(fs.realpathSync(relocated)));
    const fallbackRequest = { ...cliRequest, invocation: { ...invocation, invocation_id: "inv-root", executor: "root", freshness: "root-fallback", capability: { ...invocation.capability, fresh_context: false, source: "root-observed" }, fallback: { reason: "fresh reviewer unavailable", source: "fresh-unavailable" } } };
    const fallbackCapability = spawnSync(process.execPath, [relocatedCli, "adapter", "capability", "--cwd", fixture.worktree, "--plugin-root", relocated], { cwd: fixture.worktree, encoding: "utf8", input: JSON.stringify({ ...fallbackRequest.invocation, persona_path: actionRequest.persona_path, evidence_path: "capability-observation.json" }) });
    fallbackRequest.capability_file = JSON.parse(fallbackCapability.stdout).adapter.capability_file;
    const fallback = spawnSync(process.execPath, [relocatedCli, "adapter", "prepare", "--cwd", fixture.worktree, "--plugin-root", relocated], { cwd: fixture.worktree, encoding: "utf8", input: JSON.stringify(fallbackRequest) });
    assert.strictEqual(fallback.status, 0, fallback.stderr);
    const degradedRequest = { ...cliRequest, invocation: { ...fallbackRequest.invocation, invocation_id: "inv-degraded", freshness: "degraded", fallback: { reason: "runtime cannot prove independent context", source: "runtime-limited" } } };
    const degradedCapability = spawnSync(process.execPath, [relocatedCli, "adapter", "capability", "--cwd", fixture.worktree, "--plugin-root", relocated], { cwd: fixture.worktree, encoding: "utf8", input: JSON.stringify({ ...degradedRequest.invocation, persona_path: actionRequest.persona_path, evidence_path: "capability-observation.json" }) });
    degradedRequest.capability_file = JSON.parse(degradedCapability.stdout).adapter.capability_file;
    const degraded = spawnSync(process.execPath, [relocatedCli, "adapter", "prepare", "--cwd", fixture.worktree, "--plugin-root", relocated], { cwd: fixture.worktree, encoding: "utf8", input: JSON.stringify(degradedRequest) });
    assert.strictEqual(degraded.status, 0, degraded.stderr);
    for (const [change, code] of [
      [{ capability: { ...request.invocation.capability, model_suitable: false } }, "MDF_ADAPTER_CAPABILITY_UNSUPPORTED"],
      [{ capability: { ...request.invocation.capability, reasoning_capable: false } }, "MDF_ADAPTER_CAPABILITY_UNSUPPORTED"],
      [{ freshness: "unknown" }, "MDF_ADAPTER_FRESHNESS_INVALID"],
      [{ freshness: "fresh", executor: "root" }, "MDF_ADAPTER_MODE_INCONSISTENT"],
      [{ freshness: "root-fallback", executor: "subagent", capability: { ...request.invocation.capability, fresh_context: false } }, "MDF_ADAPTER_MODE_INCONSISTENT"],
      [{ freshness: "degraded", executor: "root", capability: { ...request.invocation.capability, fresh_context: false } }, "MDF_ADAPTER_MODE_INCONSISTENT"],
    ]) {
      const invalidRequest = { ...cliRequest, invocation: { ...invocation, ...change } };
      const invalid = spawnSync(process.execPath, [relocatedCli, "adapter", "prepare", "--cwd", fixture.worktree, "--plugin-root", relocated], { cwd: fixture.worktree, encoding: "utf8", input: JSON.stringify(invalidRequest) });
      assert.strictEqual(JSON.parse(invalid.stderr).error.code, code);
    }
    const mismatch = spawnSync(process.execPath, [relocatedCli, "adapter", "submit", "--cwd", fixture.worktree, "--plugin-root", relocated], { cwd: fixture.worktree, encoding: "utf8", input: JSON.stringify({ action_id: "other", interaction_file: prepared.interaction_file, output_path: "agent-report.md", outcome: { disposition: "pass" } }) });
    assert.strictEqual(JSON.parse(mismatch.stderr).error.code, "MDF_ADAPTER_ACTION_MISMATCH");
    const bypass = recordInteraction(context, { invocation: { ...invocation, action_id: actionRequest.action_id, action_file: cliRequest.action_file, skill_sha256: prepared.skill.bytes_sha256, persona_sha256: prepared.persona.bytes_sha256 }, input_paths: actionRequest.input_paths });
    const bypassSubmit = spawnSync(process.execPath, [relocatedCli, "adapter", "submit", "--cwd", fixture.worktree, "--plugin-root", relocated], { cwd: fixture.worktree, encoding: "utf8", input: JSON.stringify({ action_id: actionRequest.action_id, interaction_file: bypass.file, output_path: "agent-report.md", outcome: { disposition: "pass" } }) });
    assert.strictEqual(JSON.parse(bypassSubmit.stderr).error.code, "MDF_ADAPTER_PREPARE_REQUIRED");
    fs.appendFileSync(path.join(relocated, "agents/code-reviewer.md"), "\nstale\n");
    const stale = spawnSync(process.execPath, [relocatedCli, "adapter", "submit", "--cwd", fixture.worktree, "--plugin-root", relocated], { cwd: fixture.worktree, encoding: "utf8", input: JSON.stringify({ action_id: actionRequest.action_id, interaction_file: prepared.interaction_file, output_path: "agent-report.md", outcome: { disposition: "pass" } }) });
    assert.strictEqual(JSON.parse(stale.stderr).error.code, "MDF_ADAPTER_PRIMITIVE_STALE");
    fs.copyFileSync(path.join(root, "agents/code-reviewer.md"), path.join(relocated, "agents/code-reviewer.md"));
    const submit = spawnSync(process.execPath, [relocatedCli, "adapter", "submit", "--cwd", fixture.worktree, "--plugin-root", relocated], { cwd: fixture.worktree, encoding: "utf8", input: JSON.stringify({ action_id: actionRequest.action_id, interaction_file: prepared.interaction_file, output_path: "agent-report.md", outcome: { disposition: "pass" } }) });
    assert.strictEqual(submit.status, 0, submit.stderr);
    const submitted = JSON.parse(submit.stdout).adapter;
    assert(submitted.decision_file);
    fs.writeFileSync(input, "changed after decision\n");
    expectCode(() => verifySidecar(context, submitted.decision_file), "MDF_EVIDENCE_STALE");
  } finally {
    fs.rmSync(fixture.temporaryRoot, { recursive: true, force: true });
  }
}

function runLifecycleTests() {
  const phases = [...EDGES.keys(), "complete"];
  for (const from of phases) for (const to of phases) {
    if (EDGES.get(from)?.includes(to)) assert.doesNotThrow(() => validateEdge(from, to));
    else expectCode(() => validateEdge(from, to), "MDF_LIFECYCLE_ILLEGAL_EDGE");
  }
  const fixture = createFixture();
  try {
    for (const args of [["init", "--quiet"], ["config", "user.email", "test@example.com"], ["config", "user.name", "MDF test"]]) {
      assert.strictEqual(spawnSync("git", args, { cwd: fixture.worktree }).status, 0);
    }
    fs.writeFileSync(path.join(fixture.worktree, "tracked.txt"), "tracked\n");
    assert.strictEqual(spawnSync("git", ["add", "tracked.txt"], { cwd: fixture.worktree }).status, 0);
    assert.strictEqual(spawnSync("git", ["commit", "--quiet", "-m", "initial"], { cwd: fixture.worktree }).status, 0);
    const context = resolveControllerContext({ cwd: fixture.worktree, pluginRoot: root });
    fs.writeFileSync(path.join(context.work_item.path, "phase.md"), "phase evidence\n");
    const evidence = recordArtifact(context, "phase.md").file;
    assert.deepStrictEqual(nextLifecycle(context), nextLifecycle(context));
    const cliNextA = spawnSync(process.execPath, [cliPath, "lifecycle", "next", "--cwd", fixture.worktree, "--plugin-root", root], { encoding: "utf8" });
    const cliNextB = spawnSync(process.execPath, [cliPath, "lifecycle", "next", "--cwd", fixture.worktree, "--plugin-root", root], { encoding: "utf8" });
    assert.deepStrictEqual(JSON.parse(cliNextA.stdout), JSON.parse(cliNextB.stdout));
    const bypass = spawnSync(process.execPath, [cliPath, "lifecycle", "record", "--cwd", fixture.worktree, "--plugin-root", root], { encoding: "utf8", input: JSON.stringify({ event_id: "bypass", from: "spec", to: "plan", evidence_files: [evidence] }) });
    assert.strictEqual(bypass.status, 1);
    assert.strictEqual(JSON.parse(bypass.stderr).error.code, "MDF_CONTROLLER_USAGE");
    expectCode(() => recordEvent(context, { event_id: "bad", from: "spec", to: "ship", evidence_files: [evidence] }), "MDF_LIFECYCLE_ILLEGAL_EDGE");
    expectCode(() => recordEvent(context, { event_id: "bad-next", from: "spec", to: "plan", next_action: "ship", evidence_files: [evidence] }), "MDF_LIFECYCLE_NEXT_INVALID");
    let from = "spec";
    const sequence = ["plan", "build-task", "build-task", "whole-build", "simplify", "review", "ship", "github-pr", "complete"];
    for (let index = 0; index < sequence.length; index += 1) {
      const to = sequence[index];
      recordEvent(context, { event_id: `${from}-${to}`, from, to, next_action: sequence[index + 1] || null, evidence_files: [evidence] });
      if (index === 0) {
        fs.writeFileSync(path.join(fixture.worktree, "tracked.txt"), "new tree\n");
        spawnSync("git", ["add", "tracked.txt"], { cwd: fixture.worktree });
        spawnSync("git", ["commit", "--quiet", "-m", "normal lifecycle change"], { cwd: fixture.worktree });
      }
      if (index === 2) assert.strictEqual(nextLifecycle(context).action, "whole-build");
      from = to;
    }
    assert.strictEqual(nextLifecycle(context).action, "complete");
    expectCode(() => validateEdge("complete", "spec"), "MDF_LIFECYCLE_ILLEGAL_EDGE");
  } finally { fs.rmSync(fixture.temporaryRoot, { recursive: true, force: true }); }

  const stopped = createFixture();
  try {
    for (const args of [["init", "--quiet"], ["config", "user.email", "test@example.com"], ["config", "user.name", "MDF test"]]) assert.strictEqual(spawnSync("git", args, { cwd: stopped.worktree }).status, 0);
    fs.writeFileSync(path.join(stopped.worktree, "tracked.txt"), "x\n");
    spawnSync("git", ["add", "tracked.txt"], { cwd: stopped.worktree });
    spawnSync("git", ["commit", "--quiet", "-m", "initial"], { cwd: stopped.worktree });
    const context = resolveControllerContext({ cwd: stopped.worktree, pluginRoot: root });
    fs.writeFileSync(path.join(context.work_item.path, "stop.md"), "stop evidence\n");
    const stopEvidence = recordArtifact(context, "stop.md").file;
    const stoppedEvent = recordEvent(context, { event_id: "stop", from: "spec", stop_reason: "human-required", evidence_files: [stopEvidence] });
    assert.strictEqual(nextLifecycle(context).stop.code, "MDF_STOP_HUMAN_REQUIRED");
    expectCode(() => recordEvent(context, { event_id: "bypass", from: "spec", to: "plan", evidence_files: [stopEvidence] }), "MDF_LIFECYCLE_STOPPED");
    fs.writeFileSync(path.join(context.work_item.path, "resume.md"), "continue after user decision\n");
    const resumed = resumeLifecycle(context, { stop_event_file: stoppedEvent.file, user_message_path: "resume.md", invocation_id: "resume-1", affirmative: true });
    assert.strictEqual(resumed.action, "spec");
    assert.strictEqual(resumed.state.phase, "spec");
    assert.strictEqual(resumed.state.stop_reason, null);
    assert.strictEqual(nextLifecycle(context).action, "spec");
    expectCode(() => resumeLifecycle(context, { stop_event_file: stoppedEvent.file, user_message_path: "resume.md", invocation_id: "resume-replay", affirmative: true }), "MDF_LIFECYCLE_RESUME_INVALID");
    const secondStopped = recordEvent(context, { event_id: "stop-again", from: "spec", stop_reason: "human-required", evidence_files: [stopEvidence] });
    fs.writeFileSync(path.join(context.work_item.path, "resume-cli.md"), "continue through CLI\n");
    const cliResume = spawnSync(process.execPath, [cliPath, "lifecycle", "resume", "--cwd", stopped.worktree, "--plugin-root", root], { encoding: "utf8", input: JSON.stringify({ stop_event_file: secondStopped.file, user_message_path: "resume-cli.md", invocation_id: "resume-cli", affirmative: true }) });
    assert.strictEqual(cliResume.status, 0, cliResume.stderr);
    assert.strictEqual(JSON.parse(cliResume.stdout).action, "spec");
  } finally { fs.rmSync(stopped.temporaryRoot, { recursive: true, force: true }); }

  for (const scenario of ["no-progress", "stale", "ambiguous", "malformed"]) {
    const fixture = createFixture();
    try {
      for (const args of [["init", "--quiet"], ["config", "user.email", "test@example.com"], ["config", "user.name", "MDF test"]]) spawnSync("git", args, { cwd: fixture.worktree });
      fs.writeFileSync(path.join(fixture.worktree, "tracked.txt"), "x\n");
      spawnSync("git", ["add", "tracked.txt"], { cwd: fixture.worktree });
      spawnSync("git", ["commit", "--quiet", "-m", "initial"], { cwd: fixture.worktree });
      const context = resolveControllerContext({ cwd: fixture.worktree, pluginRoot: root });
      if (scenario === "no-progress") {
        fs.writeFileSync(path.join(context.work_item.path, "stop.md"), "stop evidence\n");
        recordEvent(context, { event_id: scenario, from: "spec", stop_reason: scenario, evidence_files: [recordArtifact(context, "stop.md").file] });
      }
      else if (scenario === "stale") {
        fs.writeFileSync(path.join(context.work_item.path, "stale.md"), "before\n");
        const staleEvidence = recordArtifact(context, "stale.md").file;
        fs.writeFileSync(path.join(context.work_item.path, "stale.md"), "after\n");
        expectCode(() => recordEvent(context, { event_id: "stale", from: "spec", to: "plan", evidence_files: [staleEvidence] }), "MDF_EVIDENCE_STALE");
        continue;
      } else if (scenario === "ambiguous") {
        recordInteraction(context, { invocation: { agent_id: "mdf-lifecycle", invocation_id: "a", executor: "deterministic-runtime", previous_event_file: null, from: "spec", to: "plan" }, input_paths: [] });
        recordInteraction(context, { invocation: { agent_id: "mdf-lifecycle", invocation_id: "b", executor: "deterministic-runtime", previous_event_file: null, from: "spec", to: "plan" }, input_paths: [] });
      } else recordInteraction(context, { invocation: { agent_id: "mdf-lifecycle", invocation_id: "orphan", executor: "deterministic-runtime", previous_event_file: "missing.json", from: "spec", to: "plan" }, input_paths: [] });
      assert.strictEqual(nextLifecycle(context).stop.code, scenario === "no-progress" ? "MDF_STOP_NO_PROGRESS" : `MDF_LIFECYCLE_${scenario.toUpperCase()}`);
    } finally { fs.rmSync(fixture.temporaryRoot, { recursive: true, force: true }); }
  }
}

function runSpecTests() {
  const fixture = createFixture();
  try {
    for (const args of [["init", "--quiet"], ["config", "user.email", "test@example.com"], ["config", "user.name", "MDF test"]]) spawnSync("git", args, { cwd: fixture.worktree });
    fs.writeFileSync(path.join(fixture.worktree, "tracked.txt"), "x\n"); spawnSync("git", ["add", "tracked.txt"], { cwd: fixture.worktree }); spawnSync("git", ["commit", "--quiet", "-m", "initial"], { cwd: fixture.worktree });
    const context = resolveControllerContext({ cwd: fixture.worktree, pluginRoot: root });
    for (const [file, bytes] of [["spec-001.md", "exact spec\n"], ["review.md", "DDD review\n"], ["other-review.md", "other\n"], ["user.md", "yes\n"], ["spec-002.md", "revised spec\n"], ["spec-mutate.md", "before\n"], ["spec-cli.md", "cli spec\n"]]) fs.writeFileSync(path.join(context.work_item.path, file), bytes);
    fs.writeFileSync(path.join(context.work_item.path, "review-capability.json"), "{}\n");
    const reviewFor = (specPath, id, outputPath = "review.md", actionName = "ddd-review") => {
      const action = issueAction(context, { action_id: id, action: actionName, skill_path: "skills/doubt-driven-development/SKILL.md", persona_path: "agents/code-reviewer.md", input_paths: [specPath, "review.md"] });
      const invocation = { agent_id: "reviewer", invocation_id: `${id}-inv`, executor: "subagent", model_capability: "independent-review-capable", freshness: "fresh", capability: { persona_loaded: true, reasoning_capable: true, model_suitable: true, fresh_context: true, source: "runtime-verified" } };
      const capability = issueCapability(context, { ...invocation, persona_path: "agents/code-reviewer.md", evidence_path: "review-capability.json" });
      const prepared = prepareAdapter(context, { action_file: action.action_file, capability_file: capability.capability_file, invocation });
      return submitOutcome(context, { action_id: id, interaction_file: prepared.interaction_file, output_path: outputPath, outcome: { disposition: "pass" } }).decision_file;
    };
    const review001 = reviewFor("spec-001.md", "review-spec-001");
    const before = fs.readFileSync(path.join(context.work_item.path, "spec-001.md"));
    expectCode(() => registerSpec(context, { artifact_path: "spec-001.md", review_output_path: "review.md", mode: "standalone" }), "MDF_SPEC_REVIEW_REQUIRED");
    expectCode(() => registerSpec(context, { artifact_path: "spec-001.md", review_output_path: "review.md", review_decision_file: reviewFor("spec-001.md", "wrong-output", "other-review.md"), mode: "standalone" }), "MDF_ADAPTER_DECISION_MISMATCH");
    expectCode(() => registerSpec(context, { artifact_path: "spec-001.md", review_output_path: "review.md", review_decision_file: reviewFor("spec-001.md", "wrong-action", "review.md", "other-review"), mode: "standalone" }), "MDF_ADAPTER_DECISION_MISMATCH");
    const standalone = registerSpec(context, { artifact_path: "spec-001.md", review_output_path: "review.md", review_decision_file: review001, mode: "standalone" });
    assert.deepStrictEqual(fs.readFileSync(path.join(context.work_item.path, "spec-001.md")), before);
    assert.strictEqual(advanceSpec(context, { registration_file: standalone.registration_file }).action, "stop");
    const auto = registerSpec(context, { artifact_path: "spec-001.md", review_output_path: "review.md", review_decision_file: review001, mode: "auto" });
    assert.strictEqual(advanceSpec(context, { registration_file: auto.registration_file }).stop.code, "MDF_SPEC_APPROVAL_REQUIRED");
    expectCode(() => approveSpec(context, { registration_file: auto.registration_file, user_message_path: "user.md", invocation_id: "user-no", affirmative: false }), "MDF_SPEC_APPROVAL_NOT_AFFIRMATIVE");
    expectCode(() => approveSpec(context, { registration_file: auto.registration_file, user_message_path: "user.md", invocation_id: "user-missing-pointer", affirmative: true }), "MDF_SPEC_LATEST_POINTER_INVALID");
    setLatest(context, "spec", "spec-001.md");
    const approval = approveSpec(context, { registration_file: auto.registration_file, user_message_path: "user.md", invocation_id: "user-1", affirmative: true });
    const mutation = registerSpec(context, { artifact_path: "spec-mutate.md", review_output_path: "review.md", review_decision_file: reviewFor("spec-mutate.md", "review-mutation"), mode: "auto" });
    fs.writeFileSync(path.join(context.work_item.path, "spec-mutate.md"), "after\n");
    expectCode(() => approveSpec(context, { registration_file: mutation.registration_file, user_message_path: "user.md", invocation_id: "user-mutation", affirmative: true }), "MDF_EVIDENCE_STALE");
    const revised = registerSpec(context, { artifact_path: "spec-002.md", review_output_path: "review.md", review_decision_file: reviewFor("spec-002.md", "review-spec-002"), mode: "auto" });
    expectCode(() => advanceSpec(context, { registration_file: revised.registration_file, approval_file: approval.approval_file }), "MDF_SPEC_APPROVAL_INVALID");
    setLatest(context, "spec", "spec-002.md");
    expectCode(() => advanceSpec(context, { registration_file: auto.registration_file, approval_file: approval.approval_file }), "MDF_EVIDENCE_STALE");
    setLatest(context, "spec", "spec-001.md");
    const result = advanceSpec(context, { registration_file: auto.registration_file, approval_file: approval.approval_file });
    assert.strictEqual(result.state.phase, "plan");
    const cli = spawnSync(process.execPath, [cliPath, "spec", "register", "--cwd", fixture.worktree, "--plugin-root", root], { encoding: "utf8", input: JSON.stringify({ artifact_path: "spec-cli.md", review_output_path: "review.md", review_decision_file: reviewFor("spec-cli.md", "review-cli"), mode: "standalone" }) });
    assert.strictEqual(cli.status, 0, cli.stderr);
    assert.strictEqual(JSON.parse(cli.stdout).spec.action, "stop");
  } finally { fs.rmSync(fixture.temporaryRoot, { recursive: true, force: true }); }
}

function runPlanTests() {
  const fixture = createFixture();
  try {
    for (const args of [["init", "--quiet"], ["config", "user.email", "test@example.com"], ["config", "user.name", "MDF test"]]) spawnSync("git", args, { cwd: fixture.worktree });
    fs.writeFileSync(path.join(fixture.worktree, "tracked.txt"), "x\n"); spawnSync("git", ["add", "tracked.txt"], { cwd: fixture.worktree }); spawnSync("git", ["commit", "--quiet", "-m", "initial"], { cwd: fixture.worktree });
    const context = resolveControllerContext({ cwd: fixture.worktree, pluginRoot: root });
    for (const [file, bytes] of [["spec.md", "spec\n"], ["plan.md", "raw plan without MDF fields\n"], ["plan-2.md", "revision\n"], ["plan-stale.md", "before\n"], ["review.md", "pass\n"], ["extra.md", "extra context\n"], ["user.md", "yes\n"], ["cap.json", "{}\n"]]) fs.writeFileSync(path.join(context.work_item.path, file), bytes);
    const reviewFor = (artifact, id, extraInputs = []) => {
      const action = issueAction(context, { action_id: id, action: "ddd-review", skill_path: "skills/doubt-driven-development/SKILL.md", persona_path: "agents/code-reviewer.md", input_paths: [artifact, ...extraInputs] });
      const invocation = { agent_id: "reviewer", invocation_id: `${id}-inv`, executor: "subagent", model_capability: "independent-review-capable", freshness: "fresh", capability: { persona_loaded: true, reasoning_capable: true, model_suitable: true, fresh_context: true, source: "runtime-verified" } };
      const capability = issueCapability(context, { ...invocation, persona_path: "agents/code-reviewer.md", evidence_path: "cap.json" });
      const prepared = prepareAdapter(context, { action_file: action.action_file, capability_file: capability.capability_file, invocation });
      return submitOutcome(context, { action_id: id, interaction_file: prepared.interaction_file, output_path: "review.md", outcome: { disposition: "pass" } }).decision_file;
    };
    const specReg = registerSpec(context, { artifact_path: "spec.md", review_output_path: "review.md", review_decision_file: reviewFor("spec.md", "spec-review"), mode: "auto" });
    setLatest(context, "spec", "spec.md");
    const specApproval = approveSpec(context, { registration_file: specReg.registration_file, user_message_path: "user.md", invocation_id: "spec-user", affirmative: true });
    advanceSpec(context, { registration_file: specReg.registration_file, approval_file: specApproval.approval_file });
    const matrix = { whole_build_commands: [[process.execPath, "-e", "process.exit(0)"]] };
    expectCode(() => createPlanMetadata(context, { artifact_path: "plan.md", spec_registration_file: specReg.registration_file, metadata: { tasks: [{ id: "T1", depends_on: [], owned_paths: ["src/a.js"], acceptance: ["a"] }], whole_build_commands: [] } }), "MDF_PLAN_METADATA_INVALID");
    const metadata = { ...matrix, tasks: [{ id: "T1", depends_on: [], owned_paths: ["src/a.js"], acceptance: ["works"] }, { id: "T2", depends_on: ["T1"], owned_paths: ["src/b.js"], acceptance: ["integrates"] }] };
    const before = fs.readFileSync(path.join(context.work_item.path, "plan.md"));
    expectCode(() => createPlanMetadata(context, { artifact_path: "plan.md", spec_registration_file: specReg.registration_file, metadata: { ...matrix, tasks: [{ id: "T1", depends_on: [], owned_paths: [], acceptance: ["a"] }, { id: "T1", depends_on: [], owned_paths: [], acceptance: ["b"] }] } }), "MDF_PLAN_TASK_IDS_INVALID");
    expectCode(() => createPlanMetadata(context, { artifact_path: "plan.md", spec_registration_file: specReg.registration_file, metadata: { ...matrix, tasks: [{ id: "T1", depends_on: ["missing"], owned_paths: [], acceptance: ["a"] }] } }), "MDF_PLAN_TASK_MAPPING_INVALID");
    expectCode(() => createPlanMetadata(context, { artifact_path: "plan.md", spec_registration_file: specReg.registration_file, metadata: { ...matrix, tasks: [{ id: "T1", depends_on: [], owned_paths: ["../escape"], acceptance: ["a"] }] } }), "MDF_PLAN_TASK_MAPPING_INVALID");
    expectCode(() => createPlanMetadata(context, { artifact_path: "plan.md", spec_registration_file: specReg.registration_file, metadata: { ...matrix, tasks: [{ id: "T1", depends_on: [], owned_paths: [], acceptance: ["a"] }] } }), "MDF_PLAN_TASK_MAPPING_INVALID");
    for (const alias of ["src/", "src\\a.js"]) expectCode(() => createPlanMetadata(context, { artifact_path: "plan.md", spec_registration_file: specReg.registration_file, metadata: { ...matrix, tasks: [{ id: "T1", depends_on: [], owned_paths: [alias], acceptance: ["a"] }] } }), "MDF_PLAN_TASK_MAPPING_INVALID");
    expectCode(() => createPlanMetadata(context, { artifact_path: "plan.md", spec_registration_file: specReg.registration_file, metadata: { ...matrix, tasks: [{ id: "T1", depends_on: [], owned_paths: ["src/a.js"], acceptance: ["a"] }, { id: "T2", depends_on: [], owned_paths: ["src/a.js"], acceptance: ["b"] }] } }), "MDF_PLAN_TASK_MAPPING_INVALID");
    const metadataFile = createPlanMetadata(context, { artifact_path: "plan.md", spec_registration_file: specReg.registration_file, metadata }).metadata_file;
    const review = reviewFor("plan.md", "plan-review", [`evidence/${specReg.registration_file}`, `evidence/${metadataFile}`]);
    const extraReview = reviewFor("plan.md", "plan-extra-review", [`evidence/${specReg.registration_file}`, `evidence/${metadataFile}`, "extra.md"]);
    expectCode(() => registerPlan(context, { artifact_path: "plan.md", spec_registration_file: specReg.registration_file, metadata_file: metadataFile, review_output_path: "review.md", review_decision_file: extraReview, mode: "standalone" }), "MDF_PLAN_REVIEW_INVALID");
    const standalone = registerPlan(context, { artifact_path: "plan.md", spec_registration_file: specReg.registration_file, metadata_file: metadataFile, review_output_path: "review.md", review_decision_file: review, mode: "standalone" });
    assert.deepStrictEqual(fs.readFileSync(path.join(context.work_item.path, "plan.md")), before);
    assert.strictEqual(advancePlan(context, { registration_file: standalone.registration_file }).action, "stop");
    const auto = registerPlan(context, { artifact_path: "plan.md", spec_registration_file: specReg.registration_file, metadata_file: metadataFile, review_output_path: "review.md", review_decision_file: review, mode: "auto" });
    assert.strictEqual(advancePlan(context, { registration_file: auto.registration_file }).stop.code, "MDF_PLAN_APPROVAL_REQUIRED");
    expectCode(() => approvePlan(context, { registration_file: auto.registration_file, user_message_path: "user.md", invocation_id: "plan-no", affirmative: false }), "MDF_PLAN_APPROVAL_NOT_AFFIRMATIVE");
    expectCode(() => approvePlan(context, { registration_file: auto.registration_file, user_message_path: "user.md", invocation_id: "plan-missing-pointer", affirmative: true }), "MDF_PLAN_LATEST_POINTER_INVALID");
    setLatest(context, "plan", "plan.md");
    const approval = approvePlan(context, { registration_file: auto.registration_file, user_message_path: "user.md", invocation_id: "plan-user", affirmative: true });
    const revisionMetadata = createPlanMetadata(context, { artifact_path: "plan-2.md", spec_registration_file: specReg.registration_file, metadata }).metadata_file;
    const revision = registerPlan(context, { artifact_path: "plan-2.md", spec_registration_file: specReg.registration_file, metadata_file: revisionMetadata, review_output_path: "review.md", review_decision_file: reviewFor("plan-2.md", "plan-2-review", [`evidence/${specReg.registration_file}`, `evidence/${revisionMetadata}`]), mode: "auto" });
    expectCode(() => advancePlan(context, { registration_file: revision.registration_file, approval_file: approval.approval_file }), "MDF_PLAN_APPROVAL_INVALID");
    setLatest(context, "plan", "plan-2.md");
    expectCode(() => advancePlan(context, { registration_file: auto.registration_file, approval_file: approval.approval_file }), "MDF_EVIDENCE_STALE");
    setLatest(context, "plan", "plan.md");
    const staleMetadata = createPlanMetadata(context, { artifact_path: "plan-stale.md", spec_registration_file: specReg.registration_file, metadata }).metadata_file;
    const stale = registerPlan(context, { artifact_path: "plan-stale.md", spec_registration_file: specReg.registration_file, metadata_file: staleMetadata, review_output_path: "review.md", review_decision_file: reviewFor("plan-stale.md", "plan-stale-review", [`evidence/${specReg.registration_file}`, `evidence/${staleMetadata}`]), mode: "auto" });
    fs.writeFileSync(path.join(context.work_item.path, "plan-stale.md"), "after\n");
    expectCode(() => approvePlan(context, { registration_file: stale.registration_file, user_message_path: "user.md", invocation_id: "stale-user", affirmative: true }), "MDF_EVIDENCE_STALE");
    const cli = spawnSync(process.execPath, [cliPath, "plan", "register", "--cwd", fixture.worktree, "--plugin-root", root], { encoding: "utf8", input: JSON.stringify({ artifact_path: "plan.md", spec_registration_file: specReg.registration_file, metadata_file: metadataFile, review_output_path: "review.md", review_decision_file: review, mode: "standalone" }) });
    assert.strictEqual(cli.status, 0, cli.stderr);
    assert.strictEqual(advancePlan(context, { registration_file: auto.registration_file, approval_file: approval.approval_file }).state.phase, "build-task");
  } finally { fs.rmSync(fixture.temporaryRoot, { recursive: true, force: true }); }
}

function runBuildTaskTests() {
  const fixture = createFixture();
  try {
    const runGit = (args) => { const result = spawnSync("git", args, { cwd: fixture.worktree, encoding: "utf8" }); assert.strictEqual(result.status, 0, result.stderr); return result.stdout.trim(); };
    for (const args of [["init", "--quiet"], ["config", "user.email", "test@example.com"], ["config", "user.name", "MDF test"]]) runGit(args);
    fs.mkdirSync(path.join(fixture.worktree, "src"), { recursive: true });
    fs.writeFileSync(path.join(fixture.worktree, "src", "a.js"), "before\n");
    fs.writeFileSync(path.join(fixture.worktree, "src", "b.js"), "before\n");
    runGit(["add", "src/a.js", "src/b.js"]); runGit(["commit", "--quiet", "-m", "initial"]);
    const context = resolveControllerContext({ cwd: fixture.worktree, pluginRoot: root });
    for (const [file, bytes] of [["spec.md", "spec\n"], ["plan.md", "plan\n"], ["task.md", "acceptance evidence\n"], ["diff.patch", "diff evidence\n"], ["review.md", "approved\n"], ["impact.md", "unaffected\n"], ["cap.json", "{}\n"]]) fs.writeFileSync(path.join(context.work_item.path, file), bytes);
    const specArtifact = recordArtifact(context, "spec.md");
    const specRegistration = recordInteraction(context, { invocation: { agent_id: "mdf-spec", invocation_id: "spec", executor: "deterministic-runtime", artifact_file: specArtifact.file }, input_paths: ["spec.md"] });
    const planArtifact = recordArtifact(context, "plan.md");
    const tasks = [{ id: "T1", depends_on: [], owned_paths: ["src/a.js"], acceptance: ["works"] }, { id: "T2", depends_on: ["T1"], owned_paths: ["src/b.js"], acceptance: ["integrates"] }];
    const planRegistration = recordInteraction(context, { invocation: { agent_id: "mdf-plan", invocation_id: "plan", executor: "deterministic-runtime", artifact_file: planArtifact.file, spec_registration_file: specRegistration.file, metadata: { tasks, whole_build_commands: [[process.execPath, "-e", "process.exit(0)"]] } }, input_paths: ["plan.md", `evidence/${specRegistration.file}`] });
    recordEvent(context, { event_id: "spec-plan", from: "spec", to: "plan", evidence_files: [specRegistration.file] });
    recordEvent(context, { event_id: "plan-build", from: "plan", to: "build-task", evidence_files: [planRegistration.file] });
    const unapprovedPlan = recordInteraction(context, { invocation: { agent_id: "mdf-plan", invocation_id: "unapproved-plan", executor: "deterministic-runtime", artifact_file: planArtifact.file, spec_registration_file: specRegistration.file, metadata: { tasks, whole_build_commands: [[process.execPath, "-e", "process.exit(0)"]] } }, input_paths: ["plan.md", `evidence/${specRegistration.file}`] });
    expectCode(() => selectBuildTask(context, { plan_registration_file: unapprovedPlan.file, writer_id: "root" }), "MDF_BUILD_PLAN_NOT_APPROVED");
    const attempt = selectBuildTask(context, { plan_registration_file: planRegistration.file, writer_id: "root" });
    assert.strictEqual(attempt.task.id, "T1");
    expectCode(() => selectBuildTask(context, { plan_registration_file: planRegistration.file, writer_id: "other" }), "MDF_BUILD_MULTI_WRITER");
    fs.writeFileSync(path.join(fixture.worktree, "src", "a.js"), "after\n");
    setOriginHead(context.worktree); const command = runVerification(context, { attempt_file: attempt.attempt_file, command: [process.execPath, "-e", "process.stdout.write('pass\\n')"], output_path: "command.log" });
    fs.writeFileSync(path.join(fixture.worktree, "src", "a.js"), "changed after verification\n");
    expectCode(() => authorizeTaskCommit(context, { attempt_file: attempt.attempt_file, command_files: [command.verification_file], review_output_path: "review.md", review_decision_file: "missing.json", task_evidence_path: "task.md", diff_path: "diff.patch", downstream_impact_file: "missing.json", touched_paths: ["src/a.js"], commit_subject: "feat: complete T1" }), "MDF_EVIDENCE_STALE");
    fs.writeFileSync(path.join(fixture.worktree, "src", "a.js"), "after\n");
    const impact = recordDownstreamImpact(context, { attempt_file: attempt.attempt_file, classification: "unaffected", artifact_path: "impact.md" });
    const reviewInputs = ["spec.md", "plan.md", "task.md", "diff.patch", "impact.md", `evidence/${attempt.attempt_file}`, `evidence/${impact.impact_file}`, "command.log", `evidence/${command.verification_file}`, `evidence/${command.command_file}`];
    const action = issueAction(context, { action_id: "task-review", action: "code-review", skill_path: "skills/code-review-and-quality/SKILL.md", persona_path: "agents/code-reviewer.md", input_paths: reviewInputs });
    const invocation = { agent_id: "reviewer", invocation_id: "task-review-inv", executor: "subagent", model_capability: "independent-review-capable", freshness: "fresh", capability: { persona_loaded: true, reasoning_capable: true, model_suitable: true, fresh_context: true, source: "runtime-verified" } };
    const capability = issueCapability(context, { ...invocation, persona_path: "agents/code-reviewer.md", evidence_path: "cap.json" });
    const prepared = prepareAdapter(context, { action_file: action.action_file, capability_file: capability.capability_file, invocation });
    const review = submitOutcome(context, { action_id: "task-review", interaction_file: prepared.interaction_file, output_path: "review.md", outcome: { disposition: "pass" } });
    const request = { attempt_file: attempt.attempt_file, command_files: [command.verification_file], review_output_path: "review.md", review_decision_file: review.decision_file, task_evidence_path: "task.md", diff_path: "diff.patch", downstream_impact_file: impact.impact_file, touched_paths: ["src/a.js"], commit_subject: "feat: complete T1" };
    expectCode(() => authorizeTaskCommit(context, { ...request, command_files: [] }), "MDF_BUILD_EVIDENCE_MISSING");
    fs.writeFileSync(path.join(context.work_item.path, "command.log"), "stale\n");
    expectCode(() => authorizeTaskCommit(context, request), "MDF_EVIDENCE_STALE");
    fs.writeFileSync(path.join(context.work_item.path, "command.log"), "pass\n");
    const authorization = authorizeTaskCommit(context, request);
    fs.writeFileSync(path.join(fixture.worktree, "src", "a.js"), "tampered after review\n");
    runGit(["add", "--", "src/a.js"]); runGit(["commit", "--quiet", "-m", "feat: complete T1"]);
    expectCode(() => completeBuildTask(context, { authorization_file: authorization.authorization_file }), "MDF_BUILD_COMMIT_MISMATCH");
    fs.writeFileSync(path.join(fixture.worktree, "src", "a.js"), "after\n");
    runGit(["add", "--", "src/a.js"]); runGit(["commit", "--quiet", "--amend", "--no-edit"]);
    const completed = completeBuildTask(context, { authorization_file: authorization.authorization_file });
    assert.strictEqual(completed.state.phase, "build-task");
    expectCode(() => completeBuildTask(context, { authorization_file: authorization.authorization_file }), "MDF_BUILD_TASK_DUPLICATE");
    const orphanInteraction = recordInteraction(context, { invocation: { agent_id: "mdf-build-task-complete", invocation_id: "orphan-T2", executor: "deterministic-runtime", plan_registration_file: planRegistration.file, task_id: "T2" }, input_paths: [`evidence/${planRegistration.file}`] });
    recordDecision(context, { interaction_file: orphanInteraction.file, conclusion: { kind: "build-task-complete", plan_registration_file: planRegistration.file, task_id: "T2" } });
    const selected = spawnSync(process.execPath, [cliPath, "build-task", "select", "--cwd", fixture.worktree, "--plugin-root", root], { encoding: "utf8", input: JSON.stringify({ plan_registration_file: planRegistration.file, writer_id: "root" }) });
    assert.strictEqual(selected.status, 0, selected.stderr);
    const next = JSON.parse(selected.stdout).build_task;
    assert.strictEqual(next.task.id, "T2");
    fs.writeFileSync(path.join(fixture.worktree, "outside.js"), "unrelated\n");
    expectCode(() => authorizeTaskCommit(context, { ...request, attempt_file: next.attempt_file, touched_paths: ["src/b.js"] }), "MDF_BUILD_PATH_SCOPE");
  } finally { fs.rmSync(fixture.temporaryRoot, { recursive: true, force: true }); }
}

function runWholeBuildTests() {
  const fixture = createFixture();
  try {
    const runGit = (args) => { const result = spawnSync("git", args, { cwd: fixture.worktree, encoding: "utf8" }); assert.strictEqual(result.status, 0, result.stderr); return result.stdout.trim(); };
    for (const args of [["init", "--quiet"], ["config", "user.email", "test@example.com"], ["config", "user.name", "MDF test"]]) runGit(args);
    fs.mkdirSync(path.join(fixture.worktree, "src"), { recursive: true });
    fs.writeFileSync(path.join(fixture.worktree, "src", "a.js"), "0\n"); fs.writeFileSync(path.join(fixture.worktree, "src", "b.js"), "0\n");
    runGit(["add", "src/a.js", "src/b.js"]); runGit(["commit", "--quiet", "-m", "initial"]);
    const context = resolveControllerContext({ cwd: fixture.worktree, pluginRoot: root });
    for (const [file, bytes] of [["spec.md", "spec\n"], ["plan.md", "plan\n"], ["trace.md", "whole traceability\n"], ["review.md", "approved\n"], ["cap.json", "{}\n"]]) fs.writeFileSync(path.join(context.work_item.path, file), bytes);
    const specArtifact = recordArtifact(context, "spec.md");
    const specRegistration = recordInteraction(context, { invocation: { agent_id: "mdf-spec", invocation_id: "whole-spec", executor: "deterministic-runtime", artifact_file: specArtifact.file }, input_paths: ["spec.md"] });
    const planArtifact = recordArtifact(context, "plan.md");
    const tasks = [{ id: "T1", depends_on: [], owned_paths: ["src/a.js"], acceptance: ["a"] }, { id: "T2", depends_on: ["T1"], owned_paths: ["src/b.js"], acceptance: ["b"] }];
    const commands = [[process.execPath, "-e", "process.stdout.write('one\\n')"], [process.execPath, "-e", "process.stdout.write('two\\n')"]];
    const planRegistration = recordInteraction(context, { invocation: { agent_id: "mdf-plan", invocation_id: "whole-plan", executor: "deterministic-runtime", artifact_file: planArtifact.file, spec_registration_file: specRegistration.file, metadata: { tasks, whole_build_commands: commands } }, input_paths: ["plan.md", `evidence/${specRegistration.file}`] });
    recordEvent(context, { event_id: "whole-spec-plan", from: "spec", to: "plan", evidence_files: [specRegistration.file] });
    recordEvent(context, { event_id: "whole-plan-build", from: "plan", to: "build-task", evidence_files: [planRegistration.file] });
    const first = resumeAutoBuild(context, { plan_registration_file: planRegistration.file, writer_id: "root" });
    assert.strictEqual(first.task.id, "T1");
    assert.strictEqual(resumeAutoBuild(context, { plan_registration_file: planRegistration.file, writer_id: "root" }).action, "resume-task");
    expectCode(() => resumeAutoBuild(context, { plan_registration_file: planRegistration.file, writer_id: "other" }), "MDF_BUILD_MULTI_WRITER");
    const finish = (taskId, file, attemptFile) => {
      const parent = runGit(["rev-parse", "HEAD"]);
      fs.writeFileSync(path.join(fixture.worktree, file), `${taskId}\n`); runGit(["add", "--", file]); runGit(["commit", "--quiet", "-m", `feat: ${taskId}`]);
      const head = runGit(["rev-parse", "HEAD"]); const tree = runGit(["show", "-s", "--format=%T", head]);
      const commit = { head, parent, tree, subject: `feat: ${taskId}`, paths: [file] };
      const authorizationInteraction = recordInteraction(context, { invocation: { agent_id: "mdf-build-commit-authorization", invocation_id: `whole-auth-${taskId}`, executor: "deterministic-runtime", attempt_file: attemptFile, plan_registration_file: planRegistration.file, task_id: taskId, base_head: parent, expected_tree: tree, expected_paths: [file], commit_subject: commit.subject }, input_paths: [`evidence/${attemptFile}`] });
      const authorization = recordDecision(context, { interaction_file: authorizationInteraction.file, conclusion: { kind: "build-task-commit-authorization", attempt_file: attemptFile, task_id: taskId, base_head: parent, expected_tree: tree, expected_paths: [file], commit_subject: commit.subject } });
      const interaction = recordInteraction(context, { invocation: { agent_id: "mdf-build-task-complete", invocation_id: `whole-${taskId}`, executor: "deterministic-runtime", authorization_file: authorization.file, plan_registration_file: planRegistration.file, task_id: taskId, commit }, input_paths: [`evidence/${authorization.file}`] });
      const decision = recordDecision(context, { interaction_file: interaction.file, conclusion: { kind: "build-task-complete", plan_registration_file: planRegistration.file, task_id: taskId, commit } });
      recordEvent(context, { event_id: `whole-event-${taskId}`, from: "build-task", to: "build-task", evidence_files: [decision.file] });
    };
    finish("T1", "src/a.js", first.attempt_file);
    const second = resumeAutoBuild(context, { plan_registration_file: planRegistration.file, writer_id: "root" });
    assert.strictEqual(second.task.id, "T2");
    finish("T2", "src/b.js", second.attempt_file);
    assert.strictEqual(resumeAutoBuild(context, { plan_registration_file: planRegistration.file, writer_id: "root" }).action, "whole-build");
    const baseline = beginWholeBuild(context, { plan_registration_file: planRegistration.file, writer_id: "root" });
    assert.strictEqual(beginWholeBuild(context, { plan_registration_file: planRegistration.file, writer_id: "root" }).resumed, true);
    fs.writeFileSync(path.join(fixture.worktree, "src", "a.js"), "stale\n");
    expectCode(() => runWholeVerification(context, { baseline_file: baseline.baseline_file, index: 0, output_path: "whole-0.log" }), "MDF_EVIDENCE_STALE");
    fs.writeFileSync(path.join(fixture.worktree, "src", "a.js"), "T1\n");
    expectCode(() => runWholeVerification(context, { baseline_file: baseline.baseline_file, index: 1, output_path: "whole-out-of-order.log" }), "MDF_WHOLE_BUILD_MATRIX_ORDER");
    const verification0 = runWholeVerification(context, { baseline_file: baseline.baseline_file, index: 0, output_path: "whole-0.log" });
    expectCode(() => runWholeVerification(context, { baseline_file: baseline.baseline_file, index: 0, output_path: "whole-duplicate.log" }), "MDF_WHOLE_BUILD_MATRIX_DUPLICATE");
    const verification1 = runWholeVerification(context, { baseline_file: baseline.baseline_file, index: 1, output_path: "whole-1.log" });
    expectCode(() => wholeReviewInputs(context, { baseline_file: baseline.baseline_file, verification_files: [verification0.verification_file], traceability_path: "trace.md" }), "MDF_WHOLE_BUILD_MATRIX_INCOMPLETE");
    const verificationFiles = [verification0.verification_file, verification1.verification_file];
    const inputResult = spawnSync(process.execPath, [cliPath, "whole-build", "inputs", "--cwd", fixture.worktree, "--plugin-root", root], { encoding: "utf8", input: JSON.stringify({ baseline_file: baseline.baseline_file, verification_files: verificationFiles, traceability_path: "trace.md" }) });
    assert.strictEqual(inputResult.status, 0, inputResult.stderr);
    const inputs = JSON.parse(inputResult.stdout).whole_build.input_paths;
    const action = issueAction(context, { action_id: "whole-review", action: "code-review", skill_path: "skills/code-review-and-quality/SKILL.md", persona_path: "agents/code-reviewer.md", input_paths: inputs });
    const invocation = { agent_id: "reviewer", invocation_id: "whole-review-inv", executor: "subagent", model_capability: "independent-review-capable", freshness: "fresh", capability: { persona_loaded: true, reasoning_capable: true, model_suitable: true, fresh_context: true, source: "runtime-verified" } };
    const capability = issueCapability(context, { ...invocation, persona_path: "agents/code-reviewer.md", evidence_path: "cap.json" });
    const prepared = prepareAdapter(context, { action_file: action.action_file, capability_file: capability.capability_file, invocation });
    const review = submitOutcome(context, { action_id: "whole-review", interaction_file: prepared.interaction_file, output_path: "review.md", outcome: { disposition: "pass" } });
    fs.writeFileSync(path.join(context.work_item.path, "review.md"), "stale\n");
    expectCode(() => finalizeWholeBuild(context, { baseline_file: baseline.baseline_file, verification_files: verificationFiles, traceability_path: "trace.md", review_output_path: "review.md", review_decision_file: review.decision_file }), "MDF_EVIDENCE_STALE");
    fs.writeFileSync(path.join(context.work_item.path, "review.md"), "approved\n");
    const stable = finalizeWholeBuild(context, { baseline_file: baseline.baseline_file, verification_files: verificationFiles, traceability_path: "trace.md", review_output_path: "review.md", review_decision_file: review.decision_file });
    assert.strictEqual(stable.state.phase, "whole-build");
  } finally { fs.rmSync(fixture.temporaryRoot, { recursive: true, force: true }); }
}

function runRecoveryTests() {
  const safe = { reproducible: true, intent_unchanged: true, reversible: true, bounded_scope: true, no_human_decision: true, ambiguous: false, high_risk: false, irreversible: false, external: false };
  for (const change of [{ reproducible: false }, { intent_unchanged: false }, { reversible: false }, { bounded_scope: false }, { no_human_decision: false }, { ambiguous: true }, { high_risk: true }, { irreversible: true }, { external: true }]) assert.strictEqual(recoveryDisposition({ ...safe, ...change }), "human-required");
  assert.strictEqual(recoveryDisposition(safe), "automatic-repair");
  const setup = (outcome) => {
    const fixture = createFixture();
    for (const args of [["init", "--quiet"], ["config", "user.email", "test@example.com"], ["config", "user.name", "MDF test"]]) spawnSync("git", args, { cwd: fixture.worktree });
    fs.writeFileSync(path.join(fixture.worktree, "src.js"), "x\n"); fs.writeFileSync(path.join(fixture.worktree, "extra.js"), "x\n"); spawnSync("git", ["add", "src.js", "extra.js"], { cwd: fixture.worktree }); spawnSync("git", ["commit", "--quiet", "-m", "initial"], { cwd: fixture.worktree });
    const context = resolveControllerContext({ cwd: fixture.worktree, pluginRoot: root });
    for (const [file, bytes] of [["seed.md", "seed\n"], ["plan.md", "plan\n"], ["failure.log", "failed\n"], ["diagnosis.md", "diagnosis\n"], ["cap.json", "{}\n"]]) fs.writeFileSync(path.join(context.work_item.path, file), bytes);
    const seedArtifact = recordArtifact(context, "seed.md");
    const seed = recordInteraction(context, { invocation: { agent_id: "mdf-spec", invocation_id: "seed", executor: "deterministic-runtime", artifact_file: seedArtifact.file }, input_paths: ["seed.md"] });
    recordEvent(context, { event_id: "recovery-spec-plan", from: "spec", to: "plan", evidence_files: [seed.file] });
    const planArtifact = recordArtifact(context, "plan.md");
    const task = { id: "T1", depends_on: [], owned_paths: ["src.js", "extra.js"], acceptance: ["repair"] };
    const planRegistration = recordInteraction(context, { invocation: { agent_id: "mdf-plan", invocation_id: "recovery-plan", executor: "deterministic-runtime", artifact_file: planArtifact.file, spec_registration_file: seed.file, metadata: { tasks: [task], whole_build_commands: [[process.execPath, "-e", "process.exit(0)"]] } }, input_paths: ["plan.md", `evidence/${seed.file}`] });
    recordEvent(context, { event_id: "recovery-plan-build", from: "plan", to: "build-task", evidence_files: [planRegistration.file] });
    const attempt = recordInteraction(context, { invocation: { agent_id: "mdf-build-task-select", invocation_id: "recovery-attempt", executor: "deterministic-runtime", writer_id: "root", plan_registration_file: planRegistration.file, task, base_head: spawnSync("git", ["rev-parse", "HEAD"], { cwd: fixture.worktree, encoding: "utf8" }).stdout.trim() }, input_paths: [`evidence/${planRegistration.file}`] });
    fs.writeFileSync(path.join(fixture.worktree, "src.js"), "failing change\n");
    const failure = recordCommand(context, { command: ["node", "test.js"], output_path: "failure.log", exit_code: 1 });
    const inputs = [`evidence/${failure.file}`, `evidence/${attempt.file}`].sort();
    const action = issueAction(context, { action_id: `recovery-${outcome.disposition}`, action: "debug-recovery", skill_path: "skills/debugging-and-error-recovery/SKILL.md", persona_path: "agents/test-engineer.md", input_paths: inputs });
    const invocation = { agent_id: "diagnoser", invocation_id: `diagnose-${outcome.disposition}`, executor: "subagent", model_capability: "reasoning-capable", freshness: "fresh", capability: { persona_loaded: true, reasoning_capable: true, model_suitable: true, fresh_context: true, source: "runtime-verified" } };
    const capability = issueCapability(context, { ...invocation, persona_path: "agents/test-engineer.md", evidence_path: "cap.json" });
    const prepared = prepareAdapter(context, { action_file: action.action_file, capability_file: capability.capability_file, invocation });
    const diagnosis = submitOutcome(context, { action_id: `recovery-${outcome.disposition}`, interaction_file: prepared.interaction_file, output_path: "diagnosis.md", outcome });
    return { fixture, context, plan_registration_file: planRegistration.file, request: { failure_files: [failure.file], reproduction_file: failure.file, diagnosis_output_path: "diagnosis.md", diagnosis_decision_file: diagnosis.decision_file, attempt_file: attempt.file } };
  };
  const automatic = setup({ disposition: "automatic-repair", judgment: safe, repair_scope_paths: ["src.js"] });
  try {
    const recovery = decideRecovery(automatic.context, automatic.request);
    assert.strictEqual(recovery.action, "repair-task");
    assert.strictEqual(selectRepairTask(automatic.context, { recovery_file: recovery.recovery_file, writer_id: "root" }).repair_of, recovery.recovery_file);
    fs.writeFileSync(path.join(automatic.context.work_item.path, "failure-2.log"), "failed\n");
    const repeatedFailure = recordCommand(automatic.context, { command: ["node", "test.js"], output_path: "failure-2.log", exit_code: 1 });
    const repeatedInputs = [`evidence/${repeatedFailure.file}`, `evidence/${automatic.request.attempt_file}`].sort();
    const repeatedAction = issueAction(automatic.context, { action_id: "recovery-repeat", action: "debug-recovery", skill_path: "skills/debugging-and-error-recovery/SKILL.md", persona_path: "agents/test-engineer.md", input_paths: repeatedInputs });
    const repeatedInvocation = { agent_id: "diagnoser", invocation_id: "diagnose-repeat", executor: "subagent", model_capability: "reasoning-capable", freshness: "fresh", capability: { persona_loaded: true, reasoning_capable: true, model_suitable: true, fresh_context: true, source: "runtime-verified" } };
    const repeatedCapability = issueCapability(automatic.context, { ...repeatedInvocation, persona_path: "agents/test-engineer.md", evidence_path: "cap.json" });
    const repeatedPrepared = prepareAdapter(automatic.context, { action_file: repeatedAction.action_file, capability_file: repeatedCapability.capability_file, invocation: repeatedInvocation });
    const repeatedDiagnosis = submitOutcome(automatic.context, { action_id: "recovery-repeat", interaction_file: repeatedPrepared.interaction_file, output_path: "diagnosis.md", outcome: { disposition: "automatic-repair", judgment: safe, repair_scope_paths: ["src.js"] } });
    const repeated = decideRecovery(automatic.context, { failure_files: [repeatedFailure.file], reproduction_file: repeatedFailure.file, diagnosis_output_path: "diagnosis.md", diagnosis_decision_file: repeatedDiagnosis.decision_file, attempt_file: automatic.request.attempt_file });
    assert.strictEqual(repeated.action, "stop"); assert.strictEqual(repeated.stop.code, "MDF_STOP_NO_PROGRESS");
  } finally { fs.rmSync(automatic.fixture.temporaryRoot, { recursive: true, force: true }); }
  const repairFlow = setup({ disposition: "automatic-repair", judgment: safe, repair_scope_paths: ["src.js"] });
  try {
    const recovery = decideRecovery(repairFlow.context, repairFlow.request);
    const repair = selectRepairTask(repairFlow.context, { recovery_file: recovery.recovery_file, writer_id: "root" });
    for (const [file, bytes] of [["repair-task.md", "repair acceptance\n"], ["repair.diff", "repair diff\n"], ["repair-impact.md", "unaffected\n"], ["repair-review.md", "pass\n"], ["repair-cap.json", "{}\n"]]) fs.writeFileSync(path.join(repairFlow.context.work_item.path, file), bytes);
    fs.writeFileSync(path.join(repairFlow.fixture.worktree, "src.js"), "fixed\n");
    setOriginHead(repairFlow.context.worktree); const command = runVerification(repairFlow.context, { attempt_file: repair.attempt_file, command: [process.execPath, "-e", "process.stdout.write('pass\\n')"], output_path: "repair-command.log" });
    const impact = recordDownstreamImpact(repairFlow.context, { attempt_file: repair.attempt_file, classification: "unaffected", artifact_path: "repair-impact.md" });
    const inputs = ["seed.md", "plan.md", "repair-task.md", "repair.diff", "repair-impact.md", `evidence/${repair.attempt_file}`, `evidence/${impact.impact_file}`, "repair-command.log", `evidence/${command.verification_file}`, `evidence/${command.command_file}`];
    const action = issueAction(repairFlow.context, { action_id: "repair-review", action: "code-review", skill_path: "skills/code-review-and-quality/SKILL.md", persona_path: "agents/code-reviewer.md", input_paths: inputs });
    const invocation = { agent_id: "repair-reviewer", invocation_id: "repair-review-inv", executor: "subagent", model_capability: "independent-review-capable", freshness: "fresh", capability: { persona_loaded: true, reasoning_capable: true, model_suitable: true, fresh_context: true, source: "runtime-verified" } };
    const capability = issueCapability(repairFlow.context, { ...invocation, persona_path: "agents/code-reviewer.md", evidence_path: "repair-cap.json" });
    const prepared = prepareAdapter(repairFlow.context, { action_file: action.action_file, capability_file: capability.capability_file, invocation });
    const review = submitOutcome(repairFlow.context, { action_id: "repair-review", interaction_file: prepared.interaction_file, output_path: "repair-review.md", outcome: { disposition: "pass" } });
    const authorizationRequest = { attempt_file: repair.attempt_file, command_files: [command.verification_file], review_output_path: "repair-review.md", review_decision_file: review.decision_file, task_evidence_path: "repair-task.md", diff_path: "repair.diff", downstream_impact_file: impact.impact_file, touched_paths: ["src.js"], commit_subject: "fix: repair T1" };
    fs.writeFileSync(path.join(repairFlow.fixture.worktree, "extra.js"), "scope escape\n");
    expectCode(() => authorizeTaskCommit(repairFlow.context, authorizationRequest), "MDF_BUILD_PATH_SCOPE");
    fs.writeFileSync(path.join(repairFlow.fixture.worktree, "extra.js"), "x\n");
    const authorization = authorizeTaskCommit(repairFlow.context, authorizationRequest);
    spawnSync("git", ["add", "--", "src.js"], { cwd: repairFlow.fixture.worktree }); spawnSync("git", ["commit", "--quiet", "-m", "fix: repair T1"], { cwd: repairFlow.fixture.worktree });
    assert.strictEqual(completeBuildTask(repairFlow.context, { authorization_file: authorization.authorization_file }).state.phase, "build-task");
    assert.strictEqual(resumeAutoBuild(repairFlow.context, { plan_registration_file: repairFlow.plan_registration_file, writer_id: "root" }).action, "whole-build");
  } finally { fs.rmSync(repairFlow.fixture.temporaryRoot, { recursive: true, force: true }); }
  const human = setup({ disposition: "automatic-repair", judgment: { ...safe, ambiguous: true }, repair_scope_paths: ["src.js"] });
  try { const result = decideRecovery(human.context, human.request); assert.strictEqual(result.stop.code, "MDF_STOP_HUMAN_REQUIRED"); } finally { fs.rmSync(human.fixture.temporaryRoot, { recursive: true, force: true }); }
  const revision = setup({ disposition: "technical-revision", judgment: safe });
  try {
    const cli = spawnSync(process.execPath, [cliPath, "recovery", "--cwd", revision.fixture.worktree, "--plugin-root", root], { encoding: "utf8", input: JSON.stringify(revision.request) });
    assert.strictEqual(cli.status, 0, cli.stderr); assert.strictEqual(JSON.parse(cli.stdout).recovery.action, "technical-revision");
  } finally { fs.rmSync(revision.fixture.temporaryRoot, { recursive: true, force: true }); }

  const whole = (() => {
    const fixture = createFixture();
    for (const args of [["init", "--quiet"], ["config", "user.email", "test@example.com"], ["config", "user.name", "MDF test"]]) spawnSync("git", args, { cwd: fixture.worktree });
    fs.writeFileSync(path.join(fixture.worktree, "src.js"), "broken\n"); spawnSync("git", ["add", "."], { cwd: fixture.worktree }); spawnSync("git", ["commit", "--quiet", "-m", "feat: broken"], { cwd: fixture.worktree });
    const context = resolveControllerContext({ cwd: fixture.worktree, pluginRoot: root });
    for (const [file, bytes] of [["spec.md", "spec\n"], ["plan.md", "plan\n"], ["repair-plan.md", "repair plan\n"], ["failure.log", "failed\n"], ["diagnosis.md", "diagnosis\n"], ["synthesis.md", "synthesis\n"], ["plan-review.md", "pass\n"], ["cap.json", "{}\n"]]) fs.writeFileSync(path.join(context.work_item.path, file), bytes);
    const specArtifact = recordArtifact(context, "spec.md"); const spec = recordInteraction(context, { invocation: { agent_id: "mdf-spec", invocation_id: "whole-recovery-spec", executor: "deterministic-runtime", artifact_file: specArtifact.file }, input_paths: ["spec.md"] }); recordEvent(context, { event_id: "whole-recovery-plan", from: "spec", to: "plan", evidence_files: [spec.file] });
    const originalTask = { id: "T1", depends_on: [], owned_paths: ["src.js"], acceptance: ["works"] }; const planArtifact = recordArtifact(context, "plan.md"); const plan = recordInteraction(context, { invocation: { agent_id: "mdf-plan", invocation_id: "whole-recovery-plan", executor: "deterministic-runtime", artifact_file: planArtifact.file, spec_registration_file: spec.file, metadata: { tasks: [originalTask], whole_build_commands: [[process.execPath, "-e", "process.exit(0)"]] } }, input_paths: ["plan.md", `evidence/${spec.file}`] }); recordEvent(context, { event_id: "whole-recovery-build", from: "plan", to: "build-task", evidence_files: [plan.file] });
    const head = spawnSync("git", ["rev-parse", "HEAD"], { cwd: fixture.worktree, encoding: "utf8" }).stdout.trim(); const baseline = recordInteraction(context, { invocation: { agent_id: "mdf-whole-build", invocation_id: "whole-recovery-baseline", executor: "deterministic-runtime", plan_registration_file: plan.file, head, completion_files: [] }, input_paths: [`evidence/${plan.file}`] }); const failure = recordCommand(context, { command: ["node", "test.js"], output_path: "failure.log", exit_code: 1 });
    const diagnosisInputs = [`evidence/${baseline.file}`, `evidence/${failure.file}`].sort(); const diagnosisAction = issueAction(context, { action_id: "whole-recovery-diagnosis", action: "debug-recovery", skill_path: "skills/debugging-and-error-recovery/SKILL.md", persona_path: "agents/test-engineer.md", input_paths: diagnosisInputs }); const reviewer = { agent_id: "diagnoser", invocation_id: "whole-diagnoser", executor: "subagent", model_capability: "reasoning-capable", freshness: "fresh", capability: { persona_loaded: true, reasoning_capable: true, model_suitable: true, fresh_context: true, source: "runtime-verified" } }; const reviewerCap = issueCapability(context, { ...reviewer, persona_path: "agents/test-engineer.md", evidence_path: "cap.json" }); const diagnosisPrepared = prepareAdapter(context, { action_file: diagnosisAction.action_file, capability_file: reviewerCap.capability_file, invocation: reviewer }); const diagnosis = submitOutcome(context, { action_id: "whole-recovery-diagnosis", interaction_file: diagnosisPrepared.interaction_file, output_path: "diagnosis.md", outcome: { finding: "implementation mismatch" } });
    const synthesisInputs = [...diagnosisInputs, "diagnosis.md", `evidence/${diagnosis.decision_file}`].sort(); const synthesisAction = issueAction(context, { action_id: "whole-recovery-synthesis", action: "recovery-synthesis", skill_path: "skills/debugging-and-error-recovery/SKILL.md", persona_path: "agents/code-reviewer.md", input_paths: synthesisInputs }); const rootInvocation = { agent_id: "root", invocation_id: "whole-root", executor: "root", model_capability: "root-reasoning", freshness: "root-fallback", capability: { persona_loaded: true, reasoning_capable: true, model_suitable: true, fresh_context: false, source: "root-observed" }, fallback: { source: "runtime-limited", reason: "root owns recovery synthesis" } }; const rootCap = issueCapability(context, { ...rootInvocation, persona_path: "agents/code-reviewer.md", evidence_path: "cap.json" }); const synthesisPrepared = prepareAdapter(context, { action_file: synthesisAction.action_file, capability_file: rootCap.capability_file, invocation: rootInvocation });
    const repairTask = { id: "R1", depends_on: ["T1"], repair_of: ["T1"], owned_paths: ["src.js"], acceptance: ["reproduced failure passes", "ordinary task gates pass"] }; const synthesis = submitOutcome(context, { action_id: "whole-recovery-synthesis", interaction_file: synthesisPrepared.interaction_file, output_path: "synthesis.md", outcome: { classification: "implementation", defect_kind: "acceptance", root_cause_id: "implementation-violates-T1-acceptance", rationale: "Spec and plan remain valid; implementation violates acceptance.", rejected_findings: [], material_progress: true, spec_intent_preserved: true, requires_user_decision: false, repair_tasks: [repairTask] } });
    return { fixture, context, spec, plan, baseline, failure, diagnosis, synthesis, originalTask, repairTask };
  })();
  try {
    const request = { baseline_file: whole.baseline.file, failure_files: [whole.failure.file], validation_file: whole.failure.file, diagnosis_output_path: "diagnosis.md", diagnosis_decision_file: whole.diagnosis.decision_file, synthesis_output_path: "synthesis.md", synthesis_decision_file: whole.synthesis.decision_file };
    fs.writeFileSync(path.join(whole.fixture.worktree, "src.js"), "different tree\n"); const stale = spawnSync(process.execPath, [cliPath, "recovery", "whole-build", "--cwd", whole.fixture.worktree, "--plugin-root", root], { encoding: "utf8", input: JSON.stringify(request) }); assert.strictEqual(JSON.parse(stale.stderr).error.code, "MDF_EVIDENCE_STALE"); fs.writeFileSync(path.join(whole.fixture.worktree, "src.js"), "broken\n");
    const recoveryCli = spawnSync(process.execPath, [cliPath, "recovery", "whole-build", "--cwd", whole.fixture.worktree, "--plugin-root", root], { encoding: "utf8", input: JSON.stringify(request) }); assert.strictEqual(recoveryCli.status, 0, recoveryCli.stderr); const recovery = JSON.parse(recoveryCli.stdout).recovery; assert.strictEqual(recovery.action, "repair-plan");
    const metadata = createPlanMetadata(whole.context, { artifact_path: "repair-plan.md", spec_registration_file: whole.spec.file, metadata: { tasks: [whole.originalTask, whole.repairTask], whole_build_commands: [[process.execPath, "-e", "process.exit(0)"]] } });
    const reviewInputs = ["repair-plan.md", `evidence/${recovery.recovery_file}`, `evidence/${whole.plan.file}`, `evidence/${metadata.metadata_file}`].sort(); const action = issueAction(whole.context, { action_id: "repair-plan-review", action: "ddd-review", skill_path: "skills/doubt-driven-development/SKILL.md", persona_path: "agents/code-reviewer.md", input_paths: reviewInputs }); const invocation = { agent_id: "repair-plan-reviewer", invocation_id: "repair-plan-reviewer", executor: "subagent", model_capability: "reasoning-capable", freshness: "fresh", capability: { persona_loaded: true, reasoning_capable: true, model_suitable: true, fresh_context: true, source: "runtime-verified" } }; const capability = issueCapability(whole.context, { ...invocation, persona_path: "agents/code-reviewer.md", evidence_path: "cap.json" }); const prepared = prepareAdapter(whole.context, { action_file: action.action_file, capability_file: capability.capability_file, invocation }); const review = submitOutcome(whole.context, { action_id: "repair-plan-review", interaction_file: prepared.interaction_file, output_path: "plan-review.md", outcome: { disposition: "pass" } });
    const registered = registerRepairPlan(whole.context, { recovery_file: recovery.recovery_file, artifact_path: "repair-plan.md", metadata_file: metadata.metadata_file, review_output_path: "plan-review.md", review_decision_file: review.decision_file }); assert.deepStrictEqual(registered.repair_task_ids, ["R1"]); assert.strictEqual(registered.state.phase, "build-task");
    const repeated = decideWholeBuildRecovery(whole.context, request); assert.strictEqual(repeated.stop.code, "MDF_STOP_NO_PROGRESS");
  } finally { fs.rmSync(whole.fixture.temporaryRoot, { recursive: true, force: true }); }
}

function runTechnicalRevisionTests() {
  const setup = (revisionOutcome) => {
    const fixture = createFixture();
    for (const args of [["init", "--quiet"], ["config", "user.email", "test@example.com"], ["config", "user.name", "MDF test"]]) spawnSync("git", args, { cwd: fixture.worktree });
    fs.writeFileSync(path.join(fixture.worktree, "src.js"), "x\n"); spawnSync("git", ["add", "src.js"], { cwd: fixture.worktree }); spawnSync("git", ["commit", "--quiet", "-m", "initial"], { cwd: fixture.worktree }); spawnSync("git", ["branch", "-m", "codex/task-0032"], { cwd: fixture.worktree });
    fs.writeFileSync(path.join(fixture.canonicalRoot, ".mdf", "work", fixture.workId, "item.md"), `---\nkind: task\nwork_id: "${fixture.workId}"\ntask_id: "0032"\ntitle: "Review fixture"\norder: 32\nstatus: active\ncreated: "2026-07-11"\nlatest: {}\nworktree: "${fs.realpathSync(fixture.worktree)}"\nbranch: "codex/task-0032"\n---\n`);
    writeJson(path.join(fixture.canonicalRoot, ".mdf", "locks", "0032.lock"), { task_id: "0032", work_id: fixture.workId, canonical_root: fs.realpathSync(fixture.canonicalRoot), worktree: fs.realpathSync(fixture.worktree), branch: "codex/task-0032", started: "2026-07-11T00:00:00.000Z", runtime: "test" });
    const context = resolveControllerContext({ cwd: fixture.worktree, pluginRoot: root });
    for (const [file, bytes] of [["intent.md", "intent\n"], ["spec-old.md", "old spec\n"], ["spec-new.md", "new technical spec\n"], ["plan.md", "old plan\n"], ["plan-new.md", "new plan\n"], ["revision-review.md", "revision pass\n"], ["spec-review.md", "spec pass\n"], ["plan-review.md", "plan pass\n"], ["user.md", "yes\n"], ["cap.json", "{}\n"]]) fs.writeFileSync(path.join(context.work_item.path, file), bytes);
    const oldArtifact = recordArtifact(context, "spec-old.md");
    const oldSpec = recordInteraction(context, { invocation: { agent_id: "mdf-spec", invocation_id: "old-spec", executor: "deterministic-runtime", artifact_file: oldArtifact.file }, input_paths: ["spec-old.md"] });
    const planArtifact = recordArtifact(context, "plan.md");
    const task = { id: "T1", depends_on: [], owned_paths: ["src.js"], acceptance: ["works"] };
    const plan = recordInteraction(context, { invocation: { agent_id: "mdf-plan", invocation_id: "old-plan", executor: "deterministic-runtime", artifact_file: planArtifact.file, spec_registration_file: oldSpec.file, metadata: { tasks: [task], whole_build_commands: [[process.execPath, "-e", "process.exit(0)"]] } }, input_paths: ["plan.md", `evidence/${oldSpec.file}`] });
    recordEvent(context, { event_id: "revision-spec-plan", from: "spec", to: "plan", evidence_files: [oldSpec.file] });
    recordEvent(context, { event_id: "revision-plan-build", from: "plan", to: "build-task", evidence_files: [plan.file] });
    const attempt = recordInteraction(context, { invocation: { agent_id: "mdf-build-task-select", invocation_id: "revision-attempt", executor: "deterministic-runtime", plan_registration_file: plan.file, task, base_head: spawnSync("git", ["rev-parse", "HEAD"], { cwd: fixture.worktree, encoding: "utf8" }).stdout.trim() }, input_paths: [`evidence/${plan.file}`] });
    const recoveryInteraction = recordInteraction(context, { invocation: { agent_id: "mdf-recovery", invocation_id: "revision-recovery", executor: "deterministic-runtime", attempt_file: attempt.file, disposition: "technical-revision" }, input_paths: [`evidence/${attempt.file}`] });
    const recovery = recordDecision(context, { interaction_file: recoveryInteraction.file, conclusion: { kind: "recovery-decision", attempt_file: attempt.file, plan_registration_file: plan.file, task_id: "T1", disposition: "technical-revision" } });
    const revisionInputs = ["intent.md", "spec-old.md", "spec-new.md", `evidence/${recovery.file}`, `evidence/${oldSpec.file}`];
    const action = issueAction(context, { action_id: "technical-revision", action: "technical-spec-revision", skill_path: "skills/spec-driven-development/SKILL.md", persona_path: "agents/code-reviewer.md", input_paths: revisionInputs });
    const invocation = { agent_id: "revision-reviewer", invocation_id: "technical-revision-inv", executor: "subagent", model_capability: "reasoning-capable", freshness: "fresh", capability: { persona_loaded: true, reasoning_capable: true, model_suitable: true, fresh_context: true, source: "runtime-verified" } };
    const capability = issueCapability(context, { ...invocation, persona_path: "agents/code-reviewer.md", evidence_path: "cap.json" });
    const prepared = prepareAdapter(context, { action_file: action.action_file, capability_file: capability.capability_file, invocation });
    const review = submitOutcome(context, { action_id: "technical-revision", interaction_file: prepared.interaction_file, output_path: "revision-review.md", outcome: revisionOutcome });
    return { fixture, context, oldSpec, plan, recovery, review };
  };
  const passing = setup({ disposition: "pass", intent_preserved: true, external_behavior_changed: false, scope_changed: false, material_tradeoff_changed: false, technical_reason: "runtime constraint" });
  try {
    const revisionRequest = { recovery_file: passing.recovery.file, original_intent_path: "intent.md", prior_spec_registration_file: passing.oldSpec.file, new_spec_path: "spec-new.md", review_output_path: "revision-review.md", review_decision_file: passing.review.decision_file };
    const cli = spawnSync(process.execPath, [cliPath, "technical-revision", "--cwd", passing.fixture.worktree, "--plugin-root", root], { encoding: "utf8", input: JSON.stringify(revisionRequest) });
    assert.strictEqual(cli.status, 0, cli.stderr);
    const revision = JSON.parse(cli.stdout).technical_revision;
    assert.strictEqual(revision.action, "spec");
    const resumed = spawnSync(process.execPath, [cliPath, "lifecycle", "next", "--cwd", passing.fixture.worktree, "--plugin-root", root], { encoding: "utf8" });
    assert.strictEqual(resumed.status, 0, resumed.stderr);
    assert.strictEqual(JSON.parse(resumed.stdout).action, "spec");
    const action = issueAction(passing.context, { action_id: "revised-spec-review", action: "ddd-review", skill_path: "skills/doubt-driven-development/SKILL.md", persona_path: "agents/code-reviewer.md", input_paths: ["spec-new.md"] });
    const invocation = { agent_id: "spec-reviewer", invocation_id: "revised-spec-review-inv", executor: "subagent", model_capability: "reasoning-capable", freshness: "fresh", capability: { persona_loaded: true, reasoning_capable: true, model_suitable: true, fresh_context: true, source: "runtime-verified" } };
    const capability = issueCapability(passing.context, { ...invocation, persona_path: "agents/code-reviewer.md", evidence_path: "cap.json" });
    const prepared = prepareAdapter(passing.context, { action_file: action.action_file, capability_file: capability.capability_file, invocation });
    const review = submitOutcome(passing.context, { action_id: "revised-spec-review", interaction_file: prepared.interaction_file, output_path: "spec-review.md", outcome: { disposition: "pass" } });
    expectCode(() => registerSpec(passing.context, { artifact_path: "spec-old.md", review_output_path: "spec-review.md", review_decision_file: review.decision_file, mode: "auto" }), "MDF_SPEC_REVISION_INVALID");
    fs.writeFileSync(path.join(passing.context.work_item.path, "spec-new.md"), "mutated revision\n");
    expectCode(() => registerSpec(passing.context, { artifact_path: "spec-new.md", review_output_path: "spec-review.md", review_decision_file: review.decision_file, revision_file: revision.revision_file, mode: "auto" }), "MDF_EVIDENCE_STALE");
    fs.writeFileSync(path.join(passing.context.work_item.path, "spec-new.md"), "new technical spec\n");
    const registration = registerSpec(passing.context, { artifact_path: "spec-new.md", review_output_path: "spec-review.md", review_decision_file: review.decision_file, revision_file: revision.revision_file, mode: "auto" });
    setLatest(passing.context, "spec", "spec-new.md");
    advanceSpec(passing.context, { registration_file: registration.registration_file });
    expectCode(() => registerPlan(passing.context, { artifact_path: "plan.md", spec_registration_file: passing.oldSpec.file, metadata_file: "missing.json", review_output_path: "revision-review.md", review_decision_file: passing.review.decision_file, mode: "auto" }), "MDF_PLAN_SPEC_MISMATCH");
    const metadataValue = { tasks: [{ id: "T1", depends_on: [], owned_paths: ["src.js"], acceptance: ["revised"] }], whole_build_commands: [[process.execPath, "-e", "process.exit(0)"]] };
    const metadata = createPlanMetadata(passing.context, { artifact_path: "plan-new.md", spec_registration_file: registration.registration_file, metadata: metadataValue });
    const planAction = issueAction(passing.context, { action_id: "revised-plan-review", action: "ddd-review", skill_path: "skills/doubt-driven-development/SKILL.md", persona_path: "agents/code-reviewer.md", input_paths: ["plan-new.md", `evidence/${registration.registration_file}`, `evidence/${metadata.metadata_file}`] });
    const planInvocation = { agent_id: "plan-reviewer", invocation_id: "revised-plan-review-inv", executor: "subagent", model_capability: "reasoning-capable", freshness: "fresh", capability: { persona_loaded: true, reasoning_capable: true, model_suitable: true, fresh_context: true, source: "runtime-verified" } };
    const planCapability = issueCapability(passing.context, { ...planInvocation, persona_path: "agents/code-reviewer.md", evidence_path: "cap.json" });
    const planPrepared = prepareAdapter(passing.context, { action_file: planAction.action_file, capability_file: planCapability.capability_file, invocation: planInvocation });
    const planReview = submitOutcome(passing.context, { action_id: "revised-plan-review", interaction_file: planPrepared.interaction_file, output_path: "plan-review.md", outcome: { disposition: "pass" } });
    const newPlan = registerPlan(passing.context, { artifact_path: "plan-new.md", spec_registration_file: registration.registration_file, metadata_file: metadata.metadata_file, review_output_path: "plan-review.md", review_decision_file: planReview.decision_file, mode: "auto" });
    setLatest(passing.context, "plan", "plan-new.md");
    advancePlan(passing.context, { registration_file: newPlan.registration_file });
    expectCode(() => selectBuildTask(passing.context, { plan_registration_file: passing.plan.file, writer_id: "root" }), "MDF_BUILD_PLAN_NOT_APPROVED");
    assert.strictEqual(selectBuildTask(passing.context, { plan_registration_file: newPlan.registration_file, writer_id: "root" }).task.id, "T1");
    expectCode(() => registerTechnicalRevision(passing.context, revisionRequest), "MDF_REVISION_GENERATION_INVALID");
  } finally { fs.rmSync(passing.fixture.temporaryRoot, { recursive: true, force: true }); }
  const changed = setup({ disposition: "pass", intent_preserved: false, external_behavior_changed: true, scope_changed: false, material_tradeoff_changed: false, technical_reason: "product change" });
  try {
    const result = registerTechnicalRevision(changed.context, { recovery_file: changed.recovery.file, original_intent_path: "intent.md", prior_spec_registration_file: changed.oldSpec.file, new_spec_path: "spec-new.md", review_output_path: "revision-review.md", review_decision_file: changed.review.decision_file });
    assert.strictEqual(result.stop.code, "MDF_STOP_HUMAN_REQUIRED");
  } finally { fs.rmSync(changed.fixture.temporaryRoot, { recursive: true, force: true }); }
}

function runSimplifyTests() {
  const setup = (candidateOutcome) => {
    const fixture = createFixture();
    const runGit = (args) => { const result = spawnSync("git", args, { cwd: fixture.worktree, encoding: "utf8" }); assert.strictEqual(result.status, 0, result.stderr); return result.stdout.trim(); };
    for (const args of [["init", "--quiet"], ["config", "user.email", "test@example.com"], ["config", "user.name", "MDF test"]]) runGit(args);
    for (const file of ["scripts/controller-runtime/a.js", "scripts/controller-runtime/b.js", "scripts/mdf-controller.js", "src/app.js", "tests/a.test.js", "vendor/x.js", "skills/generated.js", "fixtures/sample.js", "migrations/001.js", "snapshots/app.snap", "package-lock.json"]) { fs.mkdirSync(path.dirname(path.join(fixture.worktree, file)), { recursive: true }); fs.writeFileSync(path.join(fixture.worktree, file), "0\n"); }
    runGit(["add", "."]); runGit(["commit", "--quiet", "-m", "initial"]);
    const context = resolveControllerContext({ cwd: fixture.worktree, pluginRoot: root });
    for (const [file, bytes] of [["spec.md", "spec\n"], ["plan.md", "plan\n"], ["simplify.md", "simplify\n"], ["no-change-review.md", "pass\n"], ["cap.json", "{}\n"]]) fs.writeFileSync(path.join(context.work_item.path, file), bytes);
    const specArtifact = recordArtifact(context, "spec.md"); const spec = recordInteraction(context, { invocation: { agent_id: "mdf-spec", invocation_id: "simplify-spec", executor: "deterministic-runtime", artifact_file: specArtifact.file }, input_paths: ["spec.md"] });
    const planArtifact = recordArtifact(context, "plan.md"); const task = { id: "T1", depends_on: [], owned_paths: ["scripts/controller-runtime/a.js", "scripts/controller-runtime/b.js", "scripts/mdf-controller.js", "src/app.js", "tests/a.test.js", "vendor/x.js", "skills/generated.js", "fixtures/sample.js", "migrations/001.js", "snapshots/app.snap", "package-lock.json"], acceptance: ["works"] };
    const plan = recordInteraction(context, { invocation: { agent_id: "mdf-plan", invocation_id: "simplify-plan", executor: "deterministic-runtime", artifact_file: planArtifact.file, spec_registration_file: spec.file, metadata: { tasks: [task], whole_build_commands: [[process.execPath, "-e", "process.exit(0)"]] } }, input_paths: ["plan.md", `evidence/${spec.file}`] });
    recordEvent(context, { event_id: "simplify-spec-plan", from: "spec", to: "plan", evidence_files: [spec.file] }); recordEvent(context, { event_id: "simplify-plan-build", from: "plan", to: "build-task", evidence_files: [plan.file] });
    const parent = runGit(["rev-parse", "HEAD"]); const attempt = recordInteraction(context, { invocation: { agent_id: "mdf-build-task-select", invocation_id: "simplify-task", executor: "deterministic-runtime", plan_registration_file: plan.file, task, base_head: parent }, input_paths: [`evidence/${plan.file}`] });
    for (const file of task.owned_paths) fs.writeFileSync(path.join(fixture.worktree, file), "1\n"); runGit(["add", "."]); runGit(["commit", "--quiet", "-m", "feat: task"]);
    const head = runGit(["rev-parse", "HEAD"]); const tree = runGit(["show", "-s", "--format=%T", head]); const commit = { head, parent, tree, subject: "feat: task", paths: [...task.owned_paths].sort() };
    const authInteraction = recordInteraction(context, { invocation: { agent_id: "mdf-build-commit-authorization", invocation_id: "simplify-auth", executor: "deterministic-runtime", attempt_file: attempt.file, plan_registration_file: plan.file, task_id: "T1", base_head: parent, expected_tree: tree, expected_paths: commit.paths, commit_subject: commit.subject }, input_paths: [`evidence/${attempt.file}`] });
    const auth = recordDecision(context, { interaction_file: authInteraction.file, conclusion: { kind: "build-task-commit-authorization", attempt_file: attempt.file, task_id: "T1", base_head: parent, expected_tree: tree, expected_paths: commit.paths, commit_subject: commit.subject } });
    const completionInteraction = recordInteraction(context, { invocation: { agent_id: "mdf-build-task-complete", invocation_id: "simplify-complete", executor: "deterministic-runtime", authorization_file: auth.file, plan_registration_file: plan.file, task_id: "T1", repair_of: null, simplification_of: null, commit }, input_paths: [`evidence/${auth.file}`] });
    const completion = recordDecision(context, { interaction_file: completionInteraction.file, conclusion: { kind: "build-task-complete", plan_registration_file: plan.file, task_id: "T1", recovery_file: null, simplification_file: null, commit } });
    recordEvent(context, { event_id: "simplify-task-complete", from: "build-task", to: "build-task", evidence_files: [completion.file] });
    const baseline = recordInteraction(context, { invocation: { agent_id: "mdf-whole-build", invocation_id: "simplify-baseline", executor: "deterministic-runtime", plan_registration_file: plan.file, commands: [[process.execPath, "-e", "process.exit(0)"]], head, task_ids: ["T1"], completion_files: [completion.file] }, input_paths: [`evidence/${plan.file}`, `evidence/${completion.file}`] });
    const stableReviewInteraction = recordInteraction(context, { invocation: { agent_id: "reviewer", invocation_id: "simplify-stable-review", executor: "subagent" }, input_paths: [`evidence/${baseline.file}`] });
    const stableReview = recordDecision(context, { interaction_file: stableReviewInteraction.file, conclusion: { disposition: "pass" } });
    const stableInteraction = recordInteraction(context, { invocation: { agent_id: "mdf-whole-build-stable", invocation_id: "simplify-stable", executor: "deterministic-runtime", baseline_file: baseline.file, plan_registration_file: plan.file, head, task_ids: ["T1"], review_decision_file: stableReview.file }, input_paths: [`evidence/${baseline.file}`, `evidence/${stableReview.file}`] });
    const stable = recordDecision(context, { interaction_file: stableInteraction.file, conclusion: { kind: "whole-build-stable", baseline_file: baseline.file, plan_registration_file: plan.file, head, task_ids: ["T1"] } });
    recordEvent(context, { event_id: "simplify-whole", from: "build-task", to: "whole-build", evidence_files: [stable.file] });
    const scopeCli = spawnSync(process.execPath, [cliPath, "simplify", "scope", "--cwd", fixture.worktree, "--plugin-root", root], { encoding: "utf8", input: JSON.stringify({ stable_file: stable.file }) });
    assert.strictEqual(scopeCli.status, 0, scopeCli.stderr); const scope = JSON.parse(scopeCli.stdout).simplify; assert.deepStrictEqual(scope.eligible.map((item) => item.path), ["scripts/controller-runtime/a.js", "scripts/controller-runtime/b.js", "scripts/mdf-controller.js", "src/app.js"]);
    const action = issueAction(context, { action_id: "simplify-scan", action: "code-simplification", skill_path: "skills/code-simplification/SKILL.md", persona_path: "agents/code-reviewer.md", input_paths: [`evidence/${stable.file}`, `evidence/${scope.scope_file}`] });
    const invocation = { agent_id: "simplifier", invocation_id: "simplify-scan-inv", executor: "subagent", model_capability: "reasoning-capable", freshness: "fresh", capability: { persona_loaded: true, reasoning_capable: true, model_suitable: true, fresh_context: true, source: "runtime-verified" } };
    const capability = issueCapability(context, { ...invocation, persona_path: "agents/code-reviewer.md", evidence_path: "cap.json" }); const prepared = prepareAdapter(context, { action_file: action.action_file, capability_file: capability.capability_file, invocation });
    const scan = submitOutcome(context, { action_id: "simplify-scan", interaction_file: prepared.interaction_file, output_path: "simplify.md", outcome: candidateOutcome });
    const session = registerSimplification(context, { stable_file: stable.file, scope_file: scope.scope_file, output_path: "simplify.md", decision_file: scan.decision_file });
    return { fixture, context, plan, stable, scope, session };
  };
  const rejectedCandidate = { id: "C1", path: "scripts/controller-runtime/a.js", status: "rejected", behavior_preserving: true, production: true, generated: false, public_contract: false };
  const noChange = setup({ disposition: "no-change", candidates: [rejectedCandidate] });
  try {
    assert.strictEqual(finalizeNoChange(noChange.context, { session_file: noChange.session.session_file }).state.phase, "ship");
  } finally { fs.rmSync(noChange.fixture.temporaryRoot, { recursive: true, force: true }); }
  const acceptedCandidate = { ...rejectedCandidate, status: "accepted" };
  const rolledBack = setup({ disposition: "candidates", candidates: [acceptedCandidate] });
  try {
    const selected = selectSimplificationCandidate(rolledBack.context, { session_file: rolledBack.session.session_file, candidate_id: "C1", writer_id: "root" });
    fs.writeFileSync(path.join(rolledBack.context.work_item.path, "candidate-failure.log"), "failed\n"); fs.writeFileSync(path.join(rolledBack.context.work_item.path, "rejection.md"), "reject\n"); fs.writeFileSync(path.join(rolledBack.context.work_item.path, "rollback-review.md"), "pass\n");
    fs.writeFileSync(path.join(rolledBack.fixture.worktree, "scripts/controller-runtime/a.js"), "broken simplification\n");
    const failure = recordCommand(rolledBack.context, { command: [process.execPath, "-e", "process.exit(1)"], output_path: "candidate-failure.log", exit_code: 1 });
    const rejectionInputs = [`evidence/${selected.attempt_file}`, `evidence/${failure.file}`];
    const action = issueAction(rolledBack.context, { action_id: "simplify-reject", action: "simplification-rejection", skill_path: "skills/code-simplification/SKILL.md", persona_path: "agents/code-reviewer.md", input_paths: rejectionInputs });
    const invocation = { agent_id: "rejection-reviewer", invocation_id: "simplify-reject-inv", executor: "subagent", model_capability: "reasoning-capable", freshness: "fresh", capability: { persona_loaded: true, reasoning_capable: true, model_suitable: true, fresh_context: true, source: "runtime-verified" } };
    const capability = issueCapability(rolledBack.context, { ...invocation, persona_path: "agents/code-reviewer.md", evidence_path: "cap.json" }); const prepared = prepareAdapter(rolledBack.context, { action_file: action.action_file, capability_file: capability.capability_file, invocation }); const decision = submitOutcome(rolledBack.context, { action_id: "simplify-reject", interaction_file: prepared.interaction_file, output_path: "rejection.md", outcome: { disposition: "reject" } });
    const rejection = authorizeCandidateRejection(rolledBack.context, { attempt_file: selected.attempt_file, failure_files: [failure.file], output_path: "rejection.md", decision_file: decision.decision_file });
    fs.writeFileSync(path.join(rolledBack.fixture.worktree, "scripts/controller-runtime/a.js"), "1\n");
    const rejected = completeCandidateRejection(rolledBack.context, { rejection_file: rejection.rejection_file });
    assert.strictEqual(finalizeNoChange(rolledBack.context, { session_file: rolledBack.session.session_file }).state.phase, "ship");
  } finally { fs.rmSync(rolledBack.fixture.temporaryRoot, { recursive: true, force: true }); }
  const candidateB = { ...acceptedCandidate, id: "C2", path: "scripts/controller-runtime/b.js" };
  const multiple = setup({ disposition: "candidates", candidates: [acceptedCandidate, candidateB] });
  try {
    const first = selectSimplificationCandidate(multiple.context, { session_file: multiple.session.session_file, candidate_id: "C1", writer_id: "root" });
    const rejectionInteraction = recordInteraction(multiple.context, { invocation: { agent_id: "mdf-simplification-rejection", invocation_id: "multi-reject", executor: "deterministic-runtime", attempt_file: first.attempt_file, session_file: multiple.session.session_file, candidate_id: "C1", baseline_head: first.base_head }, input_paths: [`evidence/${first.attempt_file}`] });
    const rejection = recordDecision(multiple.context, { interaction_file: rejectionInteraction.file, conclusion: { kind: "simplification-rejection-authorized", attempt_file: first.attempt_file, session_file: multiple.session.session_file, candidate_id: "C1", baseline_head: first.base_head } });
    completeCandidateRejection(multiple.context, { rejection_file: rejection.file });
    const second = selectSimplificationCandidate(multiple.context, { session_file: multiple.session.session_file, candidate_id: "C2", writer_id: "root" });
    assert.strictEqual(resumeAutoBuild(multiple.context, { plan_registration_file: multiple.plan.file, writer_id: "root" }).attempt_file, second.attempt_file);
  } finally { fs.rmSync(multiple.fixture.temporaryRoot, { recursive: true, force: true }); }
  const changed = setup({ disposition: "candidates", candidates: [acceptedCandidate] });
  try {
    const selected = selectSimplificationCandidate(changed.context, { session_file: changed.session.session_file, candidate_id: "C1", writer_id: "root" });
    assert.deepStrictEqual(verifySidecar(changed.context, selected.attempt_file, { fresh: false }).invocation.simplification_scope_paths, ["scripts/controller-runtime/a.js"]);
    assert.strictEqual(nextLifecycle(changed.context).state.phase, "build-task");
    for (const [file, bytes] of [["simplify-task.md", "candidate C1\n"], ["simplify.diff", "diff\n"], ["simplify-impact.md", "unaffected\n"], ["simplify-review.md", "pass\n"], ["simplify-cap.json", "{}\n"]]) fs.writeFileSync(path.join(changed.context.work_item.path, file), bytes);
    fs.writeFileSync(path.join(changed.fixture.worktree, "scripts/controller-runtime/a.js"), "2\n");
    setOriginHead(changed.context.worktree); const command = runVerification(changed.context, { attempt_file: selected.attempt_file, command: [process.execPath, "-e", "process.exit(0)"], output_path: "simplify-command.log" });
    const impact = recordDownstreamImpact(changed.context, { attempt_file: selected.attempt_file, classification: "unaffected", artifact_path: "simplify-impact.md" });
    const inputs = ["spec.md", "plan.md", "simplify-task.md", "simplify.diff", "simplify-impact.md", `evidence/${selected.attempt_file}`, `evidence/${impact.impact_file}`, "simplify-command.log", `evidence/${command.verification_file}`, `evidence/${command.command_file}`];
    const action = issueAction(changed.context, { action_id: "simplify-candidate-review", action: "code-review", skill_path: "skills/code-review-and-quality/SKILL.md", persona_path: "agents/code-reviewer.md", input_paths: inputs });
    const invocation = { agent_id: "candidate-reviewer", invocation_id: "simplify-candidate-inv", executor: "subagent", model_capability: "reasoning-capable", freshness: "fresh", capability: { persona_loaded: true, reasoning_capable: true, model_suitable: true, fresh_context: true, source: "runtime-verified" } };
    const capability = issueCapability(changed.context, { ...invocation, persona_path: "agents/code-reviewer.md", evidence_path: "simplify-cap.json" }); const prepared = prepareAdapter(changed.context, { action_file: action.action_file, capability_file: capability.capability_file, invocation }); const review = submitOutcome(changed.context, { action_id: "simplify-candidate-review", interaction_file: prepared.interaction_file, output_path: "simplify-review.md", outcome: { disposition: "pass" } });
    const request = { attempt_file: selected.attempt_file, command_files: [command.verification_file], review_output_path: "simplify-review.md", review_decision_file: review.decision_file, task_evidence_path: "simplify-task.md", diff_path: "simplify.diff", downstream_impact_file: impact.impact_file, touched_paths: ["scripts/controller-runtime/a.js"], commit_subject: "refactor: simplify a" };
    expectCode(() => authorizeTaskCommit(changed.context, { ...request, commit_subject: "feat: simplify a" }), "MDF_SIMPLIFY_COMMIT_SUBJECT_INVALID");
    const authorization = authorizeTaskCommit(changed.context, request);
    spawnSync("git", ["add", "--", "scripts/controller-runtime/a.js"], { cwd: changed.fixture.worktree }); spawnSync("git", ["commit", "--quiet", "-m", "refactor: simplify a"], { cwd: changed.fixture.worktree });
    completeBuildTask(changed.context, { authorization_file: authorization.authorization_file });
    assert.strictEqual(resumeAutoBuild(changed.context, { plan_registration_file: changed.plan.file, writer_id: "root" }).action, "whole-build");
  } finally { fs.rmSync(changed.fixture.temporaryRoot, { recursive: true, force: true }); }
}

function runReviewTests() {
  const setup = (reportText, outcome, targetPhase = "ship") => {
    const fixture = createFixture();
    for (const args of [["init", "--quiet"], ["config", "user.email", "test@example.com"], ["config", "user.name", "MDF test"]]) spawnSync("git", args, { cwd: fixture.worktree });
    fs.writeFileSync(path.join(fixture.worktree, "src.js"), "x\n"); spawnSync("git", ["add", "src.js"], { cwd: fixture.worktree }); spawnSync("git", ["commit", "--quiet", "-m", "initial"], { cwd: fixture.worktree }); spawnSync("git", ["branch", "-m", "codex/task-0032"], { cwd: fixture.worktree });
    fs.writeFileSync(path.join(fixture.canonicalRoot, ".mdf", "work", fixture.workId, "item.md"), `---\nkind: task\nwork_id: "${fixture.workId}"\ntask_id: "0032"\ntitle: "Review fixture"\norder: 32\nstatus: active\ncreated: "2026-07-11"\nlatest: {}\nworktree: "${fs.realpathSync(fixture.worktree)}"\nbranch: "codex/task-0032"\n---\n`);
    writeJson(path.join(fixture.canonicalRoot, ".mdf", "locks", "0032.lock"), { task_id: "0032", work_id: fixture.workId, canonical_root: fs.realpathSync(fixture.canonicalRoot), worktree: fs.realpathSync(fixture.worktree), branch: "codex/task-0032", started: "2026-07-11T00:00:00.000Z", runtime: "test" });
    let head = spawnSync("git", ["rev-parse", "HEAD"], { cwd: fixture.worktree, encoding: "utf8" }).stdout.trim();
    const context = resolveControllerContext({ cwd: fixture.worktree, pluginRoot: root });
    for (const [file, bytes] of [["spec.md", "spec\n"], ["plan.md", "plan\n"], ["report.md", reportText], ["cap.json", "{}\n"]]) fs.writeFileSync(path.join(context.work_item.path, file), bytes);
    const specArtifact = recordArtifact(context, "spec.md"); const spec = recordInteraction(context, { invocation: { agent_id: "mdf-spec", invocation_id: "review-spec", executor: "deterministic-runtime", artifact_file: specArtifact.file }, input_paths: ["spec.md"] });
    const planArtifact = recordArtifact(context, "plan.md"); const task = { id: "T1", depends_on: [], owned_paths: ["src.js"], acceptance: ["works"] }; const plan = recordInteraction(context, { invocation: { agent_id: "mdf-plan", invocation_id: "review-plan", executor: "deterministic-runtime", artifact_file: planArtifact.file, spec_registration_file: spec.file, metadata: { tasks: [task], whole_build_commands: [[process.execPath, "-e", "process.exit(0)"]] } }, input_paths: ["plan.md", `evidence/${spec.file}`] });
    recordEvent(context, { event_id: "review-spec-plan", from: "spec", to: "plan", evidence_files: [spec.file] }); recordEvent(context, { event_id: "review-plan-build", from: "plan", to: "build-task", evidence_files: [plan.file] });
    const baseParent = head; const baseAttempt = recordInteraction(context, { invocation: { agent_id: "mdf-build-task-select", invocation_id: "review-base-attempt", executor: "deterministic-runtime", writer_id: "root", plan_registration_file: plan.file, task, base_head: baseParent }, input_paths: [`evidence/${plan.file}`] });
    fs.writeFileSync(path.join(fixture.worktree, "src.js"), "built\n"); spawnSync("git", ["add", "src.js"], { cwd: fixture.worktree }); spawnSync("git", ["commit", "--quiet", "-m", "feat: built"], { cwd: fixture.worktree }); head = spawnSync("git", ["rev-parse", "HEAD"], { cwd: fixture.worktree, encoding: "utf8" }).stdout.trim();
    const baseTree = spawnSync("git", ["show", "-s", "--format=%T", head], { cwd: fixture.worktree, encoding: "utf8" }).stdout.trim(); const baseCommit = { head, parent: baseParent, tree: baseTree, subject: "feat: built", paths: ["src.js"] };
    const baseAuthInteraction = recordInteraction(context, { invocation: { agent_id: "mdf-build-commit-authorization", invocation_id: "review-base-auth", executor: "deterministic-runtime", attempt_file: baseAttempt.file, plan_registration_file: plan.file, task_id: "T1", base_head: baseParent, expected_tree: baseTree, expected_paths: ["src.js"], commit_subject: "feat: built" }, input_paths: [`evidence/${baseAttempt.file}`] }); const baseAuth = recordDecision(context, { interaction_file: baseAuthInteraction.file, conclusion: { kind: "build-task-commit-authorization", attempt_file: baseAttempt.file, task_id: "T1", base_head: baseParent, expected_tree: baseTree, expected_paths: ["src.js"], commit_subject: "feat: built" } });
    const baseCompletionInteraction = recordInteraction(context, { invocation: { agent_id: "mdf-build-task-complete", invocation_id: "review-base-complete", executor: "deterministic-runtime", authorization_file: baseAuth.file, plan_registration_file: plan.file, task_id: "T1", repair_of: null, simplification_of: null, review_of: null, commit: baseCommit }, input_paths: [`evidence/${baseAuth.file}`] }); const baseCompletion = recordDecision(context, { interaction_file: baseCompletionInteraction.file, conclusion: { kind: "build-task-complete", plan_registration_file: plan.file, task_id: "T1", recovery_file: null, simplification_file: null, review_file: null, commit: baseCommit } }); recordEvent(context, { event_id: "review-base-completed", from: "build-task", to: "build-task", evidence_files: [baseCompletion.file] });
    const baseline = recordInteraction(context, { invocation: { agent_id: "mdf-whole-build", invocation_id: "review-baseline", executor: "deterministic-runtime", plan_registration_file: plan.file, completion_files: [baseCompletion.file], head, task_ids: ["T1"] }, input_paths: [`evidence/${plan.file}`, `evidence/${baseCompletion.file}`] });
    const stableInteraction = recordInteraction(context, { invocation: { agent_id: "mdf-whole-build-stable", invocation_id: "review-stable", executor: "deterministic-runtime", baseline_file: baseline.file, plan_registration_file: plan.file, head, task_ids: ["T1"] }, input_paths: [`evidence/${baseline.file}`] }); const stable = recordDecision(context, { interaction_file: stableInteraction.file, conclusion: { kind: "whole-build-stable", baseline_file: baseline.file, plan_registration_file: plan.file, head, task_ids: ["T1"] } });
    recordEvent(context, { event_id: "review-whole", from: "build-task", to: "whole-build", evidence_files: [stable.file] });
    const simplifySessionInteraction = recordInteraction(context, { invocation: { agent_id: "mdf-simplification", invocation_id: "review-simplify", executor: "deterministic-runtime" }, input_paths: [`evidence/${stable.file}`] }); const simplifySession = recordDecision(context, { interaction_file: simplifySessionInteraction.file, conclusion: { kind: "simplification-session", disposition: "no-change", stable_file: stable.file, plan_registration_file: plan.file, head, candidates: [] } });
    recordEvent(context, { event_id: "review-simplify", from: "whole-build", to: "simplify", evidence_files: [simplifySession.file] });
    const noChangeInteraction = recordInteraction(context, { invocation: { agent_id: "mdf-simplification-no-change", invocation_id: "review-nochange", executor: "deterministic-runtime", session_file: simplifySession.file }, input_paths: [`evidence/${simplifySession.file}`] }); const noChange = recordDecision(context, { interaction_file: noChangeInteraction.file, conclusion: { kind: "simplification-no-change", session_file: simplifySession.file, head } });
    recordEvent(context, { event_id: `review-phase-${targetPhase}`, from: "simplify", to: targetPhase, evidence_files: [noChange.file] });
    const contextCli = spawnSync(process.execPath, [cliPath, "review", "context", "--cwd", fixture.worktree, "--plugin-root", root], { encoding: "utf8", input: "{}" }); assert.strictEqual(contextCli.status, 0, contextCli.stderr); const reviewContext = JSON.parse(contextCli.stdout).review;
    const action = issueAction(context, { action_id: `standalone-review-${outcome.disposition}`, action: "standalone-review", skill_path: "skills/code-review-and-quality/SKILL.md", persona_path: "agents/code-reviewer.md", input_paths: reviewContext.input_paths });
    const invocation = { agent_id: "reviewer", invocation_id: `standalone-${outcome.disposition}-inv`, executor: "subagent", model_capability: "reasoning-capable", freshness: "fresh", capability: { persona_loaded: true, reasoning_capable: true, model_suitable: true, fresh_context: true, source: "runtime-verified" } };
    const capability = issueCapability(context, { ...invocation, persona_path: "agents/code-reviewer.md", evidence_path: "cap.json" }); const prepared = prepareAdapter(context, { action_file: action.action_file, capability_file: capability.capability_file, invocation }); const decision = submitOutcome(context, { action_id: `standalone-review-${outcome.disposition}`, interaction_file: prepared.interaction_file, output_path: "report.md", outcome });
    return { fixture, context, reviewContext, decision, reportText };
  };
  const standalone = setup("## Whatever upstream heading\nAll clear.\n", { disposition: "pass" });
  try {
    fs.writeFileSync(path.join(standalone.context.work_item.path, "report.md"), "stale\n"); expectCode(() => registerReview(standalone.context, { context_file: standalone.reviewContext.context_file, output_path: "report.md", decision_file: standalone.decision.decision_file, mode: "standalone" }), "MDF_EVIDENCE_STALE"); fs.writeFileSync(path.join(standalone.context.work_item.path, "report.md"), standalone.reportText);
    assert.strictEqual(registerReview(standalone.context, { context_file: standalone.reviewContext.context_file, output_path: "report.md", decision_file: standalone.decision.decision_file, mode: "standalone" }).action, "stop");
  } finally { fs.rmSync(standalone.fixture.temporaryRoot, { recursive: true, force: true }); }
  const auto = setup("Free-form prose without prescribed grammar.\n", { disposition: "pass" }, "review");
  try { assert.strictEqual(registerReview(auto.context, { context_file: auto.reviewContext.context_file, output_path: "report.md", decision_file: auto.decision.decision_file, mode: "auto" }).state.phase, "ship"); } finally { fs.rmSync(auto.fixture.temporaryRoot, { recursive: true, force: true }); }
  const findings = setup("Actionable issue in src.\n", { disposition: "findings", human_required: false, affected_task_id: "T1", repair_scope_paths: ["src.js"] }, "review");
  try {
    const result = registerReview(findings.context, { context_file: findings.reviewContext.context_file, output_path: "report.md", decision_file: findings.decision.decision_file, mode: "auto" }); assert.strictEqual(result.action, "repair-task"); assert.deepStrictEqual(verifySidecar(findings.context, result.attempt_file, { fresh: false }).invocation.review_scope_paths, ["src.js"]);
    const activePlan = verifySidecar(findings.context, findings.reviewContext.context_file, { fresh: false }).invocation.plan_registration_file;
    assert.strictEqual(resumeAutoBuild(findings.context, { plan_registration_file: activePlan, writer_id: "root" }).action, "resume-task");
    for (const [file, bytes] of [["review-fix-task.md", "fix\n"], ["review-fix.diff", "diff\n"], ["review-fix-impact.md", "unaffected\n"], ["review-fix-report.md", "pass\n"], ["review-fix-cap.json", "{}\n"]]) fs.writeFileSync(path.join(findings.context.work_item.path, file), bytes);
    fs.writeFileSync(path.join(findings.fixture.worktree, "src.js"), "fixed\n"); setOriginHead(findings.fixture.worktree); const command = runVerification(findings.context, { attempt_file: result.attempt_file, command: [process.execPath, "-e", "process.exit(0)"], output_path: "review-fix-command.log" }); const impact = recordDownstreamImpact(findings.context, { attempt_file: result.attempt_file, classification: "unaffected", artifact_path: "review-fix-impact.md" });
    const inputs = ["spec.md", "plan.md", "review-fix-task.md", "review-fix.diff", "review-fix-impact.md", `evidence/${result.attempt_file}`, `evidence/${impact.impact_file}`, "review-fix-command.log", `evidence/${command.verification_file}`, `evidence/${command.command_file}`]; const action = issueAction(findings.context, { action_id: "review-fix-review", action: "code-review", skill_path: "skills/code-review-and-quality/SKILL.md", persona_path: "agents/code-reviewer.md", input_paths: inputs }); const invocation = { agent_id: "fix-reviewer", invocation_id: "review-fix-inv", executor: "subagent", model_capability: "reasoning-capable", freshness: "fresh", capability: { persona_loaded: true, reasoning_capable: true, model_suitable: true, fresh_context: true, source: "runtime-verified" } }; const capability = issueCapability(findings.context, { ...invocation, persona_path: "agents/code-reviewer.md", evidence_path: "review-fix-cap.json" }); const prepared = prepareAdapter(findings.context, { action_file: action.action_file, capability_file: capability.capability_file, invocation }); const review = submitOutcome(findings.context, { action_id: "review-fix-review", interaction_file: prepared.interaction_file, output_path: "review-fix-report.md", outcome: { disposition: "pass" } });
    const authorization = authorizeTaskCommit(findings.context, { attempt_file: result.attempt_file, command_files: [command.verification_file], review_output_path: "review-fix-report.md", review_decision_file: review.decision_file, task_evidence_path: "review-fix-task.md", diff_path: "review-fix.diff", downstream_impact_file: impact.impact_file, touched_paths: ["src.js"], commit_subject: "fix: address review" }); spawnSync("git", ["add", "--", "src.js"], { cwd: findings.fixture.worktree }); spawnSync("git", ["commit", "--quiet", "-m", "fix: address review"], { cwd: findings.fixture.worktree }); const completed = completeBuildTask(findings.context, { authorization_file: authorization.authorization_file });
    assert.strictEqual(completed.state.phase, "build-task");
    assert.strictEqual(resumeAutoBuild(findings.context, { plan_registration_file: activePlan, writer_id: "root" }).action, "whole-build");
  } finally { fs.rmSync(findings.fixture.temporaryRoot, { recursive: true, force: true }); }
}

function runShipTests() {
  const setup = (fileCount, autoReview = false) => {
    const fixture = createFixture();
    for (const args of [["init", "--quiet"], ["config", "user.email", "test@example.com"], ["config", "user.name", "MDF test"]]) spawnSync("git", args, { cwd: fixture.worktree });
    for (let index = 0; index < fileCount; index += 1) fs.writeFileSync(path.join(fixture.worktree, `file-${index}.js`), "0\n"); spawnSync("git", ["add", "."], { cwd: fixture.worktree }); spawnSync("git", ["commit", "--quiet", "-m", "initial"], { cwd: fixture.worktree });
    const context = resolveControllerContext({ cwd: fixture.worktree, pluginRoot: root });
    for (const [file, bytes] of [["plan.md", "plan\n"], ["seed.md", "seed\n"], ["user.md", "accept risks\n"], ["cap.json", "{}\n"], ["code-report.md", "code raw\n"], ["security-report.md", "security raw\n"], ["empty-risk-report.md", "empty risk raw\n"], ["test-report.md", "test raw\n"], ["ship.md", "ship raw\n"], ["ship-accepted.md", "ship accepted raw\n"]]) fs.writeFileSync(path.join(context.work_item.path, file), bytes);
    const seed = recordInteraction(context, { invocation: { agent_id: "seed", invocation_id: "ship-seed", executor: "deterministic-runtime" }, input_paths: ["seed.md"] });
    recordEvent(context, { event_id: "ship-spec-plan", from: "spec", to: "plan", evidence_files: [seed.file] });
    const planArtifact = recordArtifact(context, "plan.md"); const tasks = [{ id: "T1", depends_on: [], owned_paths: Array.from({ length: fileCount }, (_, index) => `file-${index}.js`), acceptance: ["works"] }]; const plan = recordInteraction(context, { invocation: { agent_id: "mdf-plan", invocation_id: "ship-plan", executor: "deterministic-runtime", artifact_file: planArtifact.file, spec_registration_file: seed.file, metadata: { tasks, whole_build_commands: [[process.execPath, "-e", "process.exit(0)"]] } }, input_paths: ["plan.md", `evidence/${seed.file}`] });
    recordEvent(context, { event_id: "ship-plan-build", from: "plan", to: "build-task", evidence_files: [plan.file] });
    for (let index = 0; index < fileCount; index += 1) fs.writeFileSync(path.join(fixture.worktree, `file-${index}.js`), "1\n"); spawnSync("git", ["add", "."], { cwd: fixture.worktree }); spawnSync("git", ["commit", "--quiet", "-m", "feat: ship change"], { cwd: fixture.worktree });
    const phase = recordInteraction(context, { invocation: { agent_id: "phase", invocation_id: "ship-phase", executor: "deterministic-runtime" }, input_paths: ["seed.md"] });
    const currentHead = spawnSync("git", ["rev-parse", "HEAD"], { cwd: fixture.worktree, encoding: "utf8" }).stdout.trim();
    if (autoReview) {
      const reviewInteraction = recordInteraction(context, { invocation: { agent_id: "reviewer", invocation_id: "ship-whole-review", executor: "subagent" }, input_paths: ["seed.md"] }); const review = recordDecision(context, { interaction_file: reviewInteraction.file, conclusion: { disposition: "pass" } });
      const stableInteraction = recordInteraction(context, { invocation: { agent_id: "mdf-whole-build-stable", invocation_id: "ship-stable", executor: "deterministic-runtime", plan_registration_file: plan.file, head: currentHead, review_decision_file: review.file }, input_paths: ["seed.md", `evidence/${review.file}`] }); const stable = recordDecision(context, { interaction_file: stableInteraction.file, conclusion: { kind: "whole-build-stable", plan_registration_file: plan.file, head: currentHead } });
      recordEvent(context, { event_id: "ship-whole", from: "build-task", to: "whole-build", evidence_files: [stable.file] });
      const sessionInteraction = recordInteraction(context, { invocation: { agent_id: "mdf-simplification", invocation_id: "ship-session", executor: "deterministic-runtime" }, input_paths: [`evidence/${stable.file}`] }); const session = recordDecision(context, { interaction_file: sessionInteraction.file, conclusion: { kind: "simplification-session", stable_file: stable.file, head: currentHead, candidates: [] } }); recordEvent(context, { event_id: "ship-simplify", from: "whole-build", to: "simplify", evidence_files: [session.file] });
      const noChangeInteraction = recordInteraction(context, { invocation: { agent_id: "mdf-simplification-no-change", invocation_id: "ship-no-change", executor: "deterministic-runtime", session_file: session.file, stable_file: stable.file, review_decision_file: review.file }, input_paths: [`evidence/${session.file}`, `evidence/${stable.file}`, `evidence/${review.file}`] }); const noChange = recordDecision(context, { interaction_file: noChangeInteraction.file, conclusion: { kind: "simplification-no-change", session_file: session.file, stable_file: stable.file, review_file: review.file, head: currentHead } }); recordEvent(context, { event_id: "ship-phase-enter", from: "simplify", to: "ship", evidence_files: [noChange.file] });
    } else {
      recordEvent(context, { event_id: "ship-whole", from: "build-task", to: "whole-build", evidence_files: [phase.file] }); recordEvent(context, { event_id: "ship-simplify", from: "whole-build", to: "simplify", evidence_files: [phase.file] }); recordEvent(context, { event_id: "ship-review", from: "simplify", to: "review", evidence_files: [phase.file] });
      const reviewInteraction = recordInteraction(context, { invocation: { agent_id: "mdf-standalone-review", invocation_id: "ship-review-pass", executor: "deterministic-runtime", review_mode: "lifecycle-review" }, input_paths: ["seed.md"] }); const review = recordDecision(context, { interaction_file: reviewInteraction.file, conclusion: { kind: "standalone-review", disposition: "pass", review_mode: "lifecycle-review", head: currentHead } }); recordEvent(context, { event_id: "ship-phase-enter", from: "review", to: "ship", evidence_files: [review.file] });
    }
    const shipCli = spawnSync(process.execPath, [cliPath, "ship", "context", "--cwd", fixture.worktree, "--plugin-root", root], { encoding: "utf8", input: "{}" }); assert.strictEqual(shipCli.status, 0, shipCli.stderr); const shipContext = JSON.parse(shipCli.stdout).ship;
    const runAdapter = (id, actionName, personaPath, inputs, output, outcome, rootMode = false) => {
      const action = issueAction(context, { action_id: id, action: actionName, skill_path: "skills/shipping-and-launch/SKILL.md", persona_path: personaPath, input_paths: inputs });
      const invocation = rootMode ? { agent_id: "root", invocation_id: `${id}-inv`, executor: "root", model_capability: "root-reasoning", freshness: "root-fallback", capability: { persona_loaded: false, reasoning_capable: true, model_suitable: true, fresh_context: false, source: "root-observed" }, fallback: { source: "runtime-limited", reason: "root synthesis is required" } } : { agent_id: id, invocation_id: `${id}-inv`, executor: "subagent", model_capability: "specialist-capable", freshness: "fresh", capability: { persona_loaded: true, reasoning_capable: true, model_suitable: true, fresh_context: true, source: "runtime-verified" } };
      const capability = issueCapability(context, { ...invocation, persona_path: personaPath, evidence_path: "cap.json" }); const prepared = prepareAdapter(context, { action_file: action.action_file, capability_file: capability.capability_file, invocation }); return submitOutcome(context, { action_id: id, interaction_file: prepared.interaction_file, output_path: output, outcome });
    };
    return { fixture, context, shipContext, runAdapter };
  };
  const automatic = setup(1, true);
  try { assert.strictEqual(automatic.shipContext.head, spawnSync("git", ["rev-parse", "HEAD"], { cwd: automatic.fixture.worktree, encoding: "utf8" }).stdout.trim()); }
  finally { fs.rmSync(automatic.fixture.temporaryRoot, { recursive: true, force: true }); }
  const full = setup(3);
  try {
    assert.deepStrictEqual(full.shipContext.required_personas, ["code-reviewer", "security-auditor", "test-engineer"]);
    const code = full.runAdapter("ship-code", "ship-persona", "agents/code-reviewer.md", full.shipContext.persona_input_paths, "code-report.md", { disposition: "pass", critical: false, risk_ids: [] }); const security = full.runAdapter("ship-security", "ship-persona", "agents/security-auditor.md", full.shipContext.persona_input_paths, "security-report.md", { disposition: "block", critical: true, risk_ids: ["SEC-1"] }); const test = full.runAdapter("ship-test", "ship-persona", "agents/test-engineer.md", full.shipContext.persona_input_paths, "test-report.md", { disposition: "pass", critical: false, risk_ids: [] });
    const reports = [{ persona: "code-reviewer", output_path: "code-report.md", decision_file: code.decision_file }, { persona: "security-auditor", output_path: "security-report.md", decision_file: security.decision_file }, { persona: "test-engineer", output_path: "test-report.md", decision_file: test.decision_file }];
    const emptyRisk = full.runAdapter("ship-empty-risk", "ship-persona", "agents/security-auditor.md", full.shipContext.persona_input_paths, "empty-risk-report.md", { disposition: "block", critical: true, risk_ids: [] });
    const rollback = { trigger_conditions: "alert", procedure: "revert commit", recovery_time_objective: "15m" };
    const synthesisInputs = [`evidence/${full.shipContext.context_file}`, ...reports.flatMap((report) => [report.output_path, `evidence/${report.decision_file}`])].sort(); const synthesis = full.runAdapter("ship-synthesis", "ship-synthesis", null, synthesisInputs, "ship.md", { disposition: "GO", rollback }, true);
    expectCode(() => registerShip(full.context, { context_file: full.shipContext.context_file, reports: [reports[0], { persona: "security-auditor", output_path: "empty-risk-report.md", decision_file: emptyRisk.decision_file }, reports[2]], output_path: "ship.md", decision_file: synthesis.decision_file }), "MDF_SHIP_REPORTS_INVALID");
    expectCode(() => registerShip(full.context, { context_file: full.shipContext.context_file, reports: reports.slice(0, 2), output_path: "ship.md", decision_file: synthesis.decision_file }), "MDF_SHIP_REPORTS_INVALID");
    fs.writeFileSync(path.join(full.context.work_item.path, "code-report.md"), "stale\n"); expectCode(() => registerShip(full.context, { context_file: full.shipContext.context_file, reports, output_path: "ship.md", decision_file: synthesis.decision_file }), "MDF_EVIDENCE_STALE"); fs.writeFileSync(path.join(full.context.work_item.path, "code-report.md"), "code raw\n");
    expectCode(() => registerShip(full.context, { context_file: full.shipContext.context_file, reports, output_path: "ship.md", decision_file: synthesis.decision_file }), "MDF_SHIP_RISK_ACCEPTANCE_REQUIRED");
    const acceptance = recordRiskAcceptance(full.context, { context_file: full.shipContext.context_file, user_message_path: "user.md", report_decision_files: reports.map((report) => report.decision_file), risk_ids: ["SEC-1"], affirmative: true });
    const acceptedInputs = [...synthesisInputs, `evidence/${acceptance.acceptance_file}`].sort(); const accepted = full.runAdapter("ship-synthesis-accepted", "ship-synthesis", null, acceptedInputs, "ship-accepted.md", { disposition: "GO", rollback }, true);
    assert.strictEqual(registerShip(full.context, { context_file: full.shipContext.context_file, reports, output_path: "ship-accepted.md", decision_file: accepted.decision_file, risk_acceptance_file: acceptance.acceptance_file }).state.phase, "github-pr");
  } finally { fs.rmSync(full.fixture.temporaryRoot, { recursive: true, force: true }); }
  const small = setup(1);
  try {
    assert.strictEqual(small.shipContext.small_change_exception, true); const rollback = { trigger_conditions: "failure", procedure: "revert", recovery_time_objective: "5m" }; const inputs = [`evidence/${small.shipContext.context_file}`]; const synthesis = small.runAdapter("small-synthesis", "ship-synthesis", null, inputs, "ship.md", { disposition: "GO", rollback, small_change_direct_review: true }, true); assert.strictEqual(registerShip(small.context, { context_file: small.shipContext.context_file, reports: [], output_path: "ship.md", decision_file: synthesis.decision_file }).state.phase, "github-pr");
  } finally { fs.rmSync(small.fixture.temporaryRoot, { recursive: true, force: true }); }
  const noGo = setup(1);
  try { const rollback = { trigger_conditions: "failure", procedure: "do not launch", recovery_time_objective: "0m" }; const synthesis = noGo.runAdapter("nogo-synthesis", "ship-synthesis", null, [`evidence/${noGo.shipContext.context_file}`], "ship.md", { disposition: "NO-GO", rollback, small_change_direct_review: true }, true); const result = registerShip(noGo.context, { context_file: noGo.shipContext.context_file, reports: [], output_path: "ship.md", decision_file: synthesis.decision_file }); assert.strictEqual(result.action, "stop"); assert.strictEqual(result.stop.code, "MDF_STOP_HUMAN_REQUIRED"); } finally { fs.rmSync(noGo.fixture.temporaryRoot, { recursive: true, force: true }); }
}

function runGithubPrTests() {
  const setup = ({ disposition = "GO", dirty = false, auto_review: autoReview = false, github_mode: githubMode = "ok", upstream = true } = {}) => {
    const fixture = createFixture();
    for (const args of [["init", "--quiet"], ["config", "user.email", "test@example.com"], ["config", "user.name", "MDF test"]]) spawnSync("git", args, { cwd: fixture.worktree });
    fs.writeFileSync(path.join(fixture.worktree, "src.js"), "ready\n");
    spawnSync("git", ["add", "."], { cwd: fixture.worktree });
    spawnSync("git", ["commit", "--quiet", "-m", "feat: ready"], { cwd: fixture.worktree });
    spawnSync("git", ["branch", "-m", "codex/task-0032"], { cwd: fixture.worktree });
    const remote = path.join(fixture.temporaryRoot, "remote.git"); spawnSync("git", ["init", "--quiet", "--bare", remote]); spawnSync("git", ["remote", "add", "origin", remote], { cwd: fixture.worktree }); spawnSync("git", ["push", "--quiet", "-u", "origin", "codex/task-0032"], { cwd: fixture.worktree }); if (!upstream) spawnSync("git", ["branch", "--unset-upstream"], { cwd: fixture.worktree });
    fs.writeFileSync(path.join(fixture.worktree, ".git", "mdf-gh-mode"), `${githubMode}\n`); const bin = path.join(fixture.temporaryRoot, "bin"); fs.mkdirSync(bin); const gh = path.join(bin, "gh"); fs.writeFileSync(gh, `#!/bin/sh\nmode=$(cat .git/mdf-gh-mode)\nif [ "$mode" = "fail" ]; then exit 1; fi\nif [ "$1 $2" = "repo view" ]; then printf '%s\\n' '{"defaultBranchRef":{"name":"main"}}'; exit 0; fi\nif [ "$1 $2" = "pr list" ]; then if [ "$mode" = "conflict" ]; then printf '%s\\n' '[{"url":"one","state":"OPEN"},{"url":"two","state":"OPEN"}]'; else printf '%s\\n' '[]'; fi; exit 0; fi\nexit 1\n`); fs.chmodSync(gh, 0o755); process.env.PATH = `${bin}:${process.env.PATH}`;
    const context = resolveControllerContext({ cwd: fixture.worktree, pluginRoot: root });
    fs.writeFileSync(path.join(context.work_item.path, "seed.md"), "seed\n");
    fs.writeFileSync(path.join(context.work_item.path, "user-authority.md"), "run auto-workflow through PR preparation\n");
    const head = spawnSync("git", ["rev-parse", "HEAD"], { cwd: fixture.worktree, encoding: "utf8" }).stdout.trim();
    const make = (agent, conclusion) => {
      const interaction = recordInteraction(context, { invocation: { agent_id: agent, invocation_id: `${agent}-${Date.now()}-${Math.random()}`, executor: "deterministic-runtime" }, input_paths: ["seed.md"] });
      return recordDecision(context, { interaction_file: interaction.file, conclusion });
    };
    const spec = make("mdf-spec", { kind: "spec-registration" });
    recordEvent(context, { event_id: "pr-spec-plan", from: "spec", to: "plan", evidence_files: [spec.file] });
    const planInteraction = recordInteraction(context, { invocation: { agent_id: "mdf-plan", invocation_id: "pr-plan", executor: "deterministic-runtime", spec_registration_file: spec.file }, input_paths: ["seed.md", `evidence/${spec.file}`] });
    const plan = recordDecision(context, { interaction_file: planInteraction.file, conclusion: { kind: "plan-registration" } });
    recordEvent(context, { event_id: "pr-plan-build", from: "plan", to: "build-task", evidence_files: [plan.file] });
    const wholeReview = autoReview ? make("reviewer", { disposition: "pass" }) : null;
    const build = autoReview
      ? recordDecision(context, { interaction_file: recordInteraction(context, { invocation: { agent_id: "mdf-whole-build-stable", invocation_id: "pr-stable", executor: "deterministic-runtime", head, review_decision_file: wholeReview.file }, input_paths: ["seed.md", `evidence/${wholeReview.file}`] }).file, conclusion: { kind: "whole-build-stable", head } })
      : make("mdf-whole-build-stable", { kind: "whole-build-stable", head });
    recordEvent(context, { event_id: "pr-build-whole", from: "build-task", to: "whole-build", evidence_files: [build.file] });
    const whole = make("mdf-whole-build", { kind: "whole-build", disposition: "pass", head });
    recordEvent(context, { event_id: "pr-whole-simplify", from: "whole-build", to: "simplify", evidence_files: [whole.file] });
    const simplify = autoReview
      ? recordDecision(context, { interaction_file: recordInteraction(context, { invocation: { agent_id: "mdf-simplification-no-change", invocation_id: "pr-no-change", executor: "deterministic-runtime", stable_file: build.file }, input_paths: [`evidence/${build.file}`, `evidence/${wholeReview.file}`] }).file, conclusion: { kind: "simplification-no-change", stable_file: build.file, review_file: wholeReview.file, head } })
      : make("mdf-simplify", { kind: "simplification", disposition: "no-change", head });
    const review = autoReview ? wholeReview : make("mdf-standalone-review", { kind: "standalone-review", disposition: "pass", head });
    if (autoReview) recordEvent(context, { event_id: "pr-simplify-ship", from: "simplify", to: "ship", evidence_files: [simplify.file] });
    else { recordEvent(context, { event_id: "pr-simplify-review", from: "simplify", to: "review", evidence_files: [simplify.file] }); recordEvent(context, { event_id: "pr-review-ship", from: "review", to: "ship", evidence_files: [review.file] }); }
    const ship = make("mdf-ship", { kind: "ship-decision", disposition, head, rollback: { trigger_conditions: "failure", procedure: "revert", recovery_time_objective: "5m" } });
    recordEvent(context, { event_id: "pr-ship-github", from: "ship", to: "github-pr", evidence_files: [ship.file] });
    if (dirty) fs.writeFileSync(path.join(fixture.worktree, "dirty.txt"), "dirty\n");
    const authority = recordGithubPrAuthority(context, { user_message_path: "user-authority.md", affirmative: true, push: true, pull_request: true });
    return { fixture, context, refs: { spec: spec.file, plan: plan.file, build: build.file, whole: whole.file, simplify: simplify.file, review: review.file, ship: ship.file, authority: authority.authority_file } };
  };
  const ready = setup();
  try {
    expectCode(() => observeGithubPrBoundary(ready.context, { default_branch: "main", authority_file: ready.refs.authority }), "MDF_GITHUB_PR_CALLER_FACTS_FORBIDDEN");
    const observation = observeGithubPrBoundary(ready.context, { authority_file: ready.refs.authority });
    const handoff = prepareGithubPrHandoff(ready.context, { observation_file: observation.observation_file });
    assert.strictEqual(handoff.action, "github-pr", JSON.stringify(verifySidecar(ready.context, observation.observation_file, { fresh: false }).conclusion));
    assert.strictEqual(handoff.mutation_performed, false);
    assert.deepStrictEqual(handoff.references, { task_id: "0032", work_id: ready.fixture.workId, item_path: "item.md", spec_file: ready.refs.spec, plan_file: ready.refs.plan, build_file: ready.refs.build, review_file: ready.refs.review, ship_file: ready.refs.ship });
    const cli = spawnSync(process.execPath, [cliPath, "github-pr", "handoff", "--cwd", ready.fixture.worktree, "--plugin-root", root], { encoding: "utf8", input: JSON.stringify({ observation_file: observation.observation_file }) });
    assert.strictEqual(cli.status, 0, cli.stderr);
    assert.strictEqual(JSON.parse(cli.stdout).github_pr.action, "github-pr");
  } finally { fs.rmSync(ready.fixture.temporaryRoot, { recursive: true, force: true }); }
  const automatic = setup({ auto_review: true });
  try {
    const observation = observeGithubPrBoundary(automatic.context, { authority_file: automatic.refs.authority });
    assert.strictEqual(prepareGithubPrHandoff(automatic.context, { observation_file: observation.observation_file }).references.review_file, automatic.refs.review);
  } finally { fs.rmSync(automatic.fixture.temporaryRoot, { recursive: true, force: true }); }
  for (const scenario of [
    { name: "dirty", setup: { dirty: true } },
    { name: "upstream", setup: { upstream: false } },
    { name: "conflicting-pr", setup: { github_mode: "conflict" } },
    { name: "github", setup: { github_mode: "fail" } },
    { name: "authority", setup: {} },
  ]) {
    const value = setup(scenario.setup);
    try { const observation = observeGithubPrBoundary(value.context, scenario.name === "authority" ? {} : { authority_file: value.refs.authority }); const result = prepareGithubPrHandoff(value.context, { observation_file: observation.observation_file }); assert.strictEqual(result.action, "stop", scenario.name); assert.strictEqual(result.stop.reason, "ambiguous", scenario.name); assert.strictEqual(result.mutation_performed, false); }
    finally { fs.rmSync(value.fixture.temporaryRoot, { recursive: true, force: true }); }
  }
  const invalidAuthority = setup();
  try {
    const fakeInteraction = recordInteraction(invalidAuthority.context, { invocation: { agent_id: "caller", invocation_id: "self-attested-authority", executor: "deterministic-runtime" }, input_paths: ["item.md", "user-authority.md"] });
    const fakeDecision = recordDecision(invalidAuthority.context, { interaction_file: fakeInteraction.file, conclusion: { kind: "github-pr-authority", affirmative: true, push: true, pull_request: true, user_message_path: "user-authority.md" } });
    const observation = observeGithubPrBoundary(invalidAuthority.context, { authority_file: fakeDecision.file });
    const result = prepareGithubPrHandoff(invalidAuthority.context, { observation_file: observation.observation_file });
    assert.strictEqual(result.action, "stop");
    assert.strictEqual(result.stop.reason, "ambiguous");
  } finally { fs.rmSync(invalidAuthority.fixture.temporaryRoot, { recursive: true, force: true }); }
  const noGo = setup({ disposition: "NO-GO" });
  try { const observation = observeGithubPrBoundary(noGo.context, { authority_file: noGo.refs.authority }); expectCode(() => prepareGithubPrHandoff(noGo.context, { observation_file: observation.observation_file }), "MDF_GITHUB_PR_SHIP_INVALID"); }
  finally { fs.rmSync(noGo.fixture.temporaryRoot, { recursive: true, force: true }); }
}

const groups = new Map([
  ["context", runContextTests], ["evidence", runEvidenceTests], ["adapter", runAdapterTests], ["lifecycle", runLifecycleTests],
  ["spec", runSpecTests], ["plan", runPlanTests], ["build-task", runBuildTaskTests], ["whole-build", runWholeBuildTests],
  ["recovery", runRecoveryTests], ["technical-revision", runTechnicalRevisionTests], ["simplify", runSimplifyTests],
  ["review", runReviewTests], ["ship", runShipTests], ["github-pr", runGithubPrTests],
]);
const group = process.argv[3];
if (!(process.argv.length === 2 || (process.argv.length === 4 && process.argv[2] === "--group" && groups.has(group)))) {
  console.error("Usage: node scripts/validate-mdf-controller-runtime.js --group context|evidence|adapter|lifecycle|spec|plan|build-task|whole-build|recovery|technical-revision|simplify|review|ship|github-pr");
  process.exit(1);
}

const selected = group ? [[group, groups.get(group)]] : [...groups];
for (const [name, validate] of selected) {
  validate();
  console.log(`MDF controller runtime validation passed for ${name}.`);
}
