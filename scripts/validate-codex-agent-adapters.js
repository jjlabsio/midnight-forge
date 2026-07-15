#!/usr/bin/env node

/*
 * Validate that Codex-native custom-agent adapters preserve the upstream
 * persona identity and developer instructions. The adapter deliberately does
 * not own model selection; MDF supplies that at dispatch time.
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const personaRoot = path.join(root, "agents");
const adapterRoot = path.join(root, ".codex", "agents");
const failures = [];

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function parsePersona(filePath) {
  const match = read(filePath).match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  assert(match, `${path.relative(root, filePath)} must have YAML frontmatter.`);
  if (!match) return null;

  const fields = {};
  for (const line of match[1].split("\n")) {
    const field = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (field) fields[field[1]] = field[2];
  }

  return { name: fields.name, description: fields.description, body: match[2] };
}

function parseAdapter(filePath) {
  const source = read(filePath);
  const name = source.match(/^name\s*=\s*"([^"]+)"\s*$/m);
  const description = source.match(/^description\s*=\s*"([^"]*)"\s*$/m);
  const sandbox = source.match(/^sandbox_mode\s*=\s*"([^"]+)"\s*$/m);
  const instructions = source.match(/^developer_instructions\s*=\s*"""\n([\s\S]*?)\n"""\s*$/m);

  assert(name, `${path.relative(root, filePath)} must declare name.`);
  assert(description, `${path.relative(root, filePath)} must declare description.`);
  assert(sandbox, `${path.relative(root, filePath)} must declare sandbox_mode.`);
  assert(instructions, `${path.relative(root, filePath)} must declare developer_instructions.`);
  assert(!/^\s*(?:model|model_reasoning_effort)\s*=/m.test(source),
    `${path.relative(root, filePath)} must not hard-code model routing.`);

  return {
    name: name?.[1],
    description: description?.[1],
    sandbox: sandbox?.[1],
    body: instructions?.[1],
  };
}

assert(fs.existsSync(adapterRoot), ".codex/agents must exist when native adapters are present.");
if (fs.existsSync(adapterRoot)) {
  const adapters = fs.readdirSync(adapterRoot).filter((entry) => entry.endsWith(".toml"));
  assert(adapters.length > 0, ".codex/agents must contain at least one native adapter.");

  for (const adapter of adapters) {
    const adapterPath = path.join(adapterRoot, adapter);
    const personaPath = path.join(personaRoot, `${path.basename(adapter, ".toml")}.md`);
    assert(fs.existsSync(personaPath), `${adapter} has no matching upstream persona Markdown file.`);
    if (!fs.existsSync(personaPath)) continue;

    const persona = parsePersona(personaPath);
    const native = parseAdapter(adapterPath);
    if (!persona || !native) continue;

    assert(native.name === persona.name, `${adapter} name must match ${path.relative(root, personaPath)}.`);
    assert(native.description === persona.description, `${adapter} description must match ${path.relative(root, personaPath)}.`);
    assert(native.sandbox === "read-only", `${adapter} must use read-only sandboxing for this audit persona.`);
    // TOML's closing delimiter consumes the final Markdown newline.
    assert(native.body === persona.body.replace(/\n$/, ""),
      `${adapter} developer_instructions must match ${path.relative(root, personaPath)} body.`);
  }
}

if (failures.length > 0) {
  console.error("Codex agent adapter validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Codex agent adapter validation passed.");
