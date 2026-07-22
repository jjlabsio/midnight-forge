---
name: code-simplify
description: "Simplify code for clarity and maintainability — reduce complexity without changing behavior"
---

# code-simplify

## Upstream command contract

Invoke the code-simplification skill.

Simplify recently changed code (or the specified scope) while preserving exact behavior:

1. Read AGENTS.md and study project conventions
2. Identify the target code — recent changes unless a broader scope is specified
3. Understand the code's purpose, callers, edge cases, and test coverage before touching it
4. Scan for simplification opportunities:
   - Deep nesting → guard clauses or extracted helpers
   - Long functions → split by responsibility
   - Nested ternaries → if/else or switch
   - Generic names → descriptive names
   - Duplicated logic → shared functions
   - Dead code → remove after confirming
5. Apply each simplification incrementally — run tests after each change
6. Verify all tests pass, the build succeeds, and the diff is clean

If tests fail after a simplification, revert that change and reconsider. Use `code-review-and-quality` to review the result.

## MDF adaptation

1. Resolve the installed plugin root.
2. Run exact upstream `using-agent-skills` discovery. Load this adapter,
   `code-simplification`, `code-review-and-quality`, and every other applicable
   primitive it selects.
3. Change only the explicit scope. Do not stage, commit, mutate task state, or
   choose a later workflow operation unless the caller separately owns it.
4. Return changed paths, checks and results, review findings, and blockers.
