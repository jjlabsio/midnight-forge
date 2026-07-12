const { spawnSync } = require("child_process");
const { WorkflowError } = require("./errors");

function defaultRunner(command, args, { cwd } = {}) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  return { status: result.status, stdout: result.stdout || "", stderr: result.stderr || "" };
}

function runCommand(command, args, { cwd = process.cwd(), runner = defaultRunner, allowFailure = false } = {}) {
  const result = runner(command, args, { cwd });
  if (!result || !Number.isInteger(result.status)) {
    throw new WorkflowError("MDF_COMMAND_INVALID", "Command runner returned an invalid result.", { command, args });
  }
  if (result.status !== 0 && !allowFailure) {
    throw new WorkflowError("MDF_COMMAND_FAILED", "External command failed.", {
      command,
      args,
      exit_code: result.status,
      stderr: result.stderr || "",
    });
  }
  return result;
}

function runGit(args, options = {}) {
  return runCommand("git", args, options).stdout.trim();
}

function resolveDefaultBranch({ cwd = process.cwd(), runner = defaultRunner } = {}) {
  const symbolic = runCommand("git", ["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"], { cwd, runner, allowFailure: true });
  const symbolicMatch = symbolic.stdout.trim().match(/^origin\/(.+)$/);
  if (symbolic.status === 0 && symbolicMatch) return symbolicMatch[1];
  const remote = runCommand("git", ["remote", "show", "origin"], { cwd, runner, allowFailure: true });
  const remoteMatch = remote.stdout.match(/^\s*HEAD branch:\s*(\S+)\s*$/m);
  if (remote.status === 0 && remoteMatch) return remoteMatch[1];
  throw new WorkflowError("MDF_DEFAULT_BRANCH_MISSING", "Could not resolve the remote default branch.", { cwd });
}

module.exports = { defaultRunner, resolveDefaultBranch, runCommand, runGit };
