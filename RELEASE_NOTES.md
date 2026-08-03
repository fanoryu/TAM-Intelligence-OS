# TAM Intelligence OS v2.8.1 — Single Payroll Posting Authority

**Release Name:** Single Payroll Posting Authority

## Summary
A correctness release covering two bounded sprints. **SPR-077** gives Contract renewal a real business
boundary and stops it from reporting success when the save actually failed. **SPR-078** reduces Payroll
posting to exactly one authoritative path by retiring a legacy screen that had been unreachable since
v2.5.0, and normalises committed-payroll reads behind a single shared predicate.

No schema change, no new or renamed storage key, no data migration, and **no change to persistence
mechanics**. No historical record is rewritten.

> **Note on 2.8.0.** Version `2.8.0` ("Aggregate-Owned Contract Renewal") was merged to `main` but never
> tagged or published. Its content is included here; `2.8.1` is the first published version containing it.

## Added
- **`ContractRenewalAggregate`** (SPR-077) — the eighth aggregate boundary and third Contract boundary.
  A pure decision boundary, consistent with the seven existing aggregates: it decides renewal eligibility
  and **authors** the successor Contract's business shape, the predecessor's canonical `Renewed` status,
  and both history note texts. It never mutates, never generates an id or timestamp, and never persists.
- **`contract.renewal.execute`** (SPR-077) — one operational command, registered with the aggregate as its
  boundary. No Domain facade change was required.
- **`renewContract` handler + `requestContractRenewal` UI seam** (SPR-077) — the handler owns id,
  timestamps, the history append, a single `ContractRepository.save()`, strict result inspection,
  in-memory rollback, and the typed result. Every success action runs only after a confirmed write.
- **`isPayrollCommitted()`** (SPR-078) — one canonical committed-state predicate in
  `js/people/people-core.js`, the shared people-domain read boundary. Canonical value is `'Committed'`;
  the legacy lowercase value is accepted for **reads only**.
- **`tools/verify-renewal-runtime.js`** and **`tools/verify-payroll-committed-runtime.js`** — runtime
  harnesses that execute the real code paths in a Node `vm` context against a controllable in-memory
  storage backend.

## Changed
- **Contract renewal reports success only when persistence succeeds.** Previously the result of
  `persistContracts()` was discarded: a failed write still closed the modal, showed "Contract renewed",
  and navigated to the successor while storage held neither change. A failed save now restores
  `State.contracts` exactly — successor discarded; predecessor status, renewal link, history entry, and
  `updatedAt` restored — leaves the modal open, and reports that nothing was changed. The renewal remains
  retry-able once storage recovers.
- **Renew is offered only from the non-terminal statuses** (`Draft`, `Active`). Renewing an already
  `Renewed` contract previously overwrote `renewedToId` and orphaned the first successor, which kept
  pointing back via `renewedFromId`. Expired contracts remain renewable — `Expired` is a derived display
  state and such contracts retain the stored status `Active`.
- **Legacy Payroll Planning retired.** The screen was superseded by the Payroll Workspace in v2.5.0 and
  its route was removed then — no view rendered it, no navigation entry reached it, and its only callers
  were its own re-renders. Its posting function was dead code **and** a divergent authority: it bypassed
  the period lock, the commit blockers, and the Approved gate, wrote no activity entry, never set
  `committedAt`, and wrote a payroll status value that is not a member of `PAYROLL_STATUSES`. Rows it
  produced carried a real Finance transaction while reading as stage "Draft", were skipped by Integrity
  Check and HR reports, and could not be transitioned. **`commitReadyPayroll` is now the sole live
  Payroll posting path.**
- **Committed payroll is recognised consistently.** All fourteen live committed-state reads — Contracts,
  HR dashboard, reports, Monthly Plan, the payroll engine (including `payrollStage()`), the integrity
  checker, and onboarding alerts — now use the shared predicate. Payroll committed through the retired
  path is recognised everywhere instead of appearing as "Draft".
- **The contract-cancellation warning works again.** It previously compared against the legacy value
  only, so it **never fired for payroll posted through the Payroll Workspace** — the committed-payroll
  warning was effectively dead for real payroll. It now fires for both spellings, restoring the
  `CLAUDE.md` §8.1 guard.
