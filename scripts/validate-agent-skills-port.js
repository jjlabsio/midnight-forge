#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

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
  "github-clear-gone",
  "github-commit",
  "github-pr",
  "idea-refine",
  "incremental-implementation",
  "interview-me",
  "observability-and-instrumentation",
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
  "definition-of-done.md",
  "observability-checklist.md",
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
  "web-performance-auditor.md",
  "spec-evaluator.md",
  "plan-evaluator.md",
];

const entrypoints = {
  "auto-workflow": [
    "auto-workflow",
    "mdf auto-workflow",
    "spec -> plan -> build with subagents -> review -> ship -> github-pr",
    "orchestration wrapper and state machine",
    "Do not inline, summarize, abbreviate, duplicate, or replace",
    "question needed",
    "decision required",
    "missing required information",
    "review checkpoint only",
    "artifact saved confirmation",
    "NO-GO",
    "`github-pr`: do not use a subagent",
  ],
  spec: [
    "spec",
    "mdf spec",
    "Invoke the `spec-driven-development` skill.",
    "Standalone mode",
    "Auto-workflow mode",
    "same auto-workflow invocation",
    "inline blocker-oriented self-review loop",
    "SPEC.md",
    "confirm with the user before proceeding",
  ],
  plan: [
    "plan",
    "mdf plan",
    "Invoke the `planning-and-task-breakdown` skill.",
    "read only",
    "inline blocker-oriented self-review loop",
    "tasks/plan.md",
    "tasks/todo.md",
  ],
  build: [
    "build",
    "Invoke the `incremental-implementation` skill alongside the `test-driven-development` skill.",
    "process every pending task from the current plan",
    "final whole-build verification",
    "debugging-and-error-recovery",
    "If any step fails",
  ],
  test: [
    "test",
    "Invoke the `test-driven-development` skill.",
    "standalone workflow",
    "For browser-related issues",
    "browser-testing-with-devtools",
  ],
  review: [
    "review",
    "Invoke the `code-review-and-quality` skill.",
    "standalone workflow",
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
    "final GO/NO-GO gate",
    "fan-out orchestrator",
    "code-reviewer",
    "security-auditor",
    "test-engineer",
    "Skip the fan-out only if all of the following are true",
  ],
  webperf: [
    "webperf",
    "Spawn the `web-performance-auditor` subagent.",
    "Deep mode",
    "Quick mode",
    "not measured",
    "potential impact",
  ],
  "tasks-project": [
    "tasks-project",
    "current project's MDF task board",
    "~/.mdf/user/init.json",
    "non-empty `human_language`",
    "<canonical-root>/.mdf/project/init.json",
    "Active",
    "Queue",
    "Done",
    "stale",
    "clean",
  ],
  "tasks-user": [
    "tasks-user",
    "registered local projects",
    "~/.mdf/user/init.json",
    "~/.mdf/projects.json",
    "does not require current project init",
    "Do not require the current working directory to be inside a git repository",
    "Hard-stop only for malformed global registry or user state",
    "warning and skip",
    "Recommendation",
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

function readMarkdownTree(relativePath) {
  const absolutePath = rel(relativePath);
  if (!exists(absolutePath)) return "";
  const result = [];
  function visit(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const child = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(child);
      else if (entry.isFile() && child.endsWith(".md")) result.push(read(child));
    }
  }
  visit(absolutePath);
  return result.join("\n");
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

function assertNotContains(filePath, text) {
  if (!exists(filePath)) {
    assert(false, `Missing ${path.relative(root, filePath)} for negative content check`);
    return;
  }
  assert(
    !read(filePath).includes(text),
    `${path.relative(root, filePath)} must not include ${JSON.stringify(text)}`
  );
}

function sectionBetween(filePath, startText, endText) {
  const content = read(filePath);
  const start = content.indexOf(startText);
  if (start === -1) {
    assert(false, `${path.relative(root, filePath)} must include section start ${JSON.stringify(startText)}`);
    return "";
  }
  const end = content.indexOf(endText, start + startText.length);
  if (end === -1) {
    assert(false, `${path.relative(root, filePath)} must include section end ${JSON.stringify(endText)} after ${JSON.stringify(startText)}`);
    return "";
  }
  return content.slice(start, end);
}

function assertOrder(label, text, orderedNeedles) {
  let previousIndex = -1;
  for (const needle of orderedNeedles) {
    const index = text.indexOf(needle);
    assert(index !== -1, `${label} must include ${JSON.stringify(needle)} for order check`);
    if (index !== -1) {
      assert(index > previousIndex, `${label} must place ${JSON.stringify(needle)} after the previous ordered marker`);
      previousIndex = index;
    }
  }
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
assertNotContains(
  rel("skills", "auto-workflow", "SKILL.md"),
  "- asks for user input\n"
);

assert(!exists(rel("skills", "tasks", "SKILL.md")), "skills/tasks/SKILL.md must be removed");
assert(!exists(rel("commands")), "commands/ Claude Code shims must be removed for the Codex-only plugin");
assert(!exists(rel(".claude-plugin")), ".claude-plugin/ must be removed for the Codex-only plugin");

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
  "auto-workflow",
  "spec",
  "mdf spec",
  "plan",
  "mdf plan",
  "build",
  "test",
  "review",
  "code-simplify",
  "ship",
  "webperf",
  "debugging",
  "UI",
  "API/interface",
  "security",
  "performance",
  "observability",
  "documentation",
  "migration",
  "task lifecycle",
  "tasks-project",
  "tasks-user",
  "worktrees",
  "commits",
  "GitHub PRs",
  "gone branch cleanup",
  "general software development workflow decisions",
]) {
  assertContains(useMdf, trigger);
}
for (const text of [
  "Standalone `task work {id}`",
  "same user message",
  "downstream workflow",
  "separate explicit implementation instruction",
  "same-turn downstream workflows can continue after setup",
]) {
  assertContains(useMdf, text);
}

const initSkill = rel("skills", "init", "SKILL.md");
for (const text of [
  "equivalent instruction to check relevant project docs before starting code or design changes",
  "Treat equivalent meaning as enough to skip",
  "Do not require MDF marker comments or exact MDF wording",
  "equivalent unmarked or human-authored docs-before-work rule",
  "no equivalent unmarked or human-authored docs-before-work rule already exists",
  "<!-- MDF:BEGIN context-check -->",
  "<!-- MDF:END context-check -->",
  "update only that block while preserving unrelated content",
  "MDF-managed context-check blocks remain updateable within the marker boundary",
  "invoke the `github-pr` skill's MDF init setup PR mode",
  "Setup PR push/create/update mechanics belong to `github-pr`, not `init`",
]) {
  assertContains(initSkill, text);
}
for (const text of [
  "push the branch and create a GitHub PR",
  "gh pr create",
]) {
  assertNotContains(initSkill, text);
}

const usingGitWorktrees = rel("skills", "using-git-worktrees", "SKILL.md");
for (const text of [
  "name: using-git-worktrees",
  ".worktrees/<branch-name>",
  "Stop if the branch is `main` or the repository default branch",
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
  "work {id}` before creating or replacing `locks/{id}.lock`",
  "same user message",
  "explicit downstream workflow",
  "separate explicit implementation instruction",
  "standalone `work {id}`",
  "Do not treat task activation alone as implementation permission",
  "## Intent Parsing",
  "Users do not need to memorize exact command names",
  "If worktree setup or readiness setup fails or stops for any reason, do not create or replace the task lock",
  "If `using-git-worktrees` stops because `.worktrees/` is not ignored",
  "chore/ignore-worktrees",
  "Do not resume or lock the original task until the setup PR has been merged",
  "The lock must record the resulting worktree path and branch",
  "done {id} --message \"message\"",
  "## Staleness Preflight",
  "before branch creation",
  "read-only inspection of canonical task cards",
  "latest spec, plan, build, and review artifacts",
  "predecessor logs",
  "relevant current code or skill contracts",
  "This read-only inspection is not an implementation side effect",
  "do not broaden dependency readiness into semantic drift detection",
  "do not treat shared files alone as a hard dependency or stale-task signal",
  "stale assumption",
  "required user or replan decision",
  "dependency readiness, staleness preflight, the worktree guard, and worktree readiness setup have succeeded",
  "## Downstream Impact Check",
  "workflow semantics, task boundaries, or shared acceptance assumptions",
  "unaffected, needs task log/context/criteria update, needs plan revision or",
  "Do not classify impact from shared",
  "do not convert semantic impact into `depends_on` unless",
  "run the downstream impact check",
]) {
  assertContains(taskSkill, text);
}
assertOrder(
  "skills/task/SKILL.md work {id} workflow",
  sectionBetween(taskSkill, "### `work {id}`", "### `done`"),
  [
    "Validate dependency readiness",
    "Run the staleness preflight before branch creation",
    "If `.mdf/locks/{id}.lock` exists",
    "Use `using-git-worktrees`",
    "Create or replace `.mdf/locks/{id}.lock`",
    "Update `item.md` with `status: \"active\"`",
    "If the same user message already contains an explicit downstream workflow",
  ]
);
assertOrder(
  "skills/task/SKILL.md done workflow",
  sectionBetween(taskSkill, "### `done`", "### `done {id}`"),
  [
    "run the downstream impact check",
    "Completion means setting `status: \"done\"`",
  ]
);

const githubPr = rel("skills", "github-pr", "SKILL.md");
for (const text of [
  "name: github-pr",
  "Session context is the primary selector",
  "Active lock files validate the selected task; they do not select it by themselves",
  "Never complete an MDF task solely because it is the only active lock",
  "use the `github-commit` skill",
  "use the `task` skill's `done {id} --message \"message\"` completion behavior",
  "Completed task before PR creation.",
  "Analyze all commits in the branch, not just the latest commit",
  "## Design",
  "## Service Impact",
  "## Operational Checklist",
  "environment variables or secrets",
  "external operations impact scan",
  "Before drafting `Service Impact` and `Operational Checklist`",
  "added, removed, renamed, or no longer read",
  "deployment platform",
  "secret-store",
  "third-party integration dashboards",
  "webhook, cron, and queue providers",
  "DNS",
  "feature flags",
  "SQL migrations",
  "data backfills",
  "certificates/keys",
  "provider-managed credentials",
  "rollback or cleanup steps",
  "only after the external operations impact scan finds no required manual action",
  "## Test Plan",
  "Do not require a second explicit confirmation before pushing or creating the PR",
  "MDF Init Setup PR Mode",
  "Bypass the MDF task completion guard only because `init` is the caller",
  "PRs are ready for review by default",
  "Do not pass `--draft`, do not set `draft: true`, and do not report `isDraft=true` unless the user explicitly asks for a draft PR",
  "gh pr create",
]) {
  assertContains(githubPr, text);
}
assertNotContains(githubPr, "QStash");

const pullRequestTemplate = rel(".github", "pull_request_template.md");
for (const text of [
  "## Summary",
  "## Design",
  "## Service Impact",
  "## Operational Checklist",
  "## Test Plan",
  "## MDF",
]) {
  assertContains(pullRequestTemplate, text);
}

const specDrivenDevelopment = rel("skills", "spec-driven-development", "SKILL.md");
for (const text of [
  "Run an inline blocker-oriented self-review loop after drafting",
  "default `$spec` quality gate",
  "Subagent-assisted SPEC evaluation may be used when a fresh-context pass would add signal",
  "runtime exposes the needed subagent tools",
  "use `agents/spec-evaluator.md` as the prompt template",
  "The main agent owns revisions, user questions, artifact saving",
  "TODO, TBD, placeholder text",
  "Internal contradictions",
  "Ambiguity that could lead the planner to design the wrong implementation",
  "Do not block on wording polish",
  "ask only the clarifying question or related small set of questions",
]) {
  assertContains(specDrivenDevelopment, text);
}
for (const text of [
  "The user does not need to explicitly request subagents for this internal gate",
  "When subagent execution is available, run this evaluator pass",
  "normal `$spec` workflow",
]) {
  assertNotContains(specDrivenDevelopment, text);
}

const planningBreakdown = rel("skills", "planning-and-task-breakdown", "SKILL.md");
for (const text of [
  "Step 4: Classify Requirement Risk",
  "Step 7: Evaluate and Revise",
  "classify every approved SPEC requirement as `normal` or `high-risk`",
  "This classification is an AI semantic judgment",
  "not a keyword classifier",
  "Implementation meaning",
  "Required scenario",
  "Negative scenario",
  "No high-risk requirements identified because",
  "run an inline blocker-oriented self-review pass",
  "default `$plan` quality gate",
  "Ordinary tests could pass while a stated semantic requirement remains wrong",
  "Same-loop, same-invocation, no-stuck, or eventual-completion guarantees",
  "Subagent-assisted plan evaluation may be used when a fresh-context pass would add signal",
  "runtime exposes the needed subagent tools",
  "use `agents/plan-evaluator.md` as the prompt template",
  "The main agent owns revisions, user questions, artifact saving",
  "Missing tasks or missing implementation steps",
  "Missing coverage for stated SPEC requirements",
  "Inconsistent file paths, type names, API names, command names, or dependencies",
  "Do not block on wording polish",
  "ask only the clarifying question or related small set of questions",
  "preserve the change as a new plan revision",
  "dated task log/context/criteria update",
  "clearly linked superseding artifact",
  "Do not leave later queued task cards relying on obsolete plan text",
]) {
  assertContains(planningBreakdown, text);
}
for (const text of [
  "The user does not need to explicitly request subagents for this internal gate",
  "When subagent execution is available, run this evaluator pass",
  "normal `$plan` workflow",
]) {
  assertNotContains(planningBreakdown, text);
}

const incrementalImplementation = rel("skills", "incremental-implementation", "SKILL.md");
for (const text of [
  "every pending task from the current plan",
  "Review the task against its acceptance criteria",
  "Task Acceptance Traceability",
  "RED Evidence",
  "GREEN Evidence",
  "Code Path Reviewed",
  "Whole-Build Spec Traceability",
  "High-Risk Independent Review Gate",
  "Freshness: standalone-like inline pass",
  "whole-change verification loop",
  "This internal loop does not replace standalone `test`, `review`, or `ship`",
  "run a downstream impact check against remaining planned tasks and queued MDF task cards",
  "shared files alone are not hard dependencies and must not become `depends_on`",
  "Confirm downstream impact checks have been recorded",
]) {
  assertContains(incrementalImplementation, text);
}
assertOrder(
  "skills/incremental-implementation/SKILL.md planned task loop",
  sectionBetween(incrementalImplementation, "For each planned task:", "The task-level build artifact must include"),
  [
    "Commit the task-sized change only after",
    "run a downstream impact check against remaining planned tasks and queued MDF task cards",
    "Classify downstream impact as",
    "Continue to the next pending task only after",
  ]
);

const readme = rel("README.md");
const trackedDocsCorpus = `${read(readme)}\n${readMarkdownTree("docs")}`;
for (const text of [
  "`tasks-project`",
  "`tasks-user`",
  "$tasks-project",
  "$tasks-user",
  "spec -> plan -> build -> review -> ship",
  "`spec`, `plan`, and `build` use inline loops by default",
  "High-risk work has heavier gates by design",
  "delegates setup PR push/create/update mechanics to `github-pr`",
  "narrow MDF init setup PR mode",
  "PRs are ready for review by default",
  "classified as `normal` or `high-risk` by semantic judgment",
  "Task Acceptance Traceability",
  "Whole-Build Spec Traceability",
  "mandatory high-risk independent review",
  "continued DB-backed job to be reselected within the same bounded scheduler invocation",
  "persisted `continued` state is insufficient",
  "Subagent-assisted evaluator, build, or review modes require both explicit current-user authorization",
  "runtime tool availability",
  "standalone quality tools",
  "independent verification, manual changes, debugging, PR preparation, and pre-ship checks",
  "Queued task cards are checked for semantic drift before work starts",
  "runs before branch/worktree creation, lock mutation, task state changes",
  "downstream impact check against remaining planned work, queued task cards",
  "Shared files alone do not create hard dependencies",
  "`depends_on` remains only for true hard blockers",
  "review checkpoint only",
  "artifact saved confirmation",
  "same user message",
  "explicit downstream workflow",
  "Standalone `$task work <id>`",
]) {
  assert(
    trackedDocsCorpus.includes(text),
    `README.md or docs/**/*.md must include ${JSON.stringify(text)}`
  );
}
for (const text of [
  "$tasks all",
  "/mdf:tasks all",
  "`tasks all`",
  "$tasks\n",
  "/mdf:tasks\n",
]) {
  assertNotContains(readme, text);
}

const specEvaluator = rel("agents", "spec-evaluator.md");
for (const text of [
  "name: spec-evaluator",
  "Return exactly one of these shapes",
  "no blockers",
  "question needed",
  "Block only on issues likely to cause flawed planning",
  "Do not:",
  "Rewrite the SPEC",
  "Ask the user directly",
  "prompt template",
  "fresh-context SPEC evaluation would add signal",
  "runtime exposes the needed subagent tools",
]) {
  assertContains(specEvaluator, text);
}
assertNotContains(specEvaluator, "Invoke internally from `spec` / `spec-driven-development`");
assertNotContains(specEvaluator, "Use internally from the spec workflow");

const planEvaluator = rel("agents", "plan-evaluator.md");
for (const text of [
  "name: plan-evaluator",
  "Return exactly one of these shapes",
  "no blockers",
  "question needed",
  "Block only on issues likely to cause flawed implementation",
  "requirement risk classification",
  "classification of every SPEC requirement as `normal` or `high-risk`",
  "semantic judgment by meaning",
  "No high-risk requirements identified because",
  "Do not:",
  "Rewrite the plan",
  "Ask the user directly",
  "prompt template",
  "fresh-context plan evaluation would add signal",
  "runtime exposes the needed subagent tools",
]) {
  assertContains(planEvaluator, text);
}
assertNotContains(planEvaluator, "Invoke internally from `plan` / `planning-and-task-breakdown`");
assertNotContains(planEvaluator, "Use internally from the plan workflow");

const codeReviewQuality = rel("skills", "code-review-and-quality", "SKILL.md");
for (const text of [
  "## Review Scopes",
  "`task` scope",
  "`whole-build` scope",
  "`standalone` scope",
  "scope constrains which evidence matters",
  "## Pass 1: Spec Compliance",
  "## Pass 2: Code Quality / Five-Axis Review",
  "Distrust implementer and build summaries",
  "## High-Risk Independent Review",
  "Freshness: standalone-like inline pass",
  "Any Critical or Important finding",
  "task card context, criteria, and latest artifact pointers",
  "Task cards and queued downstream task assumptions",
  "available MDF task cards, spec, plan, build, and review artifacts",
  "Contradictions between approved spec, task cards, plan, build artifacts, review artifacts, tests, current code, and current code or skill contracts",
]) {
  assertContains(codeReviewQuality, text);
}

const buildSkill = rel("skills", "build", "SKILL.md");
for (const text of [
  "Task Acceptance Traceability",
  "Whole-Build Spec Traceability",
  "mandatory high-risk independent review",
  "before `$mdf:build` claims completion",
  "Freshness: standalone-like inline pass",
  "run a downstream impact check against remaining planned tasks and queued MDF task cards",
  "needs plan revision or linked superseding artifact",
  "shared files alone are not hard dependencies",
  "Downstream impact checks have been recorded",
]) {
  assertContains(buildSkill, text);
}
assertOrder(
  "skills/build/SKILL.md pending task loop",
  sectionBetween(buildSkill, "For each pending task:", "After all selected tasks complete"),
  [
    "Commit with a descriptive message only after",
    "run a downstream impact check against remaining planned tasks and queued MDF task cards",
    "Classify downstream impact as",
    "Mark the task complete and move to the next one only after",
  ]
);

const doubtDrivenDevelopment = rel("skills", "doubt-driven-development", "SKILL.md");
for (const text of [
  "where Claude Code prevents nested subagent spawn",
  "role-based reviewers in `agents/` start with isolated context by design",
]) {
  assertContains(doubtDrivenDevelopment, text);
}
for (const text of [
  "MDF high-risk independent review gates",
  "Freshness: standalone-like inline pass",
]) {
  assertNotContains(doubtDrivenDevelopment, text);
}

const codeReviewer = rel("agents", "code-reviewer.md");
for (const text of [
  "high-risk independent review",
  "Requirement Checks",
  "Freshness",
]) {
  assertContains(codeReviewer, text);
}

const githubCommit = rel("skills", "github-commit", "SKILL.md");
for (const text of [
  "name: github-commit",
  "git diff HEAD",
  "git log --oneline -10",
  "Do not commit secrets",
  "Create a single commit",
]) {
  assertContains(githubCommit, text);
}

const githubClearGone = rel("skills", "github-clear-gone", "SKILL.md");
for (const text of [
  "name: github-clear-gone",
  "git fetch --prune",
  "git branch -v",
  "git worktree list",
  "Ask for explicit confirmation only for dirty worktrees",
  "Never delete branches that are not marked `[gone]`",
]) {
  assertContains(githubClearGone, text);
}

for (const manifestPath of [
  rel(".codex-plugin", "plugin.json"),
  rel(".agents", "plugins", "marketplace.json"),
]) {
  JSON.parse(read(manifestPath));
}

const codexManifest = JSON.parse(read(rel(".codex-plugin", "plugin.json")));
assert(codexManifest.skills === "./skills/", ".codex-plugin skills path changed");
assert(
  !Object.prototype.hasOwnProperty.call(codexManifest, "agents"),
  ".codex-plugin/plugin.json must not declare unsupported agents"
);
assert(
  Array.isArray(codexManifest.keywords) &&
    codexManifest.keywords.includes("codex") &&
    !codexManifest.keywords.includes("claude-code"),
  ".codex-plugin/plugin.json must describe Codex-only support"
);
for (const [label, value] of [
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
  !codexManifest.interface?.shortDescription?.includes("Claude Code"),
  ".codex-plugin shortDescription must not advertise Claude Code support"
);
assert(
  Array.isArray(codexManifest.interface?.defaultPrompt) &&
    codexManifest.interface.defaultPrompt.join("\n").includes("use-mdf") &&
    codexManifest.interface.defaultPrompt.join("\n").includes("tasks-project") &&
    codexManifest.interface.defaultPrompt.join("\n").includes("tasks-user"),
  ".codex-plugin defaultPrompt must route users toward the workflow selector"
);

assertContains(rel("README.md"), "Claude Code plugin support has been intentionally removed");
assertNotContains(rel("README.md"), "/mdf:");
assertNotContains(rel("README.md"), "claude --plugin-dir");

for (const text of [
  "vendor/agent-skills.lock.json",
  "overlays/mdf/inventory.json",
  "overlays/mdf/release-metadata.json",
  "overlays/mdf/references/artifact-storage-override.md",
  "scripts/sync-agent-skills.js",
  "scripts/validate-agent-skills-sync.js",
]) {
  assertFile(rel(...text.split("/")));
}

const syncValidation = spawnSync(process.execPath, [rel("scripts", "validate-agent-skills-sync.js")], {
  cwd: root,
  encoding: "utf8",
});
assert(
  syncValidation.status === 0,
  `scripts/validate-agent-skills-sync.js must pass. stdout: ${syncValidation.stdout.trim()} stderr: ${syncValidation.stderr.trim()}`
);

if (failures.length > 0) {
  console.error("Agent skills port validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Agent skills port validation passed.");
