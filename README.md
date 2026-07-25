# TAM Intelligence OS — Modular Frontend Architecture

Integrated Management Intelligence for **PT Total Asset Manajemen**.

Current release: **v2.6.3 — Payroll Intelligence Workspace**
(lineage: **v2.6.0** split the stable `tam-intelligence-os-v2.5.2.html` into a modular
source tree; **v2.6.1** fixed search-box focus with incremental rendering; **v2.6.2**
decomposed the largest modules into a feature-folder tree and initialized Git; **v2.6.3**
rebuilt Payroll as an operational workspace — Base Salary + Approved Overtime only).

Two supported outputs:

| Output | What it is | Where |
|---|---|---|
| **A. Modular development source** | `index.html` + `css/` + `js/` (43 modules in `core/ ui/ finance/ people/ import/ analytics/`) loaded as ordered **classic scripts** (shared global scope, no ES modules) | project root |
| **B. Portable single-file release** | one self-contained HTML file, identical in behavior to earlier releases | `dist/tam-intelligence-os-v2.6.3.html` |

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

Regenerate `dist/tam-intelligence-os-v2.6.3.html` from the modular source:

```bash
node tools/build-single-file.js
```

Optional fallback (no Node.js):

```bash
powershell -ExecutionPolicy Bypass -File tools/build-single-file.ps1
```

The build inlines the five CSS files into one `<style>` and the 43 JS modules into one
`<script>`, in the order given by `tools/module-order.js`. It does **not** minify. External
XLSX + Google Fonts links are left untouched, so the portable file behaves exactly like
earlier releases.

---

## Verify

```bash
node tools/verify-build.js
```

Optional fallback (no Node.js):

```bash
powershell -ExecutionPolicy Bypass -File tools/verify-build.ps1
```

The verifier (76 checks) fails the build if:

- **CSS drifts from v2.5.2** (styles are unchanged — CSS must stay byte-for-byte identical),
- the dist inlined payloads do not equal the concatenated modular source (build fidelity),
- a storage key changes, `SCHEMA_VERSION` changes (must stay 6), a migration flag disappears,
- the seed data is no longer empty, a mount point is missing, duplicate `init()` calls appear,
- ES `import`/`export` or `type="module"` are introduced,
- the **search-focus fix regresses** — every search box must route to its incremental
  `apply*Filter()` and must not call the full page renderer on `input`,
- or the **module decomposition** is inconsistent — a manifest module is missing, a flat
  `js/NN-*.js` file reappears, a folder is missing, or `index.html`'s `<script>` tags no
  longer match `tools/module-order.js` exactly.

---

## What each recent release changed (and did not)

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

The 43 modules are classic scripts sharing one global scope; their **load order** (top-level
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
js/                                43 classic-script modules, one shared global scope
  core/       constants, utils, storage-adapter, state, state-load-migrations,
              domain-services, hr-persistence-portability, stabilization,
              onboarding-reset, app-bootstrap
  ui/         charts, shell-render, settings-about
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
  decompose.js                     One-time feature-folder splitter (v2.6.2, byte-checked)
  extract-source.ps1               One-time deterministic splitter (v2.5.2 -> source, v2.6.0)
  build-single-file.js / .ps1      Modular source -> dist single file
  verify-build.js / .ps1           Build + invariant + focus-fix + decomposition verification
dist/
  tam-intelligence-os-v2.6.2.html  Portable single-file release (build output, version-controlled)
tam-intelligence-os-v2.5.2.html    Frozen stable reference (source of truth for invariants)
.gitignore  README.md  ARCHITECTURE.md  CHANGELOG.md
```

See **ARCHITECTURE.md** for full file-by-file provenance, load order, and the decomposition
map (§9).
