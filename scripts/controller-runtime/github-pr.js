const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { ControllerError } = require("./context");
const { recordCommand, recordDecision, recordInteraction, verifySidecar } = require("./evidence");
const { activePlanFile, current, recordEvent, transitionEvidence } = require("./lifecycle");

const nonempty = (value) => typeof value === "string" && value.trim().length > 0;

function git(context, args) {
  const result = spawnSync("git", args, { cwd: context.worktree, encoding: "utf8" });
  if (result.status !== 0) throw new ControllerError("MDF_GITHUB_PR_GIT_FAILED", "Could not compute GitHub PR handoff Git facts.", { args, stderr: result.stderr });
  return result.stdout.trim();
}

function recordGithubPrAuthority(context, { user_message_path: userMessagePath, affirmative, push, pull_request: pullRequest }) {
  if (!nonempty(userMessagePath) || affirmative !== true || push !== true || pullRequest !== true) throw new ControllerError("MDF_GITHUB_PR_AUTHORITY_INVALID", "GitHub PR authority requires an explicit user message authorizing push and pull-request mutation.");
  const interaction = recordInteraction(context, { invocation: { agent_id: "user-github-pr-authority", invocation_id: `github-pr-authority-${Date.now()}`, executor: "human", affirmative: true, push: true, pull_request: true, user_message_path: userMessagePath }, input_paths: ["item.md", userMessagePath] });
  const decision = recordDecision(context, { interaction_file: interaction.file, conclusion: { kind: "github-pr-authority", affirmative: true, push: true, pull_request: true, user_message_path: userMessagePath } });
  return { authority_file: decision.file };
}

function observeCommand(context, command, name) {
  const result = spawnSync(command[0], command.slice(1), { cwd: context.worktree, encoding: "utf8" });
  const exitCode = Number.isInteger(result.status) ? result.status : 1;
  const outputPath = `github-pr-observation-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}.log`;
  fs.writeFileSync(path.join(context.work_item.path, outputPath), `${result.stdout || ""}${result.stderr || ""}`);
  const record = recordCommand(context, { command, output_path: outputPath, exit_code: exitCode });
  return { exit_code: exitCode, stdout: result.stdout || "", output_path: outputPath, command_file: record.file };
}

function parseJson(value) { try { return JSON.parse(value); } catch (_error) { return null; } }

