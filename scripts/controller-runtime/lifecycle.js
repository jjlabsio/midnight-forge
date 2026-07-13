const fs = require("fs");
const path = require("path");
const { ControllerError } = require("./context");
const { recordDecision, recordInteraction, verifySidecar } = require("./evidence");

const EDGES = new Map([
  ["spec", ["plan"]], ["plan", ["build-task"]], ["build-task", ["build-task", "whole-build", "spec", "simplify"]],
  ["whole-build", ["simplify", "build-task", "spec"]], ["simplify", ["ship", "review", "build-task"]], ["review", ["ship", "build-task"]],
  ["ship", ["github-pr"]], ["github-pr", ["complete"]],
]);
const STOPS = new Set(["human-required", "malformed", "stale", "no-progress", "ambiguous"]);
const RESUMABLE_STOPS = new Set(["human-required", "no-progress", "ambiguous"]);
const nonempty = (value) => typeof value === "string" && value.trim().length > 0;

function validateEdge(from, to) {
  if (!EDGES.get(from)?.includes(to)) throw new ControllerError("MDF_LIFECYCLE_ILLEGAL_EDGE", "Lifecycle transition is not allowed.", { from, to });
}

function events(context) {
  const directory = path.join(context.work_item.path, "evidence");
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory).filter((file) => file.endsWith(".json")).flatMap((file) => {
    let value;
    try { value = verifySidecar(context, file, { fresh: false }); }
    catch (error) { throw new ControllerError(error.code === "MDF_EVIDENCE_STALE" ? "MDF_LIFECYCLE_STALE" : "MDF_LIFECYCLE_MALFORMED", "Lifecycle evidence cannot be verified.", { file, cause: error.code }); }
    return value.kind === "interaction" && value.invocation?.agent_id === "mdf-lifecycle" ? [{ file, value }] : [];
  });
}

function chain(context) {
  const all = events(context);
  const ordered = [];
  let previous = null;
  while (true) {
    const children = all.filter(({ value }) => (value.invocation.previous_event_file || null) === previous);
    if (children.length > 1) throw new ControllerError("MDF_LIFECYCLE_AMBIGUOUS", "Lifecycle has conflicting next events.", { previous });
    if (children.length === 0) break;
    ordered.push(children[0]);
    previous = children[0].file;
  }
  if (ordered.length !== all.length) throw new ControllerError("MDF_LIFECYCLE_MALFORMED", "Lifecycle contains an orphaned event.");
  return ordered;
}

function current(context) {
  const ordered = chain(context);
  const last = ordered.at(-1);
  return { phase: last?.value.invocation.to || "spec", event_file: last?.file || null, evidence_files: last?.value.inputs?.map((input) => input.path).filter((value) => value.startsWith("evidence/")).map((value) => value.slice("evidence/".length)) || [], stop_reason: last?.value.invocation.stop_reason || null };
}

function transitionEvidence(context, from, to) {
  return chain(context).filter(({ value }) => value.invocation.from === from && value.invocation.to === to).map(({ file, value }) => ({ file, evidence_files: value.inputs.map((input) => input.path).filter((input) => input.startsWith("evidence/")).map((input) => input.slice(9)) }));
}

