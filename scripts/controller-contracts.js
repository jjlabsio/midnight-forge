const path = require("path");
const fs = require("fs");

function approvalMatches(approval, latest, kind) {
  return Boolean(
    approval &&
      approval.kind === kind &&
      approval.affirmative === true &&
      approval.artifact === latest[kind] &&
      approval.artifact_sha256 === latest[`${kind}_sha256`] &&
      approval.latest_pointer === latest[kind]
  );
}

function resolveBuildMode(args) {
  return args.includes("auto") || args.includes("all") ? "lifecycle" : "single-task";
}

function cleanBaseline(statusPorcelain) {
  return statusPorcelain.trim() === "";
}

function reviewDisposition({ freshReviewerAvailable, rootEscalationAllowed }) {
  if (freshReviewerAvailable) return "fresh";
  if (rootEscalationAllowed) return "root-fallback";
  return "block";
}

function canCompleteWholeBuild({ approvedTasks, passedTasks, writers }) {
  return writers === 1 && approvedTasks > 0 && passedTasks === approvedTasks;
}

function resolvePluginPath(pluginRoot, relativePath) {
  if (!pluginRoot || path.isAbsolute(relativePath)) throw new Error("plugin path must be relative to an installed plugin root");
  const resolved = path.resolve(pluginRoot, relativePath);
  if (!resolved.startsWith(path.resolve(pluginRoot) + path.sep)) throw new Error("plugin path escapes installed plugin root");
  if (!fs.existsSync(resolved)) throw new Error("plugin path is unresolved");
  return resolved;
}

module.exports = { approvalMatches, canCompleteWholeBuild, cleanBaseline, resolveBuildMode, resolvePluginPath, reviewDisposition };
