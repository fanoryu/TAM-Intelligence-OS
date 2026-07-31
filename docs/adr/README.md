# Architecture Decision Records (ADR)

Architecture-level decisions for TAM Intelligence OS. Each ADR captures one decision, its
rationale, and its revalidation trigger. ADRs are **immutable once Accepted** — a later decision
supersedes an ADR with a new record that links back; it never rewrites history
(`CLAUDE.md` §14.4, §16.2).

New ADR: copy [`TEMPLATE.md`](TEMPLATE.md), number it `ADR-NNNN` (next in sequence, never reused),
add it to the register below, and link it from any related record.

## Lifecycle

`Proposed → Accepted → (Superseded | Deprecated)`

- **Proposed** — drafted, awaiting the `CLAUDE.md` §20 approver.
- **Accepted** — approved and authoritative.
- **Superseded** — replaced by a newer ADR (stays in place, read-only, links forward).
- **Deprecated** — guidance retired without a 1:1 successor.

## Register

| ADR | Title | Status | Date | Superseded by |
|---|---|---|---|---|
| [ADR-0001](ADR-0001-documentation-governance-model.md) | Documentation Governance & Lifecycle Model | Accepted | 2026-08-01 | — |

## Timeline

- **2026-08-01** — ADR-0001 Accepted (documentation governance model; PR-4 / PR-4.1).

*Security decisions live in [`../security/`](../security/README.md) as SDRs. Engineering decision
records (EDR) referenced from workflows are tracked in their originating decision packages.*
