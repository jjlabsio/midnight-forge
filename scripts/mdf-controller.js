#!/usr/bin/env node

const { ControllerError, resolveControllerContext } = require("./controller-runtime/context");

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
  if (command !== "context") {
    throw new ControllerError("MDF_CONTROLLER_USAGE", "Usage: mdf-controller context [--cwd PATH] [--plugin-root PATH]");
  }
  console.log(JSON.stringify({ ok: true, context: resolveControllerContext(parseContextArgs(args)) }, null, 2));
} catch (error) {
  fail(error);
}
