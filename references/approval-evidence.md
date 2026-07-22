# MDF Approval Notes

This is the shared approval-evidence contract for MDF planning skills. Consumer
skills define only their stage-specific approval timing and transition gates;
they must load and apply this reference for the common evidence rules below.

## Common approval contract

The approval contract is human-readable and tied to exact Markdown artifact
bytes. For a spec or plan, report the canonical relative path and SHA-256 of
the saved revision, then observe an explicit affirmative user approval of that
exact path and hash.

Record approval in the task conversation or, when a file is needed, one
human-readable `approval-NNN.md` note containing the user message, artifact
path, SHA-256, date, and scope. Do not duplicate approval notes or carry
approval to a different artifact. Any byte, path, scope, or latest-revision
change invalidates prior approval.

Artifact existence, a reviewer pass, a green command, or an automatic-workflow
invocation is not human approval. Standalone workflows stop when exact approval
is absent, ambiguous, or stale.

An accepted automatic workflow port may replace this intermediate human
checkpoint only when its root dispatches the required fresh critic against the
exact artifact bytes and then records root acceptance of the same path and
SHA-256. The invocation or critic report alone is insufficient. Any byte, path,
scope, or latest-revision change invalidates that acceptance. This substitution
belongs to the root workflow profile; consumer stage skills remain mode-blind.
