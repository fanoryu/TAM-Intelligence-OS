# TAM Intelligence OS v2.8.2 — Honest Persistence Results

**Release Name:** Honest Persistence Results

## Summary
A correctness release from one bounded sprint, **SPR-079**. Operations that save several datasets at
once previously reported success even when the browser rejected one or more writes. They now inspect
every result and report failure honestly.

No schema change, no new or renamed storage key, no data migration, and **no change to how or when data
is written**. No historical record is rewritten.

> **This release adds no atomicity and no rollback.** Saving several datasets writes one storage key per
> dataset, and the browser provides atomicity for a single key only. A failure therefore means *the
> operation did not complete successfully* — **not** *nothing was written*. Earlier writes in a failing
> sequence may well have persisted. Reloading reloads the state that was successfully persisted.
> Because a multi-dataset save may partially succeed, manual review — or restoration from the
> pre-operation backup — may still be required.

## Changed
- **`saveAllData()` reports failure honestly.** The shared fan-out used by Smart Import and employee
  merge performs 14 writes. It previously discarded every underlying result and returned success
  unconditionally; it now returns success only when **all 14** writes succeeded. The boolean contract is
  unchanged, so no caller signature had to widen. Failing dataset names go to the console; the storage
  layer already surfaces each failure to the user, so no duplicate notification was added.
- **Employee merge no longer reports false success.** A failed save shows a clear message instead of the
  "Merged…" confirmation, clears no completion state, and keeps the pre-merge safety backup. Retrying is
  safe — a repeated merge over the same records is idempotent.
- **Smart Import commit no longer writes a success audit entry after a failed save.** The `import.commit`
  audit record is written only after every write has succeeded. On failure the wizard stays on the review
  step with the parsed model intact, does not navigate to the results screen, and shows no success
  message. The pre-import safety backup is preserved.
- **Smart Import undo remains retryable after a failed save.** The `undone` flag is both the completion
  marker and the selector used to find the batch, so leaving it set after a failed write previously
  blocked every further attempt for the rest of the session — the next click reported "No Smart Import
  batch available to undo" and never reached storage again. The failure path now clears that marker, so
  an immediate retry works once storage recovers. Only the marker is cleared; this is **not** a rollback.

## Compatibility & Data Safety
- `SCHEMA_VERSION`: **unchanged (6)**. Storage keys: **unchanged (15)**. No migration was added or re-run.
- **No persisted data shape changed.** This release changes result *reporting*, not what is written.
- Pre-operation safety backups are preserved in every failure path.
- Failure messages state that the operation did not complete. They deliberately never claim a rollback,
  full restoration, or that nothing was written. Reloading reloads the state that was successfully
  persisted; because a multi-dataset save may partially succeed, manual review — or restoration from
  the pre-operation backup — may still be required.
- No coordinator, unit of work, transaction manager, batch persistence, journal, recovery marker, or
  retry framework was introduced. The application remains client-only per `CLAUDE.md` §4.3.

## Known Limitations
- **Payroll posting is unchanged and remains non-atomic.** Posting a payroll period still writes four
  datasets sequentially — payroll plans, monthly plan, overtime, then finance transactions — and still
  does not check those results. If one write fails, the period can be left partially posted. Depending on
  which write fails, the result may be a committed payroll with no finance transaction (surfaced by
  **Settings → Run Integrity Check** as a critical finding), or a partially linked period that Integrity
  Check does not currently surface. **No coordinated rollback exists.** Manual review is required.
  Discovery for this work is complete (SPR-080); the corrective sprint is not part of v2.8.2.
- **Nothing in Payroll posting was fixed in this release.** In particular, the two silent partial-posting
  paths identified during discovery — a duplicate finance transaction on retry after one failure mode,
  and overtime that can be re-included in a later month after another — are **present in v2.8.2 exactly
  as in v2.8.1**, and are the subject of the next sprint.
- Payroll rows persisted by the retired Payroll Planning path keep a non-canonical stored value. They are
  read correctly everywhere; a remediation migration remains unauthorised.
- Supplemental source remains **overtime only**.
- Projects / Vendors / Financial Calendar remain non-functional placeholders (labeled **SOON**).
- The tracked company workbook remains a documented, accepted exception (untouched).

## QA
- Build: `dist/tam-intelligence-os-v2.8.2.html`, byte-identical on rebuild from clean `main`.
- Verify: **1136 checks** — no weakened checks.
- Runtime: **61** (`saveAllData` result integrity) + **67** (Contract renewal) + **72** (Payroll committed
  state) = **200**. The `saveAllData` harness covers all-succeed; first, middle, final and multiple write
  failures; a throwing write; each caller's success and failure behaviour; backup survival; undo marker
  clearing; immediate retry; and retry after reload. It also asserts that partial persistence is **real**
  rather than hidden, and that no failure message claims a rollback.
- Browser: modular source and portable build both boot with **zero console errors**; a fresh install
  seeds no data.

## Git Information
- Release tag: `v2.8.2`
- Release branch: `main`
- Publication channel: GitHub Releases
- Contributing commits:
  - `cdce6df` — fix(persistence): make saveAllData report failure honestly (SPR-079)
  - `3dcc783` — fix(import): clear the undo completion marker on a failed persist (SPR-079)

## Release Asset
- Asset: `tam-intelligence-os-v2.8.2.html`
- Size: 898,118 bytes
- SHA-256: `a5b6dfaef5d2f949841dcafee9c2981ec43725ffb3f39f1e10ef9dbf9cdc88cb`

The asset is built from `main` by `tools/build-single-file.js` and is byte-reproducible: rebuilding from
the same source produces an identical file, so the checksum above verifies any downloaded copy.
