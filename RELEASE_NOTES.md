# TAM Intelligence OS v2.8.4 — Monthly Plan Result Integrity

**Release Name:** Monthly Plan Result Integrity

## Summary
A correctness release from one bounded sprint, **SPR-082**. Committing a Monthly Plan previously ignored
whether its two writes actually succeeded — it marked the plan committed and reported success without
inspecting either result, the same class of defect SPR-079 fixed for multi-dataset saves and SPR-081
fixed for Payroll posting. The commit now inspects both results, reports failure honestly, keeps the
preview on screen so the user can see what was involved, and Integrity Check surfaces the partial state
that previously went undetected.

No schema change, no new or renamed storage key, no data migration, and **no change to how or when data
is written**. No historical record is rewritten.

> **This release adds no atomicity and no rollback.** The Monthly Plan commit still writes two storage
> keys sequentially — finance transactions first, then monthly plans — and the browser provides
> atomicity for a single key only. A failure therefore means *the commit did not complete successfully*
> — **not** *nothing was written*. The earlier write in the sequence may well have persisted. Reloading
> reads whatever storage keys successfully persisted; it does not restore a complete prior state. **No
> rollback, compensating action, or transaction abstraction was introduced.** Manual review is the
> current operational response.

## Changed
- **The commit inspects both persistence results.** `commitMonthlyPlan` captures and strictly inspects
  both of its writes. Success requires both. Failure returns a typed `MonthlyPlanPersistenceFailed`
  outcome naming the first failed step in the fixed write order (`failedStep`, deterministic), every
  failed step, the steps that completed (`completedSteps`), whether partial persistence occurred
  (`partialPersistence`), and a `RunIntegrityCheckAndReview` recovery hint. The write order and the
  write mechanics themselves are unchanged.
- **The write order and attempt-all behavior are retained.** Transactions are still persisted **before**
  monthly plans, and a failing first write still does not abort the second — so the failure matrix is
  unchanged. What changed is that neither result is discarded.
- **A failed commit shows no completion behavior.** The result is inspected **before** any completion
  behavior runs. There is no success toast when persistence is incomplete.
- **The preview stays on screen after a failed commit.** Clearing the preview is completion behavior —
  it discarded exactly the rows the user was committing, at the moment they were being told to review
  the data manually. The failure branch now retains the preview so those rows remain visible.
- **The failure message tells the user what to do.** It states that the commit did not complete, that
  some data may already have been saved, and that Integrity Check should be run and the Monthly Plan and
  Finance transaction reviewed before retrying. It deliberately never claims a rollback, because none
  happened.

## Added
- **Integrity Check reports orphaned Monthly Plan transactions as Critical.** A new
  `monthlyplan-orphan-transaction` rule fires for a non-payroll Finance transaction carrying a
  `monthlyPlanId` in either broken-linkage direction:
  - the **referenced monthly plan is absent entirely** — the state left when the commit created the
    month's plan for the first time and only the transactions write landed; and
  - the **plan exists but does not list the transaction** in `committedTxnIds` — the missing backlink.

  Payroll-sourced transactions are deliberately out of scope; they remain owned by
  `payroll-orphan-transaction` and `payroll-missing-monthlyplan`.
- **`corrupt-plan-ref` remains responsible for the opposite direction** — a monthly plan whose
  `committedTxnIds` point at transactions that do not exist. It is unchanged, and it could never see the
  states the new rule detects, because it walks `committedTxnIds` and those ids were never added.
- `tools/verify-monthlyplan-runtime.js` (**118 checks**) — all-succeed; each of the two writes failing;
  reload-state retry for both partial states rebuilt from only the keys that actually persisted; and
  proof that the slice introduces no snapshot, restore, unit of work, coordinator, journal, or schema
  change, and that no user-facing message claims a rollback.

## Retry behavior — what it does and does not do
**Retry is idempotent for transaction creation only. It reconciles no transaction–plan linkage.** Both
residual states below are reload-state proven by the runtime harness and **remain detectable after a
successful retry**. Neither is resolved by this release; the current operational response to each is
**manual review**.

- **Scenario A2 — the monthly plan was created by the failing commit and only the transactions write
  landed.** After reload the transactions return carrying a `monthlyPlanId` that points at no existing
  plan, and `monthlyplan-orphan-transaction` fires as Critical. Rebuilding the preview recognises those
  rows as duplicates, so a retry **creates no duplicate planned transaction**. Because they are skipped
  as duplicates, they are **never linked** to the newly created plan — the new plan lists no
  transactions — so **the Critical finding remains after the retry succeeds**.
