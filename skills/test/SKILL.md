---
name: test
description: "Run TDD workflow — write failing tests, implement, verify. For bugs, use the Prove-It pattern. Use when the user invokes test, mdf test, or asks to run the agent-skills TDD workflow."
---

# test

## Upstream command contract

Invoke the test-driven-development skill by loading and following the exact
upstream `../test-driven-development/SKILL.md`.

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

For browser-related issues, also load the exact upstream
`../browser-testing-with-devtools/SKILL.md` to verify with Chrome DevTools MCP.

## MDF/Codex adaptation

Resolve the installed plugin root before loading paths. Use this Codex-native
entrypoint when the user invokes `test`, `mdf test`, `$test`, or asks to run the
TDD workflow.

This remains a standalone workflow even though `build` may invoke test logic
internally. Use it for independent verification, manual changes, debugging,
PR preparation, and pre-ship checks.

When called with `mode: auto-workflow` or `mode: auto-workflow-pr`, the root may delegate bounded
reproduction, coverage, and regression analysis to the central subagent
dispatch policy. The root or task writer still owns shared writes and final
synthesis. Do not ask for a ceremonial approval in auto mode; stop only for a
critical decision, failed verification without an obvious in-scope repair, or
untrusted test provenance.

When saving a test plan or test result report, verify MDF user and project init
state, resolve the current MDF work item, and write
`.mdf/work/{work_id}/test-NNN.md`. If init state is missing, stop and instruct
the user to run `mdf init`. Update `item.md` `latest.test` and
`.mdf/index.jsonl`.
