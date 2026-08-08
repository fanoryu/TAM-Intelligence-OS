# UX-006A — Identity Foundation: Implementation Plan

**STATUS: IMPLEMENTATION PLAN — NOT IMPLEMENTED.** No production code is authorized by this document. It
translates the frozen [`UX-006-Identity-Personal-Workspace-Architecture.md`](UX-006-Identity-Personal-Workspace-Architecture.md)
(the **UX-006 baseline**, merged in `99c0f08`) into an exact, reviewable build plan for the **UX-006A —
Identity Foundation** phase. Implementation begins only under a separate, owner-authorized implementation
assignment. This plan makes **no** new architectural decisions; where the baseline is silent it selects the
smallest repository-consistent option and records the rationale so implementation can execute mechanically.

---

## 0. Baseline (verified against the working tree)

| Fact | Value | Verified |
|---|---|---|
| Branch base | `main` | ✓ (`main == origin/main`) |
| Main SHA | `99c0f0840b19c91b2e7fd47961d93150fed7c9b8` | ✓ |
| Architecture merge / reviewed head (parent-2) | `99c0f08` / `7d2ff45` | ✓ |
| Working tree | clean | ✓ |
| Version / release | TAM OS **2.9.0 — Workspace Experience** | ✓ (`js/core/constants.js`) |
| `SCHEMA_VERSION` | **6** | ✓ (`js/core/constants.js:35`) |
| Verifier | **2013 PASS** | ✓ (`node tools/verify-build.js`) |
| Runtime harnesses | **18** files (`tools/verify-*-runtime.js`), GS **26** / DG **36** | ✓ |
| Artifact | `dist/tam-os-v2.9.0.html` — **1,049,018 bytes** | ✓ |
| Artifact SHA-256 | `e7470ff5261896b8d7d1f8645294d2abd6a72e9820df94b799973627ddcaf3ea` | ✓ |
| v2.9.0 tag | peels to `598edef0` (unmoved) | ✓ |
| UX-006 production code | **none** (`js/core/identity.js`, `workspace.js`, `authz.js` absent) | ✓ |

This plan changes none of the above. It adds only documentation.

---

## 1. Source Files Inspected (evidence base)

- **Bootstrap:** `js/core/app-bootstrap.js` — a single async IIFE: `await loadState() → applyTheme() →
  installGlobalUIHandlers() → render() → maybeShowFirstRunChoice()`.
- **State:** `js/core/state.js` — one global `State` object literal; `DEFAULT_SETTINGS`; session-only UI
  slices already colocated on `State` (e.g. `grid`, `navCollapsed`, `budgetSim`, `storageReady`).
- **Constants / identity block:** `js/core/constants.js` — app identity + frozen enum objects (`STATUS`,
  `OVERTIME_STATUSES`, …). `SCHEMA_VERSION = 6` at line 35. Convention: **frozen plain objects / literal
  arrays** for closed vocabularies (`const STATUS = { PLANNED:'planned', … }`).
- **Utilities:** `js/core/utils.js:2` — `uid(prefix)` id generator (opaque client id). `escapeHtml` present.
- **Resolvers:** `js/people/people-core.js:288` — `empById`, `contractById`, `payrollPlanById` (unguarded
  today; SELF-scope wrapping is **UX-006B**, out of scope here).
- **Storage adapter:** `js/core/storage-adapter.js` — single persistence gateway; `tam_*_v1` keys; the
  proven migration template (flag-guarded, back-up-first). Not touched by UX-006A.
- **Seam precedent:** `js/repository/employee-repository.js` — the exact pattern for a **frozen, delegating,
  globally-exposed seam** (`const X = Object.freeze({ … }); window.X = X;`), owning no business behavior.
  This is the template for `IdentityProvider`.
- **Load-order manifest:** `tools/module-order.js` — single source of truth for JS order; `index.html`
  mirrors it; build/verify read it.
- **Harness pattern:** `tools/verify-contract-core-runtime.js` (and 17 siblings) — dependency-free Node `vm`
  loader that concatenates `module-order.js` **minus** `core/app-bootstrap.js`, runs against an in-memory
  `window`/`localStorage` mock, exposes `window.__TAM__ = {…}`, and asserts with a local `check()` counter.
- **Verifier:** `tools/verify-build.js` — single-process structural verifier; asserts harness **presence**
  (`fs.existsSync`), never executes them; frozen-surface guards scan **named** modules only (see §12.1).
