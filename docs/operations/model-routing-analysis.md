# Model Routing Analysis

This is a manually maintained strategy document for Midnight Forge. The
project-local `model-routing-analysis` skill does not update this file during
automated analysis.

Automated, factual run records are written outside the tracked repository
surface at:

```text
.mdf/analysis/model-routing/
  checkpoint.json
  runs/<run-id>.md
```

Use those immutable run records as evidence when manually reviewing or
changing the model-routing strategy. A manual update may decide which goals to
optimize, including whether to favor maximal first-pass quality or a
one-person-builder's broader utility, but those value judgments belong here
and never in the automated run records.

Run records group outcomes by requested model and runtime-native effort; they
do not claim that the requested model actually ran. They analyze work outcomes,
not dispatch-path availability. In an aggregate,
`n` is the number of invocations with enough linked artifact evidence to assess
the attempted work and at least one outcome. With fewer than three such cases,
the run lists the cases without generalizing.

## Manual strategy notes

No manually reviewed routing strategy has been recorded yet.
