#!/usr/bin/env node

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const casesPath = path.join(root, "evals", "automatic-workflows", "cases.json");
const decisionDefaults = {
  accept_current: false,
  create_empty_commit: false,
  create_follow_up_task: false,
  persist_operational_boundary: false,
  request_user: false,
  stop_blocked: false,
  rework_current: false,
  verification: "none",
  review: "none",
  simplification_audit: false,
  simplification_executor: false,
  ship: false
};
const responseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["case_id", "dispositions", "may_accept", "decisions"],
  properties: {
    case_id: { type: "string" },
    dispositions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["finding", "disposition"],
        properties: {
          finding: { type: "string" },
          disposition: {
            type: "string",
            enum: [
              "fix-now",
              "needs-user",
              "current-delivery-nonblocking",
              "invalid"
            ]
          }
        }
      }
    },
    may_accept: { type: "boolean" },
    decisions: {
      type: "object",
      additionalProperties: false,
      required: Object.keys(decisionDefaults),
      properties: Object.fromEntries(
        Object.entries(decisionDefaults).map(([key, value]) => [
          key,
          key === "verification"
            ? { type: "string", enum: ["none", "reuse", "focused", "full"] }
            : key === "review"
              ? {
                  type: "string",
                  enum: ["none", "bounded-change", "whole-tree", "simplification"]
                }
            : { type: "boolean" }
        ])
      )
    }
  }
};

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function validateCase(testCase) {
  const expected = testCase.expected;
  if (!testCase.id || !Array.isArray(testCase.files) || !testCase.scenario) {
    throw new Error("Each case requires id, files, and scenario.");
  }
  for (const file of testCase.files) {
    const resolved = path.resolve(root, file);
    if (!resolved.startsWith(`${root}${path.sep}`) || !fs.existsSync(resolved)) {
      throw new Error(`${testCase.id}: unsafe or missing contract file ${file}`);
    }
  }
  for (const key of Object.keys(expected.decisions || {})) {
    if (!(key in decisionDefaults)) {
      throw new Error(`${testCase.id}: unknown expected decision ${key}`);
    }
  }
}

function promptFor(testCase) {
  return [
    "This is an executable behavior evaluation, not a request to edit files.",
    `Read only these repository contracts: ${testCase.files.join(", ")}.`,
    "Apply their current automatic-workflow rules to the scenario below.",
    "Fill every decision field for the next required workflow behavior. Use false or none when an operation must not run.",
    "For review, use bounded-change only for the quick-workflow critic, whole-tree for an auto-workflow whole-tree re-review, and simplification for the fresh critic after code-simplify.",
    "Do not add future hardening, follow-up work, or preferred cleanup.",
    "Use finding labels exactly as written before each colon in the scenario when labels are present.",
    `Set case_id to ${JSON.stringify(testCase.id)}.`,
    `Scenario: ${testCase.scenario}`,
    "Return only the JSON object required by the response schema."
  ].join("\n\n");
}

function grade(testCase, actual) {
  const expected = testCase.expected;
  const errors = [];
  const dispositions = new Map(
    actual.dispositions.map((entry) => [entry.finding, entry.disposition])
  );
  if (dispositions.size !== actual.dispositions.length) {
    errors.push("duplicate disposition finding");
  }
  if (actual.case_id !== testCase.id) errors.push(`case_id=${actual.case_id}`);
  if (actual.may_accept !== expected.may_accept) {
    errors.push(`may_accept=${actual.may_accept}, expected ${expected.may_accept}`);
  }
  for (const [finding, expectedDisposition] of Object.entries(expected.dispositions)) {
    const allowed = Array.isArray(expectedDisposition)
      ? expectedDisposition
      : [expectedDisposition];
    if (!allowed.includes(dispositions.get(finding))) {
      errors.push(
        `${finding}=${dispositions.get(finding)}, expected one of ${allowed.join(",")}`
      );
    }
  }
  if (actual.dispositions.length !== Object.keys(expected.dispositions).length) {
    errors.push("unexpected disposition");
  }
  const expectedDecisions = { ...decisionDefaults, ...expected.decisions };
  for (const [decision, expectedValue] of Object.entries(expectedDecisions)) {
    const allowed = Array.isArray(expectedValue) ? expectedValue : [expectedValue];
    if (!allowed.includes(actual.decisions[decision])) {
      errors.push(
        `${decision}=${actual.decisions[decision]}, expected one of ${allowed.join(",")}`
      );
    }
  }
  return errors;
}

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const selected = args.find((arg) => !arg.startsWith("--"));
const document = JSON.parse(fs.readFileSync(casesPath, "utf8"));
const cases = selected
  ? document.cases.filter((testCase) => testCase.id === selected)
  : document.cases;

if (!cases.length) {
  fail(`No automatic-workflow eval case matched ${selected || "<all>"}.`);
} else {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mdf-workflow-evals-"));
  const schemaPath = path.join(tempDir, "response.schema.json");
  fs.writeFileSync(schemaPath, `${JSON.stringify(responseSchema, null, 2)}\n`);
  try {
    for (const testCase of cases) {
      validateCase(testCase);
      if (dryRun) {
        console.log(`[dry-run] ${testCase.id}`);
        continue;
      }
      const outputPath = path.join(tempDir, `${testCase.id}.json`);
      const result = spawnSync(
        "codex",
        [
          "exec",
          "--ephemeral",
          "--sandbox",
          "read-only",
          "--output-schema",
          schemaPath,
          "--output-last-message",
          outputPath,
          "-"
        ],
        {
          cwd: root,
          encoding: "utf8",
          input: promptFor(testCase),
          maxBuffer: 16 * 1024 * 1024,
          timeout: 10 * 60 * 1000
        }
      );
      if (result.status !== 0) {
        fail(`${testCase.id}: codex exec failed\n${result.stderr || result.stdout}`);
        continue;
      }
      let actual;
      try {
        actual = JSON.parse(fs.readFileSync(outputPath, "utf8"));
      } catch (error) {
        fail(`${testCase.id}: invalid JSON response: ${error.message}`);
        continue;
      }
      const errors = grade(testCase, actual);
      if (errors.length) fail(`${testCase.id}: ${errors.join("; ")}`);
      else console.log(`${testCase.id}: passed`);
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}
