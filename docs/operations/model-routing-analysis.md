# Model Routing Analysis

This is a manually maintained observation-analysis document for Midnight
Forge. It is not an active routing policy, and the project-local
`model-routing-analysis` skill does not update it during automated analysis.

Automated, factual run records are written outside the tracked repository
surface at:

```text
.mdf/analysis/model-routing/
  checkpoint.json
  runs/<run-id>.md
```

Use those immutable run records as evidence when manually reviewing the
dispatch policy. A later decision may set policy goals, including whether to
favor maximal first-pass quality or a one-person-builder's broader utility, but
those value judgments belong in a decision record and never in the automated
run records.

Run records group outcomes by requested model and runtime-native effort; they
do not claim that the requested model actually ran. They analyze work outcomes,
not dispatch-path availability. In each requested-model, effort, and task-kind
cohort, `n` is the number of distinct evaluable linked work items, not the
number of invocations. Attempts within one work item are one correlated work
sequence and are reported separately; if the same work item appears in more
than one cohort, the run suppresses cross-cohort comparison. With fewer than
three evaluable work items, the run lists the cases without generalizing.

## Manual strategy notes

No manually reviewed routing strategy has been recorded yet.
