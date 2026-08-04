# AI_CONTEXT.md — Repository Knowledge

This document captures the **current state** of TAM Intelligence OS to help future contributors and
AI assistants get productive quickly. It is descriptive (what *is*), whereas
[`CLAUDE.md`](CLAUDE.md) is prescriptive (the timeless rules). For deep implementation detail and the
authoritative module map, see [`ARCHITECTURE.md`](ARCHITECTURE.md) — this file summarizes and points
there rather than duplicating it.

**As of the current source state:** v2.8.4 — "Monthly Plan Result Integrity"; `SCHEMA_VERSION` 6.
v2.8.4 is **tagged and published, and is the latest published release** — annotated tag `v2.8.4` peels
to the published baseline commit `bd8819af0287af02711898cf43d22fb70cc3bcd5` on `main`, and the GitHub
Release *TAM Intelligence OS v2.8.4* is published (not draft, not prerelease) and marked Latest. v2.8.3
remains published and unchanged; it is no longer marked Latest. The current distributable is
`dist/tam-intelligence-os-v2.8.4.html` (914,409 bytes; SHA-256
`09c622b3a692dab426e8ef517592aa55f898d75560972c6d661e7bda3eaa02c6`), and the published asset
`tam-intelligence-os-v2.8.4.html` is byte-identical to it. Publication created a tag and a GitHub
Release only — it changed no source commit, runtime behavior, schema, or storage key.
When these change, update this document (not `CLAUDE.md`).

**Current baseline (aggregate-backed Repository adoption complete):**
[RDR-011](docs/RDR/RDR-011-epsilon-repository-snapshot.md) at commit `6714beb`; progress recorded in
[DPR-009](docs/DPR/DPR-009-epsilon-repository-adoption-completion.md). Milestone Delta established the
canonical application **Platform** and proved it transport-agnostic
([RDR-007](docs/RDR/RDR-007-delta-repository-snapshot.md) / [DPR-005](docs/DPR/DPR-005-delta-completion-report.md),
both immutable predecessors); **Milestone Epsilon** completed **Repository adoption** over it. The current
architecture has **two ingresses over one canonical contract**:

```
Browser ┐
        ├→ Transport Adapter → Application Gateway → Domain → Aggregate → Handler → Entity-Named Repository → StorageAdapter
CLI    ─┘
```

- **Application Gateway** (PR-6A) — exclusive, business-blind Platform boundary.
- **Transport Adapter** (PR-7A) — canonical transport boundary; the browser consumes it via the
  `uiExecute` seam (PR-7B "The Conduit").
- **CLI** (PR-8B) — first non-browser, read-only ingress delegating solely through `TransportAdapter`.
- **Repository** (PR-8A … PR-11A) — persistence-mechanics boundary; **three entity-named modules** in
  `js/repository/`: `EmployeeRepository`, `ContractRepository`, `PayrollRepository`. One unevolved,
  collection-grained, client-side contract: `save() → { ok:true } | { ok:false, error:'PersistFailed' }`.
  Handlers keep validation, mutation, `updatedAt`, history, rollback, typed results — and, for Payroll,
  the post-persistence best-effort audit. See [ADR-013](docs/03-adr/ADR-013-Repository-Layer.md).

**Aggregate-backed Repository adoption: 8 of 8** — Employee 4/4, Contract 3/3, Payroll 1/1.
This means *only* that every aggregate-backed handler delegates persistence through an entity-named
Repository. It does **not** mean all persistence is mediated (the layer covers 3 of 11 persist
functions), that compound persistence is solved, that multi-store transactions are supported, or that
backend readiness is achieved. Non-aggregate and compound writes remain direct by design and are
verifier-fenced. **Backend remains prohibited** by [`CLAUDE.md`](CLAUDE.md) §4.3 (client-only MUST).

