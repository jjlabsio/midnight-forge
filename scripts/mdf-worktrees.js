#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { runCli } = require("./mdf-runtime/cli");
const { WorkflowError } = require("./mdf-runtime/errors");
const { canonicalRoot, isInside, projectPaths, resolveWithin } = require("./mdf-runtime/canonical-root");
const { resolveDefaultBranch, runCommand } = require("./mdf-runtime/git");

function required(value, field) {
  if (typeof value !== "string" || !value.trim()) throw new WorkflowError("MDF_INPUT_REQUIRED", `${field} is required.`, { field });
  return value.trim();
}

function branchName(value) {
  const branch = required(value, "branch");
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(branch) || branch.includes("..") || branch.endsWith("/") || branch.includes("//")) {
    throw new WorkflowError("MDF_BRANCH_INVALID", "Branch name is not safe for a project-local worktree.", { branch });
  }
  return branch;
}

function rootFor(input, options) {
  return canonicalRoot(input.root || input.cwd || options.cwd || process.cwd());
}

function gitText(args, cwd, runner) {
  return runCommand("git", args, { cwd, runner }).stdout.trim();
}

function resolvedGitPath(value, cwd) {
  return path.isAbsolute(value) ? path.resolve(value) : path.resolve(cwd, value);
}

function targetPath(root, branch, requested) {
  const base = path.join(root, ".worktrees");
  const candidate = requested ? (path.isAbsolute(requested) ? requested : path.resolve(root, requested)) : path.join(base, branch);
  if (!isInside(base, path.resolve(candidate))) {
    throw new WorkflowError("MDF_WORKTREE_PATH_INVALID", "Worktree path must be inside the project .worktrees directory.", { path: candidate });
  }
  const relative = path.relative(root, candidate);
  return resolveWithin(root, relative, { allowMissing: true });
}

