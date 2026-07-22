---
name: test
description: "Run TDD workflow — write failing tests, implement, verify. For bugs, use the Prove-It pattern."
---

# test

## Upstream command contract

Invoke the test-driven-development skill.

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

For browser-related issues, also invoke browser-testing-with-devtools to verify with Chrome DevTools MCP.

## MDF adaptation

1. Resolve the installed plugin root.
2. Run exact upstream `using-agent-skills` discovery. Load this adapter,
   `test-driven-development`, and every other applicable primitive it selects.
3. Record exact commands, working directory, exit status, and relevant output.
4. Save a requested test report under the current canonical work item. A report
   does not replace observed RED/GREEN or regression evidence.
5. Return changed test paths, results, coverage gaps, and blockers. Do not
   select the next workflow operation or advance lifecycle.
