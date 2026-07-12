# Replace Artifact Storage Rules With MDF Storage

## Status

Superseded by the controller-boundary restoration in task 0032.

## Date

2026-07-08

## Context

Many upstream skills create workflow artifacts. In MDF, workflow artifacts should be local task evidence under `.mdf/work/{work_id}/` unless explicitly promoted into tracked project docs. Keeping upstream tracked-file storage instructions alongside MDF storage instructions creates conflicting guidance.

## Decision

The prior artifact-storage injection model modified upstream workflow content.
Task 0032 supersedes it: protected upstream primitives are byte-identical and
MDF controllers own canonical artifact storage and lifecycle adaptation.

## Alternatives Considered

### Controller-bound adaptation

- Pros: keeps upstream primitives byte-identical and localizes runtime policy.
- Cons: controllers must carry explicit artifact and approval contracts.
- Accepted by task 0032; this supersedes the former narrow-patch approach.

### Add MDF storage instructions without removing upstream storage instructions

- Pros: Smaller implementation.
- Cons: Produces conflicting instructions when upstream names tracked paths.
- Rejected because MDF storage should be authoritative for workflow artifacts.

## Consequences

- Existing artifact storage is resolved by the controller that invokes the
  upstream primitive.
- Validation rejects semantic patches and source-backed replacements for the
  protected upstream matrix.
