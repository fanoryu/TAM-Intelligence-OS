# `docs/` — Documentation Index

Supporting documentation for TAM Intelligence OS. Each document owns one responsibility and
cross-references rather than repeats (`CLAUDE.md` §16, §18). This folder index, the root
[`README.md`](../README.md) documentation table, and [`SECURITY.md`](../SECURITY.md) are the three
navigation hubs — each links, none duplicates.

The governance model for this folder is recorded in
[ADR-0001](adr/ADR-0001-documentation-governance-model.md).

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
| Architecture | [`adr/`](adr/README.md) | Architecture Decision Records (ADR-NNNN) |
| Security | [`security/`](security/README.md) | Security Decision Records (SDR-NNNN) |

Decision records are immutable once Accepted and are **superseded**, never rewritten
(`CLAUDE.md` §14.4, §16.2). Point-in-time audit records live under [`../audit/`](../audit/).

## Conventions (per ADR-0001)

- **Naming:** `ADR-NNNN-kebab.md`, `SDR-NNNN-kebab.md` (zero-padded, monotonic, never reused);
  `SCREAMING-KEBAB.md` for process files; `audit/<topic>-YYYY-MM-DD/` for archived records.
- **Lifecycle:** `Draft → Review → Approved → Active`, terminal `Superseded / Deprecated / Archived`;
  decision records use `Proposed → Accepted → (Superseded | Deprecated)`.
- **Single source of truth:** every fact lives in one document; others link to it.