function parseWorktrees(output) {
  return output.trim() ? output.trim().split(/\n\s*\n/).map((block) => {
    const lines = block.split(/\r?\n/);
    const record = { path: null, branch: null, broken: false, prunable: false };
    for (const line of lines) {
      if (line.startsWith("worktree ")) record.path = line.slice("worktree ".length);
      if (line.startsWith("branch ")) record.branch = line.slice("branch ".length).replace(/^refs\/heads\//, "");
      if (line.includes("broken")) record.broken = true;
      if (line.includes("prunable")) record.prunable = true;
    }
    return record;
  }) : [];
}

function registeredWorktree(root, worktree, runner) {
  const listed = parseWorktrees(gitText(["worktree", "list", "--porcelain"], root, runner));
  const record = listed.find((entry) => entry.path && path.resolve(entry.path) === path.resolve(worktree));
  if (!record || record.broken || record.prunable || !record.branch) {
    throw new WorkflowError("MDF_WORKTREE_NOT_REGISTERED", "Preparation must target an existing named Git worktree registered with the repository.", { path: worktree });
  }
  return record;
}

function pathEntryExists(filePath) {
  try {
    fs.lstatSync(filePath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw new WorkflowError("MDF_WORKTREE_STATE_BOUNDARY", "Unable to inspect worktree state boundary.", { path: filePath, cause: error.message });
  }
}

function assertBaseHasNoMdf(root, base, runner) {
  const result = runCommand("git", ["ls-tree", "-r", "--name-only", base, "--", ".mdf"], { cwd: root, runner });
  const tracked = result.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (tracked.length > 0) {
    throw new WorkflowError("MDF_WORKTREE_STATE_BOUNDARY", "The worktree base contains tracked independent MDF state.", { base, paths: tracked });
  }
}

function rollbackCreatedWorktree(root, target, branch, runner, originalError) {
  const failures = [];
  try {
    runCommand("git", ["worktree", "remove", "--force", target], { cwd: root, runner });
  } catch (error) {
    failures.push({ operation: "worktree_remove", cause: error.message });
  }
  try {
    runCommand("git", ["branch", "-D", branch], { cwd: root, runner });
  } catch (error) {
    failures.push({ operation: "branch_delete", cause: error.message });
  }
  if (failures.length > 0) {
    throw new WorkflowError("MDF_WORKTREE_ROLLBACK_FAILED", "Worktree creation failed and automatic rollback was incomplete.", {
      target,
      branch,
      original_error: originalError.code || originalError.message,
      cleanup_errors: failures,
    });
  }
}

function preflight(input = {}, options = {}) {
  const root = rootFor(input, options);
  const cwd = input.cwd || options.cwd || root;
  const runner = options.runner;
  const gitDir = resolvedGitPath(gitText(["rev-parse", "--git-dir"], cwd, runner), cwd);
  const commonDir = resolvedGitPath(gitText(["rev-parse", "--git-common-dir"], cwd, runner), cwd);
  const currentBranchResult = runCommand("git", ["branch", "--show-current"], { cwd, runner, allowFailure: true });
  const currentBranch = currentBranchResult.stdout.trim() || null;
  const currentIsolated = gitDir !== commonDir;
  const defaultBranch = resolveDefaultBranch({ cwd, runner });
  const expectedBranch = input.branch ? branchName(input.branch) : null;
  const requestedWorktree = input.worktree_path || input.worktree;
  const expectedPath = expectedBranch || requestedWorktree ? targetPath(root, expectedBranch || "target", requestedWorktree) : null;

  if (currentIsolated) {
    if (!currentBranch) throw new WorkflowError("MDF_DETACHED_WORKTREE", "An isolated worktree must have a named branch.", { cwd });
    if (currentBranch === defaultBranch || currentBranch === "main") {
      throw new WorkflowError("MDF_WORKTREE_NOT_ISOLATED", "The current linked worktree is on the default branch.", { branch: currentBranch });
    }
    if (expectedPath && path.resolve(cwd) !== path.resolve(expectedPath)) {
      throw new WorkflowError("MDF_WORKTREE_MISMATCH", "The current linked worktree does not match the requested path.", { cwd, expected: expectedPath });
    }
  }

  const origin = runCommand("git", ["remote", "get-url", "origin"], { cwd, runner, allowFailure: true });
  if (origin.status !== 0 || !origin.stdout.trim()) throw new WorkflowError("MDF_ORIGIN_MISSING", "The repository must have an origin remote.", { cwd });
  const paths = projectPaths(root);
  if (!fs.existsSync(paths.projectInit)) throw new WorkflowError("MDF_PROJECT_INIT_MISSING", "MDF project init is missing.", { path: paths.projectInit });
  const ignoredPath = path.join(root, ".worktrees/");
  const ignored = runCommand("git", ["check-ignore", "-q", "--", ignoredPath], { cwd: root, runner, allowFailure: true });
  if (ignored.status !== 0) throw new WorkflowError("MDF_WORKTREES_NOT_IGNORED", "The project .worktrees directory is not ignored.", { path: ignoredPath });

  runCommand("git", ["fetch", "origin", defaultBranch], { cwd: root, runner });
  const remoteRef = runCommand("git", ["show-ref", "--verify", "--quiet", `refs/remotes/origin/${defaultBranch}`], { cwd: root, runner, allowFailure: true });
  if (remoteRef.status !== 0) throw new WorkflowError("MDF_REMOTE_DEFAULT_MISSING", "The remote default branch does not exist.", { branch: defaultBranch });
  const listed = parseWorktrees(gitText(["worktree", "list", "--porcelain"], root, runner));
  const conflicts = [];
  if (expectedBranch && runCommand("git", ["show-ref", "--verify", "--quiet", `refs/heads/${expectedBranch}`], { cwd: root, runner, allowFailure: true }).status === 0) {
    conflicts.push({ kind: "branch", branch: expectedBranch });
  }
  if (expectedPath && fs.existsSync(expectedPath)) conflicts.push({ kind: "path", path: expectedPath });
  const listedPath = expectedPath && listed.some((record) => record.path && path.resolve(record.path) === path.resolve(expectedPath));
  if (listedPath && !conflicts.some((conflict) => conflict.kind === "path")) conflicts.push({ kind: "worktree", path: expectedPath });
  return {
    canonical_root: root,
    current_path: path.resolve(cwd),
    current_branch: currentBranch,
    current_isolated: currentIsolated,
    default_branch: defaultBranch,
    origin: origin.stdout.trim(),
    ignore_policy: true,
    broken_worktrees: listed.filter((record) => record.broken),
    prunable_worktrees: listed.filter((record) => record.prunable),
    conflicts,
    ready: !currentIsolated && conflicts.length === 0,
  };
}

function create(input = {}, options = {}) {
  const branch = branchName(input.branch);
  const root = rootFor(input, options);
  const requestedWorktree = input.worktree_path || input.worktree;
  const target = targetPath(root, branch, requestedWorktree);
  const check = preflight({ ...input, root, branch, worktree_path: target }, options);
  if (!check.ready) throw new WorkflowError("MDF_WORKTREE_CONFLICT", "Worktree creation is blocked by preflight conflicts or current isolation.", { conflicts: check.conflicts, current_isolated: check.current_isolated });
  const base = `origin/${check.default_branch}`;
  assertBaseHasNoMdf(root, base, options.runner);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  let created = false;
  try {
    runCommand("git", ["worktree", "add", target, "-b", branch, base], { cwd: root, runner: options.runner });
    created = true;
    const statePath = path.join(target, ".mdf");
    if (pathEntryExists(statePath)) throw new WorkflowError("MDF_WORKTREE_STATE_BOUNDARY", "A new worktree must not contain independent MDF state.", { path: statePath });
  } catch (error) {
    if (!created) throw error;
    rollbackCreatedWorktree(root, target, branch, options.runner, error);
    throw error;
  }
  return { canonical_root: root, path: target, branch, base, default_branch: check.default_branch };
}

function managerFor(dir, fallback, boundary = dir) {
  let current = dir;
  while (isInside(boundary, current)) {
    if (fs.existsSync(path.join(current, "pnpm-lock.yaml"))) return "pnpm";
    if (fs.existsSync(path.join(current, "yarn.lock"))) return "yarn";
    if (fs.existsSync(path.join(current, "bun.lock")) || fs.existsSync(path.join(current, "bun.lockb"))) return "bun";
    if (fs.existsSync(path.join(current, "package-lock.json"))) return "npm";
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return fallback || "npm";
}

function dependencySetup(worktree, runner) {
  const candidates = [
    ["pnpm-lock.yaml", "pnpm", ["install"]], ["yarn.lock", "yarn", ["install"]],
    ["bun.lock", "bun", ["install"]], ["bun.lockb", "bun", ["install"]],
    ["package-lock.json", "npm", ["install"]], ["package.json", "npm", ["install"]],
    ["Cargo.toml", "cargo", ["fetch"]], ["go.mod", "go", ["mod", "download"]],
    ["requirements.txt", "pip", ["install", "-r", "requirements.txt"]],
  ];
  const selected = candidates.find(([file]) => fs.existsSync(path.join(worktree, file)));
  if (!selected) return { status: "skipped", manager: null, command: null };
  const [, manager, args] = selected;
  try {
    runCommand(manager, args, { cwd: worktree, runner });
  } catch (error) {
    throw new WorkflowError("MDF_DEPENDENCY_SETUP_FAILED", "Dependency setup failed; later preparation steps were not run.", { manager, command: [manager, ...args], cause: error.message });
  }
  return { status: "completed", manager, command: [manager, ...args] };
}

function packageFiles(root) {
  const files = [];
  function visit(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (["node_modules", ".git", ".worktrees"].includes(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (entry.name === "package.json") files.push(full);
    }
  }
  visit(root);
  return files.sort((a, b) => (a === path.join(root, "package.json") ? -1 : b === path.join(root, "package.json") ? 1 : a.localeCompare(b)));
}

function prismaScript(packageData) {
  const scripts = packageData.scripts || {};
  const matching = Object.entries(scripts).filter(([, value]) => typeof value === "string" && /prisma\s+generate/.test(value));
  for (const preferred of ["prisma:generate", "db:generate", "generate"]) {
    const found = matching.find(([name]) => name === preferred);
    if (found) return found[0];
  }
  return matching.length ? matching[0][0] : null;
}

function appearsPrisma(packageDir, data) {
  const dependencies = { ...(data.dependencies || {}), ...(data.devDependencies || {}) };
  return Boolean(dependencies.prisma || dependencies["@prisma/client"] || fs.existsSync(path.join(packageDir, "prisma", "schema.prisma")));
}

function runPrisma(worktree, dependency, runner) {
  const results = [];
  const packages = packageFiles(worktree).map((file) => {
    try {
      return { file, dir: path.dirname(file), data: JSON.parse(fs.readFileSync(file, "utf8")) };
    } catch (error) {
      throw new WorkflowError("MDF_PACKAGE_JSON_MALFORMED", "A package.json file is malformed.", { path: file, cause: error.message });
    }
  });
  const rootPackage = packages.find((item) => item.dir === worktree);
  const rootScript = rootPackage && prismaScript(rootPackage.data);
  const run = (item, args) => {
    const manager = managerFor(item.dir, dependency.manager, worktree);
    let command = manager;
    let commandArgs = args;
    if (args[0] === "__script__") {
      const script = args[1];
      commandArgs = manager === "npm" ? ["run", script] : manager === "yarn" ? [script] : manager === "bun" ? ["run", script] : ["run", script];
    } else if (manager === "npm") commandArgs = ["exec", "prisma", "generate"];
    else if (manager === "yarn") commandArgs = ["prisma", "generate"];
    else if (manager === "bun") { command = "bunx"; commandArgs = ["prisma", "generate"]; }
    else commandArgs = ["prisma", "generate"];
    try {
      runCommand(command, commandArgs, { cwd: item.dir, runner });
    } catch (error) {
      throw new WorkflowError("MDF_PRISMA_SETUP_FAILED", "Prisma client generation failed.", { package: item.dir, command: [command, ...commandArgs], cause: error.message });
    }
    results.push({ package: item.dir, command: [command, ...commandArgs] });
  };
  if (rootPackage && rootScript) run(rootPackage, ["__script__", rootScript]);
  else {
    for (const item of packages) {
      if (!appearsPrisma(item.dir, item.data)) continue;
      const script = prismaScript(item.data);
      run(item, script ? ["__script__", script] : []);
    }
  }
  return results.length ? { status: "completed", commands: results } : { status: "skipped", commands: [] };
}

function prepare(input = {}, options = {}) {
  const root = rootFor(input, options);
  const requestedWorktree = required(input.worktree_path || input.worktree, "worktree_path");
  const candidateWorktree = path.isAbsolute(requestedWorktree) ? requestedWorktree : path.resolve(root, requestedWorktree);
  const canonicalWorktree = fs.existsSync(candidateWorktree) ? fs.realpathSync(candidateWorktree) : candidateWorktree;
  const worktree = resolveWithin(root, path.relative(root, canonicalWorktree), { allowMissing: false });
  if (!isInside(path.join(root, ".worktrees"), worktree)) throw new WorkflowError("MDF_WORKTREE_PATH_INVALID", "Preparation must target a project-local worktree.", { path: worktree });
  registeredWorktree(root, worktree, options.runner);
  if (pathEntryExists(path.join(worktree, ".mdf"))) throw new WorkflowError("MDF_WORKTREE_STATE_BOUNDARY", "Preparation refuses independent MDF state inside a worktree.", { path: path.join(worktree, ".mdf") });
  const copied = [];
  const skipped = [];
  try {
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.startsWith(".env")) continue;
      const source = path.join(root, entry.name);
      const destination = path.join(worktree, entry.name);
      if (fs.existsSync(destination)) skipped.push(entry.name);
      else { fs.copyFileSync(source, destination); copied.push(entry.name); }
    }
  } catch (error) {
    throw new WorkflowError("MDF_ENV_SETUP_FAILED", "Root environment file preparation failed.", { cause: error.message });
  }
  const dependency = dependencySetup(worktree, options.runner);
  if (pathEntryExists(path.join(worktree, ".mdf"))) throw new WorkflowError("MDF_WORKTREE_STATE_BOUNDARY", "Preparation produced independent MDF state inside a worktree.", { path: path.join(worktree, ".mdf") });
  const prisma = runPrisma(worktree, dependency, options.runner);
  if (pathEntryExists(path.join(worktree, ".mdf"))) throw new WorkflowError("MDF_WORKTREE_STATE_BOUNDARY", "Prisma preparation produced independent MDF state inside a worktree.", { path: path.join(worktree, ".mdf") });
  return { canonical_root: root, worktree, environment: { copied, skipped }, dependencies: dependency, prisma };
}

function main() {
  const exitCode = runCli({ operations: { preflight, create, prepare } });
  if (exitCode) process.exitCode = exitCode;
}

if (require.main === module) main();

module.exports = { create, prepare, preflight };
