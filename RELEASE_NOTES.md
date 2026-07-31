# TAM Intelligence OS v2.7.2 — Persistence & Transactional Integrity

**Release Name:** Persistence & Transactional Integrity

## Summary
A focused patch that fixes persistence/transactional-integrity defects in which a storage-write result
was ignored or dropped, so an operation could report success in the UI while the data did not actually
persist — or, worse, roll back the wrong record. All persistence helpers now return a strict
`true`/`false`, and the three affected flows (supplemental posting, Complete Backup restore, transaction
execution) are made atomic as far as the storage model permits. No committed payroll/finance amount or
historical record is rewritten. Adds **no** storage key (still **15**) and does **not** change
`SCHEMA_VERSION` (still **6**); no new migration.

## Fixed
- **Critical — Supplemental posting always took the failure path.** `persistHR(stateKey)` awaited
  `StorageAdapter.set(...)` but did not return its boolean, so `persistSupplementalPayments()` resolved
  to `undefined` and `postSupplementalToFinance()` treated every post as failed. It rolled the finance
  transaction out of storage while the already-persisted supplemental stayed **Posted** with a
  `financeTransactionId` pointing at a now-deleted transaction — an orphaned, stuck supplemental after
  reload. `persistHR` now returns a strict boolean (`false` for an unknown key, otherwise the real
  `set()` result) and every wrapper preserves it.
- **High — Complete Backup restore was not transaction-safe.** `restoreCompleteBackup()` ignored the
  results of `persist`, `saveSettings`, `saveBackups`, and `persistHR`, so a quota/storage failure could
  leave a partial restore while the UI reported success.
- **Medium — Transaction execution ignored persistence failure.** `executeTransaction()` mutated the
  transaction, wrote history/audit, and updated a linked supplemental without checking that the write
  succeeded, so it could report an execution that would vanish on reload.

## Changed
- **Atomic supplemental posting.** On success exactly one Planned transaction exists and the supplemental
  is Posted with valid two-way links; on failure before either write nothing changes; on failure after
  the transaction persists but before the supplemental persists, the transaction is rolled back **and the
  rollback is verified** — if the rollback itself cannot be saved, a clear user-facing error is shown and
  the residue is a detectable orphan transaction (never an orphan supplemental).
- **Transaction-safe restore.** The file is validated before any State change; a full deep-cloned
  pre-restore snapshot is kept; every dataset write is checked; on any failure the in-memory state is
  restored **and** the original values are re-persisted to every key already written; the function returns
  `{ ok: true }` only after all writes succeed, otherwise `{ ok: false, reason }`. The UI shows success
  and re-renders only when `result.ok === true`.
- **Checked execution.** Execution now takes a deep snapshot first, persists, and checks the result. On
  failure it restores the exact original transaction, writes no audit event, and does not mark a linked
  supplemental Executed. Only after a successful write is the audit recorded and the linked supplemental
  closed; if the supplemental write then fails, the committed transaction is never rewritten and the
  supplemental remains a detectable, reconcilable state with a clear message.
- **Startup recovery.** A supplemental left orphaned by the old bug (Posted, linked transaction missing,
  never executed) is conservatively restored to a re-postable **Approved** state with an audit entry; no
  financial amount is fabricated or altered, and anything ambiguous is retained for Integrity Check.
- `persist()`, `saveSettings()`, and `saveBackups()` now return strict booleans; `APP_VERSION` → `2.7.2`,
  `APP_RELEASE_NAME` → "Persistence & Transactional Integrity".

## Compatibility & Data Safety
- Existing local data: **fully compatible**. No committed payroll/finance amount or historical record is
  auto-changed; the only automatic repair is restoring the specific known failed-post orphan supplemental
  to Approved (re-postable), which touches no monetary value.
- `SCHEMA_VERSION`: **unchanged (6)**. Storage keys: **unchanged (15)** — none added, renamed, or removed.
  No new migration flag.
- Integrity Check still detects both orphan directions (supplemental → missing transaction; transaction →
  missing supplemental) and never auto-repairs financial history.

## QA
- Build: `dist/tam-intelligence-os-v2.7.2.html`. Verify: **181 checks** (adds v2.7.2 persistence,
  rollback, restore-safety, execution-rollback, and orphan-recovery checks; SCHEMA_VERSION 6, 15 keys).
- Browser (portable dist): all views render with **zero console errors** on a clean boot; simulated
  storage-failure tests confirm rollback for posting, execution, and restore, and recovery of a legacy
  orphan supplemental.

## Known Limitations
- Storage remains single-key atomic (localStorage/Artifact); cross-key operations are made safe by
  validate → snapshot → checked-write → rollback, not by a true multi-key transaction.
- Supplemental source remains **overtime only**.
- Projects / Vendors / Financial Calendar remain non-functional placeholders (labeled **SOON**).
- The tracked company workbook remains a documented, accepted exception (untouched).

## Git Information
- Commit: _pending approval — not committed_
- Tag: _pending approval — not tagged_
- Branch: main

## Release Asset
- dist/tam-intelligence-os-v2.7.2.html
