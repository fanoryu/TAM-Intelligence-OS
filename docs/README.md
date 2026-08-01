# `docs/` — Documentation Index

Supporting documentation for TAM Intelligence OS. Each document owns one responsibility and
cross-references rather than repeats (`CLAUDE.md` §16, §18). This folder index, the root
[`README.md`](../README.md) documentation table, and [`SECURITY.md`](../SECURITY.md) are the three
navigation hubs — each links, none duplicates.

The governance model for this folder is recorded in
[ADR-0001](adr/ADR-0001-documentation-governance-model.md).

## Engineering governance library

The numbered `NN-<area>/` folders are the project's engineering governance library, initialized by
DOC-001. Each folder owns one area and carries its own README.

| Section | Read it for |
|---|---|
| [`00-governance/`](00-governance/README.md) | Engineering Constitution, Core Values, Principles, and the Governance Pyramid |
| [`01-roadmap/`](01-roadmap/README.md) | The Domain roadmap and the milestone track (forward-looking) |
| [`02-architecture/`](02-architecture/README.md) | The Domain layer as implemented today: architecture, aggregate pattern, command/query model, AI positioning |
| [`03-adr/`](03-adr/README.md) | Domain Architecture Decision Records (`ADR-001`…, three-digit) |
| [`04-standards/`](04-standards/README.md) | SPR, PR, Review, Merge, Coding, Testing, and Release standards |
| [`05-milestones/`](05-milestones/README.md) | Milestones Alpha → Omega and their status |
| [`06-releases/`](06-releases/README.md) | Release strategy, flow, checklist, and hotfix flow |

The AI-facing entry point that requires this reading before implementation is
[`AGENTS.md`](../AGENTS.md); the enforceable rule set is [`CLAUDE.md`](../CLAUDE.md).

## Process & reference

| Document | Read it for |
|---|---|
| [`QA-CHECKLIST.md`](QA-CHECKLIST.md) | The living QA checklist run before a change is done |
| [`RELEASE-PROCESS.md`](RELEASE-PROCESS.md) | The step-by-step release procedure |
| [`DATA-SAFETY.md`](DATA-SAFETY.md) | Data-safety guidance for storage, migrations, and backups |
| [`DEPLOYMENT.md`](DEPLOYMENT.md) | How the portable build is deployed and the public/private layering |

## Decision records

| Area | Index | Holds |
|---|---|---|
| Repository & documentation governance | [`adr/`](adr/README.md) | Architecture Decision Records (`ADR-NNNN`, four-digit) |
| Domain architecture | [`03-adr/`](03-adr/README.md) | Domain Architecture Decision Records (`ADR-001`…, three-digit) |
| Security | [`security/`](security/README.md) | Security Decision Records (`SDR-NNNN`) |

The two ADR series are distinct: `adr/` (`ADR-NNNN`) records repository- and documentation-governance
decisions; `03-adr/` (`ADR-001`…) records Domain-layer architecture decisions. They never share a
number or overlap in scope.

Decision records are immutable once Accepted and are **superseded**, never rewritten
(`CLAUDE.md` §14.4, §16.2). Point-in-time audit records live under [`../audit/`](../audit/).

## Conventions (per ADR-0001)

- **Naming:** `ADR-NNNN-kebab.md`, `SDR-NNNN-kebab.md` (zero-padded, monotonic, never reused);
  `SCREAMING-KEBAB.md` for process files; `audit/<topic>-YYYY-MM-DD/` for archived records.
- **Lifecycle:** `Draft → Review → Approved → Active`, terminal `Superseded / Deprecated / Archived`;
  decision records use `Proposed → Accepted → (Superseded | Deprecated)`.
- **Single source of truth:** every fact lives in one document; others link to it.
