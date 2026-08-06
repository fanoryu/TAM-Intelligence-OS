# TAM Intelligence OS v2.8.5 — Workspace & Contract Timeline Integrity

**Release Name:** Workspace & Contract Timeline Integrity

## Summary
A workspace-presentation and contract-timeline correctness release. It packages work that was completed
and merged to `main` in five bounded sprints — **UX-002A**, **UX-002B**, **UX-003A**, **UX-003B** and
**UX-003C** — plus the UX-001–UX-003 documentation reconciliation. Two things changed in substance: the
application shell became persistent and the UI chrome was retuned for density and legibility; and the
contract timeline became one canonical, reference-date-correct model whose counters, filters, badges and
wording all agree.

No schema change, no new or renamed storage key, no data migration, and **no change to how or when data
is written**. `SCHEMA_VERSION` remains **6**. No historical record is rewritten.

> **Discovery is not implementation.** **UX-001 was a discovery sprint only.** Its output — the minimal
> enterprise-workspace direction, the reduced "AI dashboard" presentation, and the typography and
> density emphasis — is recorded here as **product direction**, not as shipped implementation. The
> sidebar and navigation work UX-001 identified was **deferred to UX-004** and is not in this release.

## Added
- **A persistent application shell (UX-002A).** The shell mounts once. Navigating between views updates
  the view content only; the shell is no longer torn down and rebuilt. Sidebar and navigation node
  identity persists across navigation. Structural regression checks were added to hold this property.
- **Shared token scales (UX-002B).** Spacing, corner-radius and type scales are defined once as tokens
  and applied across the UI chrome. The CSS golden master is now pinned by **digest** rather than
  reconstructed from source.
- **A canonical contract timeline model (UX-003B).** One classifier returns **two independent derived
  dimensions**:

  | Dimension | Values |
  |---|---|
  | **Effective state** | `Draft`, `Cancelled`, `Renewed`, `Scheduled`, `Active`, `Expired` |
  | **Expiry horizon** | `EndingToday`, `EndingThisWeek`, `EndingThisMonth`, `EndingNextMonth`, `WithinWarningWindow`, `None` |

  The dimensions are genuinely independent: an **`Active` contract remains `Active` while carrying a
  horizon**. `Scheduled` is **derived-only** and is never stored. The calendar horizons are calendar
  facts and **do not depend on the configured warning-days setting**. `Expiring Soon` is retained as a
  **compatibility alias**. **No schema or storage migration occurred.**
- **One canonical contract-counter helper (UX-003C).** Every contract counter in the application
  resolves through it, so no surface can drift from another.

## Changed
- **UI chrome typography and density (UX-002B).** A sans-serif UI typeface, with the spacing, radius and
  type token scales above applied consistently.
- **Chart colours are theme tokens (UX-002B).** Chart colours are drawn from the theme tokens rather than
  hard-coded, and the **light-theme chart colours were corrected**.
- **Executive Dashboard reduced from 20 to 13 metric containers (UX-002B).** The alert list is capped
  while **every alert remains reachable**.
- **Contract counter membership is defined once (UX-003C).** `Active` **includes** active contracts that
  carry an expiry horizon. `Scheduled` and `Expired` are **excluded** from `Active`. The ending-soon set
  is a strict **subset** of `Active`. The `Active` and `Scheduled` filters are consistent with the
  badges.
- **Contract wording follows a fixed priority (UX-003C):** **Ends Today** → **Ends This Week** →
  **Final Month** → **Ends Next Month** → **Ending Soon**. Urgency precedes lifecycle.
- **CSV `Status` uses the presentation vocabulary (UX-003C)**, so an export reads the way the screen
  reads. No internal timeline identifier is exposed.

## Fixed
- **Contract timeline reference-date correctness (UX-003A).** `daysUntilEnd` now shares the single
  normalized reference date used by the rest of `contractCalc`. **Today-facing behaviour is preserved**;
  advisory output computed against a **historical** date is now correct. No payroll, committed payroll,
  monthly-plan value, storage key or schema changed.
- **Contract progress wording (UX-003C).** On a three-month contract:

  | Month | Progress | Remaining |
  |---|---|---|
  | 1 | `1/3` | 2 months remaining |
  | 2 | `2/3` | 1 month remaining |
  | 3 | `3/3` | final month — 0 months remaining |
  | 4 (following) | — | `Expired` |

  **`3/3` never means one month remaining.** The bare "N remaining" figures previously rendered on the
  contract detail and employee detail surfaces were replaced by the canonical wording helper.

