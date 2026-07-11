#!/usr/bin/env node

const { ControllerError, resolveControllerContext } = require("./controller-runtime/context");
const fs = require("fs");
const { issueAction, issueCapability, prepareAdapter, submitOutcome } = require("./controller-runtime/adapter");

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
  } else if (command !== "context") {
    throw new ControllerError("MDF_CONTROLLER_USAGE", "Usage: mdf-controller context [--cwd PATH] [--plugin-root PATH]");
  }
  console.log(JSON.stringify({ ok: true, context: resolveControllerContext(parseContextArgs(args)) }, null, 2));
} catch (error) {
  fail(error);
}
