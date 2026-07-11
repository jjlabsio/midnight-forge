const { spawnSync } = require("child_process");
const { ControllerError } = require("./context");
const { verifyAdapterDecision } = require("./adapter");
const { recordDecision, recordInteraction, verifySidecar } = require("./evidence");
const { current, recordEvent, transitionEvidence } = require("./lifecycle");

const PERSONAS = new Map([["code-reviewer", "agents/code-reviewer.md"], ["security-auditor", "agents/security-auditor.md"], ["test-engineer", "agents/test-engineer.md"]]);
const nonempty = (value) => typeof value === "string" && value.trim().length > 0;
function git(context, args) { const result = spawnSync("git", args, { cwd: context.worktree, encoding: "utf8" }); if (result.status !== 0) throw new ControllerError("MDF_SHIP_GIT_FAILED", "Could not compute ship Git facts.", { stderr: result.stderr }); return result.stdout.trim(); }

function createShipContext(context) {
  if (current(context).phase !== "ship" || git(context, ["status", "--porcelain"])) throw new ControllerError("MDF_SHIP_PHASE_INVALID", "Ship context requires clean ship phase.");
  const reviewEvent = transitionEvidence(context, "review", "ship").at(-1);
  const reviewFile = reviewEvent?.evidence_files.find((file) => { const value = verifySidecar(context, file, { fresh: false }); return value.conclusion?.kind === "standalone-review" && value.conclusion.disposition === "pass"; });
  const planEvent = transitionEvidence(context, "plan", "build-task").at(-1);
  const planFile = planEvent?.evidence_files.find((file) => verifySidecar(context, file, { fresh: false }).invocation?.agent_id === "mdf-plan");
  if (!reviewFile || !planFile) throw new ControllerError("MDF_SHIP_CONTEXT_INVALID", "Ship requires current passing review and active plan.");
  const review = verifySidecar(context, reviewFile);
  const reviewInteraction = verifySidecar(context, review.interaction.file);
  const head = git(context, ["rev-parse", "HEAD"]);
  if (reviewInteraction.invocation?.agent_id !== "mdf-standalone-review" || review.conclusion.head !== head) throw new ControllerError("MDF_SHIP_CONTEXT_INVALID", "Ship review must be provenance-bound to the current tree.");
  const anchorEvent = verifySidecar(context, planEvent.file, { fresh: false });
  const numstat = git(context, ["diff", "--numstat", anchorEvent.git.head, "HEAD", "--"]);
  const rows = numstat ? numstat.split("\n").map((line) => line.split("\t")) : [];
  const paths = rows.map((row) => row[2]);
  const lines = rows.reduce((sum, row) => sum + (Number(row[0]) || 0) + (Number(row[1]) || 0), 0);
  const binary = rows.some((row) => row[0] === "-" || row[1] === "-");
  const sensitive = paths.some((file) => /(auth|payments?|data|database|storage|config|\.env)/i.test(file));
  const smallChange = paths.length <= 2 && lines < 50 && !binary && !sensitive;
  const shipContext = recordInteraction(context, { invocation: { agent_id: "mdf-ship-context", invocation_id: `ship-${head}`, executor: "deterministic-runtime", review_file: reviewFile, plan_registration_file: planFile, head, changed_paths: paths, changed_lines: lines, binary, sensitive, small_change_exception: smallChange, required_personas: smallChange ? [] : [...PERSONAS.keys()] }, input_paths: [`evidence/${reviewFile}`, `evidence/${planFile}`] });
  return { context_file: shipContext.file, head, small_change_exception: smallChange, required_personas: shipContext.invocation.required_personas, persona_input_paths: [`evidence/${shipContext.file}`] };
}

