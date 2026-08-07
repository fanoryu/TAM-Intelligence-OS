# TAM OS v2.8.6 — Navigation Experience & TAM OS Rebrand

**Release Name:** Navigation Experience & TAM OS Rebrand
**Status:** **Published and marked Latest** — annotated tag `v2.8.6` on commit `7ac0092d`; asset `tam-os-v2.8.6.html` (998,413 bytes, SHA-256 `8481523c11f78c8959291912551ee3205781daf0ec466ff79cfc59c7c91d3f62`).

## Product
TAM OS is now the current product identity. The sidebar wordmark, the browser title
(`TAM OS v2.8.6`), the About page and Settings all read **TAM OS**. Historical releases keep their
original **TAM Intelligence OS** name where that was accurate at the time of release.

## Summary
A navigation, presentation and naming release. It packages the complete UX-004 navigation modernization
(**UX-004B–UX-004F**), the sidebar interaction hotfix, and the TAM OS rebrand — all previously completed
and merged to `main`. No business logic changed.

## Navigation
- **Five business domains** — Dashboard, People, Finance, Analytics, System — over a persistent shell
  that mounts once, with canonical navigation ownership, hierarchical active state, and a single
  primary-navigation landmark.
- **Progressive disclosure:** Finance shows four primary items (Overview, Payroll, Transactions,
  Planning); every other Finance destination lives under a **More** control (session-only, and it
  auto-opens when an active destination lives inside it). Labels are simplified and the **Soon**
  placeholder tag is quieter. No route, view, id or destination changed.

## Sidebar
Collapse to an icon rail, session-only **pin** (expanded or collapsed), desktop **hover-expand**, and a
responsive overlay **drawer** on tablet/mobile — hamburger, backdrop, Escape-to-close, focus trap and
focus restoration. All session-only; nothing is persisted.

## Context
- **Breadcrumbs** derive from the canonical navigation architecture (Domain / Item / Context) in their
  own semantic Breadcrumb landmark, with entity-aware terminal labels and no internal-id leaks.
- **Context-aware Quick Actions** are navigation-only deep links, including a Payroll/Overtime →
  Execution Center hand-off.

## Payroll safety
Navigation shortcuts **do not execute, approve, or post anything automatically**. Quick Actions only
change the view and the navigation context; the canonical workflow (Generate → Review → Approve → Post
to Finance → Execution → Completed) is unchanged, and the destination screen remains authoritative.

## Numeric typography
Business-number surfaces use the primary UI font with **tabular numerals** so figures align in columns.
Presentation-only: `fmtIDR`, `toLocaleString`, rounding, currency rules and CSV/Excel/PDF output are
unchanged.

## Sidebar interaction hotfix
Clicking a group header, or the Finance **More** control, while its own section held the active view
previously flipped hidden session state and armed a surprising later collapse/disclosure. Those clicks
are now clean no-ops; the active section still intentionally remains open, and every non-active toggle
works normally.

## Rebrand
- Product identity: **TAM OS**.
- Repository is now: **`fanoryu/TAM-OS`** (renamed by the maintainer; current-state links reconciled).
- Starting with this release the portable artifact uses the TAM OS naming convention
  `dist/tam-os-v2.8.6.html`. The historical `tam-intelligence-os-v2.8.5.html` asset and older filenames
  remain immutable in Git history and their published GitHub Releases.

## Compatibility
- **`SCHEMA_VERSION` remains 6.** No migration required.
- **No storage-key add/remove/rename;** existing persisted data remains compatible.
- **Complete Backup compatibility retained:** a backup exported from v2.8.5 restores into v2.8.6, and a
  restore round-trip does not alter business data beyond the existing provenance/history behavior.
- **Payroll, overtime, contract, execution, posting and finance semantics are unchanged.**

## Known Existing Issues
Carried forward from prior releases and **verified still present**; not introduced by v2.8.6:
- **Compound Payroll posting is non-atomic.** `commitReadyPayroll` writes multiple storage keys
  sequentially; a mid-sequence failure can leave a residual state. Integrity Check detects it for
  review; it is not auto-repaired. Unchanged by v2.8.6.
- **Contract Core editor routing is not migrated.** `ContractCoreAggregate`/`contract.core.update` are
  prepared but have no operational ingress; the editor still writes through `persistContracts()`.
  **OQ-2 and OQ-3 remain OPEN**, so editor routing (ADR-014 step 2) stays blocked. Unchanged by v2.8.6.

## Build
- Portable single-file build: `dist/tam-os-v2.8.6.html`, byte-identical on rebuild.
- CSS golden master unchanged from v2.8.5.

## Release state
v2.8.6 is **published and marked Latest**, from annotated tag `v2.8.6` on commit `7ac0092d`. The published
asset `tam-os-v2.8.6.html` (998,413 bytes, SHA-256
`8481523c11f78c8959291912551ee3205781daf0ec466ff79cfc59c7c91d3f62`) is byte-identical to the repository
artifact. The prior **v2.8.5** tag, GitHub Release, and asset (`tam-intelligence-os-v2.8.5.html`, 965,767
bytes) remain historical and immutable. **UX-005 has not begun.**
