# MDF Approval Notes

The approval contract is human-readable and tied to exact Markdown artifact
bytes. For a spec or plan, report the canonical relative path and SHA-256 of
the saved revision, then observe an explicit affirmative user approval of that
exact path and hash.

An optional `approval-NNN.md` note may record the user message, artifact path,
SHA-256, date, and scope. Do not duplicate approval notes or carry approval to
a different artifact. Any byte, path, scope, or latest-revision change
invalidates prior approval.

Artifact existence, a reviewer pass, a green command, or an automatic-workflow
invocation is not approval. When approval is absent, ambiguous, or stale, stop
before planning, implementation, external mutation, or release.
