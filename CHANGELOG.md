# Changelog

## 2.6.3b — Floating Actions Menu Fix

**Type:** UI infrastructure. **No business logic, schema, or storage change.**

### Fixed
- **Row Actions menu is no longer clipped by the scrolling table container.** Replaced the
  in-container dropdown (which `overflow:auto` clipped even when flipped up) with a shared
  **floating layer**: the menu is portaled out to a top-level `#menu-root` node and positioned
  with `position:fixed` via `getBoundingClientRect()`, so it always renders fully visible.
- One shared controller — `openFloatingMenu` / `closeFloatingMenu` / `positionFloatingMenu`
  in `ui/shell-render.js` — reused by **Employees, Contracts, Payroll, Overtime, Transactions,
  Execution Center** (both the HR `bindHRActions` and finance `bindActionMenus` menus). It:
  auto-flips up/down by available space, closes on outside click and **Escape**, repositions
  on window **resize/scroll**, keeps one menu open at a time, and is cleaned up centrally at
  the start of `render()` so a portaled menu is never orphaned across a re-render.
- Also fixed a latent wiring bug the portal exposed: the **Payroll** row menu emitted
  un-prefixed action values (`detail`, `review`, …) that never matched the `bindHRActions`
  dispatch (`prow-detail`, `prow-review`, …), so those dropdown items did nothing. They now
  use the correct `prow-*` values and work (View Detail, Mark Reviewed, Approve, Return to
  Draft, Open in Execution Center, Cancel Row). Every other page already used prefixed values.

### Validation
- Node build + verify: **87/87 checks pass** (CSS golden master now allows only the one new
  `.actions-dropdown.floating` rule; new assertions for the portal, `position:fixed`, Escape,
  reposition-on-scroll/resize, and removal of the old in-container helper). Browser (dist +
  modular source, zero console errors): the menu is portaled to `#menu-root`, never inside a
  `.table-wrap`, fully within the viewport, flips up on bottom rows; closes on outside click
  and Escape; repositions on scroll; item actions fire and the menu is cleaned up — verified on
  Payroll, Employees, Contracts, Overtime and Transactions.

---

## 2.6.3a — Payroll Workspace Hotfix

**Type:** UI / action-flow hotfix. **No calculation-engine, schema, or storage change.**

### Fixed
- **Approve Selected now moves rows from Review to Approved.** Approval is a sign-off and
  is no longer gated by commit-blockers in the lifecycle helpers (`setPayrollStatus`,
  `bulkPayrollStatus`). Data validation (missing salary, invalid/duplicate contract, invalid
  schedule) now runs **only at Post to Finance** (`commitReadyPayroll`), where blocked rows
  are skipped and reported. So **Post to Finance succeeds after Approve**, valid rows create
  Planned transactions, and no duplicate payroll is created. The payroll calculation engine
  (generation, `computePayrollPlanned`, overtime math) is untouched.
- **Actions dropdown auto-flips upward** when there isn't enough room below the row, so menu
  items are never hidden and no scrolling is required. A shared `positionActionsMenu()` helper
  measures available space against the viewport / nearest scroll container and adds
  `.actions-dropdown.up` when needed. Wired into both the HR menus (Employees, Contracts,
  Overtime, Payroll) and the finance menus (Transactions, Execution Center).

### Validation
- Node build + verify: **82/82 checks pass** (CSS golden master tightened to allow **only**
  the one new `.actions-dropdown.up` rule; new hotfix assertions for the approve gate and the
  auto-flip). Browser (dist), zero console errors: Approve moves Review→Approved (incl. a
  zero-salary row), Post posts the valid rows and skips the blocked one, no duplicate payroll,
  and the Actions menu flips up on bottom rows (down on top rows) on Employees and Payroll.

---

## 2.6.3 — Payroll Intelligence Workspace

**Type:** feature — payroll operational workspace. **No schema, storage-key, or calculation-engine change.**

