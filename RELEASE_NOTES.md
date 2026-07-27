# TAM Intelligence OS v2.6.7 — Enterprise Repository & Delivery Foundation

**Release Name:** Enterprise Repository & Delivery Foundation

This is an **engineering, repository-governance, and delivery** release. It adds no business
features and changes no application behavior — the runtime is byte-identical to v2.6.6 apart
from the version identity.

## Added
- **GitHub Actions CI** (`.github/workflows/ci.yml`): on every push and pull request to `main`
  (and on demand) it builds the portable file, runs the 109-check verifier, confirms the
  version-derived dist exists, and uploads it as a build artifact. No dependencies are installed.
- **Release workflow** (`.github/workflows/release.yml`): triggered by `v*` tags. It rebuilds,
  verifies, re-derives the version from `APP_VERSION`, **refuses to publish unless the tag equals
  `v<APP_VERSION>`** and the portable HTML exists, then creates/updates the GitHub Release and
  uploads the portable HTML — idempotently (no duplicate releases).
- **Repository governance:** issue templates (bug report / feature request + config), a pull
  request template, `CODEOWNERS` (@fanoryu), `SECURITY.md`, `CONTRIBUTING.md`,
  `CODE_OF_CONDUCT.md`, a proprietary `LICENSE-NOTICE.md`, a release-notes template, and
  enterprise docs (`docs/QA-CHECKLIST.md`, `docs/RELEASE-PROCESS.md`, `docs/DATA-SAFETY.md`).
- **README badges:** CI status, latest release, current version, and proprietary status.

## Changed
- `APP_VERSION` → `2.6.7`, `APP_RELEASE_NAME` → "Enterprise Repository & Delivery Foundation"
  (propagates to the title, About, diagnostics, report headers, export filenames, and the
  version-derived dist filename). Release Notes, README, ARCHITECTURE, and CHANGELOG updated.
- Hardened `.gitignore` / `.gitattributes` to keep secrets, `.env` files, local backups, and
  uploaded evidence out of version control; documented a sample-data policy.

## Fixed
- None (no application code paths changed).

## Security
- Added a private vulnerability-reporting policy (`SECURITY.md`) and disabled blank public issues,
  routing security reports to GitHub Security Advisories.
- Repository-hygiene rules prevent common secret/PII categories (`.env`, credentials, tokens,
  backup JSON, uploaded evidence, private workbooks) from being committed.
- **Open finding (see QA):** the real company workbook `Rencana Penggunaan Dana Juli 2026.xlsx`
  is currently tracked in git history. It is not deleted automatically; safe removal is
  recommended before/with this release.

## Data Safety
- SCHEMA_VERSION: **unchanged (6)**.
- Storage keys / migration flags: **unchanged**.
- Backup format: **unchanged**.
- Module load order and the 44-module classic-script architecture: **unchanged**.

## QA
- **Automated:** `node tools/build-single-file.js` → built `dist/tam-intelligence-os-v2.6.7.html`;
  `node tools/verify-build.js` → **109/109 checks pass**; PowerShell fallback derives the same version.
- **Browser-tested:** modular source and portable dist both boot with **zero console errors**
  (sidebar mounts, 25 nav items, title = v2.6.7).
- **Source-inspected:** the diff is confined to the version constants, the Release Notes entry, the
  regenerated dist, and new non-runtime files (`.github/**`, root governance docs, `docs/**`).
- **Unable to verify locally:** GitHub Actions execution (requires a push); workflow YAML is
  syntax-validated locally.

## Regression
- Application runtime unchanged vs v2.6.6 (only the version identity differs); the v2.6.6 QA pass
  (payroll/overtime/execution calculations, Smart Import + duplicate prevention, dedup,
  backup/restore, Activity Log, Settings, themes, floating menus, search focus, scroll) remains valid.

## Known Limitations
- CI/release workflows cannot be executed locally; first real run happens on push (recommended:
  a temporary test branch after approval).
- Branch protection is **recommended, not auto-applied** (see the RC summary) to avoid locking out
  the sole owner.
- The tracked company workbook requires an ownership decision before publishing.

## Git Information
- Commit: _pending approval_
- Tag: v2.6.7
- Branch: main

## Release Asset
- dist/tam-intelligence-os-v2.6.7.html