**Contract authority.** Contract status transitions are aggregate-backed, and renewal is
**aggregate-authored**: `ContractRenewalAggregate` decides eligibility and authors the successor's
business shape, the predecessor's canonical `Renewed` status, and both history note texts, without
mutating, generating ids/timestamps, or persisting. The `renewContract` handler owns ids, timestamps, the
history append, one `ContractRepository.save()`, strict result inspection, in-memory rollback on a failed
write, and the typed result. Renewability is evaluated against **stored** statuses (`Draft`, `Active`),
never derived display states — so a contract displayed as *Expired* or *Expiring Soon* remains renewable
while its stored status is still `Active`. Terminal statuses (`Renewed`, `Cancelled`) are never renewable.

**Next architecture frontier: compound persistence** — `commitReadyPayroll` writes four stores in one
logical unit, which the collection-grained contract cannot express. This is the open question, not backend
work. It is now the **only** compound operation in the Payroll domain: Contract renewal was shown to be
single-collection (SPR-077, ATR-011 §4) and payroll-planning posting was retired as dead code (SPR-078).

SPR-079, SPR-081 and SPR-082 changed how compound persistence is **reported and detected**, not how it
is performed. Multi-key writes remain sequential and non-atomic; see *Known Limitations* for the standing
residuals and *Future Roadmap* for what is and is not authorised.

`commitReadyPayroll` is the **sole live Payroll posting path**. The legacy Payroll Planning screen and its
`commitPayroll` function were removed in SPR-078: the screen had been unreachable since v2.5.0 (no route,
no navigation entry, no external caller) and its posting path was a second, divergent authority that
bypassed the period lock, commit blockers, and the `Ready` gate, and wrote a non-canonical lowercase
`'committed'` status. Committed-state reads now go through one shared predicate, `isPayrollCommitted()`
(`js/people/people-core.js`), which accepts the canonical `'Committed'` and — for reads only — the legacy
lowercase value that retired path may have persisted. No live writer writes the legacy value.

**Payroll posting result integrity (SPR-081, v2.8.3).** `commitReadyPayroll` captures and strictly
inspects **all four** persistence results (payroll plans, monthly plan, overtime, finance transactions);
success requires all four, and failure returns a typed outcome naming the first failed step in the fixed
write order, the completed steps, and that partial persistence occurred. The success audit entry and the
success UI (toast, posted-vs-skipped summary, selection clear) are gated on full persistence success; the
failure branch retains the row selection so the user can see what was involved. Transaction lookup keeps
its forward resolution and adds a narrow reverse fallback — payroll-sourced only, exact `payrollPlanId`,
exact period — that resolves **only when exactly one candidate exists**; more than one yields a typed
`PayrollTransactionAmbiguous` skip and never a guess. A reverse-matched transaction has its forward
linkage restored rather than being duplicated. **This added no atomicity and no rollback** — the four
writes are still sequential.

**The two SPR-080 failure modes are not equally addressed.** Scenario A (duplicate finance transaction on
retry) is **prevented on retry** by the unique reverse lookup: the existing transaction is found and
relinked instead of a second one being created. Scenario C (overtime left `Approved` after a committed
posting, and therefore re-payable) is **detected as a Critical integrity finding before reuse** — it is
**not automatically repaired, and not universally blocked**. Nothing prevents that overtime from being
included in a later payroll; the finding is advisory and requires a human to act on it.

**Monthly Plan result integrity (SPR-082, v2.8.4).** `commitMonthlyPlan` (`js/people/monthly-plan.js`)
now captures and strictly inspects **both** persistence results — transactions first, monthly plans
second. The two writes keep their existing order and attempt-all behaviour; success requires both, and
failure returns a typed `MonthlyPlanPersistenceFailed` outcome naming the first failed step in the fixed
write order, the completed steps, and that partial persistence occurred. The failure branch **keeps the
preview** (so the user retains the rows they were committing), shows no success toast, and states plainly
that some data may already have been saved and that Integrity Check should be run before retrying.
**This added no atomicity and no rollback** — the two writes are still sequential, and a failure means
the commit did not complete, **not** that nothing was written.

The partial states are now **detectable**, not prevented and not repaired. A new **Critical** rule,
`monthlyplan-orphan-transaction`, fires for a non-payroll Finance transaction carrying a `monthlyPlanId`
when either the referenced monthly plan is **absent entirely** or the plan exists but **does not list the
transaction** in `committedTxnIds`. The pre-existing `corrupt-plan-ref` **warning** still covers the
opposite direction — a plan whose `committedTxnIds` point at transactions that do not exist. Payroll-sourced
transactions stay out of scope of the new rule; they are owned by `payroll-orphan-transaction` and
`payroll-missing-monthlyplan`.

