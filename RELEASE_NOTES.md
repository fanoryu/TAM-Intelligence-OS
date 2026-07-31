# TAM Intelligence OS v2.7.1 — Payroll Integrity & Reporting Foundation

**Release Name:** Payroll Integrity & Reporting Foundation

## Summary
A controlled post-release integrity fix. Posted/Executed payroll (and supplemental) display now derive
from a single **stage-aware historical source-of-truth** helper backed by **immutable snapshots frozen
at posting** — historical figures are never reconstructed from current contract/overtime data, and a
visible **integrity notice** appears when a legacy plan disagrees with its committed transaction. No
historical payroll or finance amount is auto-repaired. Adds **no** storage key (still **15**) and does
**not** change `SCHEMA_VERSION` (still **6**).

## Highlights
- **Root-cause fix** for the reported Rp7,000,000-vs-Rp8,750,000 mismatch: every payroll consumer read
  live plan values instead of the immutable committed transaction. A new `payrollHistoricalSnapshot`
  helper centralizes stage-aware display: Draft/Review/Approved use working-plan values;
  Posted/Executed use committed evidence (explicit snapshot → linked transaction → committed plan
  fields), with a "Payroll snapshot mismatch" notice on disagreement. The posted transaction is never
  altered.
- **Immutable overtime snapshots** frozen at posting (on the transaction and the plan); Supplemental
  freezes a source-overtime snapshot at Approved. Historical detail survives later edit/deletion of
  the source overtime. Unknown legacy hours render **"— / unavailable"** (distinct from an explicit 0).
- **Supplemental hardening:** Posted notes are immutable; a **global** duplicate guard prevents one
  overtime ID being captured by more than one non-cancelled supplemental across *all* payroll plans;
  coordinated posting persistence prevents orphaned transaction/supplemental linkage.
- **Company settings onboarding:** completion now uses an explicit persisted marker
  (`companySettingsConfiguredAt`) set only after a successful save, with a conservative legacy fallback.
- **Execution Center deep-link:** "Open in Execution Center" now reveals and highlights the exact
  linked transaction (regardless of date bucket), with a clear warning if it is missing.
- **Empty company-account UX** when posting a supplemental; **12 new integrity checks** for
  payroll/supplemental linkage and snapshot consistency (detect-only, never auto-repair).

## Changed
- `APP_VERSION` → `2.7.1`, `APP_RELEASE_NAME` → "Payroll Integrity & Reporting Foundation".
- Payroll Detail, worksheet rows, period totals/summary, and CSV export are stage-aware and consistent.
- `persist()` and `saveSettings()` now return their success flag for coordinated persistence.

## Compatibility & Data Safety
- Existing local data: **fully compatible**. No base-payroll/finance amount is auto-changed; legacy
  records missing a snapshot fall back to the strongest available committed evidence and show a notice.
- `SCHEMA_VERSION`: **unchanged (6)**. Storage keys: **unchanged (15)** — none added, renamed, or
  removed. `companySettingsConfiguredAt` is a field inside the existing settings object, not a key.
- Backup format: additive fields only (`committedSnapshot`, `overtimeSnapshot`, `sourceOvertimeSnapshot`,
  `companySettingsConfiguredAt`); older backups restore cleanly. Demo Data does not mark company
  settings complete (consistent with the existing onboarding policy).

## QA
- Build: `dist/tam-intelligence-os-v2.7.1.html`. Verify: **166 checks** (adds v2.7.1 source-of-truth,
  snapshot, supplemental global-dedup, Posted-notes immutability, deep-link, integrity-check, settings
  marker, and released-v2.7.0-artifact-untouched checks; SCHEMA_VERSION 6, 15 keys).
- Browser (modular + portable dist), **zero console errors** on boot.

## Known Limitations
- Reporting expansion is deliberately deferred until the historical source-of-truth model is validated
  in production; v2.7.1 establishes the foundation and integrity diagnostics only.
- Supplemental source remains **overtime only**; other adjustment types are out of scope.
- Projects / Vendors / Financial Calendar remain non-functional placeholders (labeled **SOON**).
- The tracked company workbook remains a documented, accepted exception (untouched).

## Git Information
- Release commit (tagged): 488145ff6cc6cc69fc22942915347e55253050e6
- Release content commit: b9bd3628f9b8d44185325e5c7910ab53c17f4ec5 ("Release v2.7.1"); the tag was
  advanced by one CI-only verifier fix (`fix(verify): accept release dist-swap state`) so the
  published build passes 166/166. No runtime/source behavior differs between the two commits.
- Tag: v2.7.1 (annotated)
- Branch: main

## Release Asset
- dist/tam-intelligence-os-v2.7.1.html (762,060 bytes)