- **Scenario B — only the monthly plans write landed.** After reload no transactions exist, the plan is
  marked `Committed`, its `committedTxnIds` are dangling, and `corrupt-plan-ref` fires. Retry is
  reachable and creates the missing transaction under a **new id**. The stale dangling ids **remain on
  the plan** — nothing removes them — so `corrupt-plan-ref` still stands and **the commit reports
  success while that integrity finding remains**.

## Compatibility & Data Safety
- `SCHEMA_VERSION`: **unchanged (6)**. Storage keys: **unchanged (15)**. No migration was added or re-run.
- **No persisted data shape changed.** This release changes result *inspection*, failure *reporting*, and
  *detection* — not what is written or in what order. Existing data is fully compatible.
- Committed payroll remains immutable; no committed total or posted transaction is modified.
- Failure messages state that the commit did not complete. They deliberately never claim a rollback,
  full restoration, or that nothing was written.
- No coordinator, unit of work, transaction manager, batch persistence, journal, recovery marker, or
  retry framework was introduced. The application remains client-only per `CLAUDE.md` §4.3.

## Known Limitations
- **The Monthly Plan commit is still not atomic.** It still writes two storage keys sequentially.
  Checking the results makes failure *visible*; it does not make the commit all-or-nothing.
- **No rollback or compensation exists.** Nothing undoes the write that already landed when the other
  write fails.
- **Integrity Check detects but does not repair.** `monthlyplan-orphan-transaction` and
  `corrupt-plan-ref` report that a partial state exists and where it is. They do not fix it, and they do
  not block the underlying operation.
- **Retry does not reconcile linkage.** Scenarios A2 and B remain documented residual states in which a
  finding survives a successful retry. Stale `committedTxnIds` are not removed, and pre-existing
  transactions are not linked to a newly created plan. **Manual review is the current operational
  response.**
- Payroll posting remains non-atomic with the residuals documented in v2.8.3; nothing in Payroll posting
  changed here.
- Smart Import undo retains its in-memory/storage divergence and takes no pre-operation backup.
- Payroll rows persisted by the retired Payroll Planning path keep a non-canonical stored value. They are
  read correctly everywhere; a remediation migration remains unauthorised.
- Supplemental source remains **overtime only**.
- Projects / Vendors / Financial Calendar remain non-functional placeholders (labeled **SOON**).
- The tracked company workbook remains a documented, accepted exception (untouched).

## QA
- Build: `dist/tam-intelligence-os-v2.8.4.html`, byte-identical on rebuild from clean `main`.
- Verify: **1267 checks** — no weakened checks.
- Runtime: **118** (Monthly Plan commit result integrity) + **106** (Payroll posting) + **61**
  (`saveAllData` result integrity) + **67** (Contract renewal) + **72** (Payroll committed state) =
  **424**. The monthly-plan harness drives the live engine and the commit caller: all-succeed; each of
  the two writes failing; both partial states rebuilt from storage through the app's own `loadState()`
  so the retry is a genuine reload path rather than an in-memory continuation; proof that the retry
  creates no duplicate transaction and that the integrity finding nevertheless remains; and proof that
  the failure branch retains the preview and emits no success toast.
- Browser: modular source and portable build both boot with **zero console errors**; a fresh install
  seeds no data.

## Git Information
- Release tag: `v2.8.4` *(not yet created)*
- Release branch: `main`
- Publication channel: GitHub Releases
- Contributing commits:
  - `9246750` — fix(monthly-plan): check both persistence results and detect orphan plan transactions (SPR-082)
  - `4051e4b` — test(monthly-plan): prove reload-state retry for both partial states (SPR-082)
  - `c416c87` — docs: synchronize architecture records for v2.8.4 (SPR-083)

## Release Asset
- Asset: `tam-intelligence-os-v2.8.4.html`
- Size: 914,409 bytes
- SHA-256: `09c622b3a692dab426e8ef517592aa55f898d75560972c6d661e7bda3eaa02c6`

The asset is built from `main` by `tools/build-single-file.js` and is byte-reproducible: rebuilding from
the same source produces an identical file, so the checksum above verifies any downloaded copy.
