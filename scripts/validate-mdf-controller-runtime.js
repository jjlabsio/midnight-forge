#!/usr/bin/env node

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { resolveControllerContext, resolvePluginPath } = require("./controller-runtime/context");
const { recordArtifact, recordCommand, recordInteraction, recordDecision, recordGitFacts, verifySidecar } = require("./controller-runtime/evidence");
const { issueAction, issueCapability, prepareAdapter, submitOutcome } = require("./controller-runtime/adapter");
const { EDGES, next: nextLifecycle, recordEvent, validateEdge } = require("./controller-runtime/lifecycle");
const { advanceSpec, approveSpec, registerSpec } = require("./controller-runtime/spec");
const { advancePlan, approvePlan, createPlanMetadata, registerPlan } = require("./controller-runtime/plan");
const { authorizeTaskCommit, completeBuildTask, recordDownstreamImpact, runVerification, selectBuildTask } = require("./controller-runtime/build-task");
const { beginWholeBuild, finalizeWholeBuild, resumeAutoBuild, runWholeVerification, wholeReviewInputs } = require("./controller-runtime/whole-build");

const root = path.resolve(__dirname, "..");
const cliPath = path.join(root, "scripts", "mdf-controller.js");

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
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
  fs.writeFileSync(path.join(workItem, "item.md"), "---\nwork_id: \"2026-07-11-0032-context\"\n---\n");
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

    for (const relative of ["scripts/mdf-controller.js", "scripts/controller-runtime/context.js", "scripts/controller-runtime/evidence.js", "scripts/controller-runtime/adapter.js", "scripts/controller-runtime/lifecycle.js", "scripts/controller-runtime/spec.js", "scripts/controller-runtime/plan.js", "scripts/controller-runtime/build-task.js", "scripts/controller-runtime/whole-build.js"]) {
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
    expectCode(() => recordEvent(context, { event_id: "bad", from: "spec", to: "ship", evidence_files: [evidence] }), "MDF_LIFECYCLE_ILLEGAL_EDGE");
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
    const stopCli = spawnSync(process.execPath, [cliPath, "lifecycle", "record", "--cwd", stopped.worktree, "--plugin-root", root], { encoding: "utf8", input: JSON.stringify({ event_id: "stop", from: "spec", stop_reason: "human-required", evidence_files: [stopEvidence] }) });
    assert.strictEqual(stopCli.status, 0, stopCli.stderr);
    assert.strictEqual(nextLifecycle(context).stop.code, "MDF_STOP_HUMAN_REQUIRED");
    expectCode(() => recordEvent(context, { event_id: "bypass", from: "spec", to: "plan", evidence_files: [stopEvidence] }), "MDF_LIFECYCLE_STOPPED");
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
    const approval = approveSpec(context, { registration_file: auto.registration_file, user_message_path: "user.md", invocation_id: "user-1" });
    const mutation = registerSpec(context, { artifact_path: "spec-mutate.md", review_output_path: "review.md", review_decision_file: reviewFor("spec-mutate.md", "review-mutation"), mode: "auto" });
    fs.writeFileSync(path.join(context.work_item.path, "spec-mutate.md"), "after\n");
    expectCode(() => approveSpec(context, { registration_file: mutation.registration_file, user_message_path: "user.md", invocation_id: "user-mutation" }), "MDF_EVIDENCE_STALE");
    const revised = registerSpec(context, { artifact_path: "spec-002.md", review_output_path: "review.md", review_decision_file: reviewFor("spec-002.md", "review-spec-002"), mode: "auto" });
    expectCode(() => advanceSpec(context, { registration_file: revised.registration_file, approval_file: approval.approval_file }), "MDF_SPEC_APPROVAL_INVALID");
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
    const specApproval = approveSpec(context, { registration_file: specReg.registration_file, user_message_path: "user.md", invocation_id: "spec-user" });
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
    const approval = approvePlan(context, { registration_file: auto.registration_file, user_message_path: "user.md", invocation_id: "plan-user", affirmative: true });
    const revisionMetadata = createPlanMetadata(context, { artifact_path: "plan-2.md", spec_registration_file: specReg.registration_file, metadata }).metadata_file;
    const revision = registerPlan(context, { artifact_path: "plan-2.md", spec_registration_file: specReg.registration_file, metadata_file: revisionMetadata, review_output_path: "review.md", review_decision_file: reviewFor("plan-2.md", "plan-2-review", [`evidence/${specReg.registration_file}`, `evidence/${revisionMetadata}`]), mode: "auto" });
    expectCode(() => advancePlan(context, { registration_file: revision.registration_file, approval_file: approval.approval_file }), "MDF_PLAN_APPROVAL_INVALID");
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
    const command = runVerification(context, { attempt_file: attempt.attempt_file, command: [process.execPath, "-e", "process.stdout.write('pass\\n')"], output_path: "command.log" });
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

const args = new Set(process.argv.slice(2));
const group = process.argv[3];
if (process.argv.length !== 4 || process.argv[2] !== "--group" || !["context", "evidence", "adapter", "lifecycle", "spec", "plan", "build-task", "whole-build"].includes(group)) {
  console.error("Usage: node scripts/validate-mdf-controller-runtime.js --group context|evidence|adapter|lifecycle|spec|plan|build-task|whole-build");
  process.exit(1);
}

if (group === "context") runContextTests();
else if (group === "evidence") runEvidenceTests();
else if (group === "adapter") runAdapterTests();
else if (group === "lifecycle") runLifecycleTests();
else if (group === "spec") runSpecTests();
else if (group === "plan") runPlanTests();
else if (group === "build-task") runBuildTaskTests();
else runWholeBuildTests();
console.log(`MDF controller runtime validation passed for ${group}.`);
