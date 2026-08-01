# Repository Decision Records (RDR)

Repository-level records that **snapshot the state of the repository** at a meaningful boundary — for
example, the close of an engineering milestone. An RDR is purely factual: it freezes what exists on
`main` at a point in time. It records no future planning and authorizes no work.

RDRs are **immutable once Accepted** — a later snapshot is a new record that links back; it never
rewrites history (`CLAUDE.md` §14.4, §16.2). Architecture decisions live in [`../03-adr/`](../03-adr/README.md)
as ADRs; security decisions in [`../security/`](../security/README.md) as SDRs; this register holds
snapshots only.

## Lifecycle

`Proposed → Accepted → (Superseded)`

- **Proposed** — drafted, awaiting the `CLAUDE.md` §20 approver.
- **Accepted** — approved; the authoritative snapshot for its boundary.
- **Superseded** — replaced by a newer snapshot (stays in place, read-only, links forward).

## Register

| RDR | Title | Status | Snapshot commit | Date |
|---|---|---|---|---|
| [RDR-001](RDR-001-gamma-repository-snapshot.md) | Gamma Repository Snapshot | Accepted | `0337f31` | 2026-08-01 |

## Timeline

- **2026-08-01** — RDR-001 Accepted (frozen repository state at the close of Milestone Gamma: 6 aggregates, 6 commands, 1 query; v2.7.3, SCHEMA 6).
