# TAM Intelligence OS v2.7.3 — Supplemental-Aware Payroll History

**Release Name:** Supplemental-Aware Payroll History

## Summary
A reporting/presentation patch so that Employee Detail → **Payroll History** correctly represents a
month that also has a **Supplemental Payment**. Previously such a month showed only the immutable base
payroll (e.g. Base Rp8.000.000 · Overtime Rp0 · Total Rp8.000.000) while the employee had actually also
received a Rp2.000.000 supplemental — technically correct but misleading. This release adds a read-only
**Total Compensation** view without changing any calculation, persistence, finance behaviour, schema, or
storage key, and without rewriting any historical record.

## Added
- **`payrollTotalCompensation(pp)`** — a read-only reporting aggregate that combines the immutable
  `payrollHistoricalSnapshot()` with the committed supplementals linked to the same plan. It never
  mutates anything and never redefines the base total: `baseTotal` stays exactly
  `payrollHistoricalSnapshot().totalPayroll`, and Total Compensation = Base Payroll + Payroll Overtime +
  committed (Posted/Executed) supplementals. Supplemental amounts follow the same "committed transaction
  is authoritative" rule (actual for Executed, planned for Posted, fallback to the frozen amount).

## Changed
- **Payroll History (Employee Detail)** columns are now **Base Payroll · Payroll OT · Supplemental ·
  Total Compensation · Stage**. The Supplemental cell shows the amount plus a document count
  (e.g. "2 Supplementals"); a subtle **Pending** figure appears when Draft/Review/Approved supplementals
  exist and is **excluded** from Total Compensation; Cancelled is ignored. A short note reads: "Total
  Compensation includes committed (Posted/Executed) Supplemental Payments. Base Payroll always remains
  immutable." The separate itemised Supplemental Payments card is unchanged and complements the table.
- **Integrity Check wording** now distinguishes a **legacy (pre-v2.7.1)** Posted/Executed supplemental
  with no frozen source snapshot (an **informational** finding — display-only, payment and amount
  unaffected) from one approved under **v2.7.1+** that is genuinely missing its snapshot (a **warning**
  to investigate). No legitimate issue is hidden and nothing is auto-repaired.
- `APP_VERSION` → `2.7.3`, `APP_RELEASE_NAME` → "Supplemental-Aware Payroll History".

## Compatibility & Data Safety
- **Reporting/presentation only.** No persistence, finance, payroll, schema, or storage-key change; no
  migration. `payrollHistoricalSnapshot()` is unchanged and remains the immutable source of truth; base
  payroll and its finance transaction are never modified. Total Compensation is derived at render time.
- `SCHEMA_VERSION`: **unchanged (6)**. Storage keys: **unchanged (15)**.

## QA
- Build: `dist/tam-intelligence-os-v2.7.3.html`. Verify: **188 checks** (no weakened checks;
  reporting-helper, column, pending-exclusion, and legacy/modern integrity checks included).
- Browser (portable dist): scenarios covered — no supplemental, Posted, Executed, multiple
  supplementals, pending, and legacy-without-snapshot — with **zero console errors** on a clean boot; no
  double counting; base payroll immutable; pending excluded from Total Compensation; reload persistence
  intact.

## Known Limitations
- Total Compensation is an Employee-Detail reporting view; a consolidated cross-employee payroll report
  remains future work.
- Supplemental source remains **overtime only**.
- Projects / Vendors / Financial Calendar remain non-functional placeholders (labeled **SOON**).
- The tracked company workbook remains a documented, accepted exception (untouched).

## Git Information
- Release commit (tagged): 97b8e89fa708b7b187f0c02a397d26c73983d063
- Tag: v2.7.3 (annotated)
- Branch: main

## Release Asset
- dist/tam-intelligence-os-v2.7.3.html (776,541 bytes)