- **Governance records corrected** — `ARCHITECTURE.md`, `AI_CONTEXT.md`, and the ARCH-007 backlog entry
  no longer classify payroll-planning posting as a live compound operation, and record Contract renewal
  as single-collection. Accepted decision records (ADR-013, DPR-009, ECR-001) were left **immutable** per
  `CLAUDE.md` §18 — superseded by a new record if ever needed, never rewritten.
- `APP_VERSION` → `2.8.1`, `APP_RELEASE_NAME` → "Single Payroll Posting Authority".

## Removed
- Dead legacy Payroll Planning surface: `commitPayroll`, `renderPayrollPlanning`, `renderPayrollDraft`,
  `payrollRowHTML`, `generatePayrollRows`, `buildPayrollTxn`, `payrollAmount`, `samePayrollComponents`.
  None had an external consumer. `js/people/payroll-planning.js` is **retained** — `num()` and
  `ensureMonthlyPlan()` are defined nowhere else and are used by 12 and 3 modules respectively.

## Compatibility & Data Safety
- `SCHEMA_VERSION`: **unchanged (6)**. Storage keys: **unchanged (15)**. No migration was added or re-run;
  the one-time v2.5.0 payroll-ops migration is byte-identical.
- **No persisted data was modified.** The committed-state change is a **read** normalisation only; no
  writer rewrites any stored status.
- Contract renewal is **not** a compound-persistence operation — predecessor and successor both live in
  the `contracts` collection, so one write covers both. Rollback is strictly in-memory.
- **Persistence mechanics are unchanged and remain honestly non-atomic.** `commitReadyPayroll` still
  writes four stores sequentially and still discards their results. No cross-key atomicity is claimed or
  implied. This is the open compound-persistence question recorded in ATR-011.
- No coordinator, Unit of Work, Transaction Coordinator, batch persistence, journal, Repository contract
  change, or backend work was introduced. The application remains client-only per `CLAUDE.md` §4.3.

## QA
- Build: `dist/tam-intelligence-os-v2.8.1.html` (891,216 bytes), byte-identical on rebuild from clean
  `main`.
- Verify: **1088 checks** — no weakened checks. Baseline assertions that described the retired path were
  inverted to assert its retirement rather than deleted.
- Runtime: **67 checks** (renewal) + **72 checks** (payroll committed state) = **139**. Renewal coverage
  includes a real persistence failure, full in-memory rollback, and retry. Payroll coverage exercises both
  status spellings against every migrated reader, plus the lock, blocker, and Approved rejections, and
  idempotent re-posting.
- Browser: modular source and portable build both boot with **zero console errors**; renewal and payroll
  posting exercised end-to-end in each with clearly fabricated sample data, removed afterward. A fresh
  install seeds no data.

## Known Limitations
- **Compound persistence is unresolved.** `commitReadyPayroll`'s four writes are unchecked and
  non-atomic; a mid-sequence storage failure can leave committed payroll without its finance transaction.
  Recommended next steps (transaction-first write ordering, checked results with honest recovery
  semantics) are recorded in ATR-011 and remain unauthorised.
- **`saveAllData()` reports success unconditionally**, discarding every underlying write result. It backs
  employee merge and two Smart Import commits. Recorded, not yet fixed.
- Payroll rows persisted by the retired posting path keep their non-canonical stored value. They are now
  read correctly everywhere, but a remediation migration remains unauthorised.
- Supplemental source remains **overtime only**.
- Projects / Vendors / Financial Calendar remain non-functional placeholders (labeled **SOON**).
- The tracked company workbook remains a documented, accepted exception (untouched).

## Git Information
- Branch: main
- Contributing commits:
  - `764afe9` — feat(contracts): move renewal authority into an aggregate with checked persistence (SPR-077)
  - `5f4d4ad` — refactor(payroll): retire legacy Payroll Planning and normalize committed-state reads (SPR-078)
- Release commit: *pending — the Release Preparation merge commit.*
- Tag: *not yet created. `v2.8.1` is unpublished at the time of writing.*

## Release Asset
- `dist/tam-intelligence-os-v2.8.1.html` (891,216 bytes) — built and version-controlled; **not yet
  published** as a GitHub Release asset.