Upgrades Payroll from a generator into a clean, workflow-oriented **operational workspace**.
Payroll in TAM is **Base Salary + Approved Overtime only** — no tax, BPJS, loan, transport,
meal allowance, or deduction engine.

### Added
- **Payroll Workspace** (the main payroll page): a current-period banner + period switcher,
  top KPI cards (Current Period, Employees, Draft, Review, Approved, Posted, Executed, Total
  Payroll, Total Overtime), and workspace actions (Generate, Review, Approve, Post to Finance).
- **Operational lifecycle** Draft → Review → Approved → Posted → Executed, shown as stage
  badges. It is a **display mapping over the existing stored status values** (Reviewed/Ready/
  Committed) with **Executed derived** from the linked finance transaction — so **no data
  migration**. Execution still happens in the Execution Center.
- **Bulk operations** with confirmation dialogs: Select All, Review Selected, Approve
  Selected, Post to Finance.
- **Payroll period lock** (`State.settings.payrollLocks`, same `tam_settings_v1` key): a
  locked month blocks regeneration, edits, its overtime changes, and finance re-posting.
  Unlock requires confirmation. Overtime mutators (add/edit/status/duplicate/delete/worksheet)
  are guarded against locked periods.
- **Payroll Health** — deterministic (no AI) warning cards: contract expiring within 30 days,
  payroll up/down >20% vs previous period, unusually high overtime, employee missing an
  active contract.
- **Payroll Summary**: total employees, payroll total, total overtime, average, highest, lowest.
- **Employee Timeline** on Employee Detail: Profile, Active Contract, Contract History,
  **Payroll History**, **Overtime History**, and **Finance Transactions** in one linked view.
- **Read-only payroll preview** (employee, contract, progress, base, approved overtime, total,
  generated finance transaction) with a payroll history log.

### Changed
- The payroll worksheet is now **read-only** (Employee · Contract · Progress · Base · Approved
  OT · Total · Stage) — the editable component spreadsheet (allowance/bonus/benefits/deduction
  columns) is gone. Edit salary via the Contract, overtime via Overtime.
- "Commit Ready Payroll" is now **Post to Finance** / "Post Approved Payroll to Finance"; only
  Approved payroll may be posted; it creates **Planned** transactions and never auto-executes.
- Nav label "Payroll Planning" → **"Payroll Workspace"**. Recurring adjustments UI is retained
  for backward compatibility but is no longer part of the standard workflow.
- Version identity → 2.6.3; new Release Notes entry (history preserved).

### Unchanged (verified)
- **`SCHEMA_VERSION` stays 6**; all storage keys, migration flags, backup shape, and CSS are
  byte-for-byte unchanged. The calculation engine (`computePayrollPlanned`) is untouched;
  because TAM configures no adjustments, Total already equals Base + Approved Overtime.
- Employee Dedup, Smart Import, Contract Engine, Execution Center, Monthly Planning, Reports,
  Node build, verification, Git, and the 43-module structure are all preserved. The v2.6.1
  search-focus fix still holds on the payroll search.
- Still classic ordered scripts — no ES modules, no bundler.

### Validation
- Node build + verify: **76/76 checks pass** (adds payroll-workspace assertions).
- Browser (dist + modular source, zero console errors): Generate, duplicate prevention,
  Draft→Review→Approved→Posted lifecycle, bulk review/approve/post, period lock (blocks bulk
  and re-posting), approved-overtime integration (Total = Base + OT; overtime flips to
  "Committed to Payroll" on post), finance posting creates Planned transactions, Executed
  derived from a completed transaction, employee timeline, period switching, payroll search
  focus, and dark/light themes.

### Out of scope (not implemented, by design)
- BPJS, tax, loan, meal allowance, transport, insurance, deduction engine, payslip PDF,
  multi-user approval, electronic signature.

---

## 2.6.2 — Developer Experience & Module Decomposition

**Type:** developer workflow + code organization. **No business logic, data, or schema change.**