function blockedRiskSet(context, contextFile, reportFiles) {
  if (!Array.isArray(reportFiles) || reportFiles.length === 0 || new Set(reportFiles).size !== reportFiles.length) throw new ControllerError("MDF_SHIP_RISK_ACCEPTANCE_INVALID", "Risk acceptance requires exact report decisions.");
  return [...new Set(reportFiles.flatMap((file) => {
    const decision = verifySidecar(context, file);
    const execution = verifySidecar(context, decision.interaction?.file);
    const action = verifySidecar(context, execution.invocation?.action_file);
    if (action.invocation?.action !== "ship-persona" || action.inputs?.length !== 1 || action.inputs[0].path !== `evidence/${contextFile}` || !new Set(["pass", "block"]).has(decision.conclusion?.disposition) || typeof decision.conclusion.critical !== "boolean" || !Array.isArray(decision.conclusion.risk_ids)) throw new ControllerError("MDF_SHIP_RISK_ACCEPTANCE_INVALID", "Risk acceptance report provenance is invalid.");
    return decision.conclusion.disposition === "block" || decision.conclusion.critical ? decision.conclusion.risk_ids : [];
  }))].sort();
}

function recordRiskAcceptance(context, { context_file: contextFile, user_message_path: userPath, report_decision_files: reportFiles, risk_ids: riskIds, affirmative }) {
  const blockedRisks = blockedRiskSet(context, contextFile, reportFiles);
  if (affirmative !== true || !Array.isArray(riskIds) || JSON.stringify([...riskIds].sort()) !== JSON.stringify(blockedRisks) || blockedRisks.length === 0) throw new ControllerError("MDF_SHIP_RISK_ACCEPTANCE_INVALID", "Risk acceptance requires explicit affirmative action and exact current blocking risks.");
  const shipContext = verifySidecar(context, contextFile);
  const sortedReports = [...reportFiles].sort();
  const interaction = recordInteraction(context, { invocation: { agent_id: "user-risk-acceptance", invocation_id: `risk-${Date.now()}`, executor: "human", context_file: contextFile, report_decision_files: sortedReports, risk_ids: blockedRisks, affirmative: true }, input_paths: [userPath, `evidence/${contextFile}`, ...sortedReports.map((file) => `evidence/${file}`)] });
  const decision = recordDecision(context, { interaction_file: interaction.file, conclusion: { kind: "ship-risk-acceptance", context_file: contextFile, head: shipContext.invocation.head, report_decision_files: sortedReports, risk_ids: blockedRisks, affirmative: true } });
  return { acceptance_file: decision.file };
}

