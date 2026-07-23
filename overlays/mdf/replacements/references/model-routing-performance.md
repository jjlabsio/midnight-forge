# Model Routing Performance Reference

This document records the numerical and qualitative content of the reviewed
Artificial Analysis chart, “Intelligence vs. Cost per Intelligence Index Task”.
It is a routing prior for MDF-managed subagents, not a runtime selector,
benchmark guarantee, or proof of semantic correctness.

The readings below are approximate visual readings from the chart snapshot
provided on 2026-07-14. The chart uses a logarithmic cost axis and plots an
Artificial Analysis Intelligence Index against approximate USD cost per task.
The source image is intentionally not stored in this repository.

## Recorded chart readings

| Model family | Plotted setting | Approx. intelligence | Approx. cost per task |
| --- | --- | ---: | ---: |
| Luna | medium | 38 | $0.05 |
| Luna | high | 46 | $0.09 |
| Luna | xhigh | 49 | $0.14 |
| Luna | max | 51 | $0.22 |
| Terra | medium | 45.5 | $0.16 |
| Terra | high | 49 | $0.24 |
| Terra | xhigh | 51.5 | $0.35 |
| Terra | max | 54.8 | $0.60 |
| Sol | low | 49.5 | $0.20 |
| Sol | medium | 53.5 | $0.32 |
| Sol | high | 55.8 | $0.45 |
| Sol | xhigh | 57.5 | $0.68 |
| Sol | max | 58.8 | $1.02 |

The plotted setting labels above describe what the chart compared. They are
observational data in this reference, not an MDF-defined effort vocabulary,
capability allow-list, or normalization contract. Runtime-native model
configuration remains authoritative. The chart does not include Spark.

## Qualitative routing and solo-builder insights

- The attractive region is the chart's upper-left: higher intelligence at
  lower cost. This is a frontier heuristic, not a hard eligibility boundary.
- Luna occupies the lower-cost frontier, Terra the middle-cost frontier, and
  Sol the highest-intelligence, highest-cost region.
- Luna points remain observational only while the availability exclusion is
  active; they are not candidate-selection evidence.
- Terra occupies the ordinary middle-cost prior for implementation and review.
  For a narrow, clear target, Terra medium or high and Sol low can be suitable
  candidates when each clears the capability floor.
- Sol medium or above is for a concrete task characteristic or observed
  failure, not a default. Sol high or higher needs a concrete high-impact
  escalation reason; plotted intelligence does not by itself provide one.
- The chart says nothing about actual dispatch latency, complexity, scope, or
  review burden. The root considers those feedback costs qualitatively,
  alongside the chart, for a solo builder.
- High-impact work favors required quality over frontier efficiency. For
  bounded lower-risk work, select the smallest suitable capability rather than
  treating plotted proximity as equivalence.

## Use in routing

Before selecting a GPT-5.6 candidate, the root consults this document together
with boundedness, ambiguity, risk, consequence, verification demand, runtime
capability, transport compatibility, and one-person-builder feedback costs.
The root records the requested model and effort, relevant reasoning, capability
confidence, concrete escalation reason when applicable, and any fallback in
the readable dispatch note.

The comparison must not become a fixed task-to-model table, benchmark-
equivalence gate, fabricated runtime measurement, or silent downgrade rule.
The default model family and the Spark exploration exception are defined by
the central dispatch policy; this document supplies only comparative context.
