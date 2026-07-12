const crypto = require("crypto");
const fs = require("fs");
const { ControllerError, resolvePluginPath } = require("./context");
const { recordDecision, recordInteraction, verifySidecar } = require("./evidence");

const MODES = new Set(["fresh", "root-fallback", "degraded"]);
const CAPABILITY_SOURCES = new Set(["runtime-verified", "root-observed"]);
const FALLBACK_SOURCES = new Set(["fresh-unavailable", "capability-unverified", "runtime-limited"]);
const EXECUTORS = new Set(["root", "subagent"]);
const hash = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const nonempty = (value) => typeof value === "string" && value.trim().length > 0;

function primitive(context, skillPath, personaPath) {
  const skill = resolvePluginPath(context.plugin_root, skillPath);
  const persona = nonempty(personaPath) ? resolvePluginPath(context.plugin_root, personaPath) : null;
  return { skill: { path: skill, bytes_sha256: hash(skill) }, persona: persona ? { path: persona, bytes_sha256: hash(persona) } : null };
}

function issueAction(context, request) {
  if (!nonempty(request?.action_id) || !nonempty(request?.action) || !Array.isArray(request.input_paths)) throw new ControllerError("MDF_ADAPTER_ACTION_INVALID", "Runtime action requires non-empty identity, action, and exact inputs.");
  const exact = primitive(context, request.skill_path, request.persona_path);
  const interaction = recordInteraction(context, { invocation: { agent_id: "mdf-runtime", invocation_id: request.action_id, executor: "deterministic-runtime", action_id: request.action_id, action: request.action, skill_path: request.skill_path, persona_path: request.persona_path || null, skill_sha256: exact.skill.bytes_sha256, persona_sha256: exact.persona?.bytes_sha256 || null }, input_paths: request.input_paths });
  return { version: 1, action_file: interaction.file, action_id: request.action_id, action: request.action, ...exact };
}

function actionRecord(context, file) {
  const action = verifySidecar(context, file);
  if (action.kind !== "interaction" || action.invocation?.agent_id !== "mdf-runtime" || action.invocation?.executor !== "deterministic-runtime") throw new ControllerError("MDF_ADAPTER_ACTION_INVALID", "Adapter requires a runtime-issued action record.");
  const exact = primitive(context, action.invocation.skill_path, action.invocation.persona_path);
  if (exact.skill.bytes_sha256 !== action.invocation.skill_sha256 || (exact.persona?.bytes_sha256 || null) !== action.invocation.persona_sha256) throw new ControllerError("MDF_ADAPTER_PRIMITIVE_STALE", "Exact skill or persona changed after action issue.");
  return { action, exact };
}

function validateInvocation(invocation, personaRequired) {
  const capability = invocation?.capability;
  if (![invocation?.agent_id, invocation?.invocation_id, invocation?.model_capability].every(nonempty) || !EXECUTORS.has(invocation?.executor)) throw new ControllerError("MDF_ADAPTER_INVOCATION_INVALID", "Adapter requires enumerated executor and non-empty invocation provenance.");
  if (!capability || capability.persona_loaded !== personaRequired || (!personaRequired && invocation.executor !== "root") || capability.reasoning_capable !== true || capability.model_suitable !== true || !CAPABILITY_SOURCES.has(capability.source)) throw new ControllerError("MDF_ADAPTER_CAPABILITY_UNSUPPORTED", "Adapter capability is unsupported or unproven.");
  if (!MODES.has(invocation.freshness)) throw new ControllerError("MDF_ADAPTER_FRESHNESS_INVALID", "Invalid adapter freshness mode.");
  if (invocation.freshness === "fresh") {
    if (invocation.executor === "root" || capability.fresh_context !== true || invocation.fallback) throw new ControllerError("MDF_ADAPTER_MODE_INCONSISTENT", "Fresh mode requires non-root fresh execution without fallback.");
  } else if (invocation.executor !== "root" || capability.fresh_context === true || !nonempty(invocation.fallback?.reason) || !FALLBACK_SOURCES.has(invocation.fallback?.source)) {
    throw new ControllerError("MDF_ADAPTER_MODE_INCONSISTENT", "Fallback mode provenance is inconsistent.");
  }
}

function issueCapability(context, request) {
  const { persona_path: personaPath, evidence_path: evidencePath, ...invocation } = request;
  if (!nonempty(evidencePath)) throw new ControllerError("MDF_ADAPTER_CAPABILITY_EVIDENCE_MISSING", "Capability issuance requires a canonical runtime observation artifact.");
  const persona = nonempty(personaPath) ? resolvePluginPath(context.plugin_root, personaPath) : null;
  validateInvocation(invocation, Boolean(persona));
  const personaHash = persona ? hash(persona) : null;
  const record = recordInteraction(context, { invocation: { agent_id: "mdf-capability-runtime", invocation_id: invocation.invocation_id, executor: "deterministic-runtime", capability: invocation, persona_path: personaPath || null, persona_sha256: personaHash, evidence_path: evidencePath }, input_paths: [evidencePath] });
  return { version: 1, capability_file: record.file, persona: persona ? { path: persona, bytes_sha256: personaHash } : null };
}

function invocationClaim(invocation) {
  return Object.fromEntries(["agent_id", "invocation_id", "executor", "model_capability", "freshness", "capability", "fallback"].filter((key) => invocation[key] !== undefined).map((key) => [key, invocation[key]]));
}

