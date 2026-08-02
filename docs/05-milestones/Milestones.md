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

At close: **6 aggregates, 6 commands, 1 query** on `main`, recorded in
[RDR-001](../RDR/RDR-001-gamma-repository-snapshot.md).

> **Since Gamma closed:** PR-5K "The Ledger" (`ContractStatusAggregate`) merged, then Milestone Delta ran
> to completion (see below). The **current authoritative baseline is
> [RDR-007](../RDR/RDR-007-delta-repository-snapshot.md)** at commit `55499f2`; RDR-001 and RDR-003 are
> immutable predecessors and no longer the latest baseline.

## Milestone Delta — **Completed**
**Theme:** Platform & Transport.

Delta established the canonical application Platform and proved it transport-agnostic, one bounded slice at
a time (delivery recorded in [DPR-005](../DPR/DPR-005-delta-completion-report.md)):

- **PR-6A** — The Gateway — the Application Gateway (canonical Platform boundary).
- **PR-6B** — The Record — governance publication (RDR-003, GHA-001).
- **PR-7A** — The Transport — the Transport Adapter (canonical transport boundary).
- **PR-7B** — The Conduit — the browser UI consumes the canonical path (UI-to-Transport seam).
- **PR-8A** — The Repository — the first persistence-mechanics boundary (one bounded slice).
- **PR-8B** — The CLI — the first non-browser, read-only ingress over the same contract.

At close: **two ingresses (Browser + CLI) over one canonical Platform contract**; 7 aggregates / 7
aggregate-backed commands / 1 aggregate-backed query; 13 registered commands / 4 registered queries;
v2.7.3, SCHEMA 6, commit `55499f2`, 824 verifier checks. The frozen state is recorded in
[RDR-007](../RDR/RDR-007-delta-repository-snapshot.md); completion in
[DPR-005](../DPR/DPR-005-delta-completion-report.md).

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