- **CI:** `.github/workflows/ci.yml` — runs `build-single-file.js` then `verify-build.js` (+ dist name/size
  checks); it does **not** execute the runtime harnesses. `codeql.yml` runs CodeQL.
- **Seed data:** none — a fresh install starts empty (Constitution §7.4). **Consequence:** no employee
  records exist at runtime by default (see §7, §17).

---

## 2. Frozen decisions carried in (non-negotiable)

Identity only; **no** authentication (no password/token/OAuth/session/credential/network). Provider-based
local principal selection is an **identity abstraction, not a security boundary**. Ship representative
**CEO** and **Employee** principals. One canonical `currentUser` contract; consumers never read fixtures or
storage directly. Identity persistence is **conditional** (default: none). `SCHEMA_VERSION` stays **6**; no
migration. **No** workspace ownership, SELF-scope resolvers, or authorization in UX-006A (those are 006B/C).

---

## 3. Proposed `User` contract (minimum viable)

The baseline proposed `{id, displayName, principalType, employeeId?, email?}`. For UX-006A the **minimum
necessary** contract omits `email` (§22 privacy — no consumer needs it this phase):

| Property | Type | Req? | Allowed values | Invariant | Why UX-006A needs it | Persist? | Backend-preserved? |
|---|---|---|---|---|---|---|---|
| `id` | `string` | **req** | opaque, `uid('user')` | immutable, non-empty | stable principal identity for the selector | conditional (§13) | yes — maps to backend user id |
| `displayName` | `string` | **req** | non-empty | mutable | proves a resolved principal is more than an id | conditional | yes — mirrors profile |
| `principalType` | `string` | **req** | `'ceo'` \| `'employee'` (see §6) | immutable per user | drives future workspace/scope; identity classification only | conditional | yes — maps to role claim |
| `employeeId` | `string` | **cond.** | present **iff** `principalType === 'employee'` | immutable; forward reference (§7) | proves the SELF-scope join key exists on the contract | conditional | yes — join key |

`email` is **deliberately excluded** in UX-006A (add later only if an auth handle is required). No
password/hash/token/avatar/phone/last-login — ever, client-side. Favor minimum surface area.

---

## 4. `principalType` representation

Follow the repository's closed-vocabulary convention (frozen plain object, like `STATUS`):

```js
// js/core/identity.js
const PRINCIPAL_TYPES = Object.freeze({ CEO: 'ceo', EMPLOYEE: 'employee' });
```

- **Location:** `js/core/identity.js` (the new identity module), not `constants.js` — it is identity-domain
  data, and colocating it with the provider/selector keeps the identity surface in one file.
- **Values** are the exact lowercase literals the baseline froze (`ceo`, `employee`).
- **Not** RBAC roles. `principalType` is identity classification for this phase; authorization vocabulary
  (`can(...)`, capabilities) is **UX-006C** and must not appear here.

---

## 5. `IdentityProvider` contract (minimal, sync)

Modeled on `EmployeeRepository` (frozen object, global-exposed, delegating, no business behavior). UX-006A
needs **only synchronous resolution** — there is no network, so async buys nothing and would complicate
bootstrap. Future backend swap is preserved by keeping the **interface** stable, not by pre-adding async.

```js
const IdentityProvider = Object.freeze({
  // Returns the currently-selected principal as a validated User, or null.
  // Pure read of provider-owned in-memory state; never throws for "no principal".
  getCurrentUser() { /* returns User | null */ },
  // Enumerates the principals this provider can supply (fixtures in UX-006A).
  listAvailablePrincipals() { /* returns User[] (may be []) */ },
  // Selects the active principal by id; returns the resolved User or null on miss.
  // API-only in UX-006A (no UI). Provider owns selection state (§11 option A).
  selectPrincipal(userId) { /* returns User | null */ }
});
```

- **Return semantics:** `getCurrentUser()` → validated `User` or `null`. `listAvailablePrincipals()` →
  array (possibly empty). `selectPrincipal(id)` → resolved `User` or `null` (unknown id is a no-op miss,
  not a throw).
- **Null semantics:** `null` means *identity unresolved / no principal selected* — a **fail-closed** state
  (§9, §17). Never a privileged default.
- **Error semantics:** the provider does not throw for ordinary "no/unknown principal". A malformed fixture
  is rejected by validation (§18) and surfaces as `null`, never as a partial `User`.
