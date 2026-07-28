# TAM Intelligence OS v2.6.9 — Enterprise Banking Foundation

**Release Name:** Enterprise Banking Foundation

## Summary
Establishes the banking foundation: a reusable Indonesian Bank Master, structured Company Bank
Accounts, and improved employee banking — with legacy compatibility and account-number masking.
This is a data-model + UI release; it adds **one** additive storage key and does **not** change
`SCHEMA_VERSION`. Supplemental Payment is intentionally deferred to **v2.7.0**.

## Highlights
- **Indonesian Bank Master** — one grouped, alphabetized, reusable constant (no storage key).
- **Company Bank Accounts** — a Settings → Bank Accounts CRUD page; masked account numbers; only
  Active accounts appear in transaction dropdowns ("Label — Bank").
- **Employee banking** — bank chosen from the master, new Account Holder field, legacy values mapped.
- **Backward compatible** — legacy strings resolve; a guarded seed runs only on installs with data.

## Added
- Bank Master (`BANK_MASTER_GROUPS` / `INDONESIAN_BANKS`): State, Private, Digital, Islamic (Syariah),
  Regional (BPD), International, and "Other Bank" — alphabetized within each group.
- Company Bank Accounts store `tam_company_accounts_v1` with a full management page (create / edit /
  deactivate / archive / search / filter). Fields: Account Label, Bank, Account Holder, Account
  Number (masked), Purpose, Status.
- Employee **Account Holder** field; employee **Bank** dropdown sourced from the Bank Master.
- Activity Log events for bank-account create/edit/status (reusing `tam_audit_log_v1`).

## Changed
- Transaction (Add/Execute), transactions filter, recurring expenses, and default-bank setting now
  list only **Active** company accounts.
- Complete Backup / Restore include `companyAccounts`.
- `APP_VERSION` → `2.6.9`, `APP_RELEASE_NAME` → "Enterprise Banking Foundation".

## Fixed
- None (feature release). Reconciled the employee `bankAccount` / `bankAccountNumber` field naming so
  both readers stay consistent going forward.

## Security
- Bank account numbers are **masked** everywhere except their own edit field (last 4 shown). No PIN,
  OTP, password, or token is ever stored. No account data is transmitted (client-only).

## Compatibility
- Runs in the browser (modular source or portable single file); no backend.
- Existing local data: **fully compatible**. Legacy bank strings on transactions and employees keep
  resolving; employee legacy bank names map to the master; unknown values are preserved.
- `SCHEMA_VERSION`: **unchanged (6)**.

## Data Safety
- SCHEMA_VERSION: **unchanged (6)**.
- Storage keys: **13 → 14** (added additive `tam_company_accounts_v1`); none renamed or removed.
- Migration flags: added `tam_migrated_bankaccts_v269` (one-time company-account seed).
- Backup format: extended additively with `companyAccounts`; older backups restore cleanly.

## Migration
- **Additive store** `tam_company_accounts_v1` defaults to `[]`.
- **One-time, guarded, non-destructive seed** (`tam_migrated_bankaccts_v269`): converts the five
  legacy bank strings into Active company accounts **only when the install already has data**. A
  fresh install stays empty. Existing account data is never overwritten. No `SCHEMA_VERSION` change.

## QA
- Build: `dist/tam-intelligence-os-v2.6.9.html`.
- Verify: **114/114 checks** (13 legacy keys vs the v2.5.2 golden master + new-key/seed-flag/Bank-Master
  checks; SCHEMA_VERSION still 6).
- Browser (modular + dist), **zero console errors**: Bank Accounts CRUD, search/filter, masking (no
  full number in lists); employee bank mapping + preservation + masked detail; transaction/recurring
  dropdowns list only Active accounts with legacy values preserved; seed migration (fresh→empty,
  with-data→seeded, idempotent); Complete Backup round-trip incl. company accounts and older-backup
  tolerance.

## Regression
- Payroll generic selection, overtime drift banners, execution, Smart Import / dedup, existing
  transactions with legacy bank strings — all unaffected.

## Known Limitations
- **Supplemental Payment** is not implemented (planned for v2.7.0); the v2.6.8 overtime-drift warning
  and disabled placeholder are unchanged.
- Employee CSV export still contains the full account number (existing behavior; not masked in
  export).
- The tracked company workbook remains a documented, accepted exception (unchanged).

## Git Information
- Commit: 889c2accdeefbeeafd5040909353e40d9869c488
- Tag: v2.6.9
- Branch: main

## Release Asset
- dist/tam-intelligence-os-v2.6.9.html
