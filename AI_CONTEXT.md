# AI_CONTEXT.md — Repository Knowledge

This document captures the **current state** of TAM Intelligence OS to help future contributors and
AI assistants get productive quickly. It is descriptive (what *is*), whereas
[`CLAUDE.md`](CLAUDE.md) is prescriptive (the timeless rules). For deep implementation detail and the
authoritative module map, see [`ARCHITECTURE.md`](ARCHITECTURE.md) — this file summarizes and points
there rather than duplicating it.

**As of the current release:** v2.6.9 — "Enterprise Banking Foundation"; `SCHEMA_VERSION` 6.
When these change, update this document (not `CLAUDE.md`).

---

## 1. Project Overview

TAM Intelligence OS is a **single-page, client-side** finance, payroll, and operations application
for **PT Total Asset Manajemen**. It runs entirely in the browser with no backend, database, API, or
runtime dependencies; all data persists locally. It ships in two forms: a modular development source
and a portable single-file HTML build. See [`README.md`](README.md) for the public overview.

## 2. Product Vision

A self-contained "operations OS" that lets a small finance/HR team run the full monthly cycle —
people and contracts, overtime, payroll, transaction execution, cash flow, budgeting, planning, and
reporting — without external systems, while keeping confidential data on the user's own device.

## 3. Business Domain

- **Organization:** PT Total Asset Manajemen (Indonesian company; currency and formatting are IDR).
- **Core entities:** employees, contracts (with work schedules), overtime records, payroll plans,
  finance transactions (planned vs. actual), monthly plans, budgets, and an audit/activity log.
- **Primary users:** directors, finance, HR/payroll administrators, and reviewers/auditors.
- **Sensitivity:** all payroll/employee/contract/finance data is confidential (see
  [`SECURITY.md`](SECURITY.md) and [`docs/DATA-SAFETY.md`](docs/DATA-SAFETY.md)).

## 4. Major Modules

Grouped as they appear in the app's navigation:

- **Executive / Analytics:** Executive Dashboard, Executive Insights, Planned vs. Actual, Compare
  Months, Monthly Trends.
- **Finance:** Finance Overview, Transactions, Execution Center, Add/Upload, Cash Flow, Budget
  Center.
- **People & Contracts:** Employees (+ Employee Detail), Contracts, Payroll Workspace (+ Payroll
  Detail), Overtime, Monthly Plan Generator, Recurring Expenses.
- **Import:** Smart Import (spreadsheet extraction, column mapping, deduplication).
- **Management / System:** Financial Calendar, Reports, Activity Log, Settings, Bank Accounts, About,
  Release Notes.

A capability status matrix (Available / Planned) is maintained in [`README.md`](README.md).

## 5. Current Architecture

Client-only, single shared global scope of classic-script modules organized into
`core / ui / finance / people / import / analytics`, assembled into one portable HTML file. There are
no ES modules and no bundler; module load order is the critical invariant. The full structure,
provenance, and diagrams (application structure, payroll workflow, release pipeline) live in
[`ARCHITECTURE.md`](ARCHITECTURE.md).

## 6. Build System

- **Node tooling only** (no `npm install`): a build script inlines CSS + JS in manifest order into
  the portable single file, and a verifier runs a suite of invariant checks. PowerShell fallbacks
  exist for machines without Node.
- **Version is derived** from a single source constant; the portable filename follows it
  automatically.
- Commands and the full verifier scope are documented in [`README.md`](README.md) and
  [`CONTRIBUTING.md`](CONTRIBUTING.md).

## 7. Storage Overview

- Persistence is **local**: browser `localStorage` (standalone file) or the Claude Artifact storage
  environment; nothing is sent to a server.
- `SCHEMA_VERSION` is **6**; there is a fixed set of stable storage keys (**14** as of v2.6.9:
  transactions, settings, backups, employees, contracts, payroll plans, recurring, monthly plans,
  overtime records, import batches, payroll adjustments, employee merges, audit log, and the new
  `tam_company_accounts_v1`) plus one-time migration flags. The shipped build seeds **no** data.
- Recovery is via Complete Backup export/import; destructive actions snapshot first.
- The enumerated keys and migration rules are in [`docs/DATA-SAFETY.md`](docs/DATA-SAFETY.md).

## 8. Data Flow Summary

Master data (employees, contracts, work schedules, approved overtime) feeds payroll generation.
Payroll flows into finance as planned transactions, which are later executed as actuals. Analytics
and reports read across transactions and plans. Cross-module actions are recorded in a read-only
audit/activity log. All computation happens client-side at render or on user action; no data leaves
the device.

## 9. Payroll Workflow

Operational lifecycle: **Generate → Draft → Review → Approved → Posted → Executed** (stages are a
display mapping over stored status values; "Executed" is derived from the linked finance
transaction). Payroll = Base Salary + Approved Overtime. Bulk selection is generic: each action
(Review → Draft; Approve → Draft/Review; Post → Approved) owns its eligibility and reports
eligible/skipped/reason. Posted/Executed payroll is immutable. See the payroll diagram in
[`ARCHITECTURE.md`](ARCHITECTURE.md).

## 10. Finance Workflow

Approved payroll is **posted** to finance as **planned** transactions (one per employee; no
duplicates, never auto-executed). Payments are then **executed** in the Execution Center, recording
the actual amount separately from the planned amount. Cash Flow and Budget views aggregate across
transactions; Reports export locally as CSV.

## 11. Overtime Workflow