- **Selection ownership:** switching lives in the provider (`selectPrincipal`) — API only. **Available-
  principal discovery** (`listAvailablePrincipals`) is included because the two representative principals
  must be enumerable to prove Q2; it reads fixtures, no persistence.
- **Excluded (premature):** `login`, `logout`, `refreshToken`, `authenticate`, sessions, credentials,
  network calls.

---

## 6. `currentUser` contract (single canonical access path)

Repository convention has no pre-existing selector pattern for identity, so this plan **establishes one**:
a single free function that delegates to the provider. Consumers call the selector — never the provider or
fixtures directly (enforced by §16 and a verifier guard, §20).

```js
function getCurrentUser() { return IdentityProvider.getCurrentUser(); }  // the ONLY consumer entry point
```

Semantics:

| Situation | `getCurrentUser()` returns | Meaning |
|---|---|---|
| resolved principal | the validated `User` | active principal |
| no principal selected | `null` | identity unresolved (fail-closed) |
| invalid provider result | `null` (validation rejects) | never a fabricated/partial user |
| initialization not run | `null` | not-yet-resolved (fail-closed) |
| unknown `principalType` | `null` (validation rejects) | never inferred as CEO |

**"Fail closed" in UX-006A** (before authorization exists) concretely means: identity-dependent code must
treat `null` as *no principal*, **never** infer or default to CEO/privileged, and never fabricate a `User`.
Because UX-006A wires **no** identity-dependent product surface, the practical invariant is: the selector
faithfully returns `null` rather than a convenience default, and the tests assert exactly that. Existing
v2.9.0 behavior remains fully operational when `currentUser` is `null` (identity is additive, non-gating).

---

## 7. CEO & Employee representative principals

Deterministic fixtures inside the local provider (`js/core/identity.js`) — not `constants.js`, not runtime
seed data (the app seeds nothing). Obviously-fabricated values; no real PII.

```js
const FIXTURE_PRINCIPALS = Object.freeze([
  Object.freeze({ id: 'user_ceo_fixture',      displayName: 'Executive (CEO)', principalType: 'ceo' }),
  Object.freeze({ id: 'user_employee_fixture', displayName: 'Employee (Sample)', principalType: 'employee',
                  employeeId: 'emp_fixture_self' })
]);
```

- **CEO:** `principalType: 'ceo'`, no `employeeId` (Executive scope is company-wide; the link is N/A).
- **Employee:** `principalType: 'employee'` with `employeeId` present to prove the SELF-scope **join key
  exists on the contract**.
- **`employeeId` is a forward reference (critical, source-grounded).** A fresh install has **no** employee
  records, so `emp_fixture_self` intentionally resolves to nothing today. UX-006A validates only its
  **shape/presence**, never resolves it against `State.employees` (resolution is UX-006B). This avoids
  mutating or depending on business data and keeps the fixture deterministic. See §17 (`employee missing
  employeeId` → invalid) vs. *unresolved* `employeeId` (valid, expected).
- **No default selection.** The provider starts with **no** active principal (`getCurrentUser() → null`);
  tests drive `selectPrincipal(...)`. Defaulting to CEO for convenience would violate fail-closed (§10).

---

## 8–10. Principal selection & default behavior

- **Switching:** implemented **API-only** via `IdentityProvider.selectPrincipal(id)`. No UI (a principal-
  switch UI is **UX-006D**).
- **Driven by:** fixture/provider configuration; the two `FIXTURE_PRINCIPALS` are the selectable set.
- **Initial/default:** **no active principal** at construction → `getCurrentUser()` returns `null`.
  "No active principal" is a valid, expected UX-006A state.
- **Reload preservation:** **not** required in UX-006A (no persistence — §13). If a future phase shows a
  concrete continuity need, persistence is added then, guarded (§13).
- **Why no CEO default:** silently defaulting to the privileged principal is precisely the fail-closed
  violation the baseline forbids (Risk 3/4). Selection must be explicit.

---

## 11. State integration — recommendation

**Chosen: Option A — provider-owned private state** (selection state lives inside `IdentityProvider`'s
module closure), exposed only through `getCurrentUser()`.

