# TAM Intelligence OS v2.6.8 — Payroll Selection and Overtime Drift UX Fixes

**Release Name:** Payroll Selection and Overtime Drift UX Fixes

This is a **targeted UX / correctness** release for the Payroll Workspace and Overtime modules.
It changes **no payroll status rules, no committed-payroll immutability, no business calculations,
no storage keys, no migration flags, and does not change SCHEMA_VERSION (6)**.

## Changed — Generic payroll bulk-selection model (Issue 1)
- **The selection is now generic (stage-agnostic).** Select All and the header "select all shown"
  checkbox select **all visible rows**, and the selected count is the **actual** number of selected
  rows. Every visible stage is selectable, so future actions (Export, Delete, …) can reuse the same
  selection without changing the model.
- **Each bulk action determines its own eligible rows** and reports **eligible / skipped / reason**,
  via one registry (`PAYROLL_BULK_ACTIONS`) + `partitionPayrollSelection(ids, action)`:
  - **Review Selected** → eligible **Draft**
  - **Approve Selected** → eligible **Draft, Review**
  - **Post to Finance** → eligible **Approved**
- This removes the original *"16 selected → 0 approved"* confusion. Example result:
  *"Approved 3 payroll(s). 2 skipped — 1 already at Posted stage; 1 already at Executed stage."* When
  nothing eligible is selected: *"No selected rows are eligible for Approve. Approve applies only to
  Draft and Review payroll."* Post to Finance reports rows skipped for not being Approved alongside
  any commit blockers, each with its reason.
- The header checkbox stays synchronized with the visible rows (checked / indeterminate / unchecked,
  disabled when none); each action auto-disables when the period has no row eligible for **that**
  action; a helper hint and per-button tooltips document each action's eligible stages.

## Fixed — Overtime drift visibility (Issue 2)
- Approving overtime **after** payroll already exists now shows an **immediate** warning — with **no
  need to click Generate Payroll first** — in three places: the **Overtime page**, the **Payroll
  Workspace**, and **Payroll Detail**.
  - Draft / Review / Approved payroll: *"Overtime approved. Regenerate payroll to include the
    updated overtime."*
  - Posted / Executed payroll: *"Approved overtime was added after payroll was posted. The original
    payroll remains unchanged. A supplemental payment will be required."* — with a **disabled**
    "Supplemental Payment (Coming in a future release)" placeholder.
- A live **"OT drift" / "OT after posting"** pill also appears on the affected worksheet rows.

## Changed
- `APP_VERSION` → `2.6.8`, `APP_RELEASE_NAME` → "Payroll Selection and Overtime Drift UX Fixes"
  (propagates to the title, About/Release Notes, diagnostics, report headers, export filenames, and
  the version-derived dist filename). CHANGELOG and About Release Notes updated.

## Guarantees
- **Posted and Executed payroll stays fully immutable** — payroll totals and posted/executed
  transactions are never modified. The drift warning only *surfaces* that a supplemental payment is
  needed.
- The drift warning is **derived** from existing overtime-comparison logic
  (`approvedOvertimeForMonth` + `sameIdSet`) via a new read-only `payrollOvertimeDrift(pp)`. No
  stored flag is introduced, so it **appears immediately, survives reload, and never duplicates**.
- **Supplemental Payment is intentionally deferred** to a future release (disabled placeholder only).

## Data Safety
- SCHEMA_VERSION: **unchanged (6)**.
- Storage keys / migration flags: **unchanged**.
- Backup format: **unchanged**.
- Module load order and the classic-script module architecture: **unchanged**.

## QA
- **Automated:** `node tools/build-single-file.js` → `dist/tam-intelligence-os-v2.6.8.html`;
  `node tools/verify-build.js` → all checks pass.
- **Browser-tested:** modular source and portable dist both boot with **zero console errors**;
  payroll-selection and overtime-drift scenarios exercised (all Draft / all Review / mixed / all
  Posted / all Executed / Select All / header / row / filters / clear; approve before generation and
  while Draft / Review / Approved / Posted / Executed).

## Known Limitations
- **Supplemental Payment** is not implemented in v2.6.8 — the Posted/Executed drift banner links only
  to a disabled placeholder.
- The tracked company workbook `Rencana Penggunaan Dana Juli 2026.xlsx` remains in the repository
  (documented, accepted security warning); it is unchanged by this release.

## Git Information
- Commit: _pending approval (not committed)_
- Tag: _pending approval (not tagged)_
- Branch: main

## Release Asset
- dist/tam-intelligence-os-v2.6.8.html
