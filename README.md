# TAM Intelligence OS — Modular Frontend Architecture

[![CI](https://github.com/fanoryu/TAM-Intelligence-OS/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/fanoryu/TAM-Intelligence-OS/actions/workflows/ci.yml)
[![Latest release](https://img.shields.io/github/v/release/fanoryu/TAM-Intelligence-OS?sort=semver&display_name=tag&label=release)](https://github.com/fanoryu/TAM-Intelligence-OS/releases/latest)
![Version](https://img.shields.io/badge/version-2.6.7-blue)
![Status](https://img.shields.io/badge/license-proprietary%20%26%20confidential-red)

Integrated Management Intelligence for **PT Total Asset Manajemen**.

> **Proprietary & confidential.** This repository is private and not open source — see
> [`LICENSE-NOTICE.md`](LICENSE-NOTICE.md). Do not commit real company data.

Current release: **v2.6.7 — Enterprise Repository & Delivery Foundation**
(lineage: **v2.6.0** modular split; **v2.6.1** search-box focus; **v2.6.2** module
decomposition + Git; **v2.6.3** Payroll operational workspace; **v2.6.3a** Approve→Post
lifecycle fix; **v2.6.3b** floating Actions menu; **v2.6.3c** responsive detail pages +
consistent sidebar icons; **v2.6.4** version-derived release tooling + read-only Activity
Log and payroll audit timeline; **v2.6.5** Smart Import review selection no longer jumps
scroll; **v2.6.6** onboarding "Configure company settings" step completes correctly;
**v2.6.7** GitHub CI/release automation + repository governance — no app-behavior change).

Two supported outputs:

| Output | What it is | Where |
|---|---|---|
| **A. Modular development source** | `index.html` + `css/` + `js/` (44 modules in `core/ ui/ finance/ people/ import/ analytics/`) loaded as ordered **classic scripts** (shared global scope, no ES modules) | project root |
| **B. Portable single-file release** | one self-contained HTML file, identical in behavior to earlier releases | `dist/tam-intelligence-os-v2.6.7.html` |

---

## Run the modular source locally

No framework and no Node required to run. Because it loads local `css/` and `js/` files,
serve the folder over HTTP (recommended) rather than `file://`:

```bash
python -m http.server 8000
```

Then open <http://localhost:8000>. Any static server works (`npx serve`, VS Code Live
Server). The portable build in `dist/` can also just be opened directly in a browser.

---

## Build the portable single-file release

**Toolchain:** Node.js is the primary build/verify environment (tested on **v24.18.0**;
any v18+ works). It has no dependencies — plain `fs`/`path`, nothing to `npm install`.
Node is used **only** for the tooling, never to run the app itself. The PowerShell scripts
are kept as an **optional fallback** for machines without Node.

Regenerate the portable build from the modular source:

```bash
node tools/build-single-file.js
```

Optional fallback (no Node.js):

```bash
powershell -ExecutionPolicy Bypass -File tools/build-single-file.ps1
```

The build inlines the five CSS files into one `<style>` and the 44 JS modules into one
`<script>`, in the order given by `tools/module-order.js`. It does **not** minify. External
XLSX + Google Fonts links are left untouched, so the portable file behaves exactly like
earlier releases.

**Version is derived, never hardcoded (v2.6.4).** The single source of truth for the release
version is `const APP_VERSION` in `js/core/constants.js`. `tools/app-version.js` parses it, and
both the Node and PowerShell build/verify tools derive everything from there — the output
filename is `dist/tam-intelligence-os-v${APP_VERSION}.html` automatically, and the verifier
checks the `APP_VERSION` constant, `<title>`, `APP_RELEASE_NAME`, the Release Notes entry and
the generated filename all agree with it. To cut a new release you change only the two constants
in `constants.js` (version + release name) and add a Release Notes entry — the tooling handles
the rest and fails clearly if the version cannot be parsed or the filename would not match.

---

## Verify

```bash
node tools/verify-build.js
```

Optional fallback (no Node.js):

```bash
powershell -ExecutionPolicy Bypass -File tools/verify-build.ps1
```

The Node verifier (109 checks) fails the build if:

- **CSS drifts from v2.5.2** (styles are unchanged — CSS must stay byte-for-byte identical
  apart from the one v2.6.3b floating-menu rule),
- the dist inlined payloads do not equal the concatenated modular source (build fidelity),
- the **version identity** (derived from `constants.js`) is inconsistent — `APP_VERSION`,
  `<title>`, `APP_RELEASE_NAME`, the Release Notes entry, or the generated dist filename
  disagree with `APP_VERSION`,
- a storage key changes, `SCHEMA_VERSION` changes (must stay 6), a migration flag disappears,
- the seed data is no longer empty, a mount point is missing, duplicate `init()` calls appear,
- ES `import`/`export` or `type="module"` are introduced,
- the **search-focus fix regresses** — every search box must route to its incremental
  `apply*Filter()` and must not call the full page renderer on `input`,
- the **module decomposition** is inconsistent — a manifest module is missing, a flat
  `js/NN-*.js` file reappears, a folder is missing, or `index.html`'s `<script>` tags no
  longer match `tools/module-order.js` exactly,
- or the **v2.6.4 audit features** regress — the Activity Log page/helpers/incremental filter
  are missing, an independent audit storage key is introduced, the payroll timeline builders
  are absent, or Post to Finance no longer records exact per-row skip reasons.

The PowerShell fallback (`tools/verify-build.ps1`, 53 checks) runs the CSS/fidelity/version/
data-safety/focus subset; the Node verifier is the full superset.

---

## What each recent release changed (and did not)

- **v2.6.7 — Enterprise Repository & Delivery Foundation.** Engineering/governance only — **no
  application behavior change** (runtime byte-identical to v2.6.6 apart from the version). Added
  GitHub Actions **CI** (build + verify on every push/PR to `main`) and a **tag-triggered release
  workflow** that re-derives the version, refuses to publish unless the tag equals `v<APP_VERSION>`,
  and uploads the portable HTML. Added repository governance — issue/PR templates, `CODEOWNERS`,
  `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `LICENSE-NOTICE.md` (proprietary),
  release-notes templates, and `docs/` (QA checklist, release process, data safety) — plus hardened
  `.gitignore`/`.gitattributes` and README badges. No storage key, `SCHEMA_VERSION` (6), calculation,
  backup-format, module-order, or `.css` change.
- **v2.6.6 — Company Settings Checklist Fix.** The onboarding "Configure company settings" step
  now completes as soon as a meaningful company profile is saved. Completion is derived purely
  from persisted settings via `companySettingsConfigured()` — true when the Company Name **or**
  Product Name is non-default (non-empty) **or** an Opening Cash Balance is set. Previously it
  ignored Product Name and only credited a non-default Company Name or a set cash balance, so
  saving Settings often left the step unchecked. Unchanged shipped defaults and theme-only saves
  do not count; optional blank fields never block it. No company data, storage key,
  `SCHEMA_VERSION` (6), calculation or `.css` change.
- **v2.6.5 — Smart Import Selection Scroll Preservation.** Fixed the Smart Import review jump:
  toggling a row checkbox is now **fully incremental** (updates only `model.items[].selected`
  and the live "N selected" counter — no `smartCounts` value depends on selection, so nothing
  else needs to change and the wizard is not re-rendered). Select All Safe / Unselect All sync
  the visible checkboxes in place. Skip Conflicts and column-mapping overrides still re-render
  (they change buckets/counts or rebuild the model) but preserve the review list's scroll
  position and the focused control via a guarded `requestAnimationFrame` + `setTimeout` restore
  using `focus({preventScroll:true})`. No change to import parsing, employee/contract matching,
  payroll generation, transaction creation, duplicate prevention, storage, `SCHEMA_VERSION` (6),
  audit behavior or `.css`.
- **v2.6.4 — Release Automation & Payroll Audit Visibility.** The build/verify tooling
  (Node + PowerShell) now derives the version from a single source of truth (`APP_VERSION`
  in `constants.js`) via `tools/app-version.js` — no hardcoded version, and the dist filename
  follows `APP_VERSION`. Added a read-only **Activity Log** (Management → Activity Log) over
  the existing `tam_audit_log_v1` store, with search / module / event / period filters,
  incremental rendering (search keeps focus), an empty state and CSV export. Payroll Detail
  shows a read-only **Payroll Timeline** and the Workspace shows **Period Activity**, both
  derived from existing history + audit records (only real events, no fabricated timestamps).
  **Post to Finance** now reports posted-vs-skipped with the exact blocker reason per skipped
  row (rows stay Approved, no transaction created, blocker rules unchanged). No business
  calculation, storage key, migration flag, `SCHEMA_VERSION` (6) or `.css` file changed.
- **v2.6.3c — Responsive UI Polish.** Execution Center sidebar icon rendered monochrome
  (consistent with siblings); Employee/Contract/Payroll detail cards size to content and stack
  at 125%/150% zoom; tighter detail-card spacing. JS/markup only — no `.css` files or
  verification touched (CSS golden master unchanged).
- **v2.6.3b — Floating Actions Menu Fix.** The row Actions menu is portaled to a top-level
  `#menu-root` and positioned with `position:fixed` (via `getBoundingClientRect`), so it's
  never clipped by a table's `overflow`. One shared controller (auto-flip, close on
  outside-click/Escape, reposition on resize/scroll) is reused across Employees, Contracts,
  Payroll, Overtime, Transactions, Execution Center. UI infrastructure only.
- **v2.6.3a — Payroll Workspace Hotfix.** Approve Selected now moves rows Review→Approved
  (approval is a sign-off; data validation moved to Post to Finance, which skips/reports
  blocked rows). Actions dropdowns auto-flip upward when there's no room below. UI/action-flow
  only — no calculation-engine, schema, or storage change.
- **v2.6.3 — Payroll Intelligence Workspace.** Rebuilt Payroll as an operational workspace:
  current-period banner + switcher, KPI cards, read-only worksheet, Draft→Review→Approved→
  Posted→Executed lifecycle (display mapping over unchanged stored statuses; Executed derived
  from the finance transaction), bulk actions with confirmations, period **lock**, deterministic
  **health** cards, a **summary**, and an **employee timeline**. Payroll = Base Salary +
  Approved Overtime only. No schema/storage-key/calculation change; locks live in settings.
- **v2.6.2 — Developer Experience & Module Decomposition.** Split the 20 flat `js/` files
  into **43 feature modules** (`core/ ui/ finance/ people/ import/ analytics/`) and
  initialized Git. Pure code move — verified byte-identical to the previous concatenation,
  so runtime behavior is unchanged. Still classic ordered scripts (no ES modules).
- **v2.6.1 — Search Focus & Incremental Rendering Fix.** Typing in any search box no longer
  loses focus; search/filter update **only the table body** via `apply*Filter()`, preserving
  focus/caret/selection, scroll, and payroll checkbox selection.

**Unchanged across both:** all business logic, calculations, storage keys, `SCHEMA_VERSION`
(6), migration flags, backup format, imports, deduplication, exports — and all CSS.

---

## Load order is the one critical invariant

The 44 modules are classic scripts sharing one global scope; their **load order** (top-level
`const` initializations depend on it) lives in exactly one place: **`tools/module-order.js`**.
`index.html` mirrors it as `<script src>` tags, the build/verify tools `require()` it, and
`verify-build.js` asserts `index.html` matches it. If you add or move a module, update the
manifest **and** `index.html` together, then run `node tools/verify-build.js`.

## Scaffolding tools (one-time, historical)

- `tools/extract-source.ps1` produced the first modular split from `tam-intelligence-os-v2.5.2.html` (v2.6.0).
- `tools/decompose.js` split the flat files into the feature-folder tree (v2.6.2), self-checking byte-identity.

Both are **one-time** and **not** part of the normal build. Do **not** re-run them — the
source files are now edited in place, and re-running would overwrite current work from an
older baseline.

---

## Project layout

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
  tam-intelligence-os-v2.6.7.html  Portable single-file release (build output, version-controlled)
tam-intelligence-os-v2.5.2.html    Frozen stable reference (source of truth for invariants)
.github/                           Repository governance & delivery (v2.6.7)
  workflows/ci.yml                 Build + verify on push/PR to main; uploads dist artifact
  workflows/release.yml            Tag-triggered (v*) GitHub Release; publishes portable HTML
  ISSUE_TEMPLATE/                  bug_report.yml, feature_request.yml, config.yml
  pull_request_template.md  CODEOWNERS  RELEASE_TEMPLATE.md
docs/                              QA-CHECKLIST.md, RELEASE-PROCESS.md, DATA-SAFETY.md
SECURITY.md  CONTRIBUTING.md  CODE_OF_CONDUCT.md  LICENSE-NOTICE.md  RELEASE_NOTES.md
.gitignore  .gitattributes  README.md  ARCHITECTURE.md  CHANGELOG.md
```

See **ARCHITECTURE.md** for full file-by-file provenance, load order, and the decomposition
map (§9). See **CONTRIBUTING.md**, **docs/RELEASE-PROCESS.md**, and **docs/QA-CHECKLIST.md** for
the contributor and release workflow, and **SECURITY.md** / **docs/DATA-SAFETY.md** for data
handling.