| Option | Coupling | Testability | Bootstrap impact | 006B fit | Backend swap | Ergonomics |
|---|---|---|---|---|---|---|
| **A. Provider-owned (chosen)** | lowest — no `State` change | high — construct provider, assert selector | none — `State` untouched | 006B adds `State.identity` when workspace needs it | cleanest — swap provider only | consumers call one selector |
| B. `State.identity` slice now | adds identity to global `State` | high | edits `state.js` | native home for workspace later | fine | direct `State` reads (discouraged) |
| C. Thin module + private state | same as A, different name | high | none | same as A | same as A | same as A |
| D. Other | — | — | — | — | — | — |

Rationale: A is the **smallest seam** and keeps `js/core/state.js` byte-stable this phase, minimizing
frozen-surface risk. **Exact state shape added to `State`: none in UX-006A.** (UX-006B may introduce
`State.identity = { currentUser, activeWorkspace, availableWorkspaces }` when workspace resolution needs a
render-visible home — deferred by design.)

---

## 12. Bootstrap integration

Smallest possible seam; **do not restructure** the IIFE.

- **Timing:** resolve identity **after** `loadState()` (storage/migration) and **before** `render()` —
  matching the baseline's bootstrap order, minus workspace (006B).
- **Construction:** the frozen `IdentityProvider` needs no construction; add a single call, e.g.
  `resolveIdentity()` (a thin function that, in UX-006A, is a no-op beyond leaving `currentUser === null`,
  or selects nothing). The plan's default: **add the seam call but select no principal**, so behavior is
  unchanged and `currentUser` stays `null`.
- **Relation to `loadState()`:** identity resolution is **independent** of business-state load; it neither
  reads nor blocks it.
- **Rendering:** **not** blocked on identity. Existing app renders exactly as today when `currentUser` is
  `null`.
- **Failure behavior:** any provider/validation failure → `currentUser === null`; app continues.
- **Proposed edit (one line, additive):**

```js
(async function init(){
  await loadState();
  applyTheme();
  resolveIdentity();          // UX-006A: establish the identity seam (currentUser resolvable; null by default)
  installGlobalUIHandlers();
  render();
  maybeShowFirstRunChoice();
})();
```

`app-bootstrap.js` is **outside** every frozen-surface guard scan (§12.1), so this edit trips none of them.

### 12.1 Frozen-surface guard finding (why UX-006A is low-risk)

`verify-build.js`'s "no UX-006 role/auth/workspace/currentUser" guards scan **named** modules only:
dashboard sources, `data-grid.js`, `global-search*.js`, `components.css`, and `shell + stabilization +
transaction-modals` (line ~3782). A **new** `js/core/identity.js` and an additive line in
`app-bootstrap.js` are in **none** of those sets, so the identity symbols do not trip them. The only rule
to honor: identity symbols (`currentUser`, `IdentityProvider`, `PersonalWorkspace`, …) must **not** leak
into the scanned modules. Implementation must not import identity into shell/stabilization/txn/dashboard/
grid/GS/CSS. (A later phase that *does* touch those surfaces will update the guards under its own
authorization — not UX-006A.)

---

## 13. Storage decision — **NO UX-006A identity persistence**

**Recommendation: NO persistence.** Source evidence: the two representative principals are static fixtures;
no UX-006A surface consumes a persisted selection; there is no reload-continuity requirement (no UI, no
identity-dependent view). Therefore UX-006A introduces:

- **no** new `tam_*` keys (specifically **not** `tam_users_v1`, **not** `tam_active_principal_v1`);
- **no** migration and **no** migration flag;
- **no** backup-format change;
- **no** `SCHEMA_VERSION` bump (stays **6**).

If a later phase proves a concrete continuity need, persistence is added then as **additive dedicated keys**
following the proven flag-guarded template — with its own schema decision at that time.

---

## 14. Exact file plan (proposed diff at file level)

**New / changed (production — *for the future implementation assignment only*):**

| File | New/Existing | Purpose | Symbols | Why UX-006A |
|---|---|---|---|---|
| `js/core/identity.js` | **new** | identity module: types, fixtures, provider seam, selector | `PRINCIPAL_TYPES`, `FIXTURE_PRINCIPALS`, `IdentityProvider`, `getCurrentUser`, `resolveIdentity`, internal `isValidUser` | the whole identity surface in one file |
| `tools/module-order.js` | existing | register load order | add `'core/identity.js'` after `'core/utils.js'` | manifest is load-order SoT |
| `index.html` | existing | mirror manifest | add `<script src="js/core/identity.js">` in the same position | index mirrors the manifest (MUST) |
| `js/core/app-bootstrap.js` | existing | seam call | add `resolveIdentity();` (one line, §12) | establish the seam without gating render |
| `tools/verify-identity-foundation-runtime.js` | **new** | behavioral harness (§19) | `vm` loader + `check()` cases | proves identity behavior out-of-process |
| `tools/verify-build.js` | existing | additive structural guards (§20) | new `check(...)` lines only | structure/preservation guardrails |
| `dist/tam-os-v2.9.0.html` | existing | rebuilt from source | — | build re-inlines new module (§24) |

