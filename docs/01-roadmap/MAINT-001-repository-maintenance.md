# MAINT-001 — Repository Maintenance & Branding Refresh (Planned)

**Status:** Planned backlog item — **not started**. This document is forward-looking
planning; it authorizes no implementation. Work is authorized only by a subsequent
Sprint Assignment per [`docs/01-roadmap/README.md`](README.md).

**Predecessor:** UX-005B (Data Grid Foundation), merged. **This item does not depend on
any later UX-005 phase** and may be scheduled independently. It is the recommended
**next work item** after UX-005B.

**Guiding constraints (inherited):** no business-logic or calculation changes; no
`SCHEMA_VERSION`, storage-key, or migration change; no backend work; the published
`v2.8.6` tag/Release/asset remain immutable. Anything touching the CSS golden master
follows the intentional pin-revision process.

---

## 1. Repository — legacy migration scripts

Evaluate removal of the one-time source-decomposition tooling, now that the modular
`js/` tree is the source of truth:

- `tools/decompose.js`
- `tools/extract-source.ps1`

**Before removal (MUST):** prove nothing references them — grep the repo (docs, CI
workflows under `.github/`, `tools/`, `package`-style scripts, READMEs) for
`decompose` / `extract-source`. Removing tracked files is approval-gated
(`CLAUDE.md` §20); the removal Sprint must list them explicitly and confirm the build
(`build-single-file.js`) and verifier (`verify-build.js`) do not invoke them.

## 2. Documentation — synchronization & cleanup

- Resolve README inconsistencies (see §4 below) and reconcile the root `README.md`
  documentation table, `docs/README.md`, and `SECURITY.md` SDR list.
- Documentation synchronization pass: verify version references, counts, and
  cross-links are current after UX-005A/UX-005B (verifier 1931, runtime 1526 / 17
  harnesses on the current line).
- General documentation cleanup; remove stale pointers; keep one responsibility per
  document (`CLAUDE.md` §16, §18).

## 3. Branding — refresh (PREPARE ONLY)

Prepare (do **not** create or modify any binary asset in this planning item) an
`assets/branding/` structure. Do **not** redesign the logo.

```
assets/
  branding/
    logo-full-color.png     # PRIMARY — blue + cyan
    logo-flat-blue.png      # secondary
    logo-white.png          # secondary (dark backgrounds)
    logo-black.png          # secondary (light backgrounds)
    icon.png                # app/mark icon
    favicon.png             # browser favicon
    BRAND_GUIDELINES.md     # usage, spacing, color values, do/don't
```

- **Primary:** Full Color (blue + cyan).
- **Secondary:** Flat Blue · White · Black · Icon · Favicon.

The branding Sprint will add the actual assets and `BRAND_GUIDELINES.md`; this item
only reserves the structure and intent. (No placeholder binaries are committed here —
creating empty/placeholder image files would be modifying branding assets, which this
planning item explicitly excludes.)

## 4. README refresh (PLAN ONLY)

Plan a README refresh to land in a later Sprint:

- Add the new logo (from §3).
- Add high-quality screenshots at **1920×1080**, using **consistent fabricated demo
  data**, **dark theme**, **sidebar expanded**. Never use real company data
  (`CLAUDE.md` §12, §17).
- **Remove the "Zero Backend" positioning** and **update product positioning** to
  accommodate a future backend architecture. Note: this is a documentation/positioning
  change only — it authorizes **no** backend implementation, and the app remains
  client-only until a separate, explicitly approved architecture decision (ADR) says
  otherwise. The current-state architecture docs must not be edited to imply a backend
  exists.

---

## 5. Suggested MAINT-001 sequence (when authorized)

1. Reference-check + remove the two legacy migration scripts (approval-gated).
2. Documentation synchronization + cleanup; reconcile the three navigation hubs.
3. Reserve `assets/branding/` structure + author `BRAND_GUIDELINES.md`.
4. Add branding assets (separate, once assets exist).
5. README refresh (logo + 1920×1080 dark-theme screenshots + positioning update).
6. Verify (build + verifier + harnesses green), deterministic rebuild, PR, controlled
   merge.

## 6. Out of scope for MAINT-001

UX-005C/D/E/F, UX-006, Data Grid redesign, business-logic/calculation changes,
`SCHEMA_VERSION`/storage/migration changes, and any actual backend implementation.

---

*Forward-looking planning only. Implementation of any part is authorized solely by a
subsequent Sprint Assignment.*
