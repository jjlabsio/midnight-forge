const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { ControllerError } = require("./context");

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function inside(parent, child) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== "..");
}

function evidencePath(context, relativePath) {
  if (typeof relativePath !== "string" || !relativePath || path.isAbsolute(relativePath)) {
    throw new ControllerError("MDF_EVIDENCE_PATH_INVALID", "Evidence path must be a non-empty relative path.");
  }
  const candidate = path.resolve(context.work_item.path, relativePath);
  if (!inside(context.work_item.path, candidate)) throw new ControllerError("MDF_EVIDENCE_PATH_ESCAPE", "Evidence path escapes the work item.");
  const stat = fs.lstatSync(candidate, { throwIfNoEntry: false });
  if (!stat) throw new ControllerError("MDF_EVIDENCE_PATH_MISSING", "Evidence path is missing.", { path: relativePath });
  if (stat.isSymbolicLink()) throw new ControllerError("MDF_EVIDENCE_SYMLINK", "Evidence path must not be a symbolic link.", { path: relativePath });
  const resolved = fs.realpathSync(candidate);
  if (!inside(context.work_item.path, resolved) || !fs.statSync(resolved).isFile()) {
    throw new ControllerError("MDF_EVIDENCE_PATH_INVALID", "Evidence path must resolve to a work-item file.", { path: relativePath });
  }
  return resolved;
}

function fact(context, relativePath) {
  const absolute = evidencePath(context, relativePath);
  const bytes = fs.readFileSync(absolute);
  return { path: relativePath, sha256: sha256(bytes), bytes: bytes.length };
}

function nextFile(context, kind) {
  const directory = path.join(context.work_item.path, "evidence");
  if (fs.existsSync(directory)) {
    const stat = fs.lstatSync(directory);
    if (stat.isSymbolicLink() || !stat.isDirectory() || !inside(context.work_item.path, fs.realpathSync(directory))) {
      throw new ControllerError("MDF_EVIDENCE_SYMLINK", "Evidence directory must be a real directory inside the work item.");
    }
  } else {
    fs.mkdirSync(directory, { recursive: true });
  }
  const prefix = `${kind}-`;
  const count = fs.readdirSync(directory).filter((name) => name.startsWith(prefix) && name.endsWith(".json")).length + 1;
  return { directory, file: `${kind}-${String(count).padStart(3, "0")}.json` };
}

function write(context, kind, value) {
  const target = nextFile(context, kind);
  const sidecar = { version: 1, kind, work_id: context.work_item.id, recorded_at: new Date().toISOString(), ...value };
  sidecar.integrity_sha256 = sha256(JSON.stringify(sidecar));
  fs.writeFileSync(path.join(target.directory, target.file), `${JSON.stringify(sidecar, null, 2)}\n`, { flag: "wx" });
  return { file: target.file, ...sidecar };
}

function recordArtifact(context, artifactPath) {
  return write(context, "artifact", { artifact: fact(context, artifactPath) });
}

function recordCommand(context, { command, output_path: outputPath, exit_code: exitCode }) {
  if (!Array.isArray(command) || command.some((part) => typeof part !== "string") || !Number.isInteger(exitCode)) {
    throw new ControllerError("MDF_COMMAND_INVALID", "Command evidence requires string argv and integer exit_code.");
  }
  return write(context, "command", { command, exit_code: exitCode, output: fact(context, outputPath) });
}

function computeGitFacts(context) {
  const run = (args) => {
    const result = spawnSync("git", args, { cwd: context.worktree, encoding: "utf8" });
    if (result.status !== 0) throw new ControllerError("MDF_GIT_FACTS_FAILED", "Could not compute Git facts.", { args, stderr: result.stderr });
    return result.stdout;
  };
  const head = run(["rev-parse", "HEAD"]).trim();
  const status = run(["status", "--porcelain"]);
  const diff = spawnSync("git", ["diff", "--binary", "HEAD", "--"], { cwd: context.worktree }).stdout || Buffer.alloc(0);
  const untracked = run(["ls-files", "--others", "--exclude-standard", "-z"]).split("\0").filter(Boolean).sort().map((file) => {
    const absolute = path.join(context.worktree, file);
    const stat = fs.lstatSync(absolute);
    const bytes = stat.isSymbolicLink() ? Buffer.from(fs.readlinkSync(absolute)) : fs.readFileSync(absolute);
    return `${file}\0${sha256(bytes)}`;
  }).join("\0");
  return { head, status_sha256: sha256(status), worktree_sha256: sha256(Buffer.concat([diff, Buffer.from(untracked)])) };
}

function recordGitFacts(context) {
  return write(context, "git", { git: computeGitFacts(context) });
}

function recordInteraction(context, { invocation, input_paths: inputPaths }) {
  if (!invocation || typeof invocation.agent_id !== "string" || typeof invocation.invocation_id !== "string" || !Array.isArray(inputPaths)) {
    throw new ControllerError("MDF_INTERACTION_INVALID", "Interactions require an agent invocation and exact input paths.");
  }
  return write(context, "interaction", { invocation, inputs: inputPaths.map((inputPath) => fact(context, inputPath)), git: computeGitFacts(context) });
}