Overtime is calculated with the internal TAM method (monthly standard hours → hourly rate → payable,
rounding only the final amount). Records move Draft → Reviewed → Approved and, once payroll is
committed, "Committed to Payroll". **Drift detection** is derived and read-only: if approved overtime
changes after payroll captured it, the app warns immediately (regenerate for uncommitted payroll; for
posted/executed payroll it flags that a supplemental payment is required). Supplemental payment
itself is not yet implemented (see §16).

## 12. Repository Layout

At a glance: `index.html` + `css/` + `js/` (modular source), `tools/` (build/verify), `dist/`
(portable build), `docs/` and root Markdown (governance/knowledge), `.github/` (CI, release,
templates), and a frozen reference HTML used as the invariant golden master. The authoritative,
detailed layout is in [`README.md`](README.md#project-structure) and
[`ARCHITECTURE.md`](ARCHITECTURE.md).

## 13. Current Engineering Practices

- Edit modular source; never hand-edit the portable build; commit source + regenerated build
  together.
- Build + verify on every change; boot modular and portable with zero console errors; validate with
  fabricated data only.
- Documentation is updated as part of behavior/structure/build changes; version references stay
  consistent. Full contract: [`CONTRIBUTING.md`](CONTRIBUTING.md).

## 14. Release Process

Bump the version constants, add release notes, build + verify, present a Release Candidate, and — on
approval — commit, tag, push, and let the tag-triggered workflow publish the GitHub Release and
portable asset (guarded so it publishes only when the tag matches the source version). Detailed steps:
[`docs/RELEASE-PROCESS.md`](docs/RELEASE-PROCESS.md). History: [`CHANGELOG.md`](CHANGELOG.md); latest
summary: [`RELEASE_NOTES.md`](RELEASE_NOTES.md).

## 15. CI/CD Overview

- **CI** builds + verifies on every push/PR to the main branch and uploads the portable HTML as a
  build artifact; permissions are read-only.
- **Release** is tag-triggered, re-derives the version, enforces the tag-equals-version guardrail,
  and creates/refreshes the GitHub Release idempotently.
- Workflows use **official GitHub Actions only**, on current stable major versions, with minimal
  permissions.

## 16. Known Limitations

- **Supplemental Overtime Payment** is not implemented; drift is surfaced with a disabled placeholder.
- **No automated browser/unit test suite** — QA is the invariant verifier plus manual browser
  validation.
- **External CDN references** for the spreadsheet parser and fonts mean the fully offline experience
  depends on those assets (no user data is sent to them).
- **Single-owner project** — response and review timelines are best-effort.
- A real company workbook is intentionally tracked as a **documented, accepted exception**; it must
  not be inspected, exposed, moved, or removed without explicit approval.
- Screenshots and a social-preview image are **planned**, not yet captured (to avoid exposing real
  data).

## 17. Future Roadmap

Directions (no committed release numbers unless already approved):

- **Planned:** Supplemental Payroll Engine (v2.7.0); ongoing repository maintenance.
- **Under consideration:** authentication and role-based access control; attachment/evidence
  handling; expanded approval workflows.

The canonical roadmap lives in [`README.md`](README.md#roadmap).

## 18. Technical Debt

- No automated regression tests beyond the invariant verifier; behavioral coverage is manual.
- Heavy use of direct DOM string rendering — safe today because user data is escaped, but a
  standing reason to keep escaping disciplined.
- Some persisted records carry legacy/compatibility fields retained to avoid migrations.
- Optional security automation (secret scanning, CodeQL) is not enabled; on a private repository
  these generally depend on the GitHub plan / Advanced Security.

## 19. Important Design Decisions

- **Single-file, client-only, zero-dependency** by design — maximizes portability and keeps
  confidential data on-device.
- **Classic scripts in one global scope** were kept deliberately (not migrated to modules) to
  preserve a verified, byte-checked golden master and avoid a bundler.
- **Version derived from one constant** so the build, filename, and identity can never drift.
- **Operational payroll stages are a display mapping** over stored statuses, so UX can evolve without
  schema migrations.
- **Overtime drift is derived, not stored**, so warnings appear immediately, survive reload, and
  never duplicate — without a new storage flag.
- **Committed payroll immutability** is a hard rule; downstream corrections use supplemental flows
  rather than editing posted amounts.

## 20. Glossary

- **Modular source** — the human-edited `index.html` + `css/` + `js/` application.
- **Portable build** — the single self-contained HTML file under `dist/`, generated from source.
- **Golden master** — the frozen reference HTML used as the source of truth for CSS/data-safety
  invariants.
- **Load-order manifest** — the single file defining JS script load order, mirrored by `index.html`.
- **Verifier** — the Node script that enforces build fidelity and data-safety invariants.
- **Payroll stage** — the operational label (Draft/Review/Approved/Posted/Executed) derived from a
  stored status.
- **Overtime drift** — a derived warning that approved overtime no longer matches captured payroll.
- **Commit (payroll)** — posting approved payroll to finance as planned transactions.
- **Execution** — recording the actual payment against a planned transaction.
- **Complete Backup** — the full local-data JSON export/import used for recovery.
- **`SCHEMA_VERSION`** — the persisted-data schema version (currently 6); changes only via migration.

---

*This document describes the project as it currently stands. For the rules that do not change, see
[`CLAUDE.md`](CLAUDE.md); for implementation specifics, see [`ARCHITECTURE.md`](ARCHITECTURE.md).*