function observeGithubPrBoundary(context, external) {
  if (current(context).phase !== "github-pr") throw new ControllerError("MDF_GITHUB_PR_PHASE_INVALID", "GitHub PR observation requires github-pr phase.");
  if (!external || typeof external !== "object" || Array.isArray(external) || Object.keys(external).some((key) => key !== "authority_file")) throw new ControllerError("MDF_GITHUB_PR_CALLER_FACTS_FORBIDDEN", "GitHub PR observation does not accept caller-asserted Git or GitHub facts.");
  const { authority_file: authorityFile = null } = external;
  if (authorityFile !== null && !nonempty(authorityFile)) throw new ControllerError("MDF_GITHUB_PR_OBSERVATION_INVALID", "GitHub PR authority reference is malformed.");
  let authority = null;
  if (authorityFile) {
    try {
      const authorityDecision = verifySidecar(context, authorityFile);
      const authorityInteraction = verifySidecar(context, authorityDecision.interaction.file);
      const conclusion = authorityDecision.conclusion;
      const inputPaths = authorityInteraction.inputs.map((input) => input.path).sort();
      const expected = ["item.md", conclusion?.user_message_path].sort();
      if (conclusion?.kind !== "github-pr-authority" || conclusion.affirmative !== true || conclusion.push !== true || conclusion.pull_request !== true || authorityInteraction.invocation?.agent_id !== "user-github-pr-authority" || authorityInteraction.invocation?.executor !== "human" || authorityInteraction.invocation?.affirmative !== true || JSON.stringify(inputPaths) !== JSON.stringify(expected)) throw new ControllerError("MDF_GITHUB_PR_AUTHORITY_INVALID", "GitHub PR authority provenance is invalid.");
      authority = { file: authorityFile, push: true, pull_request: true, status: "valid" };
    } catch (error) {
      if (!(error instanceof ControllerError)) throw error;
      authority = { file: authorityFile, push: false, pull_request: false, status: "invalid" };
    }
  }
  const branch = git(context, ["branch", "--show-current"]);
  const upstream = observeCommand(context, ["git", "rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"], "upstream");
  const ahead = upstream.exit_code === 0 ? observeCommand(context, ["git", "rev-list", "--count", "@{upstream}..HEAD"], "ahead") : null;
  const repo = observeCommand(context, ["gh", "repo", "view", "--json", "defaultBranchRef"], "repo");
  const prs = observeCommand(context, ["gh", "pr", "list", "--state", "all", "--head", branch, "--json", "url,state"], "prs");
  const repoJson = repo.exit_code === 0 ? parseJson(repo.stdout) : null;
  const prsJson = prs.exit_code === 0 ? parseJson(prs.stdout) : null;
  const repoValid = nonempty(repoJson?.defaultBranchRef?.name);
  const prsValid = Array.isArray(prsJson) && prsJson.every((pr) => pr && nonempty(pr.url) && new Set(["open", "closed", "merged"]).has(String(pr.state || "").toLowerCase()));
  const openPrs = prsValid ? prsJson.map((pr) => ({ url: pr.url, state: pr.state.toLowerCase() })) : [];
  const defaultBranch = repoValid ? repoJson.defaultBranchRef.name : null;
  const unpushedCommits = ahead?.exit_code === 0 && /^\d+$/.test(ahead.stdout.trim()) ? Number(ahead.stdout.trim()) : null;
  const observationInputs = [upstream, ...(ahead ? [ahead] : []), repo, prs].flatMap((record) => [record.output_path, `evidence/${record.command_file}`]);
  const facts = {
    kind: "github-pr-external-state",
    head: git(context, ["rev-parse", "HEAD"]),
    branch,
    dirty: Boolean(git(context, ["status", "--porcelain"])),
    default_branch: defaultBranch,
    upstream_state: upstream.exit_code === 0 && ahead?.exit_code === 0 ? "known" : "ambiguous",
    unpushed_commits: unpushedCommits,
    open_prs: openPrs,
    github_state: repoValid && prsValid ? "known" : "ambiguous",
    authority,
  };
  const interaction = recordInteraction(context, { invocation: { agent_id: "mdf-github-pr-observer", invocation_id: `github-pr-observe-${facts.head}-${Date.now()}`, executor: "external-boundary-adapter", observation: facts }, input_paths: ["item.md", ...observationInputs, ...(authorityFile ? [`evidence/${authorityFile}`] : [])] });
  const decision = recordDecision(context, { interaction_file: interaction.file, conclusion: facts });
  return { observation_file: decision.file, mutation_performed: false };
}

function transitionFile(context, from, to, predicate, code) {
  const candidates = transitionEvidence(context, from, to).at(-1)?.evidence_files || [];
  const file = candidates.find((candidate) => predicate(verifySidecar(context, candidate, { fresh: false }), candidate));
  if (!file) throw new ControllerError(code, `GitHub PR handoff is missing canonical ${from} evidence.`);
  return file;
}

function unwrapInteraction(context, file) {
  const value = verifySidecar(context, file, { fresh: false });
  return value.kind === "decision" ? verifySidecar(context, value.interaction.file, { fresh: false }) : value;
}