### Added
- **Git repository** initialized on branch `main` with a practical `.gitignore`
  (`node_modules/`, `dist/*.tmp`, `*.log`, `.vscode/settings.json`, `Thumbs.db`, `.DS_Store`).
  The portable release HTML (`dist/*.html`) is **intentionally version-controlled**.
- `tools/module-order.js` — the single source of truth for classic-script load order,
  consumed by `build-single-file.js`, `verify-build.js`, and mirrored by `index.html`.
- `tools/decompose.js` — the one-time, self-verifying splitter used for this release.

### Changed
- **Decomposed the largest JS modules into a feature-folder tree.** Went from **20 flat
  files → 43 modules** under `js/{core,ui,finance,people,import,analytics}/`. Average
  module size dropped from ~410 to ~190 lines; the biggest file is now ~350 lines (was
  1,581). The three named large files were split:
  - `09-finance-pages.js` → `finance/{dashboard, execution-center, transaction-modals, transactions, add-upload}.js`
  - `11-import-ui-analytics.js` → `import/import-preview.js`, `analytics/{plan-vs-actual, compare, trends, executive-dashboard, executive-insights, reports}.js`, `finance/{cashflow, budget}.js`, `ui/settings-about.js`
  - `12-people-pages.js` → `people/{people-core, employees, contracts, payroll-planning, recurring-expenses, monthly-plan, legacy-mapping, hr-dashboard-reports}.js`
  - `17-employee-dedup.js` and `18-payroll-ops.js` were also split along their internal seams.
- **Node.js is the primary build/verify toolchain**; the PowerShell scripts remain an
  optional fallback and now read the shared manifest so they stay in sync.
- Version identity → `2.6.2` / "Developer Experience & Module Decomposition"; new Release
  Notes entry (2.6.1 and earlier preserved).

### Unchanged (verified)
- **Pure code move.** The decomposition is verified **byte-identical**: the concatenation
  of the 43 modules in load order equals the previous concatenation of the 20 files, so
  runtime behavior is unchanged. `SCHEMA_VERSION` stays **6**; all storage keys, migration
  flags, and backup shape untouched; **CSS byte-for-byte identical to v2.5.2**.
- Still **classic ordered `<script>` tags** in one shared global scope — no ES modules,
  no `import`/`export`, no bundler.
- The v2.6.1 search-focus behavior is intact (verified by the same focus-fix assertions).

### Validation
- Node build + verify: **63/63 checks pass** (adds module-decomposition integrity checks:
  all 43 modules present, no flat files remain, folders present, `index.html` matches the
  manifest).
- Browser: modular source loads all **43 `<script src>` files `200 OK` in manifest order**;
  every page renders, search focus works, charts render, themes toggle — **zero console
  errors** on both the modular source and the portable dist.

---

## 2.6.1 — Search Focus & Incremental Rendering Fix

**Type:** UX / rendering-path fix. **No business logic, data, or schema change.**

Fixed a regression where typing in any search box lost keyboard focus after every
keystroke (the whole content pane, including the `<input>`, was rebuilt on each `input`
event). Search and filter controls now update **only the table body** (and any
filter-dependent totals), so the search input is never destroyed while typing.

### Fixed / Changed
- **Employees, Contracts, Transactions, Payroll Planning, Overtime** search boxes and
  their filter dropdowns now call an incremental `apply*Filter()` that swaps only the
  `<tbody>` and re-binds the row-level handlers — the page shell, toolbar, and inputs are
  never rebuilt.
- Result: the search input keeps **focus, caret position, and text selection**; the table
  keeps its **scroll position**; dropdown selections and payroll **row-selection
  checkboxes survive** filtering (selection state lives in `State.payrollSel`).
- Filter-dependent summaries update in place: Transactions "N of M" count, Overtime
  "Records Shown / Total Hours / Total Amount" tiles.
