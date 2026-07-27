# Data Safety — TAM Intelligence OS

TAM Intelligence OS stores finance, payroll, employee, and contract data **locally** — in the
browser's `localStorage` (standalone file) or the Claude Artifact storage environment. Data never
leaves the device on its own. These invariants protect that data across releases.

## Invariants that must not change accidentally

The verifier (`node tools/verify-build.js`) enforces these; a release must not break them unless the
change is an **intentional, documented migration**:

- **`SCHEMA_VERSION = 6`** — the persisted-data schema version.
- **Storage keys** (13) — e.g. `tam_txns_v1`, `tam_settings_v1`, `tam_employees_v1`,
  `tam_contracts_v1`, `tam_payroll_plans_v1`, `tam_overtime_records_v1`, `tam_audit_log_v1`, etc.
- **Migration flags** — e.g. `tam_migrated_hr_v22`, `tam_migrated_overtime_v23`, `tam_v23_ack`, etc.
- **Empty seed data** — the shipped build contains no records (`<script id="seed-data">[]</script>`).
- **Backup format** — the Complete Backup JSON shape used by export/restore.

## If you must migrate the schema

1. Increment `SCHEMA_VERSION`.
2. Add a migration that transforms old data forward, guarded by a new migration flag so it runs once.
3. Never rename or drop an existing storage key without a migration that reads the old key.
4. Update the verifier expectations and document the migration in `CHANGELOG.md` and the PR.
5. Test with **real-shaped** (fabricated) legacy data to confirm no data loss.

## Backups

- **Complete Backup** (Settings → Data Portability) exports all transactions, settings, and backups
  as one JSON file. It is the user's primary recovery path.
- Destructive actions create automatic safety backups first: **Restore**, **Employee Merge**, and
  **Smart Import** each snapshot current data before changing anything. **Start Fresh** forces a
  full backup download and a typed confirmation before clearing.
- The audit log (`tam_audit_log_v1`) intentionally survives a data reset.

## Handling real company data

- **Do not commit real data.** No employee names, salaries, contracts, bank details, or Complete
  Backup JSON in the repository, issues, PRs, logs, or screenshots. Use fabricated placeholders.
- Backup JSON exports and uploaded workbooks are **sample-data-policy** artifacts — keep them out of
  version control (see `.gitignore`).
- If real data is ever committed, treat it as an incident: follow `SECURITY.md`, remove it from
  history, and notify the data owner at PT Total Asset Manajemen.

## Privacy posture

- No network calls carry user data; the app runs entirely client-side (external CDN is used only for
  the XLSX parser and fonts).
- Exports (CSV / JSON) are generated locally and downloaded by the user; they are never transmitted.