function canonicalReferences(context) {
  const planFile = activePlanFile(context);
  if (!planFile) throw new ControllerError("MDF_GITHUB_PR_PLAN_MISSING", "GitHub PR handoff is missing the active canonical plan.");
  const plan = unwrapInteraction(context, planFile);
  const specFile = plan.invocation.spec_registration_file;
  if (!nonempty(specFile)) throw new ControllerError("MDF_GITHUB_PR_SPEC_MISSING", "GitHub PR handoff plan does not reference a canonical spec.");
  verifySidecar(context, specFile, { fresh: false });
  const buildFile = transitionFile(context, "build-task", "whole-build", (value) => value.conclusion?.kind === "whole-build-stable", "MDF_GITHUB_PR_BUILD_MISSING");
  const standaloneEvent = transitionEvidence(context, "review", "ship").at(-1);
  const standaloneFile = standaloneEvent?.evidence_files.find((file) => { const value = verifySidecar(context, file, { fresh: false }); return value.conclusion?.kind === "standalone-review" && value.conclusion.disposition === "pass"; });
  const noChangeEvent = transitionEvidence(context, "simplify", "ship").at(-1);
  const noChangeFile = noChangeEvent?.evidence_files.find((file) => verifySidecar(context, file, { fresh: false }).conclusion?.kind === "simplification-no-change");
  let reviewFile = standaloneFile;
  if (!reviewFile && noChangeFile) {
    const noChange = verifySidecar(context, noChangeFile, { fresh: false }); const noChangeInteraction = verifySidecar(context, noChange.interaction.file, { fresh: false });
    const stableInteraction = verifySidecar(context, verifySidecar(context, buildFile, { fresh: false }).interaction.file, { fresh: false });
    if (noChangeInteraction.invocation?.agent_id !== "mdf-simplification-no-change" || noChange.conclusion.stable_file !== buildFile || noChangeInteraction.invocation.stable_file !== buildFile || noChange.conclusion.review_file !== stableInteraction.invocation.review_decision_file) throw new ControllerError("MDF_GITHUB_PR_REVIEW_MISSING", "GitHub PR handoff review does not match the final stable tree.");
    reviewFile = noChange.conclusion.review_file;
  }
  if (!reviewFile) throw new ControllerError("MDF_GITHUB_PR_REVIEW_MISSING", "GitHub PR handoff is missing canonical final-tree review evidence.");
  const shipFile = transitionFile(context, "ship", "github-pr", (value) => value.conclusion?.kind === "ship-decision", "MDF_GITHUB_PR_SHIP_INVALID");
  return { task_id: context.lock.task_id, work_id: context.work_item.id, item_path: "item.md", spec_file: specFile, plan_file: planFile, build_file: buildFile, review_file: reviewFile, ship_file: shipFile };
}

function ambiguous(context, observation) {
  const open = observation.open_prs.filter((pr) => pr.state === "open");
  return observation.dirty || !nonempty(observation.branch) || observation.branch !== context.lock.branch || !nonempty(observation.default_branch) || observation.branch === observation.default_branch || observation.upstream_state !== "known" || observation.github_state !== "known" || !Number.isInteger(observation.unpushed_commits) || open.length > 1 || observation.authority?.status !== "valid" || observation.authority?.push !== true || observation.authority?.pull_request !== true;
}

function prepareGithubPrHandoff(context, { observation_file: observationFile }) {
  if (current(context).phase !== "github-pr") throw new ControllerError("MDF_GITHUB_PR_PHASE_INVALID", "GitHub PR handoff requires github-pr phase.");
  const observationDecision = verifySidecar(context, observationFile);
  const observation = observationDecision.conclusion;
  if (observation?.kind !== "github-pr-external-state") throw new ControllerError("MDF_GITHUB_PR_OBSERVATION_INVALID", "GitHub PR handoff requires a current external observation.");
  if (ambiguous(context, observation)) {
    const stop = recordDecision(context, { interaction_file: observationDecision.interaction.file, conclusion: { kind: "github-pr-stop", reason: "ambiguous", observation_file: observationFile, mutation_performed: false } });
    return { ...recordEvent(context, { event_id: `github-pr-stop-${stop.file}`, from: "github-pr", evidence_files: [stop.file], stop_reason: "ambiguous" }), action: "stop", mutation_performed: false, stop_file: stop.file };
  }
  const references = canonicalReferences(context);
  verifySidecar(context, references.build_file);
  verifySidecar(context, references.review_file);
  const ship = verifySidecar(context, references.ship_file);
  if (ship.conclusion?.disposition !== "GO" || ship.conclusion.head !== observation.head) throw new ControllerError("MDF_GITHUB_PR_SHIP_INVALID", "Only current-tree ship GO evidence can produce a GitHub PR handoff.");
  const inputPaths = ["item.md", `evidence/${observationFile}`, ...[references.spec_file, references.plan_file, references.build_file, references.review_file, references.ship_file].map((file) => `evidence/${file}`)];
  const interaction = recordInteraction(context, { invocation: { agent_id: "mdf-github-pr-handoff", invocation_id: `github-pr-handoff-${observation.head}-${Date.now()}`, executor: "deterministic-runtime", references, existing_github_pr_authoritative: true, mutation_performed: false }, input_paths: inputPaths });
  const handoff = recordDecision(context, { interaction_file: interaction.file, conclusion: { kind: "github-pr-handoff", head: observation.head, references, existing_github_pr_authoritative: true, mutation_performed: false } });
  return { action: "github-pr", references, handoff_file: handoff.file, mutation_performed: false };
}

module.exports = { observeGithubPrBoundary, prepareGithubPrHandoff, recordGithubPrAuthority };