function capabilityRecord(context, file, invocation, personaPath, personaHash) {
  const record = verifySidecar(context, file);
  const capability = record.invocation?.capability;
  if (record.kind !== "interaction" || record.invocation?.agent_id !== "mdf-capability-runtime" || JSON.stringify(capability) !== JSON.stringify(invocationClaim(invocation)) || record.invocation.persona_path !== personaPath || record.invocation.persona_sha256 !== personaHash) {
    throw new ControllerError("MDF_ADAPTER_CAPABILITY_MISMATCH", "Invocation does not match its capability provenance record.");
  }
  return record;
}

function prepareAdapter(context, request) {
  const { action, exact } = actionRecord(context, request.action_file);
  validateInvocation(request?.invocation, Boolean(exact.persona));
  if (!nonempty(request.capability_file)) throw new ControllerError("MDF_ADAPTER_CAPABILITY_MISSING", "Adapter prepare requires a capability provenance record.");
  const capability = capabilityRecord(context, request.capability_file, request.invocation, action.invocation.persona_path, exact.persona?.bytes_sha256 || null);
  const invocation = { ...request.invocation, adapter_stage: "prepared", action_file: request.action_file, capability_file: request.capability_file, capability_integrity_sha256: capability.integrity_sha256, action_id: action.invocation.action_id, action: action.invocation.action, skill_sha256: exact.skill.bytes_sha256, persona_sha256: exact.persona?.bytes_sha256 || null };
  const interaction = recordInteraction(context, { invocation, input_paths: action.inputs.map((input) => input.path) });
  return { version: 1, action_file: request.action_file, action_id: invocation.action_id, action: invocation.action, ...exact, invocation, interaction_file: interaction.file };
}

function submitOutcome(context, request) {
  if (!nonempty(request?.interaction_file) || !nonempty(request?.action_id) || !nonempty(request?.output_path) || !request.outcome || typeof request.outcome !== "object" || Array.isArray(request.outcome)) throw new ControllerError("MDF_ADAPTER_OUTCOME_INVALID", "Outcome requires prepared interaction, structured result, and raw output artifact.");
  const interaction = verifySidecar(context, request.interaction_file);
  if (interaction.invocation?.adapter_stage !== "prepared") throw new ControllerError("MDF_ADAPTER_PREPARE_REQUIRED", "Outcome requires an adapter-prepared interaction.");
  const { action } = actionRecord(context, interaction.invocation.action_file);
  validateInvocation(interaction.invocation, nonempty(action.invocation.persona_path));
  if (interaction.invocation?.action_id !== request.action_id) throw new ControllerError("MDF_ADAPTER_ACTION_MISMATCH", "Outcome action does not match invocation.");
  const capability = capabilityRecord(context, interaction.invocation.capability_file, interaction.invocation, action.invocation.persona_path, interaction.invocation.persona_sha256);
  if (capability.integrity_sha256 !== interaction.invocation.capability_integrity_sha256) throw new ControllerError("MDF_ADAPTER_CAPABILITY_MISMATCH", "Prepared capability provenance changed.");
  if (action.invocation.action_id !== request.action_id || interaction.invocation.skill_sha256 !== action.invocation.skill_sha256 || interaction.invocation.persona_sha256 !== action.invocation.persona_sha256) throw new ControllerError("MDF_ADAPTER_PRIMITIVE_STALE", "Outcome provenance no longer matches runtime action.");
  const dependencyPaths = [request.output_path, ...action.inputs.map((input) => input.path), ...capability.inputs.map((input) => input.path), `evidence/${request.interaction_file}`, `evidence/${interaction.invocation.action_file}`, `evidence/${interaction.invocation.capability_file}`];
  const execution = recordInteraction(context, { invocation: { ...invocationClaim(interaction.invocation), adapter_stage: "executed", prepared_interaction_file: request.interaction_file, action_file: interaction.invocation.action_file, capability_file: interaction.invocation.capability_file, action_id: request.action_id, output_path: request.output_path, skill_sha256: interaction.invocation.skill_sha256, persona_sha256: interaction.invocation.persona_sha256 }, input_paths: [...new Set(dependencyPaths)] });
  const decision = recordDecision(context, { interaction_file: execution.file, conclusion: { ...request.outcome, action_id: request.action_id } });
  return { version: 1, action_id: request.action_id, interaction_file: request.interaction_file, execution_file: execution.file, decision_file: decision.file };
}

function verifyAdapterDecision(context, decisionFile, expected) {
  const decision = verifySidecar(context, decisionFile);
  const execution = verifySidecar(context, decision.interaction?.file);
  if (decision.kind !== "decision" || execution.invocation?.adapter_stage !== "executed") throw new ControllerError("MDF_ADAPTER_DECISION_INVALID", "Decision is not an adapter execution result.");
  const prepared = verifySidecar(context, execution.invocation.prepared_interaction_file);
  if (prepared.kind !== "interaction" || prepared.invocation?.adapter_stage !== "prepared") throw new ControllerError("MDF_ADAPTER_DECISION_INVALID", "Adapter prepared provenance is missing.");
  const { action } = actionRecord(context, execution.invocation.action_file);
  capabilityRecord(context, execution.invocation.capability_file, execution.invocation, action.invocation.persona_path, execution.invocation.persona_sha256);
  if (action.invocation.action !== expected.action || action.invocation.skill_path !== expected.skill_path || action.invocation.persona_path !== expected.persona_path || execution.invocation.output_path !== expected.output_path) throw new ControllerError("MDF_ADAPTER_DECISION_MISMATCH", "Adapter decision does not match expected action, primitives, or output.");
  return { decision, execution, action };
}

module.exports = { issueAction, issueCapability, prepareAdapter, submitOutcome, verifyAdapterDecision };
