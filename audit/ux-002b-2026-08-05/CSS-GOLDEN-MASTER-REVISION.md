# CSS Golden-Master Revision — UX-002B Phase 1

**Date:** 2026-08-05 · **Status:** immutable point-in-time record · **Authorization:** PD-A (approved by the maintainer, recorded in the UX-002B sprint instruction)

This record captures the repository state **immediately before** the first authorized revision of the CSS golden master, and the mechanism change that accompanies it. Per `CLAUDE.md` §18, records under `audit/` are immutable: this file is never rewritten. A future revision adds a new record, it does not edit this one.

---

## 1. Pre-revision state (superseded)

| Item | Value |
|---|---|
| Base commit (`main`) | `d9c534a70c114d0c026c4e437f1c1fa098229209` |
| **`concat(css/*.css)` SHA-256** | **`b311990b405d4d8ac86efb406e9cfefafee2a53b29dec6a201e0690387a8100d`** |
| `concat(css/*.css)` normalized length | 15,660 bytes |
| Portable artifact | `dist/tam-intelligence-os-v2.8.4.html` |
| Artifact size | 937,539 bytes |
| Artifact SHA-256 | `817df58fa5207ba5ea064be097d83dc525e6572ab273c89b545fe287a7128899` |
| Verifier total | 1564 checks |
| Runtime harness total | 984 checks (ten harnesses) |
| `APP_VERSION` | 2.8.4 |
| `APP_RELEASE_NAME` | Monthly Plan Result Integrity |
| `SCHEMA_VERSION` | 6 |

**This is the rollback anchor.** Restoring the five files under `css/` to the content that produces digest `b311990b…8100d`, restoring the previous verifier check, and rebuilding returns the repository to the pre-revision visual state exactly.

## 2. Post-revision state

| Item | Value |
|---|---|
| **`concat(css/*.css)` SHA-256** | **`47413d6eb2e864367aed98e50e8d9a9ed80c14605092b853b08a0c775e35d712`** |
| `concat(css/*.css)` normalized length | 21,738 bytes |
| Verifier total | 1568 checks (1564 + 4 new token/typography invariants; the CSS check itself was replaced 1-for-1) |
| Runtime harness total | 984 checks — unchanged |
| `APP_VERSION` / `APP_RELEASE_NAME` / `SCHEMA_VERSION` | unchanged: 2.8.4 / Monthly Plan Result Integrity / 6 |

## 3. Mechanism change

Until this revision the golden master was verified by a **derivation chain**: the verifier read the tracked reference artifact `tam-intelligence-os-v2.5.2.html`, extracted its `<style>` payload, reconstructed the expected stylesheet by substituting one enumerated string patch (the v2.6.3b floating-menu rule), and asserted byte equality.

That mechanism could not express an authorized multi-file revision. Extending it would have required accumulating further literal `split`/`join` patch pairs — opaque, order-dependent, and silently fragile if an anchor string shifted. It would have looked stricter while becoming weaker.

It is replaced **one-for-one** by an exact **pinned SHA-256 digest of `concat(css/*.css)`** under the verifier's existing normalization (LF-join, leading/trailing newline trim). The check count is unchanged by the swap. The guarantee is strictly stronger: whole-file, exact, no anchor fragility, and every future revision becomes a single reviewable line plus a diff.

**Deliberately unchanged by this revision:**

- `concat(css/*.css) == dist CSS payload` and `concat(js/*.js) == dist JS payload` — build fidelity.
- The `.actions-dropdown.floating{position:fixed` presence assertion.
- `tam-intelligence-os-v2.5.2.html` — retained, tracked, unmodified. It remains load-bearing for JS provenance checks (for example, that the supplemental engine is genuinely absent from the v2.5.2 golden master). Its role narrows to JS only; it is no longer the CSS comparator.

## 4. New invariants introduced alongside the revision

Four static checks now enforce mechanically what were previously conventions:

1. No fractional `font-size` values in CSS — the type scale is integer-only.
2. `var(--serif)` is used exactly once, on `.brand .mark` — UI chrome is sans (PD-B).
3. Every custom property declared in `:root` is also declared in `:root[data-theme="light"]` — dark/light parity cannot be half-defined.
4. Spacing and radius resolve from tokens, with two documented exceptions: values below 4px (hairlines and optical nudges finer than the smallest step), and `td`/`th` padding, frozen by the table density invariant.

Each was independently fault-injected and proven to fail loudly with a specific diagnostic; the pinned digest fires as a backstop in every case.

## 5. Scope of the visual revision

Authorized under PD-A, PD-B and PD-C, per UX-002B Charter Revision 2 items S1–S12:

- Token scales introduced: 6 font sizes, 6 spacing steps, 4 radii.
- `--serif` removed from UI chrome (page titles, card headings, section titles, modal headings); retained on the wordmark only.
- `--accent` split: `--brand` (identity only) and `--interactive` / `--interactive-soft` / `--interactive-ink` (selection and primary action).
- `--warn` / `--warn-soft` introduced; the two previously hardcoded oranges removed, along with the now-dead light-theme `.pill-status-partial` override.
- `--text-faint` raised for WCAG AA at the sizes it is used: dark `#5E6A87` → `#828FB4` (3.12:1 → 5.25:1 on `--surface`); light `#7A879E` → `#5F6B80` (3.63:1 → 5.38:1).
- Chart series tokens added (`--chart-planned`, `--chart-actual`, `--chart-positive`, `--chart-negative`, `--chart-neutral`, `--chart-muted`) for consumption in Phase 2.
- `.main` gutter made responsive at ≤768px and ≤480px.
- `.stat-card` padding and oversized decorative glyphs reduced.

**Not changed:** the neutral surface ladder, `--brick`/`--green` semantics, the remaining light-theme pill overrides, `td`/`th` padding, `SCHEMA_VERSION`, storage keys, migration flags, domain logic, `APP_VERSION`, `APP_RELEASE_NAME`, `index.html`, `tools/module-order.js`.

## 6. Future maintenance

Every subsequent CSS revision requires, in order: explicit maintainer approval; a new dated record under `audit/` carrying the superseded digest; a one-line pin update in `tools/verify-build.js`; a full CSS diff review against a declared change inventory; and the full browser validation matrix in both themes. The pin makes each revision an explicit, dated, reviewable event rather than invisible drift.