**Load-order placement:** `core/identity.js` immediately **after** `core/utils.js` (it uses `uid`) and
before `core/state.js`. It depends on nothing else and touches no `State`, so this is the lowest-risk slot.

**Must NOT change:** `js/core/state.js`, `js/core/constants.js` (`SCHEMA_VERSION`), `js/core/storage-adapter.js`,
`js/core/state-load-migrations.js`, `js/people/people-core.js` (resolvers), `data-grid.js`, `global-search*.js`,
`global-search-ui.js`, Action Center sources, all `css/*`, `APP_VERSION`, published v2.9.0 tag/asset.

---

## 15. Public API surface (smallest useful)

| Symbol | Module | Signature | Returns | Failure | Consumers | Frozen after 006A? |
|---|---|---|---|---|---|---|
| `getCurrentUser` | `identity.js` | `() → User\|null` | validated `User` or `null` | returns `null` | future identity-aware code (none yet) | contract frozen; impl may extend |
| `IdentityProvider` | `identity.js` | frozen object | see §5 | `null` / no-op | selector, bootstrap, tests | interface frozen |
| `PRINCIPAL_TYPES` | `identity.js` | frozen object | `{CEO, EMPLOYEE}` | — | validation, future workspace/authz | values frozen |
| `resolveIdentity` | `identity.js` | `() → void` | — | swallows → `null` | bootstrap only | may extend in 006B |

`FIXTURE_PRINCIPALS` and `isValidUser` are **module-internal** (not part of the consumer API; tests reach
them via the `window.__TAM__` export the harness sets, mirroring existing harnesses).

---

## 16. Module dependency graph (enforced direction)

```
consumers (future identity-aware code; NONE in UX-006A)
        │  call only
        ▼
getCurrentUser()  ── selector façade (identity.js)
        │
        ▼
IdentityProvider  ── seam (identity.js), provider-owned selection state
        │
        ▼
FIXTURE_PRINCIPALS + isValidUser  ── local fixtures/validation (identity.js)
```

Forbidden: UI/business modules reading `FIXTURE_PRINCIPALS` or provider state directly; provider importing
UI/shell; identity importing `State` (Option A keeps it `State`-free in 006A); any circular
bootstrap/state dependency. Because everything lives in one leaf module loaded early, cycles are
structurally impossible in this phase.

---

## 17. Fail-closed matrix

| Condition | UX-006A behavior |
|---|---|
| valid CEO principal selected | `getCurrentUser()` → CEO `User`; `principalType==='ceo'`; no `employeeId` |
| valid Employee principal selected | `getCurrentUser()` → Employee `User`; `employeeId` present (unresolved is fine) |
| provider returns null / none selected | `getCurrentUser()` → `null`; **no privileged inference** |
| provider returns malformed object | validation rejects → `getCurrentUser()` → `null` (never partial `User`) |
| unknown `principalType` | validation rejects → `null` (never treated as CEO) |
| employee **missing** `employeeId` | **invalid** → `null` (employee requires the join key) |
| employee `employeeId` present but unresolved | **valid** in 006A (forward reference; resolution is 006B) |
| provider `selectPrincipal` throws / bad id | no state change; `getCurrentUser()` unchanged (stays `null` if none) |

No branch fabricates a privileged identity as recovery.

---

## 18. Runtime validation plan

- **Location:** a small internal `isValidUser(u)` in `identity.js`; the provider/selector return `null`
  rather than an invalid `User`.
- **Checks:** object is non-null; `id` non-empty string; `displayName` non-empty string; `principalType`
  ∈ `PRINCIPAL_TYPES`; if `principalType==='employee'` then `employeeId` is a non-empty string; if
  `'ceo'` then `employeeId` absent. No unexpected credential-like fields.
- **Invalid-result behavior:** treated as no principal → `null` (fail-closed).
- **No schema library** — plain guards, matching repository style (`computeStatus`-level simplicity).

---

## 19. Test plan (concrete cases)