**Retry is idempotent for transaction creation only — it does not reconcile linkage.** Two residual
states are documented and proven by the runtime harness, and both require **manual review**:

- **Scenario A2** (the monthly plan was created by the failing commit; only the transactions write
  landed). After reload the transactions return with a `monthlyPlanId` pointing at nothing, and
  `monthlyplan-orphan-transaction` fires. The retry **creates no duplicate transaction** — the reloaded
  rows are recognised as duplicates and skipped — but because they are skipped they are **never linked**
  to the newly created plan, so the Critical finding **remains** after a successful retry.
- **Scenario B** (only the monthly plans write landed). After reload the plan is `Committed` with
  **dangling** `committedTxnIds` and `corrupt-plan-ref` fires. The retry creates the missing transaction
  under a **new id**; the stale dangling ids **stay on the plan** — nothing removes them — so
  `corrupt-plan-ref` **remains** and the commit **reports success while that finding still stands**.

**Multi-dataset persistence (SPR-079, v2.8.2).** `saveAllData()` inspects every one of its 14 writes and
returns `true` only when all succeed; Employee Merge and Smart Import no longer report false success.
Multi-key saves remain non-atomic: a failure means the operation did not complete, **not** that nothing
was written. **Reload reads whatever storage keys successfully persisted. It does not restore a complete
prior state.**

**Integrity Check** gained two **Critical** rules in SPR-081 — `payroll-orphan-transaction`, which fires
when a payroll-sourced Finance transaction references a `PayrollPlan` that is **either not `Committed`
or does not link back to that transaction** (both broken-linkage directions, not only the uncommitted
case), and `payroll-overtime-uncommitted` (committed payroll whose linked overtime is still `Approved`,
which was runtime-proven to be re-payable in the next month). SPR-082 added a third **Critical** rule,
`monthlyplan-orphan-transaction` (a non-payroll transaction whose referenced monthly plan is absent, or
exists but does not list it), alongside the pre-existing `corrupt-plan-ref` **warning** for the reverse
direction. All of these are **read-only detection**: they report that a partial state exists and where —
they do **not** repair it and do **not** block the underlying operation.

Operational surface: 8 aggregates / 8 aggregate-backed commands / 1 aggregate-backed query; 14 registered
commands / 4 registered queries — unchanged by every Repository slice. Business authority remains
exclusively in the Domain.

**v2.7.1 note.** Posted/Executed payroll and supplemental display now derive from a single stage-aware
historical source-of-truth helper (`payrollHistoricalSnapshot`) backed by immutable snapshots frozen
at posting — historical figures are never reconstructed from current master data, and a visible notice
appears when a legacy plan disagrees with its committed transaction. No storage key was added (still
15) and `SCHEMA_VERSION` is unchanged (6).

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
`core / ui / finance / people / import / analytics / domain / platform / transport / repository / cli`,
assembled into one portable HTML file. **65 JS modules** exist in the source: **64 are browser-loaded**
(the load-order manifest and `index.html` agree on all 64), and `js/cli/cli.js` is the CLI-only ingress,
deliberately outside the browser load order. There are no ES modules and no bundler; module load order is
the critical invariant. The full structure, provenance, and diagrams (application structure, payroll
workflow, release pipeline) live in [`ARCHITECTURE.md`](ARCHITECTURE.md).

## 6. Build System

- **Node tooling only** (no `npm install`): a build script inlines CSS + JS in manifest order into
  the portable single file, and a verifier runs a suite of invariant checks (**1267** at v2.8.4), joined
  by five runtime harnesses (**424** checks). PowerShell fallbacks exist for machines without Node.
- The portable build is **reproducible**: the same source produces a byte-identical artifact, so the
  published SHA-256 verifies any downloaded copy.
- **Version is derived** from a single source constant; the portable filename follows it
  automatically.
