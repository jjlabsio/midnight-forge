#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const failures = [];

const originalSkillNames = [
  "api-and-interface-design",
  "browser-testing-with-devtools",
  "ci-cd-and-automation",
  "code-review-and-quality",
  "code-simplification",
  "context-engineering",
  "debugging-and-error-recovery",
  "deprecation-and-migration",
  "documentation-and-adrs",
  "doubt-driven-development",
  "frontend-ui-engineering",
  "git-workflow-and-versioning",
  "idea-refine",
  "incremental-implementation",
  "interview-me",
  "performance-optimization",
  "planning-and-task-breakdown",
  "security-and-hardening",
  "shipping-and-launch",
  "source-driven-development",
  "spec-driven-development",
  "test-driven-development",
  "use-mdf",
  "using-git-worktrees",
];

const references = [
  "accessibility-checklist.md",
  "orchestration-patterns.md",
  "performance-checklist.md",
  "security-checklist.md",
  "testing-patterns.md",
];

const agents = [
  "README.md",
  "code-reviewer.md",
  "security-auditor.md",
  "test-engineer.md",
];

const entrypoints = {
  spec: [
    "spec",
    "mdf spec",
    "Invoke the `spec-driven-development` skill.",
    "SPEC.md",
    "confirm with the user before proceeding",
  ],
  plan: [
    "plan",
    "mdf plan",
    "Invoke the `planning-and-task-breakdown` skill.",
    "read only",
    "tasks/plan.md",
    "tasks/todo.md",
  ],
  build: [
    "build",
    "Invoke the `incremental-implementation` skill alongside the `test-driven-development` skill.",
    "debugging-and-error-recovery",
    "If any step fails",
  ],
  test: [
    "test",
    "Invoke the `test-driven-development` skill.",
    "For browser-related issues",
    "browser-testing-with-devtools",
  ],
  review: [
    "review",
    "Invoke the `code-review-and-quality` skill.",
    "Use security-and-hardening skill",
    "Use performance-optimization skill",
  ],
  "code-simplify": [
    "code-simplify",
    "Invoke the `code-simplification` skill.",
    "Use `code-review-and-quality` to review the result",
  ],
  ship: [
    "ship",
    "Invoke the `shipping-and-launch` skill.",
    "fan-out orchestrator",
    "code-reviewer",
    "security-auditor",
    "test-engineer",
    "Skip the fan-out only if all of the following are true",
  ],
};

function rel(...parts) {
  return path.join(root, ...parts);
}

function exists(filePath) {
  return fs.existsSync(filePath);
}

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function assertFile(filePath) {
  assert(exists(filePath), `Missing ${path.relative(root, filePath)}`);
}

function assertContains(filePath, text) {
  if (!exists(filePath)) {
    assert(false, `Missing ${path.relative(root, filePath)} for content check`);
    return;
  }
  assert(
    read(filePath).includes(text),
    `${path.relative(root, filePath)} must include ${JSON.stringify(text)}`
  );
}

for (const skillName of originalSkillNames) {
  assertFile(rel("skills", skillName, "SKILL.md"));
}

for (const reference of references) {
  assertFile(rel("references", reference));
}

for (const agent of agents) {
  assertFile(rel("agents", agent));
}

assertFile(rel("references", "agent-skills-port-notes.md"));
assertContains(
  rel("references", "agent-skills-port-notes.md"),
  "test-driven-development"
);
assertContains(rel("references", "agent-skills-port-notes.md"), "collision");

for (const [entrypoint, requiredText] of Object.entries(entrypoints)) {
  const skillPath = rel("skills", entrypoint, "SKILL.md");
  assertFile(skillPath);
  assertContains(skillPath, `name: ${entrypoint}`);
  for (const text of requiredText) {
    assertContains(skillPath, text);
  }
}

for (const entrypoint of Object.keys(entrypoints)) {
  const skillPath = rel("skills", entrypoint, "SKILL.md");
  assert(
    !read(skillPath).includes("agent-skills:"),
    `${path.relative(root, skillPath)} must use local skill names, not agent-skills: prefixes`
  );
}