**One new dedicated harness:** `tools/verify-identity-foundation-runtime.js`, using the established `vm`
loader (concatenate `module-order.js` minus `app-bootstrap.js`; export `window.__TAM__ = { IdentityProvider,
getCurrentUser, PRINCIPAL_TYPES, FIXTURE_PRINCIPALS, isValidUser }`). One harness (not many) matches the
"one bounded concern per harness" precedent and keeps the count change to **+1** (18 → 19).

Cases:
- **User contract:** CEO fixture valid; Employee fixture valid; missing `displayName` rejected; missing
  `id` rejected; employee missing `employeeId` rejected; CEO with stray `employeeId` rejected; invalid
  `principalType` rejected.
- **IdentityProvider:** `listAvailablePrincipals()` returns both principals; `selectPrincipal('user_ceo_fixture')`
  resolves CEO; `selectPrincipal('user_employee_fixture')` resolves Employee; `selectPrincipal('nope')` →
  `null` no-op; malformed injected fixture → not resolvable.
- **currentUser:** initial `getCurrentUser()` → `null` (no default); after selecting CEO → CEO; after
  selecting Employee → Employee; never fabricates CEO on unknown state; a consumer using only
  `getCurrentUser()` needs no fixture knowledge.
- **Employee linkage:** employee `User` carries `employeeId` (shape asserted); unresolved `employeeId`
  does not throw and does not auto-resolve (006B boundary).
- **Preservation (in-suite):** running the full harness set still passes; GS harness **26**; DG harness
  **36**; verifier **presence** check for the new harness passes.

**Harness structure recommendation:** **one new dedicated runtime harness** (not an extension of a core
harness — identity is a new bounded concern with its own fixtures), consistent with the SPR-077…095 pattern.

---

## 20. Verifier additions (additive, structural — implement in 006A, not now)

Add `check(...)` lines to `verify-build.js` (never weaken existing checks):

- identity module present: `js/core/identity.js` exists and is registered in `module-order.js` **and**
  mirrored in `index.html`;
- `PRINCIPAL_TYPES` defines exactly `ceo` + `employee`; both representative principals present;
- a single canonical `getCurrentUser` selector exists; **no** `authenticate|login|logout|password|token|
  OAuth|session` symbols in `identity.js` (no-auth guard);
- **no** identity persistence: `identity.js` contains no `tam_*_v1` key and no `StorageAdapter`/`localStorage`
  reference (matches the §13 decision);
- `SCHEMA_VERSION` still `6` (existing check already covers this);
- new runtime harness present: `tools/verify-identity-foundation-runtime.js` (`fs.existsSync`);
- GS/DG source-digest/preservation and artifact-integrity checks remain green.

Avoid brittle internal-syntax freezes (e.g. exact fixture ids) beyond what proves the contract.

---

## 21. Security / trust guardrails (anti-overclaim)

- File header comment in `identity.js`: *"Development/client identity abstraction. Provider-based local
  principal selection is NOT authentication; it is spoofable client-side; real security enforcement is a
  future backend responsibility. No credential material is stored or verified."*
- Verifier no-auth guard (§20) mechanically prevents auth vocabulary creeping in.
- No security UI, no "secure/login" wording in code or docs.

## 22. Privacy decision

`email` **omitted** in UX-006A (no consumer needs it). No passwords/credentials/tokens/PII. Fixtures use
obviously-fabricated labels. Add `email` only if a future auth handle is required, as an additive optional
field.

## 23. Accessibility / UI impact

**None.** No visible product UI, no CSS change. Principal-switch UI is **UX-006D**. Switching is API-only.

## 24. Build / portable-artifact implications

Adding `core/identity.js` to the manifest means `build-single-file.js` inlines one more script in order;
the deterministic build stays reproducible. **Implementation will rebuild `dist/` (a new working artifact),
committed with its source (Constitution §15.1).** The **published v2.9.0 release/tag/asset is immutable and
never modified.** No artifact change occurs in *this planning* assignment.

---

## 25. Implementation order (for the future assignment)

1. `PRINCIPAL_TYPES` + `isValidUser` (contract/validation) → unit-check in isolation.
2. `FIXTURE_PRINCIPALS` (CEO + Employee) → shape asserted.
3. `IdentityProvider` seam (`getCurrentUser`/`listAvailablePrincipals`/`selectPrincipal`).
4. `getCurrentUser()` selector façade.
5. Register in `module-order.js` **and** `index.html` (together).
6. `resolveIdentity()` + one-line bootstrap seam.
7. New runtime harness `verify-identity-foundation-runtime.js`.
8. Additive verifier guards.
9. `build-single-file.js` → rebuild `dist/`; full verifier + all harnesses; regression (GS 26 / DG 36).

