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
  final_response: "none",
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
          key === "final_response"
            ? { type: "string", enum: ["none", "final"] }
            : key === "verification"
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
  for (const key of Object.keys(expected.workflow_decisions || {})) {
    if (![
      "local_handoff",
      "task_active",
      "github_pr",
      "push",
      "remote_pr_checks",
      "pr_link_storage",
    ].includes(key)) {
      throw new Error(`${testCase.id}: unknown workflow decision ${key}`);
    }
  }
}

function promptFor(testCase) {
  const lines = [
    "This is an executable behavior evaluation, not a request to edit files.",
    `Read only these repository contracts: ${testCase.files.join(", ")}.`,
    "Apply their current automatic-workflow rules to the scenario below.",
    "Fill every decision field for the next required workflow behavior. Derive `final_response` eligibility from the listed contract files and scenario. Use false or none when an operation must not run.",
    "For review, use bounded-change only for the quick-workflow critic, whole-tree for an auto-workflow whole-tree re-review, and simplification for the fresh critic after code-simplify.",
    "When rework_current is true, review denotes the fresh critic required after that rework, not a review already completed.",
    "Do not add future hardening, follow-up work, or preferred cleanup.",
    "Use finding labels exactly as written before each colon in the scenario when labels are present.",
    `Set case_id to ${JSON.stringify(testCase.id)}.`,
    `Scenario: ${testCase.scenario}`,
    "Return only the JSON object required by the response schema."
  ];
  if (testCase.expected.plan_granularity !== undefined) {
    lines.splice(
      4,
      0,
      "Set top-level plan_granularity to component-sliced, operation-sized, or monolithic as requested."
    );
  }
  if (testCase.expected.authorized_repairs !== undefined) {
    lines.splice(
      4,
      0,
      "Set top-level rework_handoff to whether the root writes its immutable disposition handoff before another executor can run, and authorized_repairs to the exact finding labels granted to a rework executor."
    );
  }
  if (testCase.expected.executor_authority !== undefined) {
    lines.splice(
      4,
      0,
      "Set top-level executor_authority to the exact finding labels actually passed to the rework executor as write authority; use an empty array when no rework executor is dispatched."
    );
  }
  if (testCase.expected.workflow_decisions !== undefined) {
    lines.splice(
      4,
      0,
      "Set each requested local-delivery decision in decisions exactly as the selected profile requires."
    );
  }
  return lines.join("\n\n");
}

function schemaFor(testCase) {
  if (
    testCase.expected.plan_granularity === undefined
    && testCase.expected.authorized_repairs === undefined
    && testCase.expected.executor_authority === undefined
    && testCase.expected.workflow_decisions === undefined
  ) {
    return responseSchema;
  }
  const properties = { ...responseSchema.properties };
  const required = [...responseSchema.required];
  if (testCase.expected.plan_granularity !== undefined) {
    required.push("plan_granularity");
    properties.plan_granularity = {
      type: "string",
      enum: ["component-sliced", "operation-sized", "monolithic"]
    };
  }
  if (testCase.expected.authorized_repairs !== undefined) {
    required.push("rework_handoff", "authorized_repairs");
    properties.rework_handoff = { type: "boolean" };
    properties.authorized_repairs = {
      type: "array",
      items: { type: "string" }
    };
  }
  if (testCase.expected.executor_authority !== undefined) {
    required.push("executor_authority");
    properties.executor_authority = {
      type: "array",
      items: { type: "string" }
    };
  }
  if (testCase.expected.workflow_decisions !== undefined) {
    const decisionProperties = { ...properties.decisions.properties };
    const decisionRequired = [...properties.decisions.required];
    for (const key of Object.keys(testCase.expected.workflow_decisions)) {
      decisionProperties[key] = { type: "boolean" };
      decisionRequired.push(key);
    }
    properties.decisions = {
      ...properties.decisions,
      required: decisionRequired,
      properties: decisionProperties,
    };
  }
  return {
    ...responseSchema,
    required,
    properties
  };
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
  if (expected.plan_granularity !== undefined) {
    if (actual.plan_granularity !== expected.plan_granularity) {
      errors.push(
        `plan_granularity=${actual.plan_granularity}, expected ${expected.plan_granularity}`
      );
    }
  } else if (actual.plan_granularity !== undefined) {
    errors.push(`unexpected plan_granularity=${actual.plan_granularity}`);
  }
  if (expected.authorized_repairs !== undefined) {
    if (actual.rework_handoff !== expected.rework_handoff) {
      errors.push(`rework_handoff=${actual.rework_handoff}, expected ${expected.rework_handoff}`);
    }
    const actualRepairs = [...actual.authorized_repairs].sort();
    const expectedRepairs = [...expected.authorized_repairs].sort();
    if (new Set(actualRepairs).size !== actualRepairs.length) {
      errors.push("duplicate authorized repair");
    }
    if (JSON.stringify(actualRepairs) !== JSON.stringify(expectedRepairs)) {
      errors.push(
        `authorized_repairs=${JSON.stringify(actualRepairs)}, expected ${JSON.stringify(expectedRepairs)}`
      );
    }
  } else if (actual.rework_handoff !== undefined || actual.authorized_repairs !== undefined) {
    errors.push("unexpected rework handoff output");
  }
  if (expected.executor_authority !== undefined) {
    const actualAuthority = [...actual.executor_authority].sort();
    const expectedAuthority = [...expected.executor_authority].sort();
    if (new Set(actualAuthority).size !== actualAuthority.length) {
      errors.push("duplicate executor authority");
    }
    if (JSON.stringify(actualAuthority) !== JSON.stringify(expectedAuthority)) {
      errors.push(
        `executor_authority=${JSON.stringify(actualAuthority)}, expected ${JSON.stringify(expectedAuthority)}`
      );
    }
  } else if (actual.executor_authority !== undefined) {
    errors.push("unexpected executor authority output");
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
  for (const [decision, expectedValue] of Object.entries(expected.workflow_decisions || {})) {
    if (actual.decisions[decision] !== expectedValue) {
      errors.push(`${decision}=${actual.decisions[decision]}, expected ${expectedValue}`);
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
  try {
    for (const testCase of cases) {
      validateCase(testCase);
      if (dryRun) {
        console.log(`[dry-run] ${testCase.id}`);
        continue;
      }
      fs.writeFileSync(
        schemaPath,
        `${JSON.stringify(schemaFor(testCase), null, 2)}\n`
      );
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