function registerShip(context, { context_file: contextFile, reports, output_path: outputPath, decision_file: decisionFile, risk_acceptance_file: acceptanceFile = null }) {
  const shipContext = verifySidecar(context, contextFile);
  if (shipContext.invocation?.agent_id !== "mdf-ship-context" || current(context).phase !== "ship") throw new ControllerError("MDF_SHIP_CONTEXT_INVALID", "Ship decision requires current ship context.");
  if (!Array.isArray(reports)) throw new ControllerError("MDF_SHIP_REPORTS_INVALID", "Ship reports must be an array.");
  const required = shipContext.invocation.required_personas;
  if (reports.length !== required.length || new Set(reports.map((report) => report.persona)).size !== reports.length || reports.some((report) => !required.includes(report.persona))) throw new ControllerError("MDF_SHIP_REPORTS_INVALID", "Ship persona reports do not match required fan-out or exact exception.");
  const verified = reports.map((report) => {
    const personaPath = PERSONAS.get(report.persona);
    const { decision, action } = verifyAdapterDecision(context, report.decision_file, { action: "ship-persona", skill_path: "skills/shipping-and-launch/SKILL.md", persona_path: personaPath, output_path: report.output_path });
    const blocking = decision.conclusion?.disposition === "block" || decision.conclusion?.critical === true;
    if (!new Set(["pass", "block"]).has(decision.conclusion?.disposition) || typeof decision.conclusion.critical !== "boolean" || !Array.isArray(decision.conclusion.risk_ids) || decision.conclusion.risk_ids.some((id) => !nonempty(id)) || (blocking && decision.conclusion.risk_ids.length === 0) || JSON.stringify(action.inputs.map((input) => input.path)) !== JSON.stringify([`evidence/${contextFile}`])) throw new ControllerError("MDF_SHIP_REPORTS_INVALID", "Persona report is stale, unsupported, or malformed.");
    return { ...report, decision };
  });
  const synthesisInputs = [`evidence/${contextFile}`, ...verified.flatMap(({ output_path: reportPath, decision_file: reportFile }) => [reportPath, `evidence/${reportFile}`]), ...(acceptanceFile ? [`evidence/${acceptanceFile}`] : [])].sort();
  const { decision: synthesis, action } = verifyAdapterDecision(context, decisionFile, { action: "ship-synthesis", skill_path: "skills/shipping-and-launch/SKILL.md", persona_path: "agents/code-reviewer.md", output_path: outputPath });
  if (JSON.stringify(action.inputs.map((input) => input.path).sort()) !== JSON.stringify(synthesisInputs) || !new Set(["GO", "NO-GO"]).has(synthesis.conclusion?.disposition) || ![synthesis.conclusion.rollback?.trigger_conditions, synthesis.conclusion.rollback?.procedure, synthesis.conclusion.rollback?.recovery_time_objective].every(nonempty) || (shipContext.invocation.small_change_exception && synthesis.conclusion.small_change_direct_review !== true)) throw new ControllerError("MDF_SHIP_DECISION_INVALID", "Root ship synthesis must bind exact reports and mandatory rollback plan.");
  const blockedRisks = [...new Set(verified.filter(({ decision }) => decision.conclusion.disposition === "block" || decision.conclusion.critical).flatMap(({ decision }) => decision.conclusion.risk_ids))];
  let acceptance = null;
  if (acceptanceFile) { acceptance = verifySidecar(context, acceptanceFile); if (acceptance.conclusion?.kind !== "ship-risk-acceptance" || acceptance.conclusion.context_file !== contextFile || acceptance.conclusion.head !== shipContext.invocation.head || acceptance.conclusion.affirmative !== true || JSON.stringify(acceptance.conclusion.report_decision_files) !== JSON.stringify(verified.map((report) => report.decision_file).sort()) || JSON.stringify(acceptance.conclusion.risk_ids) !== JSON.stringify([...blockedRisks].sort())) throw new ControllerError("MDF_SHIP_RISK_ACCEPTANCE_INVALID", "Risk acceptance does not match current reports and risks."); }
  if (synthesis.conclusion.disposition === "GO" && blockedRisks.some((risk) => !acceptance?.conclusion.risk_ids.includes(risk))) throw new ControllerError("MDF_SHIP_RISK_ACCEPTANCE_REQUIRED", "GO requires explicit acceptance of every blocking risk.", { risk_ids: blockedRisks });
  const interaction = recordInteraction(context, { invocation: { agent_id: "mdf-ship", invocation_id: `ship-${shipContext.invocation.head}-${Date.now()}`, executor: "root", context_file: contextFile, report_decision_files: verified.map((report) => report.decision_file), synthesis_decision_file: decisionFile, risk_acceptance_file: acceptanceFile, disposition: synthesis.conclusion.disposition }, input_paths: [...synthesisInputs, outputPath, `evidence/${decisionFile}`] });
  const result = recordDecision(context, { interaction_file: interaction.file, conclusion: { kind: "ship-decision", context_file: contextFile, head: shipContext.invocation.head, disposition: synthesis.conclusion.disposition, rollback: synthesis.conclusion.rollback, report_decision_files: verified.map((report) => report.decision_file), risk_acceptance_file: acceptanceFile } });
  if (synthesis.conclusion.disposition === "NO-GO") return { ...recordEvent(context, { event_id: `ship-stop-${result.file}`, from: "ship", evidence_files: [result.file], stop_reason: "human-required" }), action: "stop", ship_file: result.file };
  return { ...recordEvent(context, { event_id: `ship-pr-${result.file}`, from: "ship", to: "github-pr", evidence_files: [result.file] }), ship_file: result.file };
}

module.exports = { createShipContext, recordRiskAcceptance, registerShip };
