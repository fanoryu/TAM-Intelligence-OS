# TAM Intelligence OS v2.8.3 — Payroll Posting Integrity

**Release Name:** Payroll Posting Integrity

## Summary
A correctness release from one bounded sprint, **SPR-081**. Posting a payroll period previously ignored
whether its writes actually succeeded. It could report success after a failed posting, and two failure
modes proven during discovery (SPR-080) could quietly cost or double real money. Posting now inspects
every result, reports failure honestly, refuses to guess an ambiguous match, and Integrity Check
surfaces the two partial states that previously went undetected.

No schema change, no new or renamed storage key, no data migration, and **no change to how or when data
is written**. No historical record is rewritten.

> **This release adds no atomicity and no rollback.** Payroll posting still writes four storage keys
> sequentially — payroll plans, monthly plan, overtime, then finance transactions — and the browser
> provides atomicity for a single key only. A failure therefore means *the posting did not complete
> successfully* — **not** *nothing was written*. Earlier writes in the sequence may well have persisted.
> Reloading reloads the state that was successfully persisted. **No rollback or compensating action was
> introduced.** Manual review — or restoration from the pre-operation backup — may still be required.

## Changed
- **Posting inspects all four persistence results.** `commitReadyPayroll` captures and strictly inspects
  every one of its four writes. Success requires all four. Failure returns a typed outcome naming the
  first failed step in the fixed write order, the steps that completed, and that partial persistence
  occurred. The write order and the write mechanics themselves are unchanged.
- **A failed posting writes no success audit entry.** The audit trail records what actually happened.
- **A failed posting shows no completion behavior.** The workspace Post handler previously ran
  `sel.clear()` and `closeModal()` on the same line as the posting call, before the result was inspected.
  The result is now inspected first; the success toast and the posted-vs-skipped summary are on the
  success path only.
- **Selected Payroll rows remain visible after a failed posting.** Clearing the selection is completion
  behavior — it discarded which rows the user was posting, exactly when they were being told to review
  the data manually. The failure branch now retains the selection so the same rows stay checked after
  the re-render. It closes the modal explicitly because `render()` rebuilds the workspace beneath it.
  The locked branch keeps its existing clear-and-close behavior and its single warning.
- **Retry after the orphan-transaction failure reuses the existing Finance transaction.** When the
  payroll-plans write failed and the transactions write succeeded, a reload left a real transaction
  carrying `payrollPlanId` while the plan was back at Ready with no forward link. Lookup resolved only
  through that forward link, so a retry created a **second** transaction and doubled the payroll — with
  no integrity finding beforehand. Lookup keeps its forward resolution and gains a narrow reverse
  fallback: payroll-sourced only, exact `payrollPlanId`, exact period. A reverse-matched transaction has
  its forward linkage restored, with a `transaction-relinked` history entry, instead of being duplicated.
- **Ambiguous Finance transaction matches are never guessed.** Resolution distinguishes resolved / none /
  ambiguous, so a caller that may **create** a transaction can never mistake ambiguity for absence.
  Posting resolves the transaction **before** mutating, so an ambiguous row is skipped uncommitted with a
  `PayrollTransactionAmbiguous` reason listing every candidate. It never picks one and never adds a third.

## Added
- **Integrity Check reports orphan Payroll transactions as Critical.** A payroll-sourced Finance
  transaction whose linked payroll plan is not committed — the residue of a partial posting — is now
  surfaced rather than going unnoticed.
- **Integrity Check reports committed Payroll whose linked Overtime is still Approved as Critical.**
  When the overtime write failed after the payroll and transaction writes landed, the linked overtime
  stayed Approved and was runtime-proven to be re-included in the next month's generated payroll —
  paying it twice. No rule previously detected this.

## Compatibility & Data Safety
- `SCHEMA_VERSION`: **unchanged (6)**. Storage keys: **unchanged (15)**. No migration was added or re-run.
- **No persisted data shape changed.** This release changes result *inspection*, transaction *resolution*,
  and *detection* — not what is written or in what order.
- Committed payroll remains immutable; no committed total or posted transaction is modified.
- Failure messages state that the posting did not complete. They deliberately never claim a rollback,
  full restoration, or that nothing was written.
- No coordinator, unit of work, transaction manager, batch persistence, journal, recovery marker, or
  retry framework was introduced. The application remains client-only per `CLAUDE.md` §4.3.

## Known Limitations
- **Payroll posting is still not atomic.** It still writes four storage keys sequentially. Checking the
  results makes failure *visible*; it does not make the operation all-or-nothing.
- **No rollback or compensation exists.** Nothing undoes the writes that already landed when a later
  write fails.
- **Integrity Check detects but does not repair.** The two new findings report that a partial state
  exists and where it is. They do not fix it.
- **Not every possible Payroll partial state is automatically repairable.** The two failure modes closed
  here are the two proven by SPR-080 discovery. This release does not claim to detect or remediate every
  combination of the four writes failing. **Manual review may still be required after partial
  persistence.**
- Payroll rows persisted by the retired Payroll Planning path keep a non-canonical stored value. They are
  read correctly everywhere; a remediation migration remains unauthorised.
- Supplemental source remains **overtime only**.
- Projects / Vendors / Financial Calendar remain non-functional placeholders (labeled **SOON**).
- The tracked company workbook remains a documented, accepted exception (untouched).

## QA
- Build: `dist/tam-intelligence-os-v2.8.3.html`, byte-identical on rebuild from clean `main`.
- Verify: **1212 checks** — no weakened checks.
- Runtime: **106** (Payroll posting) + **61** (`saveAllData` result integrity) + **67** (Contract
  renewal) + **72** (Payroll committed state) = **306**. The payroll-posting harness drives the live
  engine, selection set, and UI seams: all-succeed; each of the four writes failing; the orphan-retry
  scenario proven not to duplicate; the overtime-still-Approved scenario proven to be detected; ambiguous
  resolution proven to skip rather than guess; and failure proven to retain the selection and emit only
  the manual-review error while success preserves the full completion UX including the skip summary.
  Branch ordering is proven by index — nothing completion-shaped sits between the posting call and the
  failure branch.
- Browser: modular source and portable build both boot with **zero console errors**; a fresh install
  seeds no data.

## Git Information
- Release tag: `v2.8.3` *(not yet created)*
- Release branch: `main`
- Publication channel: GitHub Releases
- Contributing commits:
  - `fc4f590` — fix(payroll): check posting results and detect partial posting states (SPR-081)
  - `516bc67` — fix(payroll): inspect posting result before any completion behaviour (SPR-081)

## Release Asset
- Asset: `tam-intelligence-os-v2.8.3.html`
- Size: 908,988 bytes
- SHA-256: `b71e1832989082c4aa2ea218dd0200ef16c9b59319b53efc78c3c2a2c1b85818`

The asset is built from `main` by `tools/build-single-file.js` and is byte-reproducible: rebuilding from
the same source produces an identical file, so the checksum above verifies any downloaded copy.
