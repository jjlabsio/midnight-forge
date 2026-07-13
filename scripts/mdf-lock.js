#!/usr/bin/env node

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const { O_NOFOLLOW } = fs.constants;

class LockError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function fail(code, message) {
  throw new LockError(code, message);
}

function requireNoFollow() {
  if (typeof O_NOFOLLOW !== "number") fail("UNSUPPORTED", "Filesystem does not provide O_NOFOLLOW.");
}

function parseArgs(argv) {
  const [operation, ...rest] = argv;
  if (!new Set(["inspect", "acquire", "release"]).has(operation)) {
    fail("USAGE", "Usage: mdf-lock.js inspect|acquire|release --lock PATH [--sha256 DIGEST]");
  }

  let lockPath = null;
  let digest = null;
  for (let index = 0; index < rest.length; index += 1) {
    const option = rest[index];
    const value = rest[index + 1];
    if (option === "--lock" && lockPath === null && value) {
      lockPath = value;
      index += 1;
    } else if (option === "--sha256" && digest === null && value) {
      digest = value;
      index += 1;
    } else {
      fail("USAGE", "Usage: mdf-lock.js inspect|acquire|release --lock PATH [--sha256 DIGEST]");
    }
  }
  if (lockPath === null) fail("USAGE", "--lock PATH is required.");
  if (operation === "release" && !/^[a-f0-9]{64}$/.test(digest || "")) {
    fail("USAGE", "release requires a lowercase 64-character --sha256 DIGEST.");
  }
  if (operation !== "release" && digest !== null) fail("USAGE", "--sha256 is only valid for release.");
  return { operation, lockPath, digest };
}

function validatePath(rawPath) {
  if (typeof rawPath !== "string" || !path.isAbsolute(rawPath)) {
    fail("PATH", "Lock path must be absolute.");
  }
  const parts = rawPath.split(path.sep);
  if (parts.includes("..")) fail("PATH", "Lock path must not contain traversal.");
  if (rawPath.includes("\0")) fail("PATH", "Lock path contains a NUL byte.");
  return rawPath;
}

function validateAncestors(lockPath) {
  const parent = path.dirname(lockPath);
  const root = path.parse(parent).root;
  const relative = path.relative(root, parent);
  let current = root;
  const trustedSystemAliases = new Map([
    [path.parse("/var").root === "/" ? "/var" : "", "/private/var"],
    [path.parse("/tmp").root === "/" ? "/tmp" : "", "/private/tmp"],
  ]);
  for (const component of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, component);
    const stat = fs.lstatSync(current, { throwIfNoEntry: false });
    if (!stat) fail("PATH", `Lock ancestor is missing: ${current}`);
    if (stat.isSymbolicLink()) {
      let resolved;
      try { resolved = fs.realpathSync(current); } catch { fail("PATH", `Lock ancestor cannot be resolved: ${current}`); }
      if (trustedSystemAliases.get(current) !== resolved) fail("PATH", `Lock ancestor is an unexpected symlink: ${current}`);
    }
    const directoryStat = stat.isSymbolicLink() ? fs.statSync(current) : stat;
    if (!directoryStat.isDirectory()) fail("PATH", `Lock ancestor is not a directory: ${current}`);
  }
  return parent;
}

function validateTarget(lockPath, allowMissing) {
  validatePath(lockPath);
  const parent = validateAncestors(lockPath);
  const stat = fs.lstatSync(lockPath, { throwIfNoEntry: false });
  if (!stat) {
    if (!allowMissing) fail("MISSING", "Lock does not exist.");
    return { parent, exists: false };
  }
  if (stat.isSymbolicLink()) fail("PATH", "Lock target must not be a symlink.");
  if (!stat.isFile()) fail("PATH", "Lock target must be a regular file.");
  return { parent, exists: true, stat };
}

function identity(stat) {
  return { dev: stat.dev, ino: stat.ino, size: stat.size, mtimeMs: stat.mtimeMs };
}

function sameIdentity(left, right) {
  return left.dev === right.dev && left.ino === right.ino && left.size === right.size && left.mtimeMs === right.mtimeMs;
}

