# Architecture Evolution Backlog

The authoritative register for **non-blocking** architecture evolution items — observations worth
resolving deliberately, later, with evidence. An entry here is a question the project has chosen to
hold open, not a problem it is ignoring.

> **What an ARCH item is — and is not.** Every item below is:
> - **non-blocking** — it does not block any merge, release, or current work;
> - **not a defect** — the current implementation is correct and intentional;
> - **not an accepted architecture decision** — nothing here has been decided;
> - **not implementation authorization** — no ARCH item permits code changes on its own.
>
> An item becomes actionable only when a Sprint Assignment authorizes it, typically after its paired
> Proposed ADR is evaluated and Accepted. Until then it is a recorded intention to think, not to build.

## Status legend

- **Planned** — recorded for future evaluation; no decision, no authorization.
- **Under Review** — actively being evaluated (e.g. via its Proposed ADR).
- **Resolved** — closed by an Accepted ADR or a deliberate decision to take no action.

## Register

| ID | Title | Status | Paired ADR |
|---|---|---|---|
| [ARCH-001](#arch-001--aggregate-entry-contract) | Aggregate Entry Contract | Planned | [ADR-008](../03-adr/ADR-008-Aggregate-Entry-Contract.md) (Proposed) |
| [ARCH-002](#arch-002--employment-vs-lifecycle-responsibility) | Employment vs Lifecycle Responsibility | Planned | [ADR-009](../03-adr/ADR-009-Employment-vs-Lifecycle-Responsibility.md) (Proposed) |
| [ARCH-003](#arch-003--compensation-write-authority) | Compensation Write Authority | Planned | [ADR-010](../03-adr/ADR-010-Compensation-Write-Authority.md) (Proposed) |
| [ARCH-004](#arch-004--contract-date-model-authority) | Contract Date Model Authority | Planned | [ADR-011](../03-adr/ADR-011-Contract-Date-Model-Authority.md) (Proposed) |
| [ARCH-005](#arch-005--contract-overlap-enforcement) | Contract Overlap Enforcement | Planned | [ADR-012](../03-adr/ADR-012-Contract-Overlap-Enforcement.md) (Proposed) |

---

## ARCH-001 — Aggregate Entry Contract

**Status:** Planned

### Context
PR-5G introduced metadata-driven aggregate routing. A command may now declare, in its registry entry,
which method the boundary aggregate exposes and which key carries the sanitized payload:

- `boundaryMethod` — the aggregate's decision method (defaults to `prepare`).
- `boundaryPayload` — the key on the decision object holding the sanitized handler input (defaults to
  `patch`).

Today two shapes exist: `EmployeeContactAggregate` and `EmployeeEmploymentAggregate` expose
`prepare(id, patch)` returning `{ ok, patch }`; `EmployeeLifecycleAggregate` exposes
`transition(id, transition)` returning `{ ok, transition }`.

### Objective
Define a consistent public entry contract for future aggregates, so method naming and payload shape
are principled rather than incidental.

### Questions to resolve
- When an aggregate should expose `prepare()`.
- When an aggregate should expose `transition()`.
- Whether other entry methods are permitted, and under what criteria.
- How command metadata should identify the entry method and the returned payload.

### Constraints
- No speculative framework.
- Preserve explicit, domain-focused aggregate business language.
- Preserve backward compatibility (existing routing must remain unchanged).
- Require evidence from additional aggregate implementations before any broader abstraction.

Evaluated in [ADR-008 (Proposed)](../03-adr/ADR-008-Aggregate-Entry-Contract.md).

---

## ARCH-002 — Employment vs Lifecycle Responsibility

**Status:** Planned

### Context
Both `EmployeeEmploymentAggregate` (via `employee.employment.update`) and
`EmployeeLifecycleAggregate` (via `employee.lifecycle.transition`) can affect `employmentStatus`. The
employment command may set `employmentStatus` to any value in `EMPLOYMENT_STATUSES`; the lifecycle
command applies a narrow, validated state machine (`Active ↔ Resigned`, `Active ↔ Terminated`). This
overlap is intentional and correct as shipped, but the authoritative boundary for status changes is
not yet decided.

### Objective
Clarify the authoritative boundary for lifecycle status changes.

### Questions to resolve
- Whether `employmentStatus` changes must occur only through `employee.lifecycle.transition`.
- Whether `EmployeeEmploymentAggregate` should retain a limited status-edit capability.
- How `Inactive` and `On Leave` should relate to lifecycle transitions.
- Whether existing UI paths require a staged migration.

### Constraints
- No behavior change inside PR-5G.
- No retroactive scope expansion.
- Preserve existing runtime until a separately authorized decision is implemented.

Evaluated in [ADR-009 (Proposed)](../03-adr/ADR-009-Employment-vs-Lifecycle-Responsibility.md).

---

## ARCH-003 — Compensation Write Authority

**Status:** Planned

### Context
PR-5H introduced `EmployeeCompensationAggregate` as the controlled Domain path for `monthlyBaseSalary`
updates, via `employee.compensation.update`. The legacy full Employee editor (`openEmployeeModal`) can
still write `monthlyBaseSalary` directly, outside the aggregate gate. Both paths are correct and
intentional as shipped; this item records the open question of which one is authoritative.

### Objective
Determine the authoritative write path for Employee compensation.

### Questions to evaluate
- Should `monthlyBaseSalary` be writable **only** through `employee.compensation.update`?
- Should the legacy Employee editor stop writing salary directly?
- How should any migration occur without runtime regression?
- What business meaning distinguishes `null` from `0` for `monthlyBaseSalary`?
- Should compensation history eventually include the previous and new values (it currently records
  neither)?

### Constraints
- No runtime change.
- No UI migration.
- No implementation authorization.
- Preserve existing behavior.

**ARCH-003 is Planned, non-blocking, not a defect, and not implementation authorization.**

Evaluated in [ADR-010 (Proposed)](../03-adr/ADR-010-Compensation-Write-Authority.md).

---

## ARCH-004 — Contract Date Model Authority

**Status:** Planned

### Context
PR-5I confirmed (via the SPR-049 architecture incident) that the authoritative Contract model stores
`startDate` and `durationMonths`, while `endDate` remains **derived** through the existing Contract
calculation semantics (`contractCalc`). PR-5I introduced `contract.dates.update` as a controlled
Domain path over those stored facts. The legacy full Contract editor (`openContractModal`) can still
write `startDate` and `durationMonths` directly, outside the aggregate gate. Both paths are correct
and intentional as shipped.

### Objective
Establish the permanent authoritative Contract date model.

### Questions to evaluate
- Should all Contract date edits route exclusively through `contract.dates.update`?
- Should the legacy Contract editor stop mutating stored date fields directly?
- Should `endDate` remain permanently derived?
- Should any future UI expose `endDate` as editable (and, if so, how without a second source of truth)?

### Constraints
- No runtime change.
- No UI migration.
- No implementation authorization.
- Preserve current behavior.

**ARCH-004 is Planned, non-blocking, not a defect, and not implementation authorization.**

Evaluated in [ADR-011 (Proposed)](../03-adr/ADR-011-Contract-Date-Model-Authority.md).

---

## ARCH-005 — Contract Overlap Enforcement

**Status:** Planned

### Context
PR-5I intentionally preserved existing overlap behavior: a read-only detector
(`overlappingActiveContracts`) surfaces informational warnings, but no overlap policy exists inside
the Domain. `contract.dates.update` does not reject overlapping date updates and does not touch
sibling Contracts.

### Objective
Determine whether Contract overlap becomes Aggregate validation, a Domain Policy, or remains a UI
warning only.

### Questions to evaluate
- Should overlap **reject** updates, or remain informational?
- If enforced, how should self-overlap exclusion work (a Contract must not overlap "itself")?
- Which layer owns overlap enforcement — the aggregate, a dedicated policy, or the UI?
- What is the authoritative scope of an overlap (per employee, per active status, month-range)?

### Constraints
- No runtime change.
- No overlap engine.
- No implementation authorization.

**ARCH-005 is Planned, non-blocking, not a defect, and not implementation authorization.**

Evaluated in [ADR-012 (Proposed)](../03-adr/ADR-012-Contract-Overlap-Enforcement.md).
