#!/usr/bin/env node

const { ControllerError, resolveControllerContext } = require("./controller-runtime/context");
const fs = require("fs");
const { issueAction, issueCapability, prepareAdapter, submitOutcome } = require("./controller-runtime/adapter");
const { next } = require("./controller-runtime/lifecycle");
const { advanceSpec, approveSpec, registerSpec } = require("./controller-runtime/spec");
const { advancePlan, approvePlan, createPlanMetadata, registerPlan } = require("./controller-runtime/plan");
const { authorizeTaskCommit, completeBuildTask, recordDownstreamImpact, runVerification, selectBuildTask, selectRepairTask } = require("./controller-runtime/build-task");
const { beginWholeBuild, finalizeWholeBuild, resumeAutoBuild, runWholeVerification, wholeReviewInputs } = require("./controller-runtime/whole-build");
const { decideRecovery, decideWholeBuildRecovery, registerRepairPlan } = require("./controller-runtime/recovery");
const { registerTechnicalRevision } = require("./controller-runtime/revision");
const { authorizeCandidateRejection, completeCandidateRejection, createSimplificationScope, finalizeNoChange, registerSimplification, selectSimplificationCandidate } = require("./controller-runtime/simplify");
const { createReviewContext, registerReview } = require("./controller-runtime/review");
const { createShipContext, recordRiskAcceptance, registerShip } = require("./controller-runtime/ship");
const { observeGithubPrBoundary, prepareGithubPrHandoff, recordGithubPrAuthority } = require("./controller-runtime/github-pr");

function fail(error) {
  const response = {
    ok: false,
    error: {
      code: error.code || "MDF_CONTROLLER_UNEXPECTED",
      message: error.message,
      ...(error.details || {}),
    },
  };
  console.error(JSON.stringify(response, null, 2));
  process.exit(1);
}

function parseContextArgs(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const option = args[index];
    if (option !== "--cwd" && option !== "--plugin-root") {
      throw new ControllerError("MDF_CONTROLLER_USAGE", "Unsupported mdf-controller option.", { option });
    }
    const value = args[index + 1];
    if (!value) throw new ControllerError("MDF_CONTROLLER_USAGE", "Controller option requires a value.", { option });
    options[option === "--cwd" ? "cwd" : "pluginRoot"] = value;
    index += 1;
  }
  return options;
}