function digest(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function readOpenFile(filePath) {
  requireNoFollow();
  let fd;
  try {
    fd = fs.openSync(filePath, fs.constants.O_RDONLY | O_NOFOLLOW);
    const stat = fs.fstatSync(fd);
    if (!stat.isFile()) fail("PATH", "Lock target must be a regular file.");
    const bytes = fs.readFileSync(fd);
    return { fd, bytes, identity: identity(stat), digest: digest(bytes) };
  } catch (error) {
    if (fd !== undefined) fs.closeSync(fd);
    throw error;
  }
}

function closeSnapshot(snapshot) {
  if (snapshot?.fd !== undefined) {
    fs.closeSync(snapshot.fd);
    snapshot.fd = undefined;
  }
}

function uniquePath(parent, prefix) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const name = `${prefix}-${process.pid}-${crypto.randomBytes(12).toString("hex")}`;
    const candidate = path.join(parent, name);
    if (!fs.existsSync(candidate)) return candidate;
  }
  fail("UNSUPPORTED", "Could not allocate a private same-directory temporary name.");
}

function acquire(lockPath) {
  requireNoFollow();
  const target = validateTarget(lockPath, true);
  if (target.exists) fail("CONFLICT", "Lock already exists; existing bytes were preserved.");

  const tempPath = uniquePath(target.parent, ".mdf-lock-tmp");
  let fd;
  try {
    const bytes = fs.readFileSync(0);
    if (bytes.length === 0) fail("INPUT", "Lock bytes from stdin must be non-empty.");
    fd = fs.openSync(tempPath, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL, 0o600);
    fs.writeFileSync(fd, bytes);
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;
    try {
      validateAncestors(lockPath);
      fs.linkSync(tempPath, lockPath);
    } catch (error) {
      if (error.code === "EEXIST") fail("CONFLICT", "Lock appeared during exclusive acquisition; existing bytes were preserved.");
      fail("UNSUPPORTED", `Exclusive same-filesystem installation failed: ${error.code || error.message}`);
    }
    fs.unlinkSync(tempPath);
    console.log(`acquired ${lockPath}`);
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
    if (fs.existsSync(tempPath)) {
      try { fs.unlinkSync(tempPath); } catch { /* preserve the lock if cleanup itself is unavailable */ }
    }
  }
}

function inspect(lockPath) {
  validateTarget(lockPath, false);
  const snapshot = readOpenFile(lockPath);
  try {
    process.stdout.write(snapshot.bytes);
  } finally {
    closeSnapshot(snapshot);
  }
}

function release(lockPath, expectedDigest) {
  requireNoFollow();
  const target = validateTarget(lockPath, false);
  const original = readOpenFile(lockPath);
  let tombstonePath = null;
  let tombstone = null;
  try {
    if (original.digest !== expectedDigest) fail("DIGEST", "Digest did not match; lock bytes were preserved.");
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const candidate = uniquePath(target.parent, ".mdf-lock-tomb");
      try {
        fs.linkSync(lockPath, candidate);
        tombstonePath = candidate;
        break;
      } catch (error) {
        if (error.code !== "EEXIST") fail("UNSUPPORTED", `Tombstone installation failed: ${error.code || error.message}`);
      }
    }
    if (!tombstonePath) fail("UNSUPPORTED", "Could not allocate a private tombstone.");

    tombstone = readOpenFile(tombstonePath);
    if (!sameIdentity(tombstone.identity, original.identity) || tombstone.digest !== expectedDigest) {
      fail("CHANGED", "Lock changed while preparing release; current lock was preserved.");
    }

    const current = readOpenFile(lockPath);
    try {
      if (!sameIdentity(current.identity, original.identity) || current.digest !== expectedDigest) {
        fail("CHANGED", "Lock changed before release; current lock was preserved.");
      }
      validateAncestors(lockPath);
      fs.unlinkSync(lockPath);
    } finally {
      closeSnapshot(current);
    }

    closeSnapshot(original);
    fs.unlinkSync(tombstonePath);
    tombstonePath = null;
    closeSnapshot(tombstone);
    tombstone = null;
    console.log(`released ${lockPath}`);
  } finally {
    closeSnapshot(original);
    closeSnapshot(tombstone);
    if (tombstonePath && fs.existsSync(tombstonePath)) {
      try { fs.unlinkSync(tombstonePath); } catch { /* leave no further mutation on cleanup failure */ }
    }
  }
}

try {
  const { operation, lockPath, digest: expectedDigest } = parseArgs(process.argv.slice(2));
  if (operation === "inspect") inspect(lockPath);
  else if (operation === "acquire") acquire(lockPath);
  else release(lockPath, expectedDigest);
} catch (error) {
  const code = error instanceof LockError ? error.code : "IO";
  console.error(`mdf-lock ${code}: ${error.message}`);
  process.exitCode = 1;
}