Checkpoint after each step: verifier green + no frozen-surface regression.

## 26. Acceptance criteria (measurable)

- `js/core/identity.js` exists, registered in manifest + mirrored in `index.html`.
- `getCurrentUser()` returns a validated `User` for a selected CEO or Employee principal, `null` otherwise.
- Both representative principals selectable via `IdentityProvider`.
- Fail-closed matrix (§17) holds for every row; no privileged default.
- No auth symbols; no `tam_*` identity key; no `StorageAdapter`/`localStorage` in `identity.js`.
- `SCHEMA_VERSION === 6`; no migration; no business-data change.
- GS harness **26**, DG harness **36**, all pre-existing harnesses green.
- New identity harness green; verifier total **increases** (all prior checks still pass) — expected order
  **2013 → >2013**; runtime harness count **18 → 19**.
- Deterministic build reproducible; new working `dist/` committed with source.
- v2.9.0 published release/tag unchanged.

## 27. Stop conditions (halt implementation; escalate)

Halt and request an architecture decision if any occurs: identity requires a persisted-state migration;
a `SCHEMA_VERSION` bump becomes necessary; the Employee principal cannot be represented without resolving
against (absent) employee data; bootstrap cannot host the seam without a structural refactor; the work
would require workspace/authz behavior to function; Global Search / Data Grid must change; the provider
contract is pushed toward authentication semantics; any contradiction with the frozen baseline; any
historical-release mutation; or unrelated regressions.

## 28. Implementation PR strategy

- **Branch:** `feature/ux-006a-identity-foundation` (per Constitution §5 naming).
- **One narrowly-scoped PR** (source evidence supports it: ~1 new module + 3 small registrations + 1
  harness + additive verifier lines + rebuilt `dist/`).
- **Expected changed files (~6):** `js/core/identity.js` (new), `tools/module-order.js`, `index.html`,
  `js/core/app-bootstrap.js`, `tools/verify-identity-foundation-runtime.js` (new), `tools/verify-build.js`,
  plus the rebuilt `dist/tam-os-v2.9.0.html`.
- **Review boundaries:** identity-only; zero change to business logic, storage, schema, frozen surfaces.
- **Docs:** update `AI_CONTEXT.md`/`ARCHITECTURE.md` module map in the **same** PR (identity module now
  exists); this plan and the baseline are referenced, not modified.
- **Merge:** true merge commit (repo convention), owner-approved, after CI + all harnesses green.
- **Not created here** — this assignment does not open the implementation branch.

## 29. Implementation report template (for the future assignment)

Return: baseline SHA; implementation head SHA; changed files; final `User` contract; `IdentityProvider`
contract; `currentUser` behavior + fail-closed proof; CEO fixture; Employee fixture; persistence decision
(expected: none); schema status (expected: 6, no migration); new harness + case results; verifier total
(before/after); GS **26** / DG **36** preservation; artifact size/SHA + rebuilt-dist proof; no-auth
confirmation; no-workspace/no-authz confirmation; CI + CodeQL status; PR identity/status; stop-condition
status; and a GO/HOLD line.

---

## 30. Confirmation — no implementation performed

This is a documentation-only planning artifact. No production/runtime/CSS/business code was written or
changed; no `js/core/identity.js`, provider, `currentUser`, fixtures, bootstrap edit, storage key, schema
change, harness, or verifier change was created. `APP_VERSION` stays `2.9.0`; `SCHEMA_VERSION` stays `6`;
the verifier remains **2013 PASS**; GS **26** / DG **36**; the published v2.9.0 artifact, tag, and all
historical releases remain immutable.

## 31. Recommendation

**GO for UX-006A implementation.** The plan is fully specified against actual repository conventions, the
frozen-surface risk is bounded (identity lives in a new leaf module outside every guard scan), no schema or
persistence change is required, and no open architectural decision remains. The one nuance to carry
forward — the Employee `employeeId` is a **forward reference** with no seed data to resolve against — is
handled by validating shape only in 006A and deferring resolution to UX-006B, and is listed as a stop
condition if that boundary cannot hold.
