# TAM Intelligence OS v2.7.0 — Supplemental Payroll Engine

**Release Name:** Supplemental Payroll Engine

## Summary
Introduces Supplemental Payments — a separate accounting document that settles overtime approved
**after** the base payroll became immutable (Posted/Executed). The base payroll total, its finance
transaction, and its execution history are never modified. Adds **one** additive storage key and does
**not** change `SCHEMA_VERSION`. Source in v1 is overtime only.

## Highlights
- **Supplemental Payment** entity with a full lifecycle: Draft → Review → Approved → Posted → Executed.
- The v2.6.8 overtime-drift warning is now **actionable** — generate/settle a supplemental in a click.
- Reuses existing systems: the drift amount, the finance transaction model, and the Execution Center.
- Rigorous **duplicate prevention** — an overtime record is never paid twice; frozen records are never mutated.
- Housekeeping: feature-status registry (no more hardcoded "Preview" badge), masked employee CSV, count-neutral CI labels.

## Added
- **Supplemental Payments** module (`js/people/supplemental-engine.js`) + store
  `tam_supplemental_payments_v1`. Model: `{ id, employeeId, payrollPlanId, payrollPeriod, sourceType,
  sourceOvertimeIds, amount, status, companyAccountId + snapshots, financeTransactionId, executionId,
  notes, timestamps, createdBy, auditVersion }`. Source type v1: `overtime_drift` only.
- New **Supplemental Payments** page (list / search / filter by status·period·employee / detail /
  lifecycle actions with skipped/disabled reasons). Payroll Detail and Employee Detail show related
  supplementals separately from base payroll. Activity Log labels for all `supplemental.*` events.
- Actionable overtime-drift banner (Generate / Open) in Payroll Workspace, Payroll Detail, Overtime.
- **Feature lifecycle registry** replacing the hardcoded sidebar badge; masked general employee CSV export.

## Changed
- Overtime-drift committed banner: the disabled placeholder is replaced by real Generate/Open actions.
- CI/Release "Verify build" step labels are count-neutral.
- `APP_VERSION` → `2.7.0`, `APP_RELEASE_NAME` → "Supplemental Payroll Engine".

## Fixed
- Resolved the known employee-CSV limitation: bank-account numbers are now masked in the general export.

## Security
- Bank-account numbers are masked everywhere outside their own edit field, including the general CSV
  export; no PIN/OTP/password/token stored; account snapshots are immutable after posting. No
  supplemental data or account numbers are transmitted (client-only).

## Compatibility
- Runs in the browser (modular source or portable single file); no backend.
- Existing local data: **fully compatible**. No base-payroll data is touched. Fresh installs start
  with an empty supplemental store (no seed).
- `SCHEMA_VERSION`: **unchanged (6)**.

## Data Safety
- SCHEMA_VERSION: **unchanged (6)**.
- Storage keys: **14 → 15** (added additive `tam_supplemental_payments_v1`); none renamed or removed.
- Backup format: extended additively with `supplementalPayments`; older backups restore cleanly.

## Migration
- **Additive store** `tam_supplemental_payments_v1` defaults to `[]`. **No migration and no seed** —
  supplementals are created explicitly by the user from an overtime-drift warning.

## QA
- Build: `dist/tam-intelligence-os-v2.7.0.html`. Verify: **129 checks** (adds supplemental key/count,
  lifecycle constants, linkage, feature-registry, count-neutral workflow labels; SCHEMA_VERSION 6).
- Browser (modular + dist), **zero console errors**: foundation (15 keys, reload, backup round-trip,
  old-backup restore); generation (posted/executed base + late OT, no-eligible, repeated, refresh,
  frozen records, new-record-after-freeze, no double-count); lifecycle (all valid/invalid
  transitions, idempotent); finance (one Planned txn, both-way links, snapshot vs rename, base
  byte-stable); execution (execute once, repeat blocked, actual/history linked, base untouched);
  UI (list/detail, payroll & employee integration, actionable banner, Activity Log labels, no
  account-number leaks); feature badges (SOON/none) and masked CSV.

## Regression
- Payroll generic selection, overtime drift, execution, Smart Import/dedup, company accounts, and
  existing transactions — all unaffected. Base payroll transactions verified byte-stable.

## Known Limitations
- Source is **overtime only**; bonuses/reimbursements/arbitrary adjustments are out of scope (the
  engine is designed to extend later).
- Projects / Vendors / Financial Calendar remain non-functional placeholders (labeled **SOON**).
- No dedicated full-account "payment file" export exists; the general employee CSV is masked.
- The tracked company workbook remains a documented, accepted exception (untouched).

## Git Information
- Commit: <pending approval>
- Tag: v2.7.0
- Branch: main

## Release Asset
- dist/tam-intelligence-os-v2.7.0.html
