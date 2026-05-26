---
name: test
description: "Use when the user invokes test, mdf test, or asks to run the agent-skills TDD workflow, including browser testing only for browser-related issues."
---

# test

Use this Codex-native entrypoint when the user invokes `test`, `mdf test`, `$test`, or asks to run the TDD workflow.

Invoke the `test-driven-development` skill.

For new features:
1. Write tests that describe the expected behavior (they should FAIL)
2. Implement the code to make them pass
3. Refactor while keeping tests green

For bug fixes (Prove-It pattern):
1. Write a test that reproduces the bug (must FAIL)
2. Confirm the test fails
3. Implement the fix
4. Confirm the test passes
5. Run the full test suite for regressions

For browser-related issues, also invoke `browser-testing-with-devtools` to verify with Chrome DevTools MCP.

When saving a test plan or test result report, resolve the current MDF work item and write `.mdf/work/{work_id}/test-NNN.md`. Update `item.md` `latest.test` and `.mdf/index.jsonl`.
