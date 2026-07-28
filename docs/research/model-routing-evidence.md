# Model Routing Evidence

This document preserves historical inputs for manual review of the active
[model-routing policy](../operations/model-routing.md). It is not a selector,
eligibility source, capability guarantee, or proof that a requested model
executed.

## Artificial Analysis chart snapshot

- **Source:** [Artificial Analysis model comparison](https://artificialanalysis.ai/models/), specifically its “Intelligence Index vs. Cost per Intelligence Index Task” chart.
- **Snapshot consulted:** 2026-07-14; the chart image supplied to MDF was not
  retained, so its exact page version and model rows cannot be recreated from
  this repository.
- **Metric scope:** Artificial Analysis Intelligence Index and weighted USD
  cost per Intelligence Index task. The chart’s cost blends input, cache,
  reasoning, and answer-token prices across its benchmark evaluations.
- **Recorded readings:** Luna medium/high/xhigh/max: 38/$0.05,
  46/$0.09, 49/$0.14, 51/$0.22; Terra medium/high/xhigh/max: 45.5/$0.16,
  49/$0.24, 51.5/$0.35, 54.8/$0.60; Sol low/medium/high/xhigh/max:
  49.5/$0.20, 53.5/$0.32, 55.8/$0.45, 57.5/$0.68, 58.8/$1.02.
- **Interpretation limit:** those approximate visual readings are neither
  current pricing nor a measurement of dispatch latency, scope containment,
  review burden, actual task success, or runtime availability.

## External benchmark review

- **Source:** [Artificial Analysis GPT-5.6 benchmark report](https://artificialanalysis.ai/articles/gpt-5-6-has-landed), published 2026-07-09 and consulted 2026-07-29.
- **Metric scope:** the report discusses Artificial Analysis Intelligence and
  Coding Agent Index results plus benchmark cost comparisons.
- **Interpretation limit:** its benchmark and pricing observations do not
  measure this repository's total feedback cost or authorize a routing change.
  The active policy deliberately treats them as historical context only.

## MDF observations

Immutable factual runs live under `.mdf/analysis/model-routing/` outside the
tracked repository. They group outcomes by requested model and runtime-native
effort; they do not assert the executed model, token use, billing, or causal
cost efficiency. See [model-routing analysis](../operations/model-routing-analysis.md)
for cohort and inference limits.