- Each affected renderer was split into `X` (shell, built once), `XFiltered()` /
  `XRowsHTML()` (data → rows), and `bind*Rows()` (row handlers), shared by the initial
  render and the incremental refresh.

### Unchanged (verified)
- `SCHEMA_VERSION` stays **6**; all storage keys, migration flags, and the complete-backup
  shape are untouched. **CSS is byte-for-byte identical to v2.5.2.**
- No calculation, import, deduplication, payroll/overtime result, export, row action,
  inline edit, or Actions-menu behavior changed. Reports and Smart Import have no live
  search input and were not affected.

### Validation
- 52 automated checks pass (`tools/verify-build.*`), including "old full-render search
  handler removed" and "incremental refresh present" assertions.
- Browser-verified on both the modular source and the portable dist: for every search box
  the input node is preserved across keystrokes, focus/caret/selection persist, lists
  filter live, row actions/inline-edits re-bind, and payroll checkbox selection survives
  filtering. Zero console errors.

---

## 2.6.0 — Modular Frontend Architecture (Phase 0)

**Type:** architecture / refactoring only. **No behavior change.**

Phase 0 of the Modular Frontend Architecture initiative. The stable single-file
application (`tam-intelligence-os-v2.5.2.html`) was physically split into a maintainable
modular source tree while preserving 100% of existing functionality.

### Changed
- Split the single 8,500-line file into **20 ordered JavaScript files** (`js/00-*` …
  `js/19-*`) and **5 CSS files** (`css/tokens|base|shell|components|charts.css`),
  each a verbatim contiguous slice of v2.5.2 in original order.
- JS loads as **classic `<script src>` tags** (shared global scope) — **no** ES modules,
  `import`, or `export`. Declaration order == original order.
- CSS extracted to external files in fixed cascade order (tokens → base → shell →
  components → charts).
- Added a portable single-file build pipeline (`tools/build-single-file.*`) that inlines
  the modular source into `dist/tam-intelligence-os-v2.6.0.html`, behaviorally identical
  to previous releases (same external XLSX/font behavior, no minification).
- Added golden-master verification (`tools/verify-build.*`) gating storage keys, schema
  version, migration flags, seed data, mount points, single bootstrap, and byte-level JS/CSS
  equivalence against v2.5.2.
- `APP_VERSION` → `2.6.0`; `APP_RELEASE_NAME` → `Modular Frontend Architecture`;
  browser `<title>` → `TAM Intelligence OS v2.6.0`. These propagate to About, Diagnostics,
  report headers, and all export filenames (`FILE_BASE`) automatically.
- Added a 2.6.0 Release Notes entry (no historical entry altered).

### Unchanged (verified by golden master)
- `SCHEMA_VERSION` stays **6**.
- All storage keys: `tam_txns_v1`, `tam_settings_v1`, `tam_backups_v1`, all `HR_KEYS`
  (`tam_employees_v1` … `tam_employee_merges_v1`), `tam_audit_log_v1`.
- All migration flags: `tam_migrated_exec_v21`, `tam_migrated_hr_v22`,
  `tam_migrated_norm_v221`, `tam_migrated_overtime_v23`, `tam_migrated_payrollops_v25`,
  `tam_migrated_dedup_v252`, `tam_v23_ack` (the `v252` in the flag name is a storage key,
  not version identity — untouched).
- Complete-backup shape, workbook import, Smart Import, employee deduplication, payroll
  and overtime calculations, transaction lifecycle, Execution Center buckets, reports,
  diagnostics, themes, charts, sidebar scroll, action menus, fresh-install detection, and
  standalone localStorage persistence — all byte-for-byte identical.

### Not in this release (deferred)
- ES module conversion, bundler, dead-code elimination.
- Any logic de-duplication, renaming, or optimization.
- Any data-schema change.

---

## 2.5.2 — Employee Deduplication & Master Data Consolidation

Previous stable release. See in-app **Release Notes** for the full history (2.5.2 → 1.0).
