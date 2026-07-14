#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const failures = [];

function fail(message) {
  failures.push(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function read(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    fail(`${relativePath} is missing`);
    return "";
  }
  return fs.readFileSync(absolutePath, "utf8");
}

function readJson(relativePath) {
  try {
    return JSON.parse(read(relativePath));
  } catch (error) {
    fail(`${relativePath} is not valid JSON: ${error.message}`);
    return null;
  }
}

function extractRoutingContract(content) {
  const match = content.match(/```json\n([\s\S]*?)\n```/);
  if (!match) {
    fail("model-routing-5.6.md is missing its machine-readable routing contract");
    return null;
  }
  try {
    return JSON.parse(match[1]);
  } catch (error) {
    fail(`model-routing-5.6.md routing contract is invalid JSON: ${error.message}`);
    return null;
  }
}

const routingReference = read("references/model-routing-5.6.md");
const routing = extractRoutingContract(routingReference);
assert(routing?.family === "gpt-5.6", "routing family must be exactly gpt-5.6");
assert(
  JSON.stringify(routing?.allowed_variants) === JSON.stringify(["sol", "terra", "luna"]),
  "routing variants must be exactly sol, terra, and luna"
);
assert(
  JSON.stringify(routing?.allowed_efforts) === JSON.stringify(["light", "medium", "high", "xhigh"]),
  "routing efforts must be exactly light, medium, high, and xhigh"
);
assert(
  routing?.forbidden_profile_labels?.includes("fast") && routing?.forbidden_profile_labels?.includes("speed-only"),
  "routing must forbid fast and speed-only profile labels"
);
assert(routing?.exploration?.preferred_model === "gpt-5.3-codex-spark", "exploration routing must prefer GPT-5.3-Codex-Spark");
assert(routing?.exploration?.read_only === true, "exploration routing must be read-only");
assert(routing?.exploration?.authority === "report-only", "exploration routing must be report-only");
assert(routing?.exploration?.write_scope === "none", "exploration routing must have no write scope");
assert(typeof routing?.exploration?.transport === "string", "exploration routing must declare transport requirements");
for (const profile of routing?.profiles || []) {
  assert(profile.family === undefined || profile.family === "gpt-5.6", `${profile.variant} profile has an invalid family`);
  assert(routing.allowed_variants.includes(profile.variant), `${profile.variant} is not an allowed variant`);
  assert(
    profile.efforts.every((effort) => routing.allowed_efforts.includes(effort)),
    `${profile.variant} profile contains an unreviewed effort`
  );
}

const policy = read("references/subagent-dispatch-policy.md");
const normalizedPolicy = policy.replace(/\s+/g, " ");
for (const term of [
  "plugin-installed",
  "root orchestrator",
  "generic runtime spawn path",
  "quality floor",
  "capability",
  "degraded",
  "GPT-5.6",
  "`fast` and `speed-only` are forbidden profile labels, not effort values",
  "Precedence for persona settings",
  "root-selected model, effort, fallback"
]) {
  assert(normalizedPolicy.includes(term), `subagent-dispatch-policy.md is missing: ${term}`);
}
assert(!/depends on|loads|resolves from|overrides?\s+(?:repository-local|project-local)/i.test(policy), "central policy must not depend on repository-local agent configuration");

const delegatedSkills = [
  "skills/use-mdf/SKILL.md",
  "skills/ship/SKILL.md",
  "skills/webperf/SKILL.md",
  "skills/build/SKILL.md",
  "skills/review/SKILL.md",
  "skills/doubt-driven-development/SKILL.md",
  "skills/test-driven-development/SKILL.md"
];
const hardCodedModelPattern = /\b(?:gpt-\d+\.\d+[-/][a-z0-9.-]+|gpt-\d+[-/][a-z0-9.-]+|claude[-/][a-z0-9.-]+|gemini[-/][a-z0-9.-]+|haiku|sonnet|opus)\b/i;
for (const skill of delegatedSkills) {
  const content = read(skill);
  const normalized = content.replace(/\s+/g, " ");
  assert(normalized.includes("../../references/subagent-dispatch-policy.md"), `${skill} bypasses the central dispatch policy`);
  assert(normalized.includes("../../references/model-routing-5.6.md"), `${skill} bypasses the GPT-5.6 routing reference`);
  assert(normalized.includes("generic runtime spawn path"), `${skill} does not use the generic runtime spawn path`);
  assert(!hardCodedModelPattern.test(content), `${skill} hard-codes a model or vendor profile`);
  assert(!/task\s*[-=]>\s*model|model\s*[:=]\s*(?:fast|speed-only)/i.test(content), `${skill} contains a fixed or forbidden model selection`);
}

const personaAdapter = read("agents/README.md");
assert(personaAdapter.includes("../references/subagent-dispatch-policy.md"), "agents/README.md bypasses central dispatch");
assert(personaAdapter.replace(/\s+/g, " ").includes("generic runtime spawn path"), "agents/README.md omits generic runtime dispatch");
assert(personaAdapter.includes("model-agnostic"), "agents/README.md does not keep personas model-agnostic");
assert(
  personaAdapter.includes("root-selected MDF dispatch record overrides"),
  "agents/README.md does not define root precedence over persona defaults"
);
for (const entry of fs.readdirSync(path.join(root, "agents"))) {
  if (entry === "README.md" || !entry.endsWith(".md")) continue;
  const content = read(path.join("agents", entry));
  assert(!hardCodedModelPattern.test(content), `persona agents/${entry} hard-codes a model or vendor profile`);
}

const autoContract = read("references/auto-workflow-contract.md").replace(/\s+/g, " ").toLowerCase();
for (const term of [
  "mode: auto-workflow",
  "interview-me",
  "parallel writers",
  "serial",
  "push",
  "pr create operation",
  "merge",
  "deploy",
  "canonical `.mdf`"
]) {
  assert(autoContract.includes(term), `auto-workflow-contract.md is missing: ${term}`);
}

const inventoryRoot = readJson("overlays/mdf/inventory.json");
const inventoryEntries = new Map();
for (const entryFile of inventoryRoot?.generated?.entryFiles || []) {
  const entry = readJson(path.join("overlays/mdf", entryFile));
  if (entry?.output) inventoryEntries.set(entry.output, entry);
}
for (const output of [
  "references/subagent-dispatch-policy.md",
  "references/model-routing-5.6.md",
  "references/auto-workflow-contract.md",
  "agents/README.md",
  ...delegatedSkills
]) {
  const entry = inventoryEntries.get(output);
  assert(entry, `${output} is missing from generated inventory`);
  assert(entry?.overlay, `${output} has no overlay coverage for the dispatch policy`);
}

const ship = read("skills/ship/SKILL.md");
const normalizedShip = ship.replace(/-\s+/g, "").replace(/\s+/g, " ");
assert(
  normalizedShip.includes("defaults for direct invocation only") && normalizedShip.includes("root-selected dispatch record takes precedence"),
  "skills/ship/SKILL.md does not define root precedence over persona defaults"
);
assert(
  normalizedShip.includes("named-persona tool can accept the root-selected dispatch record"),
  "skills/ship/SKILL.md does not define the named-persona dispatch boundary"
);

for (const pathName of ["skills/webperf/SKILL.md", "skills/doubt-driven-development/SKILL.md"]) {
  const content = read(pathName).replace(/\s+/g, " ");
  assert(
    content.includes("root-selected dispatch record") && content.includes("generic runtime spawn path"),
    `${pathName} does not define the root dispatch transport boundary`
  );
}

function effortRank(effort) {
  return effort === "xhigh" ? 2 : effort === "high" ? 1 : 0;
}

function selectCandidate(request, capabilities) {
  const eligible = capabilities.filter((candidate) => (
    candidate.verified === true &&
    candidate.family === "gpt-5.6" &&
    ["sol", "terra", "luna"].includes(candidate.variant) &&
    ["light", "medium", "high", "xhigh"].includes(candidate.effort) &&
    !["fast", "speed-only"].includes(candidate.profileLabel) &&
    effortRank(candidate.effort) >= effortRank(request.qualityFloor)
  ));
  if (eligible.length === 0) return { degraded: true, fallback: "root" };

  if (request.risk === "high") {
    return [...eligible].sort((left, right) => (
      right.qualitySignal - left.qualitySignal || left.costSignal - right.costSignal
    ))[0];
  }

  const equivalent = eligible.filter((candidate) => candidate.benchmarkEquivalent === true);
  return [...(equivalent.length ? equivalent : eligible)].sort((left, right) => (
    left.costSignal - right.costSignal || right.qualitySignal - left.qualitySignal
  ))[0];
}

function runRoutingSelfTests() {
  const capabilities = [
    { family: "gpt-5.6", variant: "terra", effort: "high", verified: true, qualitySignal: 8, costSignal: 5, benchmarkEquivalent: true },
    { family: "gpt-5.6", variant: "luna", effort: "xhigh", verified: true, qualitySignal: 8, costSignal: 3, benchmarkEquivalent: true },
    { family: "gpt-5.6", variant: "terra", effort: "xhigh", verified: true, qualitySignal: 10, costSignal: 9, benchmarkEquivalent: false },
    { family: "gpt-5.5", variant: "terra", effort: "xhigh", verified: true, qualitySignal: 99, costSignal: 1, benchmarkEquivalent: true },
    { family: "gpt-5.6", variant: "sol", effort: "high", profileLabel: "fast", verified: true, qualitySignal: 99, costSignal: 1, benchmarkEquivalent: true }
  ];
  const implementation = selectCandidate({ qualityFloor: "high", risk: "medium" }, capabilities);
  assert(implementation.variant === "luna" && implementation.effort === "xhigh", "Pareto selection did not prefer equivalent Luna xhigh efficiency");
  const highRisk = selectCandidate({ qualityFloor: "high", risk: "high" }, capabilities);
  assert(highRisk.variant === "terra" && highRisk.effort === "xhigh", "high-risk selection did not prefer verified quality");
  const design = selectCandidate({ qualityFloor: "xhigh", risk: "medium" }, capabilities);
  assert(design.effort === "xhigh", "xhigh design floor was not enforced");
  const fallback = selectCandidate({ qualityFloor: "xhigh", risk: "high" }, capabilities.filter((candidate) => candidate.family !== "gpt-5.5" && candidate.effort !== "xhigh"));
  assert(fallback.degraded === true && fallback.fallback === "root", "missing GPT-5.6 capability did not produce degraded root fallback");
}

runRoutingSelfTests();

if (failures.length > 0) {
  console.error(`Dispatch validation failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Dispatch validation passed: ${delegatedSkills.length} delegation paths, GPT-5.6 guard, routing matrix, Pareto selection, and fallback coverage.`);
}