function assertLifecycleReviewEvidence(context, file) {
  const sidecar = verifySidecar(context, file, { fresh: false });
  const direct = sidecar.kind === "interaction"
    ? sidecar
    : sidecar.kind === "decision" && sidecar.interaction?.file
      ? verifySidecar(context, sidecar.interaction.file, { fresh: false })
      : null;
  if (sidecar.kind === "interaction" && sidecar.invocation?.review_mode !== undefined && sidecar.invocation.agent_id !== "mdf-standalone-review") throw new ControllerError("MDF_LIFECYCLE_REVIEW_MODE_INVALID", "Review-mode interactions must originate from the standalone-review adapter before lifecycle consumption.", { file, agent_id: sidecar.invocation.agent_id || null });
  if (sidecar.conclusion?.kind === "standalone-review") {
    if (sidecar.conclusion.review_mode !== undefined && sidecar.conclusion.review_mode !== "lifecycle-review") throw new ControllerError("MDF_LIFECYCLE_REVIEW_MODE_INVALID", "Lifecycle transitions require resolver-owned lifecycle-review evidence.", { file, review_mode: sidecar.conclusion.review_mode || null });
    if (!direct || direct.invocation?.agent_id !== "mdf-standalone-review") throw new ControllerError("MDF_LIFECYCLE_REVIEW_MODE_INVALID", "Lifecycle review evidence must originate from the standalone-review adapter.", { file, agent_id: direct?.invocation?.agent_id || null });
    if (sidecar.conclusion.review_mode === undefined) throw new ControllerError("MDF_LIFECYCLE_REVIEW_MODE_INVALID", "Resolver-owned review evidence must carry an explicit lifecycle-review mode.", { file });
  }
  if (direct?.invocation?.agent_id === "mdf-standalone-review" && direct.invocation.review_mode !== "lifecycle-review") throw new ControllerError("MDF_LIFECYCLE_REVIEW_MODE_INVALID", "Direct task-review evidence cannot satisfy a lifecycle transition.", { file, review_mode: direct.invocation.review_mode || null });
  return sidecar;
}

function activePlanFile(context) {
  for (const { value } of [...chain(context)].reverse()) {
    for (const input of value.inputs || []) {
      if (!input.path.startsWith("evidence/")) continue;
      const file = input.path.slice(9);
      const evidence = verifySidecar(context, file, { fresh: false });
      const interaction = evidence.kind === "decision" ? verifySidecar(context, evidence.interaction?.file, { fresh: false }) : evidence;
      if (interaction.invocation?.agent_id === "mdf-plan") return file;
    }
  }
  return null;
}

function next(context) {
  try {
    const state = current(context);
    if (state.stop_reason) return { ok: false, stop: { code: `MDF_STOP_${state.stop_reason.toUpperCase().replaceAll("-", "_")}`, reason: state.stop_reason }, state };
    if (state.phase === "complete") return { ok: true, action: "complete", state };
    const last = chain(context).at(-1)?.value;
    return { ok: true, action: last?.invocation.next_action || EDGES.get(state.phase)[0], state };
  } catch (error) {
    if (error.code?.startsWith("MDF_LIFECYCLE_")) return { ok: false, stop: { code: error.code, reason: error.message } };
    throw error;
  }
}

function recordEvent(context, request) {
  if (!request || typeof request !== "object" || Array.isArray(request)) throw new ControllerError("MDF_LIFECYCLE_INPUT_INVALID", "Lifecycle event must be an object.");
  const { event_id: eventId, from, to, next_action: nextAction = null, evidence_files: evidenceFiles, stop_reason: stopReason = null } = request;
  if (!nonempty(eventId) || !nonempty(from) || !Array.isArray(evidenceFiles) || evidenceFiles.length === 0 || evidenceFiles.some((file) => !nonempty(file)) || (to !== undefined && to !== null && !nonempty(to)) || (nextAction !== null && !nonempty(nextAction)) || (stopReason !== null && !nonempty(stopReason))) throw new ControllerError("MDF_LIFECYCLE_INPUT_INVALID", "Lifecycle event fields are invalid.");
  const state = current(context);
  if (state.stop_reason) throw new ControllerError("MDF_LIFECYCLE_STOPPED", "Stopped lifecycle requires a separate decision-bound resume operation.", { stop_reason: state.stop_reason });
  if (state.phase !== from) throw new ControllerError("MDF_LIFECYCLE_ILLEGAL_EDGE", "Lifecycle event does not start at current phase.", { current: state.phase, from, to });
  if (stopReason) {
    if (!STOPS.has(stopReason)) throw new ControllerError("MDF_LIFECYCLE_STOP_INVALID", "Unknown lifecycle stop reason.");
  } else validateEdge(from, to);
  const resultingPhase = stopReason ? from : to;
  if (nextAction && nextAction !== resultingPhase && !EDGES.get(resultingPhase)?.includes(nextAction)) throw new ControllerError("MDF_LIFECYCLE_NEXT_INVALID", "Lifecycle next action is not legal from resulting phase.", { resulting_phase: resultingPhase, next_action: nextAction });
  for (const file of evidenceFiles) {
    assertLifecycleReviewEvidence(context, file);
    verifySidecar(context, file);
  }
  const inputPaths = evidenceFiles.map((file) => `evidence/${file}`);
  const event = recordInteraction(context, { invocation: { agent_id: "mdf-lifecycle", invocation_id: eventId, executor: "deterministic-runtime", previous_event_file: state.event_file, from, to: resultingPhase, next_action: nextAction, stop_reason: stopReason }, input_paths: inputPaths });
  return { file: event.file, ...next(context) };
}

