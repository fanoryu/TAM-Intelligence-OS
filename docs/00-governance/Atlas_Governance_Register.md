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
| [RDR-001](../RDR/RDR-001-gamma-repository-snapshot.md) | Gamma Repository Snapshot | `docs/RDR/` | Accepted (superseded as baseline by RDR-003) |
| [RDR-003](../RDR/RDR-003-delta-repository-snapshot.md) | Delta Repository Snapshot | `docs/RDR/` | **Accepted — current authoritative baseline** |
| [GHA-001](../../audit/github-audit-2026-08-02/GHA-001-github-repository-comprehensive-audit.md) | GitHub & Repository Comprehensive Audit | `audit/` | Complete — recorded |
| [SDR-0001](../security/SDR-0001-codeql-baseline-disposition.md) | CodeQL Baseline Disposition | `docs/security/` | Accepted (dispositions CodeQL #1–5) |

## Pending repository publication

The following **7 Atlas governance artifacts remain external to the repository pending authoritative
publication** — their authoritative text currently exists in the Atlas governance system and has not yet
been supplied to the repository. They are **reserved and referenced** here; their bodies are **not**
authored locally to avoid fabricating governance history (`CLAUDE.md` §16.4). Each will be published
verbatim into the appropriate home once its source text is provided.

| Artifact | Title (as referenced) | Intended home | Status |
|---|---|---|---|
| RDR-002 | Repository snapshot (subject/scope not yet supplied) | `docs/RDR/` | Pending source text |
| GCR-001 | Gamma Closure Report | `docs/05-milestones/` or `audit/` (TBD on receipt) | Pending source text |
| DPR-001 | Delta Progress Report | `docs/05-milestones/` (TBD on receipt) | Pending source text |
| ATR-003 | Delta Readiness Review | TBD on receipt | Pending source text |
| ATR-004 | Platform Gateway Contract Review | TBD on receipt | Pending source text (decision recorded in [RDR-003 §3.1](../RDR/RDR-003-delta-repository-snapshot.md#31-gateway-envelope-semantics-atr-004--intentional-not-a-defect)) |
| SRD-062A | Platform Gateway Contract Revision | `docs/02-architecture/` or `docs/03-adr/` (TBD on receipt) | Pending source text (contract implemented at commit `a4eedac`) |
| FAA-PR6A | Final Architecture Approval — PR-6A | TBD on receipt | Pending source text (PR-6A merged in PR #21) |

> **Why some rows point elsewhere for the decision.** Where an artifact's *decision* is independently
> and verifiably captured by an in-repo record (e.g. ATR-004's gateway-envelope decision in RDR-003 §3.1),
> that record — not this index — is the authoritative statement. This register only tracks the artifact's
> own publication status.

## Notes

- SPR (Sprint Assignment) contracts are issued per task and governed by
  [`SPR_Standard.md`](../04-standards/SPR_Standard.md); they are process instruments, not decision
  records, and are not individually filed here unless a specific SPR is later published as an artifact.
- This register is linked from the [`docs/` index](../README.md). It carries no authority of its own; it
  points to records that do.
