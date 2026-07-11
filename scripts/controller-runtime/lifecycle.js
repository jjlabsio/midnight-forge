const fs = require("fs");
const path = require("path");
const { ControllerError } = require("./context");
const { recordInteraction, verifySidecar } = require("./evidence");

const EDGES = new Map([
  ["spec", ["plan"]], ["plan", ["build-task"]], ["build-task", ["build-task", "whole-build", "spec", "simplify"]],
  ["whole-build", ["simplify", "build-task", "spec"]], ["simplify", ["review", "build-task"]], ["review", ["ship"]],
  ["ship", ["github-pr"]], ["github-pr", ["complete"]],
]);
const STOPS = new Set(["human-required", "malformed", "stale", "no-progress", "ambiguous"]);
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
  if (nextAction && !EDGES.get(resultingPhase)?.includes(nextAction)) throw new ControllerError("MDF_LIFECYCLE_NEXT_INVALID", "Lifecycle next action is not legal from resulting phase.", { resulting_phase: resultingPhase, next_action: nextAction });
  for (const file of evidenceFiles) verifySidecar(context, file);
  const inputPaths = evidenceFiles.map((file) => `evidence/${file}`);
  const event = recordInteraction(context, { invocation: { agent_id: "mdf-lifecycle", invocation_id: eventId, executor: "deterministic-runtime", previous_event_file: state.event_file, from, to: resultingPhase, next_action: nextAction, stop_reason: stopReason }, input_paths: inputPaths });
  return { file: event.file, ...next(context) };
}

module.exports = { EDGES, current, next, recordEvent, transitionEvidence, validateEdge };
