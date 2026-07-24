# GPT-5.6 Model Routing Reference

This is the sole model-and-effort selection policy for MDF-managed subagents.
Select the eligible candidate with the lowest expected total feedback cost that
can satisfy the task contract and safety floor. Do not optimize for maximum
capability.

## Eligibility

- Never request any GPT-5.6 Luna candidate.
- Never request `gpt-5.6-sol` at `high` or higher, including any present or
  future runtime effort ordered at or above `high`.

## Selection

1. For each role, derive the minimum capability floor from boundedness,
   ambiguity, consequence of error, reversibility, verification difficulty,
   and domain risk.
2. Consult
   `<plugin-root>/references/model-routing-performance.md`. Among eligible
   candidates expected to clear the floor, choose the candidate with the lowest
   total feedback cost.
3. Use chart intelligence and cost as the cross-family prior. Also consider
   observed latency, rework, scope expansion, and review burden from comparable
   MDF dispatches.
4. Without comparable observed evidence, do not invent candidate-specific
   latency or review advantages that override the chart.
5. Select additional capability only for a concrete task property or observed
   failure showing that a cheaper candidate may miss the floor. Generic quality,
   prestige, role name, whole-tree scope, optional future requirements,
   generalized architecture, adjacent cleanup, and polish beyond the acceptance
   contract are not evidence.
6. When uncertainty remains, prefer the cheaper candidate when acceptance is
   directly and reliably verifiable and failure is reversible. Otherwise prefer
   the candidate with stronger capability evidence.

## Unplotted candidates

A runtime-supported eligible setting absent from the chart remains a candidate.

- Use runtime-native effort ordering within the same family.
- In the absence of contrary observed evidence, presume that lower effort has
  lower total feedback cost.
- Accept missing performance data only when deterministic verification and
  reversibility make that uncertainty acceptable.
- Missing chart data never causes automatic escalation.

## Rationale

Use the existing dispatch rationale to state:

- the derived capability floor;
- the selected candidate;
- when a higher-cost candidate is selected, the concrete reason a lower-cost
  eligible alternative would not clear the floor.

If the lowest-feedback-cost eligible candidate is selected, state that directly.
