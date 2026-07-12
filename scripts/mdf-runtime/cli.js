const fs = require("fs");
const { WorkflowError, toErrorPayload } = require("./errors");

function camelCase(option) {
  return option.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  if (!command || command.startsWith("-")) {
    throw new WorkflowError("MDF_USAGE", "A workflow operation is required.");
  }
  const options = {};
  for (let index = 0; index < rest.length; index += 1) {
    const raw = rest[index];
    if (!raw.startsWith("--")) throw new WorkflowError("MDF_USAGE", "Unexpected positional argument.", { argument: raw });
    const key = camelCase(raw.slice(2));
    const next = rest[index + 1];
    if (!next || next.startsWith("--")) {
      options[key] = true;
      continue;
    }
    options[key] = next;
    index += 1;
  }
  return { command, options };
}

function parseJsonInput(content) {
  const source = String(content || "").trim();
  if (!source) return {};
  try {
    const value = JSON.parse(source);
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new WorkflowError("MDF_INPUT_INVALID", "Workflow input must be a JSON object.");
    }
    return value;
  } catch (error) {
    if (error instanceof WorkflowError) throw error;
    throw new WorkflowError("MDF_INPUT_INVALID", "Workflow input must be valid JSON.", { cause: error.message });
  }
}

function formatSuccess(result) {
  return { ok: true, result };
}

function formatFailure(error) {
  return { ok: false, error: toErrorPayload(error) };
}

function runCli({ argv = process.argv.slice(2), operations }) {
  try {
    const { command, options } = parseArgs(argv);
    const operation = operations?.[command];
    if (typeof operation !== "function") {
      throw new WorkflowError("MDF_USAGE", "Unknown workflow operation.", { operation: command });
    }
    const input = parseJsonInput(fs.readFileSync(0, "utf8"));
    process.stdout.write(`${JSON.stringify(formatSuccess(operation(input, options)), null, 2)}\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`${JSON.stringify(formatFailure(error), null, 2)}\n`);
    process.exitCode = 1;
    return 1;
  }
}

module.exports = { formatFailure, formatSuccess, parseArgs, parseJsonInput, runCli };
