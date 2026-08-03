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
> to completion, followed by Milestone Epsilon's Repository adoption (both below). The **current
> authoritative baseline is [RDR-011](../RDR/RDR-011-epsilon-repository-snapshot.md)** at commit
> `6714beb`; RDR-001, RDR-003 and RDR-007 are immutable predecessors and no longer the latest baseline.

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

## Milestone Epsilon — **Repository Adoption**

**Theme:** Repository Adoption.
**Status:** Engineering complete · architecture adoption objective complete · governance synchronized by
SPR-075 · **formal closure pending a final closure record.**

> **Charter reconciliation.** Epsilon was originally chartered as **Workflow** — *"model multi-step
> lifecycles (payroll, supplemental, finance execution) as explicit workflows over the existing status
> values, preserving derive-don't-duplicate."* It was **formally re-chartered from Workflow to Repository
> Adoption** through the accepted Atlas governance sequence beginning with **ATR-008**. The original
> charter is recorded here as **superseded, not deleted**; the Workflow theme was **not** delivered under
> Epsilon and remains available as a future milestone theme.

Epsilon adopted the Repository boundary across every aggregate, one bounded slice at a time — each
migrating exactly one aggregate-backed handler, with no change to the Repository contract, the Platform,
or the operational surface:

- **ATR-008** — Repository Adoption direction (Hybrid, entity-named repositories).
- **PR-9A / PR-9B / PR-9C** — Employee employment, lifecycle, compensation — **Employee aggregate complete (4 of 4)**.
- **RDR-009 · DPR-007** — intermediate snapshot / progress report (record-only).
- **ATR-009** — Contract Repository readiness review.
- **PR-10A / PR-10B** — `ContractRepository` introduced (dates), then status — **Contract aggregate complete (2 of 2)**.
- **RDR-010 · DPR-008** — intermediate snapshot / progress report (record-only).
- **ATR-010** — Payroll Repository readiness review.
- **PR-11A** — `PayrollRepository` introduced (lifecycle) — **Payroll complete (1 of 1)**; adoption reaches **7 of 7**.
- **RDR-011 · DPR-009** — published baseline and completion report.
- **SPR-075** — governance synchronization (ADR-013, RDR-011, DPR-009, architecture and register updates).

At close of the adoption objective: **three entity-named repositories** (`EmployeeRepository`,
`ContractRepository`, `PayrollRepository`) mediating **all seven aggregate-backed handlers**; Platform,
Transport, Gateway, Domain, Aggregates, Commands, Queries, StorageAdapter and the Repository contract
unchanged; 7 aggregates / 7 aggregate-backed commands / 1 aggregate-backed query; 13 registered commands /
4 registered queries; v2.7.3, SCHEMA 6, commit `6714beb`, **942 verifier checks**. The frozen state is
recorded in [RDR-011](../RDR/RDR-011-epsilon-repository-snapshot.md); progress in
[DPR-009](../DPR/DPR-009-epsilon-repository-adoption-completion.md); the decision in
[ADR-013](../03-adr/ADR-013-Repository-Layer.md).

> **7 of 7 is a bounded claim.** It means every aggregate-backed handler delegates persistence through an
> entity-named Repository. It does **not** mean full persistence abstraction (3 of 11 persist functions
> are mediated), compound-persistence support, multi-store transactions, or backend readiness — the
> application remains client-only per [`CLAUDE.md`](../../CLAUDE.md) §4.3. **Compound persistence** is the
> next architectural frontier.

## Milestone Zeta — **Upcoming**
**Theme:** Intelligence Layer.

Read-only analytical and advisory capability built strictly as a Domain client — never a parallel
source of truth (see [AI_Architecture.md](../02-architecture/AI_Architecture.md)).

## Milestone Omega — **Upcoming**
**Theme:** Enterprise Platform.

The long-horizon target: a fully Domain-governed operations platform whose every state change is a
registered command, every read a registered query, and every decision an aggregate.