assertContains(
  rel("skills", "idea-refine", "SKILL.md"),
  "bash skills/idea-refine/scripts/idea-refine.sh"
);
assert(
  !read(rel("skills", "idea-refine", "SKILL.md")).includes(
    "/mnt/skills/user/idea-refine"
  ),
  "skills/idea-refine/SKILL.md must use the vendored script path"
);

const useMdf = rel("skills", "use-mdf", "SKILL.md");
for (const trigger of [
  "use-mdf",
  "spec",
  "mdf spec",
  "plan",
  "mdf plan",
  "build",
  "test",
  "review",
  "code-simplify",
  "ship",
  "debugging",
  "UI",
  "API/interface",
  "security",
  "performance",
  "documentation",
  "migration",
  "task lifecycle",
  "worktrees",
  "commits",
  "PRs",
  "general software development workflow decisions",
]) {
  assertContains(useMdf, trigger);
}

const usingGitWorktrees = rel("skills", "using-git-worktrees", "SKILL.md");
for (const text of [
  "name: using-git-worktrees",
  ".worktrees/<branch-name>",
  "Stop if `.worktrees/` is not ignored",
  "Do not edit `.gitignore` from this skill",
  ".env.local",
  "Install dependencies",
  "Do not run tests, builds, lint checks",
  "does not write MDF task locks",
]) {
  assertContains(usingGitWorktrees, text);
}

const taskSkill = rel("skills", "task", "SKILL.md");
for (const text of [
  "## Worktree Guard",
  "use the `using-git-worktrees` skill",
  "work {id}` and `start` before creating or replacing `locks/{id}.lock`",
  "If worktree setup fails or stops for any reason, do not create or replace the task lock",
  "The lock must record the resulting worktree path and branch",
]) {
  assertContains(taskSkill, text);
}

for (const manifestPath of [
  rel(".codex-plugin", "plugin.json"),
  rel(".claude-plugin", "plugin.json"),
  rel(".agents", "plugins", "marketplace.json"),
  rel(".claude-plugin", "marketplace.json"),
]) {
  JSON.parse(read(manifestPath));
}

const codexManifest = JSON.parse(read(rel(".codex-plugin", "plugin.json")));
const claudeManifest = JSON.parse(read(rel(".claude-plugin", "plugin.json")));
assert(codexManifest.skills === "./skills/", ".codex-plugin skills path changed");
assert(claudeManifest.skills === "./skills/", ".claude-plugin skills path changed");
assert(
  !Object.prototype.hasOwnProperty.call(codexManifest, "agents"),
  ".codex-plugin/plugin.json must not declare unsupported agents"
);
assert(
  Array.isArray(claudeManifest.agents) &&
    claudeManifest.agents.includes("./agents/code-reviewer.md") &&
    claudeManifest.agents.includes("./agents/security-auditor.md") &&
    claudeManifest.agents.includes("./agents/test-engineer.md"),
  ".claude-plugin/plugin.json must expose the vendored specialist agents"
);
for (const [label, value] of [
  [".claude-plugin description", claudeManifest.description],
  [".codex-plugin description", codexManifest.description],
  [".codex-plugin shortDescription", codexManifest.interface?.shortDescription],
  [".codex-plugin longDescription", codexManifest.interface?.longDescription],
]) {
  assert(
    typeof value === "string" &&
      value.includes("agent-skills") &&
      !value.includes("skeleton"),
    `${label} must describe the agent-skills workflow surface, not the old skeleton`
  );
}
assert(
  Array.isArray(codexManifest.interface?.defaultPrompt) &&
    codexManifest.interface.defaultPrompt.join("\n").includes("use-mdf"),
  ".codex-plugin defaultPrompt must route users toward the workflow selector"
);

const claudeMarketplace = JSON.parse(read(rel(".claude-plugin", "marketplace.json")));
assert(
  claudeMarketplace.plugins?.[0]?.description?.includes("agent-skills") &&
    !claudeMarketplace.plugins[0].description.includes("skeleton"),
  ".claude-plugin/marketplace.json description must reflect the agent-skills workflows"
);

if (failures.length > 0) {
  console.error("Agent skills port validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Agent skills port validation passed.");
