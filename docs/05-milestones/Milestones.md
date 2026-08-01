# Milestones

The milestone track from Alpha to Omega. Each milestone groups the pull requests that share a theme.
Status advances only when the underlying work has actually landed on `main`. The forward-looking view
is the [Milestone Roadmap](../01-roadmap/Milestone_Roadmap.md).

---

## Milestone Alpha — **Completed**
**Theme:** Product foundation.

The application itself and the engineering discipline around it: a proprietary, client-side,
single-page finance/payroll/operations app in a shared global scope of classic scripts; a
deterministic single-file build; and the mechanical verifier that guards its invariants.

## Milestone Beta — **Completed**
**Theme:** Domain Foundation.

The Domain layer established and made operational in thin, reversible slices:

- **PR-5 / PR-5A** — descriptive Domain registries and the read-only facade.
- **PR-5B** — first operational query (`employee.filtered`).
- **PR-5C.1** — first operational command (`employee.contact.update`).
- **PR-5D** — first aggregate boundary (`EmployeeContactAggregate`).
- **PR-5E** — second aggregate boundary (`EmployeeEmploymentAggregate`).
- **PR-5F** — shared aggregate helpers extracted (refactor; no behavior change).

**Milestone Beta identifies Domain Foundation as completed.**

## Milestone Gamma — **Completed**
**Theme:** Domain Expansion.

The operational aggregate/command surface widened from Employee alone into the Contract and Payroll
areas, one bounded slice at a time, following the established aggregate → handler pattern:

- **PR-5G** — The Gatekeeper — third aggregate boundary (`EmployeeLifecycleAggregate`).
- **PR-5H** — The Arbiter — fourth aggregate boundary (`EmployeeCompensationAggregate`).
- **PR-5I** — The Binder — first Contract boundary (`ContractDateAggregate`).
- **PR-5J** — The Accountant — first Payroll boundary (`PayrollLifecycleAggregate`).

At close: **6 aggregates, 6 commands, 1 query** on `main`. The next slice, **PR-5K — The Ledger**,
remains Upcoming and is carried forward to future Domain expansion. The frozen repository state is
recorded in [RDR-001](../RDR/RDR-001-gamma-repository-snapshot.md).

## Milestone Delta — **Upcoming**
**Theme:** Domain Events & Policies.

Promote events toward operational, observable domain events emitted after committed transitions, and
express cross-aggregate rules as explicit, testable policies.

## Milestone Epsilon — **Upcoming**
**Theme:** Workflow.

Model multi-step lifecycles (payroll, supplemental, finance execution) as explicit workflows over the
existing status values, preserving derive-don't-duplicate.

## Milestone Zeta — **Upcoming**
**Theme:** Intelligence Layer.

Read-only analytical and advisory capability built strictly as a Domain client — never a parallel
source of truth (see [AI_Architecture.md](../02-architecture/AI_Architecture.md)).

## Milestone Omega — **Upcoming**
**Theme:** Enterprise Platform.

The long-horizon target: a fully Domain-governed operations platform whose every state change is a
registered command, every read a registered query, and every decision an aggregate.
