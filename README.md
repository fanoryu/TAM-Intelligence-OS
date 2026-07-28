# TAM Intelligence OS

**Integrated Management Intelligence for PT Total Asset Manajemen** — a single-page finance,
payroll, and operations workspace that runs entirely in the browser, with no backend and no runtime
dependencies.

[![CI](https://github.com/fanoryu/TAM-Intelligence-OS/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/fanoryu/TAM-Intelligence-OS/actions/workflows/ci.yml)
[![Latest release](https://img.shields.io/github/v/release/fanoryu/TAM-Intelligence-OS?sort=semver&display_name=tag&label=release)](https://github.com/fanoryu/TAM-Intelligence-OS/releases/latest)
![Version](https://img.shields.io/badge/version-2.6.9-blue)
![License](https://img.shields.io/badge/license-proprietary%20%26%20confidential-red)
![JavaScript](https://img.shields.io/badge/JavaScript-vanilla%20%C2%B7%20no%20framework-f7df1e)
![HTML](https://img.shields.io/badge/HTML-single--file%20app-e34f26)
![Repository](https://img.shields.io/badge/repository-private-lightgrey)

> **Proprietary & confidential.** This repository is private and **not** open source — see
> [`LICENSE`](LICENSE) and [`PROPRIETARY-LICENSE-NOTICE.md`](PROPRIETARY-LICENSE-NOTICE.md). Do not commit real company,
> employee, payroll, or backup data.

---

## Overview

TAM Intelligence OS is an internal operations tool for **PT Total Asset Manajemen**. It manages the
monthly cycle for finance and people operations — employees and contracts, overtime, payroll
generation and posting, transaction execution, cash flow, budgeting, and reporting — as one
self-contained HTML application.

Design principles:

- **Client-side only.** All data is stored locally in the browser's `localStorage` (or the Claude
  Artifact storage environment). Nothing is sent to a server; there is no backend, database, or API.
- **No build framework, no dependencies.** The app is plain HTML, CSS, and classic-script JavaScript
  sharing one global scope. Node.js is used **only** for the build/verify tooling, never to run the
  app. The only external network references are the XLSX parser and web fonts (CDN).
- **Two shippable forms.** A modular development source and a single portable HTML file that behaves
  identically.
- **Data-safety first.** A 114-check verifier guards the persisted-data schema, storage keys,
  migration flags, and build fidelity on every change.

---

## Current release

**v2.6.9 — Enterprise Banking Foundation** · `SCHEMA_VERSION` 6

- **Indonesian Bank Master** — one grouped, alphabetized, reusable constant (State / Private /
  Digital / Islamic / Regional / International + "Other Bank"); no storage key, no duplicated arrays.
- **Company Bank Accounts** — a Settings → Bank Accounts page (create / edit / deactivate / archive /
  search / filter) with masked account numbers; only Active accounts appear in transaction dropdowns
  as "Label — Bank". New additive store `tam_company_accounts_v1` (SCHEMA_VERSION unchanged).
- **Employee banking** — bank chosen from the master, new Account Holder field, legacy values mapped
  and preserved. Backward compatible; a guarded seed runs only on installs that already have data.
- **Supplemental Payment** remains planned for **v2.7.0** (the v2.6.8 overtime-drift warning is
  unchanged).

Download the portable build from the release page:
**[Release v2.6.9](https://github.com/fanoryu/TAM-Intelligence-OS/releases/tag/v2.6.9)** →
`tam-intelligence-os-v2.6.9.html`. See [`CHANGELOG.md`](CHANGELOG.md) and
[`RELEASE_NOTES.md`](RELEASE_NOTES.md) for full history.

Two supported outputs:

| Output | What it is | Where |
|---|---|---|
| **A. Modular development source** | `index.html` + `css/` (5 files) + `js/` (44 classic-script modules across `core/ ui/ finance/ people/ import/ analytics/`), one shared global scope, no ES modules | project root |
| **B. Portable single-file release** | one self-contained HTML file, identical in behavior | `dist/tam-intelligence-os-v2.6.9.html` |

---

## Product capabilities

- **Finance operations** — a transaction ledger with planned vs. actual amounts, an Execution
  Center to execute/schedule/cancel payments, cash-flow and budget views, and a financial calendar.
- **People & payroll** — employees and contracts with work schedules; an operational Payroll
  Workspace running Draft → Review → Approved → Posted → Executed over a read-only worksheet; and a
  TAM-method overtime engine that feeds approved overtime into payroll.
- **Planning & analytics** — a monthly plan generator, planned-vs-actual and month-over-month
  comparisons, trend charts, and an executive dashboard.
- **Data import** — Smart Import extracts employees/contracts/transactions from spreadsheets with
  column mapping, conflict handling, and duplicate prevention.
- **Governance & recovery** — a read-only cross-module Activity Log (audit trail), Complete Backup /
  Restore, CSV exports, and typed-confirmation safeguards around destructive actions.

---

## Feature matrix

Status legend: **Available** = shipped and in use · **Partial** = usable with documented limits ·
**Planned** = on the roadmap, not yet available.

| Module / capability | Status | Notes |
|---|---|---|
| Executive Dashboard | Available | KPI overview, executive insights |
| Finance Overview | Available | Planned vs. actual, status rollups |
| Transactions | Available | Ledger with planned/actual, filters, CSV export |
| Execution Center | Available | Execute / schedule / cancel payments |
| Cash Flow | Available | Inflow/outflow by period |
| Budget Center | Available | Budget vs. actual tracking |
| Employees | Available | Records, work schedules, search/filters; bank from Bank Master, masked account |
| Bank Accounts (Company) | Available | Settings → Bank Accounts: CRUD, purpose/status, masked numbers |
| Indonesian Bank Master | Available | Reusable grouped bank reference (constant, single source) |
| Employee Detail | Available | Profile + contract, payroll & overtime timeline |
| Contracts | Available | Contract lifecycle, coverage per month |
| Payroll Workspace | Available | Draft → Review → Approved → Posted → Executed; generic bulk selection |
| Payroll Detail | Available | Read-only payroll + generated finance transaction |
| Overtime | Available | TAM-method calculation, approval, drift warnings |
| Monthly Plan Generator | Available | Builds the monthly plan from master data |
| Smart Import | Available | Spreadsheet import, column mapping, dedup |
| Activity Log | Available | Read-only cross-module audit trail |
| Reports | Available | Report views and CSV export |
| Company Settings | Available | Company profile, schedules, appearance |
| Backup & Restore | Available | Complete Backup JSON export/import |
| CSV Export | Available | Payroll, overtime, transactions, reports |
| Search & Filters | Available | Incremental, focus-preserving across modules |
| Theme support | Available | Light/dark, pre-paint theme reconciliation |
| Supplemental Overtime Payment | Planned | Planned for v2.7.0; drift is surfaced today with a disabled placeholder |

This matrix lists shipped functionality only; it does not promise unavailable features.

---

## Screenshots

No screenshots are committed yet (to avoid any risk of exposing real company data). A capture plan —
which screens to show, the required fabricated sample data, target filenames under `docs/images/`,
and recommended dimensions — is maintained by the maintainer and will be added here once
safe, sanitized captures exist. Until then, run the app locally (below) to explore the UI.

---

## Architecture overview

```mermaid
flowchart LR
  subgraph Source["Modular source"]
    IDX["index.html<br/>(ordered script tags)"]
    CSS["css/ (5 files)"]
    JS["js/ (44 classic-script modules)<br/>core · ui · finance · people · import · analytics"]
  end
  subgraph Runtime["Browser runtime (client-only)"]
    STATE["State (in-memory)"]
    LS[("localStorage / Artifact storage")]
  end
  subgraph Build["Build & verify tooling (Node)"]
    ORDER["tools/module-order.js<br/>(load-order source of truth)"]
    BUILD["tools/build-single-file.js"]
    VERIFY["tools/verify-build.js<br/>(109 checks)"]
  end
  DIST["dist/tam-intelligence-os-v2.6.9.html<br/>(portable single file)"]

  IDX --> JS --> STATE --> LS
  CSS --> IDX
  ORDER --> BUILD
  IDX --> BUILD
  CSS --> BUILD
  JS --> BUILD
  BUILD --> DIST
  BUILD --> VERIFY
```

The 44 modules are **classic scripts** sharing one global scope; their **load order** is the single
critical invariant and lives once in `tools/module-order.js` (mirrored by `index.html`). The build
inlines CSS + JS into one portable file; the verifier asserts the dist equals the concatenated
source and that the version identity, schema, storage keys, and decomposition are all consistent.
See [`ARCHITECTURE.md`](ARCHITECTURE.md) for the full module map, provenance, and additional
diagrams (payroll workflow, release pipeline).

---

## Project structure

```
index.html                         Modular entry: meta, external deps, pre-paint theme
                                   script, ordered CSS <link> + JS <script> tags, mounts
css/                               Extracted styles (load order fixed)
  tokens.css base.css shell.css components.css charts.css
js/                                44 classic-script modules, one shared global scope
  core/       constants, utils, storage-adapter, state, state-load-migrations,
              domain-services, hr-persistence-portability, stabilization,
              onboarding-reset, app-bootstrap
  ui/         charts, shell-render, settings-about, activity-log
  finance/    dashboard, execution-center, transaction-modals, transactions,
              add-upload, cashflow, budget
  people/     people-core, employees, contracts, payroll-planning, recurring-expenses,
              monthly-plan, legacy-mapping, hr-dashboard-reports, overtime,
              employee-dedup, payroll-ops-engine, payroll-workspace
  import/     parser, import-preview, smart-import-extract, smart-import-commit,
              smart-import-ui
  analytics/  plan-vs-actual, compare, trends, executive-dashboard,
              executive-insights, reports
tools/
  module-order.js                  Single source of truth for JS load order
  app-version.js                   Single source of truth for the version (reads constants.js)
  decompose.js                     One-time feature-folder splitter (v2.6.2, byte-checked)
  extract-source.ps1               One-time deterministic splitter (v2.5.2 -> source, v2.6.0)
  build-single-file.js / .ps1      Modular source -> dist single file (version-derived filename)
  verify-build.js / .ps1           Build + invariant + focus-fix + decomposition + audit verification
dist/
  tam-intelligence-os-v2.6.9.html  Portable single-file release (build output, version-controlled)
tam-intelligence-os-v2.5.2.html    Frozen stable reference (source of truth for invariants)
.github/                           Repository governance & delivery
  workflows/ci.yml                 Build + verify on push/PR to main; uploads dist artifact
  workflows/release.yml            Tag-triggered (v*) GitHub Release; publishes portable HTML
  ISSUE_TEMPLATE/                  bug_report.yml, feature_request.yml, config.yml
  pull_request_template.md  CODEOWNERS  RELEASE_TEMPLATE.md
docs/                              QA-CHECKLIST.md, RELEASE-PROCESS.md, DATA-SAFETY.md
LICENSE  PROPRIETARY-LICENSE-NOTICE.md  SECURITY.md  CONTRIBUTING.md  CODE_OF_CONDUCT.md
RELEASE_NOTES.md  README.md  ARCHITECTURE.md  CHANGELOG.md
.gitignore  .gitattributes
```

---

## Getting started

No framework and no `npm install` are required to run the app. Because the modular source loads
local `css/` and `js/` files, serve the folder over HTTP (recommended) rather than opening via
`file://`:

```bash
python -m http.server 8000
```

Then open <http://localhost:8000>. Any static server works (`npx serve`, VS Code Live Server). The
portable build in `dist/` — or the asset from
[Release v2.6.9](https://github.com/fanoryu/TAM-Intelligence-OS/releases/tag/v2.6.9) — can also be
opened directly in a browser.

---

## Development workflow

1. **Confirm the baseline:** `git status` (clean), `git branch --show-current` (main),
   `git describe --tags --abbrev=0` (latest release tag).
2. **Edit the modular source** — never edit `dist/` by hand. If you add or move a module, update
   `tools/module-order.js` **and** `index.html` together.
3. **Build** the portable file, then **verify** (both below).
4. **Browser QA** in both the modular source and the portable dist — zero console errors.
5. Update [`CHANGELOG.md`](CHANGELOG.md) (and [`RELEASE_NOTES.md`](RELEASE_NOTES.md) for a release)
   and any affected docs; keep version references consistent (the version lives once, in
   `APP_VERSION`).
6. Commit the source **and** the rebuilt `dist/` together.

Branch naming: `feature/<name>`, `fix/<name>`, `chore/<name>`, `release/<version>`. See
[`CONTRIBUTING.md`](CONTRIBUTING.md) for the full contract.

---

## Build and verification

**Toolchain:** Node.js is the primary build/verify environment (tested on **v24**; any v18+ works).
It has no dependencies — plain `fs`/`path`, nothing to `npm install`. PowerShell scripts are an
optional fallback for machines without Node.

Build the portable single file from the modular source:

```bash
node tools/build-single-file.js
```

Verify (109 checks):

```bash
node tools/verify-build.js
```

Optional PowerShell fallback:

```bash
powershell -ExecutionPolicy Bypass -File tools/build-single-file.ps1
powershell -ExecutionPolicy Bypass -File tools/verify-build.ps1
```

**Version is derived, never hardcoded.** The single source of truth is `const APP_VERSION` in
`js/core/constants.js`. `tools/app-version.js` parses it; the build and verify tools derive
everything from there — the output filename is `dist/tam-intelligence-os-v${APP_VERSION}.html`
automatically. The verifier fails the build if:

- CSS drifts from the v2.5.2 golden master (styles must stay byte-for-byte identical apart from the
  one v2.6.3b floating-menu rule);
- the dist inlined payload ≠ the concatenated modular source (build fidelity);
- the version identity (`APP_VERSION`, `<title>`, `APP_RELEASE_NAME`, the Release Notes entry, the
  dist filename) is inconsistent;
- a storage key changes, `SCHEMA_VERSION` changes (must stay 6), or a migration flag disappears;
- the seed data is non-empty, a mount point is missing, or ES `import`/`export`/`type="module"`
  appears;
- the search-focus fix, module decomposition, or the audit/timeline/blocker features regress.

---

## Release process

Releases are tag-driven and guarded end-to-end (see [`docs/RELEASE-PROCESS.md`](docs/RELEASE-PROCESS.md)):

1. Bump `APP_VERSION` + `APP_RELEASE_NAME` in `js/core/constants.js`; add a Release Notes entry.
2. Build + verify; boot modular and dist with zero console errors.
3. Commit source + rebuilt dist; annotate a `vX.Y.Z` tag; push `main` then the tag.
4. The **Release** workflow (`.github/workflows/release.yml`) rebuilds, verifies, **refuses to
   publish unless the tag equals `v<APP_VERSION>`** and the portable HTML exists, then creates or
   refreshes the GitHub Release idempotently and uploads the portable asset.

```mermaid
flowchart LR
  DEV["Edit modular source"] --> B["build-single-file.js"] --> V["verify-build.js (109)"]
  V --> C["commit source + dist"] --> T["push tag vX.Y.Z"]
  T --> GA["GitHub Actions: Release"]
  GA --> GATE{"tag matches<br/>v-APP_VERSION?"}
  GATE -->|yes| REL["GitHub Release + portable asset"]
  GATE -->|no| STOP["fail: publish nothing"]
```

The **CI** workflow (`.github/workflows/ci.yml`) builds + verifies on every push/PR to `main` and
uploads the portable HTML as a build artifact.

---

## Data safety

TAM Intelligence OS stores finance, payroll, employee, and contract data **locally**; data never
leaves the device on its own. The verifier enforces these invariants unless a change is an
**intentional, documented migration**:

- `SCHEMA_VERSION` = 6; the 13 storage keys and the migration flags are stable.
- The shipped build ships **empty seed data**.
- The Complete Backup JSON format is stable; destructive actions (Restore, Employee Merge, Smart
  Import, Start Fresh) snapshot data first.

Never commit real company/personal data. Full guidance: [`docs/DATA-SAFETY.md`](docs/DATA-SAFETY.md).

---

## Repository documentation

Each document owns one responsibility; they cross-reference rather than repeat one another.

| Document | Role | Read it for |
|---|---|---|
| [`README.md`](README.md) | Public overview | What the product is, how to run/build it, where everything lives (this file) |
| [`CLAUDE.md`](CLAUDE.md) | Engineering constitution | The timeless, version-agnostic rules for changing this codebase; the approval matrix and Definition of Done |
| [`AI_CONTEXT.md`](AI_CONTEXT.md) | Repository knowledge | The current state — modules, workflows, decisions, limitations, glossary — for fast onboarding |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Technical implementation | The module map, load order, per-release provenance, and diagrams |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Contribution workflow | The step-by-step contributor contract (baseline, build, verify, QA, RC, approvals) |
| [`SECURITY.md`](SECURITY.md) | Security policy | How to report vulnerabilities privately and the data-handling expectations |
| [`CHANGELOG.md`](CHANGELOG.md) | Historical changes | The full version-by-version history |
| [`RELEASE_NOTES.md`](RELEASE_NOTES.md) | Release summaries | The summary for the current release |

Supporting documents: [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) (collaborator conduct),
[`LICENSE`](LICENSE) / [`PROPRIETARY-LICENSE-NOTICE.md`](PROPRIETARY-LICENSE-NOTICE.md) (proprietary terms), and
[`docs/`](docs/) — [`QA-CHECKLIST.md`](docs/QA-CHECKLIST.md),
[`RELEASE-PROCESS.md`](docs/RELEASE-PROCESS.md), [`DATA-SAFETY.md`](docs/DATA-SAFETY.md).

New to the repository? Start with **AI_CONTEXT.md** for context, then **CLAUDE.md** before making
changes.

---

## Roadmap

Directions only — no release numbers are assigned unless already approved.

**Released**
- Enterprise Banking Foundation — Bank Master, Company Bank Accounts, employee banking (v2.6.9)
- Payroll operational workspace with generic bulk selection (v2.6.8)
- Immediate overtime-drift visibility (v2.6.8)
- Read-only Activity Log and payroll audit timeline (v2.6.4)

**Planned**
- **Supplemental Payroll Engine (v2.7.0)** — pay approved overtime that landed after payroll was
  posted (the drift condition is already surfaced; the action is a disabled placeholder today).
- **Repository maintenance** — ongoing tooling, documentation, and workflow upkeep.

**Under consideration**
- Authentication and role-based access control (RBAC)
- Attachment and evidence handling
- Expanded approval workflows

These are candidate directions, not commitments.

---

## Governance

- **Ownership & review:** [`.github/CODEOWNERS`](.github/CODEOWNERS) routes review to the repository
  owner across all paths.
- **Contributions:** [`CONTRIBUTING.md`](CONTRIBUTING.md) is the contract; PRs use
  [`.github/pull_request_template.md`](.github/pull_request_template.md) with data-safety and
  regression checkboxes.
- **Issues:** structured [bug](.github/ISSUE_TEMPLATE/bug_report.yml) and
  [feature](.github/ISSUE_TEMPLATE/feature_request.yml) forms; blank issues are disabled and
  security reports are routed privately.
- **Conduct:** [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).
- **CI/Release:** official GitHub Actions only; minimal permissions; tag/version guardrails.

---

## License and security

- **License:** proprietary and confidential — see [`LICENSE`](LICENSE) and
  [`PROPRIETARY-LICENSE-NOTICE.md`](PROPRIETARY-LICENSE-NOTICE.md). Not open source; all rights reserved by PT Total Asset
  Manajemen.
- **Security:** report vulnerabilities privately via GitHub Security Advisories — never in a public
  issue, and never with real data. See [`SECURITY.md`](SECURITY.md).

© PT Total Asset Manajemen. All rights reserved.
