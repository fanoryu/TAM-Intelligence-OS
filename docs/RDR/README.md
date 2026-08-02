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
| [RDR-001](RDR-001-gamma-repository-snapshot.md) | Gamma Repository Snapshot | Accepted · **superseded as baseline by RDR-003** | `0337f31` | 2026-08-01 |
| [RDR-003](RDR-003-delta-repository-snapshot.md) | Delta Repository Snapshot | **Accepted — current authoritative baseline** | `851c038` | 2026-08-02 |

> **Current baseline: [RDR-003](RDR-003-delta-repository-snapshot.md).** RDR-001 remains the immutable
> Gamma-boundary snapshot but is **no longer the latest baseline**; it links forward to RDR-003.

**Reserved / pending source text.** **RDR-002** is referenced by the milestone governance trail but its
authoritative text has not been supplied to the repository. It is reserved (not yet a file) and tracked
in the [Atlas Governance Artifact Register](../00-governance/Atlas_Governance_Register.md); it will be
published here verbatim once its source is provided. RDR numbering is not reused.

## Timeline

- **2026-08-01** — RDR-001 Accepted (frozen repository state at the close of Milestone Gamma: 6 aggregates, 6 commands, 1 query; v2.7.3, SCHEMA 6).
- **2026-08-02** — RDR-003 Accepted (Delta baseline at the close of PR-6A "The Gateway": 7 aggregate-backed commands + 1 aggregate-backed query behind 7 aggregates, 13 registered commands / 4 registered queries, 1 Application Gateway; v2.7.3, SCHEMA 6, commit `851c038`). Supersedes RDR-001 as the authoritative baseline.