try {
  const [command, ...args] = process.argv.slice(2);
  if (command === "adapter") {
    const [operation, ...contextArgs] = args;
    if (!new Set(["issue", "capability", "prepare", "submit"]).has(operation)) throw new ControllerError("MDF_CONTROLLER_USAGE", "Usage: mdf-controller adapter issue|capability|prepare|submit [--cwd PATH] [--plugin-root PATH]");
    const context = resolveControllerContext(parseContextArgs(contextArgs));
    let request;
    try { request = JSON.parse(fs.readFileSync(0, "utf8")); }
    catch (error) { throw new ControllerError("MDF_CONTROLLER_INPUT_INVALID", "Adapter command requires JSON stdin.", { cause: error.message }); }
    const adapter = operation === "issue" ? issueAction(context, request) : operation === "capability" ? issueCapability(context, request) : operation === "prepare" ? prepareAdapter(context, request) : submitOutcome(context, request);
    console.log(JSON.stringify({ ok: true, adapter }, null, 2));
    process.exit(0);
  } else if (command === "lifecycle") {
    const [operation, ...contextArgs] = args;
    const context = resolveControllerContext(parseContextArgs(contextArgs));
    if (operation === "next") console.log(JSON.stringify(next(context), null, 2));
    else throw new ControllerError("MDF_CONTROLLER_USAGE", "Usage: mdf-controller lifecycle next [--cwd PATH] [--plugin-root PATH]");
    process.exit(0);
  } else if (command === "spec") {
    const [operation, ...contextArgs] = args;
    const context = resolveControllerContext(parseContextArgs(contextArgs));
    let request;
    try { request = JSON.parse(fs.readFileSync(0, "utf8")); }
    catch (error) { throw new ControllerError("MDF_CONTROLLER_INPUT_INVALID", "Spec command requires JSON stdin."); }
    const result = operation === "register" ? registerSpec(context, request) : operation === "approve" ? approveSpec(context, request) : operation === "advance" ? advanceSpec(context, request) : null;
    if (!result) throw new ControllerError("MDF_CONTROLLER_USAGE", "Usage: mdf-controller spec register|approve|advance [--cwd PATH] [--plugin-root PATH]");
    console.log(JSON.stringify({ ok: true, spec: result }, null, 2));
    process.exit(0);
  } else if (command === "plan") {
    const [operation, ...contextArgs] = args;
    const context = resolveControllerContext(parseContextArgs(contextArgs));
    let request;
    try { request = JSON.parse(fs.readFileSync(0, "utf8")); }
    catch (error) { throw new ControllerError("MDF_CONTROLLER_INPUT_INVALID", "Plan command requires JSON stdin."); }
    const result = operation === "metadata" ? createPlanMetadata(context, request) : operation === "register" ? registerPlan(context, request) : operation === "approve" ? approvePlan(context, request) : operation === "advance" ? advancePlan(context, request) : null;
    if (!result) throw new ControllerError("MDF_CONTROLLER_USAGE", "Usage: mdf-controller plan metadata|register|approve|advance [--cwd PATH] [--plugin-root PATH]");
    console.log(JSON.stringify({ ok: true, plan: result }, null, 2));
    process.exit(0);
  } else if (command === "build-task") {
    const [operation, ...contextArgs] = args;
    const context = resolveControllerContext(parseContextArgs(contextArgs));
    let request;
    try { request = JSON.parse(fs.readFileSync(0, "utf8")); }
    catch (error) { throw new ControllerError("MDF_CONTROLLER_INPUT_INVALID", "Build-task command requires JSON stdin."); }
    const result = operation === "select" ? selectBuildTask(context, request) : operation === "repair" ? selectRepairTask(context, request) : operation === "verify" ? runVerification(context, request) : operation === "impact" ? recordDownstreamImpact(context, request) : operation === "authorize" ? authorizeTaskCommit(context, request) : operation === "complete" ? completeBuildTask(context, request) : null;
    if (!result) throw new ControllerError("MDF_CONTROLLER_USAGE", "Usage: mdf-controller build-task select|repair|verify|impact|authorize|complete [--cwd PATH] [--plugin-root PATH]");
    console.log(JSON.stringify({ ok: true, build_task: result }, null, 2));
    process.exit(0);
  } else if (command === "whole-build") {
    const [operation, ...contextArgs] = args;
    const context = resolveControllerContext(parseContextArgs(contextArgs));
    let request;
    try { request = JSON.parse(fs.readFileSync(0, "utf8")); }
    catch (error) { throw new ControllerError("MDF_CONTROLLER_INPUT_INVALID", "Whole-build command requires JSON stdin."); }
    const result = operation === "resume" ? resumeAutoBuild(context, request) : operation === "begin" ? beginWholeBuild(context, request) : operation === "verify" ? runWholeVerification(context, request) : operation === "inputs" ? { input_paths: wholeReviewInputs(context, request) } : operation === "finalize" ? finalizeWholeBuild(context, request) : null;
    if (!result) throw new ControllerError("MDF_CONTROLLER_USAGE", "Usage: mdf-controller whole-build resume|begin|verify|inputs|finalize [--cwd PATH] [--plugin-root PATH]");
    console.log(JSON.stringify({ ok: true, whole_build: result }, null, 2));
    process.exit(0);
  } else if (command === "recovery") {
    const operation = new Set(["task", "whole-build", "plan"]).has(args[0]) ? args[0] : "task";
    const context = resolveControllerContext(parseContextArgs(operation === "task" && args[0] !== "task" ? args : args.slice(1)));
    let request;
    try { request = JSON.parse(fs.readFileSync(0, "utf8")); }
    catch (error) { throw new ControllerError("MDF_CONTROLLER_INPUT_INVALID", "Recovery command requires JSON stdin."); }
    const result = operation === "task" ? decideRecovery(context, request) : operation === "whole-build" ? decideWholeBuildRecovery(context, request) : registerRepairPlan(context, request);
    console.log(JSON.stringify({ ok: true, recovery: result }, null, 2));
    process.exit(0);
  } else if (command === "technical-revision") {
    const context = resolveControllerContext(parseContextArgs(args));
    let request;
    try { request = JSON.parse(fs.readFileSync(0, "utf8")); }
    catch (error) { throw new ControllerError("MDF_CONTROLLER_INPUT_INVALID", "Technical-revision command requires JSON stdin."); }
    console.log(JSON.stringify({ ok: true, technical_revision: registerTechnicalRevision(context, request) }, null, 2));
    process.exit(0);
  } else if (command === "simplify") {
    const [operation, ...contextArgs] = args;
    const context = resolveControllerContext(parseContextArgs(contextArgs));
    let request;
    try { request = JSON.parse(fs.readFileSync(0, "utf8")); }
    catch (error) { throw new ControllerError("MDF_CONTROLLER_INPUT_INVALID", "Simplify command requires JSON stdin."); }
    const result = operation === "scope" ? createSimplificationScope(context, request) : operation === "register" ? registerSimplification(context, request) : operation === "select" ? selectSimplificationCandidate(context, request) : operation === "reject" ? authorizeCandidateRejection(context, request) : operation === "rejected" ? completeCandidateRejection(context, request) : operation === "no-change" ? finalizeNoChange(context, request) : null;
    if (!result) throw new ControllerError("MDF_CONTROLLER_USAGE", "Usage: mdf-controller simplify scope|register|select|reject|rejected|no-change [--cwd PATH] [--plugin-root PATH]");
    console.log(JSON.stringify({ ok: true, simplify: result }, null, 2));
    process.exit(0);
  } else if (command === "review") {
    const [operation, ...contextArgs] = args;
    const context = resolveControllerContext(parseContextArgs(contextArgs));
    let request = {};
    try { request = JSON.parse(fs.readFileSync(0, "utf8") || "{}"); }
    catch (error) { throw new ControllerError("MDF_CONTROLLER_INPUT_INVALID", "Review command requires JSON stdin."); }
    const result = operation === "context" ? createReviewContext(context) : operation === "register" ? registerReview(context, request) : null;
    if (!result) throw new ControllerError("MDF_CONTROLLER_USAGE", "Usage: mdf-controller review context|register [--cwd PATH] [--plugin-root PATH]");
    console.log(JSON.stringify({ ok: true, review: result }, null, 2));
    process.exit(0);
  } else if (command === "ship") {
    const [operation, ...contextArgs] = args;
    const context = resolveControllerContext(parseContextArgs(contextArgs));
    let request = {};
    try { request = JSON.parse(fs.readFileSync(0, "utf8") || "{}"); }
    catch (error) { throw new ControllerError("MDF_CONTROLLER_INPUT_INVALID", "Ship command requires JSON stdin."); }
    const result = operation === "context" ? createShipContext(context) : operation === "risk" ? recordRiskAcceptance(context, request) : operation === "register" ? registerShip(context, request) : null;
    if (!result) throw new ControllerError("MDF_CONTROLLER_USAGE", "Usage: mdf-controller ship context|risk|register [--cwd PATH] [--plugin-root PATH]");
    console.log(JSON.stringify({ ok: true, ship: result }, null, 2));
    process.exit(0);
  } else if (command === "github-pr") {
    const [operation, ...contextArgs] = args;
    const context = resolveControllerContext(parseContextArgs(contextArgs));
    let request = {};
    try { request = JSON.parse(fs.readFileSync(0, "utf8") || "{}"); }
    catch (error) { throw new ControllerError("MDF_CONTROLLER_INPUT_INVALID", "GitHub PR command requires JSON stdin."); }
    const result = operation === "authorize" ? recordGithubPrAuthority(context, request) : operation === "observe" ? observeGithubPrBoundary(context, request) : operation === "handoff" ? prepareGithubPrHandoff(context, request) : null;
    if (!result) throw new ControllerError("MDF_CONTROLLER_USAGE", "Usage: mdf-controller github-pr authorize|observe|handoff [--cwd PATH] [--plugin-root PATH]");
    console.log(JSON.stringify({ ok: true, github_pr: result }, null, 2));
    process.exit(0);
  } else if (command !== "context") {
    throw new ControllerError("MDF_CONTROLLER_USAGE", "Usage: mdf-controller context [--cwd PATH] [--plugin-root PATH]");
  }
  console.log(JSON.stringify({ ok: true, context: resolveControllerContext(parseContextArgs(args)) }, null, 2));
} catch (error) {
  fail(error);
}