## Verification
- **Static verifier: 1713 checks** (from 1700). The increase is the retargeted version pin plus **13
  added checks**:
  - **12 release-identity guardrails** — authoritative version agreement, release-name agreement,
    `index.html` title agreement, artifact-filename agreement, absence of a tracked current artifact
    under the superseded v2.8.4 filename, release-notes and changelog v2.8.5 presence, retention of the
    historical v2.8.4 changelog entry, `SCHEMA_VERSION` 6 in both source and artifact, and the OQ/UX
    honesty statements.
  - **1 whole-artifact fidelity check.** Release fault injection found that the existing fidelity checks
    compared only the inlined `<style>` and `<script>` payloads, so bytes appended after `</html>` or an
    edited `<title>` could not fail the verifier. The artifact is now re-assembled with the builder's own
    algorithm and compared **byte-for-byte**.

  **No existing check was weakened or removed.**
- **Runtime harnesses: eleven, 1333 checks — unchanged.** Contract timeline **349**. No runtime
  assertion was added or altered, because the release sprint itself changes no business, payroll,
  contract, storage or UI behaviour.
- **Deterministic build.** Two consecutive clean builds are byte-identical; the artifact embeds no
  timestamp, machine path, or other nondeterministic data.

## Known limitations
- **UX-004 — Sidebar & Navigation is not in this release.** There is **no** context-aware sidebar, **no**
  breadcrumb or quick-action system, and **no** collapsed / pinned / hover-expand rail.
- **UX-005 — Responsive/Mobile Refinement is not in this release.** There is **no** mobile drawer.
- **OQ-2 and OQ-3 remain OPEN.** Contract editor routing (ADR-014 step 2) stays blocked on OQ-2. **No
  contract editor authority migration** and **no deletion-command migration** occurred.
- **No storage or schema migration occurred**, and none is planned by this release.
- UX-001 remains **discovery only**. Nothing shipped from it beyond what UX-002 and UX-003 delivered.
- Prior residual limitations are carried forward unchanged: Monthly Plan commit and Payroll posting
  remain non-atomic with the residual states documented in v2.8.3 and v2.8.4; Integrity Check detects
  but does not repair; Smart Import undo retains its in-memory/storage divergence; supplemental source
  remains **overtime only**; Projects / Vendors / Financial Calendar remain non-functional placeholders
  (labeled **SOON**).

## Upgrade / storage
- **No data migration is required.** `SCHEMA_VERSION` remains **6**, and no migration runs on upgrade.
- **No storage key is added, removed, or renamed** (still 15 keys). No migration flag is added or reset.
- **Existing backups remain compatible.** A Complete Backup exported from v2.8.4 restores in v2.8.5, and
  a backup exported from v2.8.5 retains the same schema contract. A restore round-trip does not alter
  stored data.
- **Payroll and committed payroll semantics are unchanged.** Committed payroll remains immutable and
  byte-identical across the upgrade.
- A fresh install still seeds **no** data.

## QA
- Build: `dist/tam-intelligence-os-v2.8.5.html`, byte-identical on rebuild.
- Verify: **1713 checks** — no weakened checks.
- Runtime: **1333 checks** across eleven harnesses — contract core **129**, contract persistence **74**,
  **contract timeline 349**, integrity payroll rules **144**, integrity rules **67**, integrity warning
  rules **146**, monthly plan **118**, payroll committed **72**, payroll posting **106**, renewal **67**,
  `saveAllData` **61**.
- Browser: modular source and portable build both boot with **zero console errors** and agree with each
  other; dark and light themes at 1280px and 480px; a fresh install seeds no data.

## Known Existing Issues

Everything in this section is **pre-existing**. None of it is a regression, and **none of it was
introduced by v2.8.5**. Each item was measured against the v2.8.4 baseline during release verification
and behaves identically there. These are open conditions in the shipped product, not roadmap items —
work that is merely *not yet built* is listed under **Known limitations** above, not here.

- **OQ-2 — contract editor status control: OPEN.** The open question behind ADR-014 step 2 is
  unresolved, so contract editor routing stays blocked. Pre-existing; unchanged by v2.8.5.
