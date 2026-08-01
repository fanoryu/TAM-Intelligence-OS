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
