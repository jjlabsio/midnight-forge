# MDF Authority and Artifact Integrity

This is the shared authority-evidence contract for MDF planning skills.
Consumer skills define stage-specific transition gates; they must load and
apply this reference for common exact-artifact, authority, and invalidation
rules.

## Common authority contract

The authority contract is human-readable and tied to exact Markdown artifact
bytes. Report the canonical relative path and SHA-256 of every saved revision,
then bind that artifact to the current task card, workflow mode, and execution
envelope. The path and hash prove identity and freshness; they are not a human
approval requirement.

Record the authority source in the task conversation, handoff, or contract,
including the user invocation or confirmation that delegated the bounded
scope. Do not create ceremonial `approval-NNN.md` notes. Do not carry authority
to a different artifact, path, scope, or latest revision. Any byte, path,
scope, or latest-revision change invalidates the prior integrity evidence and
requires fresh verification under the current envelope.

Artifact existence, a reviewer pass, a green command, or an automatic-workflow
invocation does not by itself establish artifact identity or scope. Bind all of
them to the exact path/hash and current handoff. When authority, artifact
identity, scope, or freshness is absent, ambiguous, or stale, stop with
`BLOCKED` and report the evidence; do not turn the stop into an approval prompt.
