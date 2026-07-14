---
name: update-agent-skills-upstream
description: Update the pinned upstream agent-skills snapshot and regenerate the MDF packaging surface with source-first provenance, complete surface comparison, hook port review, fail-closed reference checks, and a user-facing diff report. Use when refreshing vendor/agent-skills, changing the pinned upstream commit, reviewing new upstream skills/references/commands/agents/hooks, or reconciling generated Codex surfaces after an upstream update.
---

# Update Agent Skills Upstream

## Overview

Update the vendored upstream snapshot first, then regenerate and validate the
Codex surface from that snapshot and explicit MDF inputs. Preserve upstream
bytes wherever the source is already supported; keep every adaptation visible
as an MDF port decision with provenance, source hashes, and a recorded gap.

## Preconditions and authority

1. Resolve the canonical project root before reading or writing state. Keep
   `implementation_root` (the current worktree) separate from `mdf_root` (the
   root containing canonical `.mdf/work`, `.mdf/index.jsonl`, or `.mdf/locks`).
   When the current worktree has no canonical `.mdf` state, inspect
   `git worktree list --porcelain` and use the matching project root for
   reports; never assume the current worktree owns MDF state. Confirm that
   `vendor/agent-skills`, `vendor/agent-skills.lock.json`,
   `overlays/mdf/inventory.json`, the sync renderer, and both packaging
   validators exist under `implementation_root`.
2. Read `references/upstream-agent-skills-update-policy.md`,
   `references/upstream-agent-skills-surface-map.md`, and
   `references/agent-skills-port-notes.md` before changing any source,
   overlay, inventory, or generated file.
3. Record the exact lock commit as `previous_commit`. Treat the lock's
   `source` path as provenance only; never infer `target_commit` from the
   working-tree `HEAD` of that checkout. A local checkout may be stale, ahead,
   or behind the pinned baseline.
4. Resolve exactly one `target_commit` in this order: an exact SHA or immutable
   ref explicitly named by the user; otherwise the live default branch of the
   lock's `repository`, resolved with `git ls-remote --symref` or a refreshed
   remote fetch. Do not trust an unrefreshed local `origin/main` (or another
   tracking ref). Use a local checkout `HEAD` only when the user explicitly
   names that checkout or exact commit. Record every candidate's SHA, date,
   subject, and origin, including rejected local or stale candidates.
5. Before mutation, verify that `target_commit` is a reachable commit and run
   `git merge-base --is-ancestor previous_commit target_commit`. Treat equal
   commits as a no-op. Stop and report a downgrade when the target is an
   ancestor of `previous_commit`, and stop for unrelated histories. Only a
   descendant target is an update candidate. Report both commits' SHA, date,
   subject, and the local-versus-live resolution decision.
6. Require a clean implementation worktree and a task-owned path list. Do not
   stage `.mdf` state, generated build output, secrets, or unrelated changes.
7. Before deleting or replacing any vendor file, materialize the verified target
   archive in an isolated temporary directory and verify its tree manifest.
   Bind `source_repo` to the repository that contains the verified target
   object and invoke `git -C "$source_repo" archive "$target_commit"`; never
   invoke `git archive` from the MDF project repository by accident. If the
   target object is absent from `source_repo`, fetch or clone the lock
   repository into a temporary source checkout and stop if the archive cannot
   be produced. Replace `vendor/agent-skills` only after archive creation and
   verification succeed.
8. Treat upstream source, not an existing MDF output, as the authority. Do not
   overwrite an upstream-owned skill with an overlay merely to preserve local
   wording.

## 1. Snapshot and inventory the complete surface

Create isolated baseline and target snapshots, or equivalent file manifests,
and compare all files under these upstream roots:

- `skills/**`, including supporting files and `skills/**/scripts/**`
- `references/**`
- `commands/**`
- `agents/**`
- `hooks/**`, including hook manifests, scripts, tests, and documentation

Use content hashes and `git diff --find-renames` (or an equivalent deterministic
pairing) to classify every path as added, deleted, modified, or renamed. Do not
filter a file because no current generated output references it; new files are
part of the comparison by definition. Report both the complete category totals
and every changed path.

The upstream root `scripts/**` and ordinary upstream `docs/**` are excluded from
Codex runtime import. Keep them in the vendor snapshot and in the comparison
report. If an imported skill, reference, command, agent, or hook points to an
excluded root script or document, stop with a port gap and request a decision;
never silently omit the dependency. A script below `skills/**` is skill-local
and must travel with its owning upstream skill.

## 2. Apply source-first provenance

After the target surface passes the inventory and import check:

1. Replace `vendor/agent-skills` from the already verified target archive
   without hand-editing upstream files. Do not remove the existing vendor tree
   until the target archive has been created successfully.