function resumeLifecycle(context, { stop_event_file: stopEventFile, user_message_path: userMessagePath, invocation_id: invocationId, affirmative, evidence_files: evidenceFiles = [] }) {
  if (!nonempty(stopEventFile) || !nonempty(userMessagePath) || !nonempty(invocationId) || affirmative !== true || !Array.isArray(evidenceFiles) || new Set(evidenceFiles).size !== evidenceFiles.length || evidenceFiles.some((file) => !nonempty(file))) {
    throw new ControllerError("MDF_LIFECYCLE_RESUME_INVALID", "Lifecycle resume requires an explicit affirmative decision, current stop event, and optional evidence files.");
  }
  const state = current(context);
  if (!state.stop_reason || !RESUMABLE_STOPS.has(state.stop_reason) || state.event_file !== stopEventFile) {
    throw new ControllerError("MDF_LIFECYCLE_RESUME_INVALID", "Lifecycle resume must target the current resumable stop event.", { stop_event_file: stopEventFile, current_event_file: state.event_file, stop_reason: state.stop_reason });
  }
  const stop = verifySidecar(context, stopEventFile, { fresh: false });
  if (stop.kind !== "interaction" || stop.invocation?.agent_id !== "mdf-lifecycle" || stop.invocation?.stop_reason !== state.stop_reason || stop.invocation?.from !== state.phase || stop.invocation?.to !== state.phase) {
    throw new ControllerError("MDF_LIFECYCLE_RESUME_INVALID", "Lifecycle resume target is not a canonical stop event.");
  }
  evidenceFiles.forEach((file) => verifySidecar(context, file));
  const inputPaths = ["item.md", userMessagePath, `evidence/${stopEventFile}`, ...evidenceFiles.map((file) => `evidence/${file}`)];
  const authorization = recordInteraction(context, {
    invocation: {
      agent_id: "user-lifecycle-resume",
      invocation_id: invocationId,
      executor: "human",
      explicit_affirmative: true,
      stop_event_file: stopEventFile,
      stop_reason: state.stop_reason,
      phase: state.phase,
    },
    input_paths: inputPaths,
  });
  const decision = recordDecision(context, {
    interaction_file: authorization.file,
    conclusion: {
      kind: "lifecycle-resume",
      affirmative: true,
      stop_event_file: stopEventFile,
      stop_reason: state.stop_reason,
      phase: state.phase,
    },
  });
  const resumed = recordInteraction(context, {
    invocation: {
      agent_id: "mdf-lifecycle",
      invocation_id: `resume-${stopEventFile}-${Date.now()}`,
      executor: "deterministic-runtime",
      previous_event_file: stopEventFile,
      from: state.phase,
      to: state.phase,
      next_action: state.phase,
      stop_reason: null,
      resume_decision_file: decision.file,
    },
    input_paths: [`evidence/${decision.file}`],
  });
  return { resume_file: decision.file, file: resumed.file, ...next(context) };
}

module.exports = { EDGES, activePlanFile, assertLifecycleReviewEvidence, current, next, recordEvent, resumeLifecycle, transitionEvidence, validateEdge };