- Commands and the full verifier scope are documented in [`README.md`](README.md) and
  [`CONTRIBUTING.md`](CONTRIBUTING.md).

## 7. Storage Overview

- Persistence is **local**: browser `localStorage` (standalone file) or the Claude Artifact storage
  environment; nothing is sent to a server.
- `SCHEMA_VERSION` is **6**; there is a fixed set of stable storage keys (**15** as of v2.7.0:
  transactions, settings, backups, employees, contracts, payroll plans, recurring, monthly plans,
  overtime records, import batches, payroll adjustments, employee merges, audit log,
  `tam_company_accounts_v1`, and `tam_supplemental_payments_v1`) plus one-time migration flags. The
  shipped build seeds **no** data.
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
posted/executed payroll it becomes actionable — generate a **Supplemental Payment** (v2.7.0) that
settles the late overtime as a separate document without touching the base payroll (Draft → Review →
Approved → Posted → Executed; reuses the finance transaction model and Execution Center).

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
portable asset (guarded so it publishes only when the tag matches the source version). **v2.8.4 is the
latest published release, published from annotated tag `v2.8.4` (commit `bd8819a`) and marked Latest;
v2.8.3 remains published and unchanged but is no longer Latest.** Detailed steps:
[`docs/RELEASE-PROCESS.md`](docs/RELEASE-PROCESS.md). History: [`CHANGELOG.md`](CHANGELOG.md); latest
summary: [`RELEASE_NOTES.md`](RELEASE_NOTES.md).

## 15. CI/CD Overview

- **CI** (`ci.yml`) builds + verifies on every push/PR to the main branch and uploads the portable HTML
  as a build artifact; permissions are read-only.
- **CodeQL** (`codeql.yml`) runs code scanning on push/PR with two Analyze jobs
  (`javascript-typescript` and `actions`).
- **Release** (`release.yml`) is tag-triggered, re-derives the version, enforces the tag-equals-version
  guardrail, and creates/refreshes the GitHub Release idempotently, uploading the portable HTML as the
  release asset. It titles the Release `TAM Intelligence OS <tag>` — the short convention, which is why a
  published Release title reads `TAM Intelligence OS v2.8.4` rather than including the release name.
  It resolves the Release body from `RELEASE_NOTES.md` at the tagged commit. Shipped releases are never
  rewritten.
- Workflows use **official GitHub Actions only**, on current stable major versions, with minimal
  permissions.

## 16. Known Limitations

- **Payroll posting is not atomic.** `commitReadyPayroll` still writes **four storage keys
  sequentially** and retains attempt-all behaviour. Its results are now checked (SPR-081), which makes
  failure *visible* — it does not make the operation all-or-nothing. **No coordinated rollback and no
  compensating action exist for Payroll posting.** A failure means the posting did not complete, not
  that nothing was written.
- **Integrity Check detects but does not repair.** `payroll-orphan-transaction`,
  `payroll-overtime-uncommitted`, `monthlyplan-orphan-transaction` and `corrupt-plan-ref` report that a
  partial state exists and where it is; none of them fixes it. **Some partial states may still require
  manual review** or restoration from the pre-operation backup, and not every possible partial state is
  automatically detectable or repairable.
- **Monthly Plan commit is not atomic.** `commitMonthlyPlan` writes **two storage keys sequentially** and
  retains attempt-all behaviour. Both results are now checked (SPR-082), which makes failure *visible* —
  it does not make the commit all-or-nothing. **No coordinated rollback and no compensating action exist.**
- **Monthly Plan retry does not reconcile transaction–plan linkage.** Retry is idempotent for
  *transaction creation* only. In **Scenario A2** the retry creates no duplicate transaction but never
  links the pre-existing rows to the new plan, so `monthlyplan-orphan-transaction` **remains**. In
  **Scenario B** the stale dangling `committedTxnIds` are never removed, so `corrupt-plan-ref` **remains**
  and the retry **reports success while that finding still stands**. Both are documented residual states
  whose current operational response is **manual review**.
