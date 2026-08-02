# Atlas Governance Artifact Register

A **discovery index** for the Atlas-issued governance artifacts that bear on the current architecture
baseline. This register does **not** define a new decision-record type and does **not** replace the
authoritative homes for records that already have one (`docs/RDR/`, `docs/security/`, `docs/adr/`,
`docs/03-adr/`, `audit/`). It exists so that every artifact referenced by the milestone baseline is
**discoverable and its publication status is honest** — nothing is silently missing, and nothing is
fabricated.

> **Convention (per [ADR-0001](../adr/ADR-0001-documentation-governance-model.md)).** Records with an
> established home are published there and linked from their own register; this page only points to them.
> Artifacts whose authoritative text is maintained in the external Atlas governance system and has **not
> been supplied to the repository** are listed as **Pending repository publication** — reserved, not
> orphaned, and explicitly not yet present as a file. No placeholder invents record content.

## Published in this repository

| Artifact | Title | Home | Status |
|---|---|---|---|
| [RDR-001](../RDR/RDR-001-gamma-repository-snapshot.md) | Gamma Repository Snapshot | `docs/RDR/` | Accepted (superseded as baseline) |
| [RDR-003](../RDR/RDR-003-delta-repository-snapshot.md) | Delta Repository Snapshot (Gateway boundary) | `docs/RDR/` | Accepted (superseded as baseline by RDR-007) |
| [RDR-007](../RDR/RDR-007-delta-repository-snapshot.md) | Delta Repository Snapshot (post-PR-8B) | `docs/RDR/` | **Accepted — current authoritative baseline** (`55499f2`) |
| [DPR-005](../DPR/DPR-005-delta-completion-report.md) | Delta Completion Report | `docs/DPR/` | **Accepted — official Milestone Delta completion report** |
| [GHA-001](../../audit/github-audit-2026-08-02/GHA-001-github-repository-comprehensive-audit.md) | GitHub & Repository Comprehensive Audit | `audit/` | Complete — recorded |
| [SDR-0001](../security/SDR-0001-codeql-baseline-disposition.md) | CodeQL Baseline Disposition | `docs/security/` | Accepted (dispositions CodeQL #1–5) |

## Milestone Delta governance trail (record-only / superseded)

The artifacts below are Atlas governance records produced across Milestone Delta. Progress reports and
repository snapshots are **superseded** by the current baselines ([RDR-007](../RDR/RDR-007-delta-repository-snapshot.md),
[DPR-005](../DPR/DPR-005-delta-completion-report.md)); reviews/approvals are recorded as milestone events.
Record-only entries were maintained in the Atlas governance system; their substance is captured by the
current published records and by the in-repo verifier/merge trail — they are **not** separately published
as files (no fabricated bodies; `CLAUDE.md` §16.4).

| Artifact | Title | Status |
|---|---|---|
| RDR-002 / RDR-004 / RDR-005 / RDR-006 | Intermediate Delta repository snapshots | Record-only — **superseded by RDR-007** (see [RDR register](../RDR/README.md)) |
| DPR-001 / DPR-002 / DPR-003 / DPR-004 | Delta progress reports | Record-only — **superseded by [DPR-005](../DPR/DPR-005-delta-completion-report.md)** (see [DPR register](../DPR/README.md)) |
| ATR-003 | Delta Readiness Review | Record-only — milestone review |
| ATR-004 | Platform Gateway Contract Review | Record-only — decision captured in [RDR-003 §3.1](../RDR/RDR-003-delta-repository-snapshot.md#31-gateway-envelope-semantics-atr-004--intentional-not-a-defect) |
| ATR-005 / ATR-006 / ATR-007 | Delta capability/multi-transport reviews | Record-only — milestone reviews (informed PR-7A/PR-8A/PR-8B) |
| SRD-062A | Platform Gateway Contract Revision | Record-only — contract implemented at commit `a4eedac` |
| SRD-065A | Repository Scope Correction Directive | Record-only — corrected scope for PR-7B |
| FAA-PR6A … FAA-PR8B | Final Architecture Approvals (per PR) | Record-only — each captured by its merge commit (PR #21–#26) |
| GCR-001 | Gamma Closure Report | Record-only (pre-Delta) |
| SPR-058 … SPR-068 | Sprint Assignments | Process instruments — governed by [`SPR_Standard.md`](../04-standards/SPR_Standard.md); realized as PRs #19–#26 |

> **Authoritative statements live in the published records**, not this index. Where a decision is captured
> by an in-repo record (e.g. ATR-004 → RDR-003 §3.1) or by the merge/verifier trail, that record is
> authoritative; this register only tracks each artifact's status.

## Notes

- SPR (Sprint Assignment) contracts are issued per task and governed by
  [`SPR_Standard.md`](../04-standards/SPR_Standard.md); they are process instruments, not decision
  records, and are not individually filed here unless a specific SPR is later published as an artifact.
- This register is linked from the [`docs/` index](../README.md). It carries no authority of its own; it
  points to records that do.