function recordDecision(context, { interaction_file: interactionFile, conclusion }) {
  if (typeof interactionFile !== "string" || !conclusion || typeof conclusion !== "object" || Array.isArray(conclusion)) {
    throw new ControllerError("MDF_DECISION_INVALID", "Semantic decisions require a canonical interaction reference and structured conclusion.");
  }
  const interaction = verifySidecar(context, interactionFile);
  if (interaction.kind !== "interaction") throw new ControllerError("MDF_DECISION_INVALID", "Decision reference must name an interaction sidecar.");
  return write(context, "decision", { interaction: { file: interactionFile, integrity_sha256: interaction.integrity_sha256 }, conclusion });
}

function readSidecar(context, file) {
  const absolute = evidencePath({ ...context, work_item: { ...context.work_item, path: path.join(context.work_item.path, "evidence") } }, file);
  try { return JSON.parse(fs.readFileSync(absolute, "utf8")); }
  catch (error) { throw new ControllerError("MDF_EVIDENCE_MALFORMED", "Evidence sidecar is malformed.", { file, cause: error.message }); }
}

function matches(context, expected) {
  const current = fact(context, expected.path);
  if (current.sha256 !== expected.sha256 || current.bytes !== expected.bytes) {
    throw new ControllerError("MDF_EVIDENCE_STALE", "Evidence no longer matches canonical input bytes.", { path: expected.path });
  }
}

function verifyInputs(context, sidecar) {
  if (!sidecar || !Array.isArray(sidecar.inputs)) throw new ControllerError("MDF_EVIDENCE_MALFORMED", "Evidence does not contain recorded inputs.");
  sidecar.inputs.forEach((input) => matches(context, input));
  return sidecar;
}

function verifySidecar(context, file, { fresh = true } = {}) {
  const sidecar = readSidecar(context, file);
  const integrity = sidecar.integrity_sha256;
  const unsigned = { ...sidecar };
  delete unsigned.integrity_sha256;
  if (integrity !== sha256(JSON.stringify(unsigned))) {
    throw new ControllerError("MDF_EVIDENCE_FABRICATED", "Evidence sidecar integrity does not match its recorded fields.", { file });
  }
  if (sidecar.work_id !== context.work_item.id) throw new ControllerError("MDF_EVIDENCE_REPLAY", "Evidence sidecar belongs to a different work item.", { file });
  if (sidecar.version !== 1) throw new ControllerError("MDF_EVIDENCE_MALFORMED", "Unsupported evidence sidecar version.", { file });
  if (sidecar.kind === "artifact") { if (!sidecar.artifact?.path || !sidecar.artifact.sha256) throw new ControllerError("MDF_EVIDENCE_FABRICATED", "Artifact sidecar lacks facts.", { file }); if (fresh) matches(context, sidecar.artifact); }
  else if (sidecar.kind === "command") { if (!Array.isArray(sidecar.command) || !Number.isInteger(sidecar.exit_code) || !sidecar.output?.path) throw new ControllerError("MDF_EVIDENCE_FABRICATED", "Command sidecar lacks facts.", { file }); if (fresh) matches(context, sidecar.output); }
  else if (sidecar.kind === "interaction") {
    if (!sidecar.invocation?.agent_id || !sidecar.invocation?.invocation_id) throw new ControllerError("MDF_EVIDENCE_FABRICATED", "Interaction sidecar lacks invocation provenance.", { file });
    if (!Array.isArray(sidecar.inputs) || !sidecar.git?.head || !sidecar.git.status_sha256) throw new ControllerError("MDF_EVIDENCE_FABRICATED", "Interaction sidecar lacks input or Git facts.", { file });
    if (fresh) {
      sidecar.inputs.forEach((input) => matches(context, input));
      const current = computeGitFacts(context);
      if (current.head !== sidecar.git?.head || current.status_sha256 !== sidecar.git?.status_sha256 || (sidecar.git.worktree_sha256 && current.worktree_sha256 !== sidecar.git.worktree_sha256)) throw new ControllerError("MDF_EVIDENCE_STALE", "Interaction Git facts are stale.", { file });
    }
  } else if (sidecar.kind === "decision") {
    if (typeof sidecar.interaction?.file !== "string" || typeof sidecar.conclusion !== "object") throw new ControllerError("MDF_EVIDENCE_FABRICATED", "Decision sidecar lacks semantic provenance.", { file });
    const interaction = verifySidecar(context, sidecar.interaction.file, { fresh });
    if (interaction.kind !== "interaction" || interaction.integrity_sha256 !== sidecar.interaction.integrity_sha256) throw new ControllerError("MDF_EVIDENCE_FABRICATED", "Decision interaction reference is fabricated.", { file });
  } else if (sidecar.kind === "git") {
    if (!sidecar.git?.head || !sidecar.git.status_sha256) throw new ControllerError("MDF_EVIDENCE_FABRICATED", "Git sidecar lacks facts.", { file });
    if (fresh) { const current = computeGitFacts(context); if (current.head !== sidecar.git.head || current.status_sha256 !== sidecar.git.status_sha256 || (sidecar.git.worktree_sha256 && current.worktree_sha256 !== sidecar.git.worktree_sha256)) throw new ControllerError("MDF_EVIDENCE_STALE", "Git evidence is stale.", { file }); }
  } else throw new ControllerError("MDF_EVIDENCE_MALFORMED", "Unknown evidence sidecar kind.", { file });
  return sidecar;
}

module.exports = { recordArtifact, recordCommand, recordInteraction, recordDecision, recordGitFacts, verifyInputs, verifySidecar };
