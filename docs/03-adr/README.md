# 03 — Domain Architecture Decision Records

This register records the **Domain-layer** architecture decisions established during PR-5A through
PR-5F. Each ADR captures one decision — its context, the decision itself, its consequences, and its
status. ADRs are **immutable once Accepted**: a later decision supersedes an ADR with a new record
that links back; it never rewrites history.

## Two registers, one convention

This repository keeps two decision-record series with distinct scopes and distinct numbering, so
there is no ambiguity about which governs what:

| Series | Location | Scope | Numbering |
|---|---|---|---|
| **Domain ADRs** | this folder (`docs/03-adr/`) | Domain-layer architecture (registry, query, command, aggregate, helpers, AI positioning) | `ADR-001`, `ADR-002`, … (three digit) |
| **Repository ADRs** | [`docs/adr/`](../adr/README.md) | Documentation & repository governance model | `ADR-NNNN` (four digit, e.g. `ADR-0001`) |

Security decisions live in [`docs/security/`](../security/README.md) as SDRs. The three series never
share a number and never overlap in scope.

## Lifecycle

`Proposed → Accepted → (Superseded | Deprecated)` — an Accepted ADR stays in place, read-only, and
links forward if it is ever superseded.

## Register

| ADR | Title | Status | Established by |
|---|---|---|---|
| [ADR-001](ADR-001-domain-registry.md) | Domain Registry | Accepted | PR-5 / PR-5A |
| [ADR-002](ADR-002-query-layer.md) | Query Layer | Accepted | PR-5B |
| [ADR-003](ADR-003-command-layer.md) | Command Layer | Accepted | PR-5C.1 |
| [ADR-004](ADR-004-aggregate-pattern.md) | Aggregate Pattern | Accepted | PR-5D / PR-5E |
| [ADR-005](ADR-005-ai-is-a-domain-client.md) | AI Is a Domain Client | Accepted | DOC-001 |
| [ADR-006](ADR-006-engineering-constitution.md) | Engineering Constitution | Accepted | DOC-001 |
| [ADR-007](ADR-007-shared-aggregate-helpers.md) | Shared Aggregate Helpers | Accepted | PR-5F |