- **Smart Import undo has an unresolved partial-persistence case.** The undo sets its `undone` completion
  marker *before* the write, because the marker is part of the `importBatches` payload. If the
  `importBatches` write **succeeds** but another required dataset write **fails**, reload may preserve
  `undone:true` while some record removals did not persist — and because the marker is also the batch
  selector (`find(b=>!b.undone)`), **the batch may then be unavailable for retry after reload**.
  **Immediate retry is available only where the failure branch clears the in-memory completion marker
  before reload**; once a divergent state has been reloaded, that path is gone. This is explicitly
  **not** a rollback: the record removals stay applied in memory and whatever the fan-out wrote stays
  written. Unresolved.
- **Smart Import undo has no pre-operation backup.** Employee Merge and Smart Import **commit** each
  snapshot a pre-operation safety backup before writing; **Smart Import undo does not** take an
  equivalent snapshot, so there is no undo-specific restore point to fall back on.
- **No backend, server-side transaction, or multi-user synchronisation exists** — the application is
  client-only by [`CLAUDE.md`](CLAUDE.md) §4.3, so cross-key atomicity cannot be delegated to a server.
- **Supplemental Payments** (v2.7.0) settle overtime drift only; other adjustment sources (bonuses,
  reimbursements) are not yet implemented (the engine is designed to extend).
- **No automated browser/unit test suite** — QA is the invariant verifier (**1267** checks) plus five
  Node runtime harnesses (**424** checks total: monthly plan 118, payroll posting 106, `saveAllData` 61,
  contract renewal 67, payroll committed state 72) plus manual browser validation. The runtime harnesses drive real
  behaviour against the live engine and UI seams, but they are not a general test suite.
- **External CDN references** for the spreadsheet parser and fonts mean the fully offline experience
  depends on those assets (no user data is sent to them).
- **Single-owner project** — response and review timelines are best-effort.
- A real company workbook is intentionally tracked as a **documented, accepted exception**; it must
  not be inspected, exposed, moved, or removed without explicit approval.
- Screenshots and a social-preview image are **planned**, not yet captured (to avoid exposing real
  data).

## 17. Future Roadmap

Directions (no committed release numbers unless already approved):

- **Released:** Supplemental Payroll Engine (v2.7.0); Payroll Integrity & Reporting Foundation (v2.7.1);
  Persistence & Transactional Integrity (v2.7.2); Supplemental-Aware Payroll History (v2.7.3);
  Aggregate-Owned Contract Renewal + Single Payroll Posting Authority (v2.8.1); Honest Persistence
  Results (v2.8.2); Payroll Posting Integrity (v2.8.3); **Monthly Plan Result Integrity (v2.8.4 —
  current, and the latest published release)**.
- **Immediate residuals** (evidence-backed, not yet scheduled): Monthly Plan retry linkage reconciliation
  (Scenarios A2 and B); the Smart Import undo in-memory/storage divergence — both described under
  *Known Limitations*, and both answered today by **manual review** only.
- **Deferred architecture** — considered only if evidence justifies it, never pre-emptively:
  operation-specific compensation (only where a concrete failure mode warrants it); a persisted recovery
  marker (only if runtime evidence requires one); a generic coordination mechanism (only after a
  **second** convergent operation demonstrates the need). None of these is approved today.
- **Explicitly not authorised:** a Unit of Work; a Transaction Coordinator; a `StorageAdapter` journal;
  a single-key envelope; any backend assumption. Generic compound-persistence coordination is an **open
  question**, not an approved direction.
- **Planned:** Payroll Reporting suite expansion; supplemental sources beyond overtime; ongoing
  repository maintenance.
- **Under consideration:** authentication and role-based access control; attachment/evidence
  handling; expanded approval workflows.

The canonical roadmap lives in [`README.md`](README.md#roadmap).

## 18. Technical Debt

- No general automated regression suite; coverage is the invariant verifier plus five targeted runtime
  harnesses, with the remaining behavioural coverage manual.
- Heavy use of direct DOM string rendering — safe today because user data is escaped, but a
  standing reason to keep escaping disciplined.
- Some persisted records carry legacy/compatibility fields retained to avoid migrations.
- Compound (multi-key) persistence is checked and reported but not coordinated, and detected partial
  states are not repaired; see *Known Limitations* for the outstanding residuals.

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