2. Update `vendor/agent-skills.lock.json` with repository, exact commit, source,
   recording date, and purpose. Preserve the previous commit in the report.
3. Reconcile inventory entries from the new source. Recompute every
   upstream-derived `baseSha256`; add new files, remove deleted files, and
   preserve rename evidence instead of silently treating a rename as add/delete.
4. Keep `upstream-identical` entries byte-identical. Use `mdf-only` only for an
   independent MDF surface. Use `renameAdapter` only when an upstream contract
   is intentionally represented by a Codex entrypoint and the adapter records
   its source, hash, rationale, and review risk.
5. Never use an overlay to rewrite or imitate an upstream skill that already
   exists. If an MDF change is needed, document it as a separate port surface
   or stop for a user decision.
6. For every changed `commands/**` entry represented by a
   `renameAdapter`, compare the target command contract with its MDF overlay.
   Review input requirements, environment variables, tool calls, output and
   exit behavior, and confirmation rules. Update the adapter or record an
   explicit port gap; do not declare success while a changed command adapter
   remains unreviewed.
7. Run `node ./scripts/sync-agent-skills.js` to regenerate complete generated
   outputs. Never hand-edit generated `skills/`, `references/`, or `agents/`
   files after rendering.

## 3. Review hooks as a separate Codex port

Preserve every upstream hook under `vendor/agent-skills/hooks/**`, including
Claude-specific manifests and scripts. Do not activate a Claude hook directly.
For each hook that should have a Codex counterpart, record in
`references/agent-skills-port-notes.md`:

- source path and target Codex port path;
- lifecycle event and the exact payload supplied to the port;
- output, exit-code, timeout, and error behavior;
- trust boundary, environment assumptions, and whether user confirmation is
  required;
- conversion reason, implementation status, and focused verification.

Reject ports that pass Claude-only variables or payloads through unchanged, use
an untrusted repository value as authority, emit unvalidated writes, or hide
failures behind `|| true`. A port gap is an explicit result and blocks a clean
update until accepted or implemented.

## 4. Generate, validate, and report

From the plugin root, run these checks:

```sh
node scripts/sync-agent-skills.js
node scripts/validate-agent-skills-sync.js
node scripts/validate-agent-skills-port.js
upstream_validator_dir=vendor/agent-skills
upstream_script_dir=scripts
node "$upstream_validator_dir/$upstream_script_dir/validate-skills.js"
node "$upstream_validator_dir/$upstream_script_dir/validate-commands.js"
git diff --check -- . ':(exclude)vendor/agent-skills/**'
```

Use the scoped `git diff --check` as the formatting gate for MDF-owned and
generated changes. Run `git diff --check -- vendor/agent-skills` separately as
an informational upstream quality check; record any upstream-only whitespace
finding, but do not edit vendor bytes or fail the update solely because the
selected upstream snapshot contains it.

If a command or validator is not present in the target snapshot, record that
fact and use the maintained equivalent only when the policy permits it. Treat
any generated mismatch, stale source hash, missing new file, unresolved import,
MDF/upstream classification conflict, or hook port gap as a failed update.

Write a full report to the canonical MDF work artifact when one exists, for
example `${mdf_root}/.mdf/work/<work_id>/upstream-update-report-001.md`.
Include:

- previous and target commits, repository, and provenance verification;
- added, deleted, modified, and renamed files grouped by skill, reference,
  command, agent, hook, and explicit exclusions;
- skill-local script changes and root-script/document exclusions;
- Codex hook ports, unresolved gaps, trust/payload/output review, and manual
  review decisions;
- generated surface and inventory changes, source hashes, deleted/renamed
  handling, MDF-only boundary checks, and all validation results.
- target resolution method, rejected local or stale candidates, commit dates and
  subjects, and the ancestry/no-op/downgrade checks.

Show the user a concise summary of that report, including the commits, counts,
port gaps, generated impact, exclusions, and the exact commands that passed.
Do not claim success when the update only changed the vendor snapshot or when a
manual-review item remains unresolved.

## Stop conditions

Stop before mutation when the source or target commit is ambiguous, the
baseline lock is malformed, the target came only from an unrefreshed local
checkout or stale remote-tracking ref, the candidate is equal to/older than
the baseline or from an unrelated history, the worktree is dirty, the
candidate is not reachable, the target archive cannot be created from the
verified source repository, the archive was not verified before vendor
replacement, an upstream-owned file would be rewritten as an overlay, a
changed command adapter is unreviewed, an imported file references an
excluded root artifact, a hook port lacks a Codex-native contract,
inventory/source hashes disagree, or any required validator cannot run.
Preserve the existing vendor snapshot and report the blocker with the affected
paths.