- **OQ-3 — delete as a command: OPEN.** The deletion-command question is unresolved and no
  deletion-command migration has occurred. Pre-existing; unchanged by v2.8.5.
- **Four pre-existing CodeQL alerts.** Three `js/insecure-randomness` (in `js/core/onboarding-reset.js`,
  `js/finance/execution-center.js`, `js/ui/settings-about.js`) and one
  `js/incomplete-multi-character-sanitization` (in `js/analytics/reports.js`). All four were raised on
  2026-07-31, all predate this release, and v2.8.5 adds no new alert and touches none of the flagged
  code paths.
- **Headless `prompt()` limitation during first-run QA.** In a headless browser the first-run flow can
  report that `prompt()` is not supported. It is an artifact of the QA environment, not of the
  application, and it is identical to the previous baseline. Normal seeded flows are unaffected.
- **Out-of-range `refKey` inconsistency.** `contractRefDate()` rejects an out-of-calendar-range
  reference key (for example `2026-13`) and falls back to today, but `contractCalc()` derives its month
  arithmetic from the raw key. For such a key the progress/expiry figures and `daysUntilEnd` are
  therefore computed against **different** reference points and can disagree. No application code path
  produces an out-of-range key — every caller passes either a real month key or nothing — so this is
  reachable only by direct programmatic call. Pre-existing and unchanged by v2.8.5.
- **Unreachable `"Contract expired"` payroll exclusion branch.** This is the previously identified and
  intentionally deferred payroll issue. `payrollExclusionReason()` classifies an expired contract with
  the test `cc.current > cc.total`, but `contractCalc()` **clamps** `current` to `total` once the
  contract has ended, so that condition can never hold. The branch and its `"Contract expired"`
  exclusion message are therefore unreachable, and a post-end month instead falls through to
  `"No active contract covering this month"`. The employee is still correctly excluded from payroll —
  only the *reason wording* is less specific than intended. The sibling `"Contract not started"` branch
  is unaffected and remains reachable. Pre-existing, intentionally deferred, and unchanged by v2.8.5.
- **Model-impossible `Expired` + expiry-horizon presentation combination.** Separately from the payroll
  branch above, `contractTimeline()` resolves the `Expired` state *before* the horizon dimension, so a
  non-Active state always carries the horizon `None`. Any presentation key pairing `Expired` with a
  non-`None` horizon is consequently impossible by construction. This is **not** a defect and not the
  payroll issue above: the canonical model is behaving exactly as designed, the combination produces no
  incorrect output, and the reachable state/horizon set was verified exhaustively. Recorded only so the
  impossibility is documented rather than rediscovered. Pre-existing and unchanged by v2.8.5.

## Git Information
- Release tag: `v2.8.5` *(not yet created)*
- Release branch: `release/v2.8.5` → `main`
- Publication channel: GitHub Releases
- Contributing commits (since `v2.8.4`):
  - `2bc8cd6` — feat: separate application shell from view rendering (UX-002A)
  - `cff7678` — feat: CSS foundation — tokens, typography and golden-master revision (UX-002B Phase 1)
  - `05333cf` — fix: restore narrow-width grid containment (UX-002B Phase 1 remediation)
  - `e558b27` — fix: tokenize chart colors across themes (UX-002B Phase 2)
  - `0a708d9` — feat: simplify dashboard information density (UX-002B Phase 3)
  - `f13c496` — fix: make contract timeline calculations reference-date coherent (UX-003A)
  - `cafdb0e` — feat: add derived contract state and expiry horizon model (UX-003B)
  - `537095e` — feat: align contract counters filters and timeline wording (UX-003C)
  - `b94bfc0` — docs: reconcile UX-001 through UX-003 documentation

## Release Asset
- Asset: `tam-intelligence-os-v2.8.5.html`
- Size: 965,767 bytes
- SHA-256: `32e624a262ef1da47bd4ec849471ff98e428402c33722db1715cf1c23a7db8cb`

The asset is built from `main` by `tools/build-single-file.js` and is byte-reproducible: rebuilding from
the same source produces an identical file, so the checksum above verifies any downloaded copy.

> The size and SHA-256 above describe the artifact built during release preparation. The published asset
> is the one rebuilt and verified from the **tagged** `main` commit; it must be re-measured at
> publication time and is not assumed to equal any earlier artifact.
