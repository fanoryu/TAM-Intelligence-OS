# Domain Roadmap

The Domain layer is introduced incrementally, one thin, reversible slice at a time, so that business
truth migrates onto a single authority without ever changing runtime behavior in the same step that
adds structure. Each slice is authorized by its own Sprint Assignment and lands as one pull request.

## Legend

- **Completed** — implemented, verified, and merged to `main`.
- **Upcoming** — approved direction; not yet authorized for implementation.

---

## Phase: Foundation — **Completed**

The application and its build/verify discipline: classic shared global scope, deterministic
single-file build, and the mechanical verifier.

## Phase: Domain Foundation — **Completed**

The Domain layer established as a read-only registry and facade, then its first operational slices.

| Slice | Name | Outcome |
|---|---|---|
| PR-5 / PR-5A | Enterprise Foundation | Descriptive Domain registries (aggregates, commands, queries, events) + read-only facade |
| PR-5B | Pathfinder | First operational **query** routed through `Domain.query()` — `employee.filtered` |
| PR-5C.1 | Contact Command | First operational **command** routed through `Domain.command()` — `employee.contact.update` |
| PR-5D | The Steward | First aggregate boundary — `EmployeeContactAggregate` (business authority) |
| PR-5E | The Custodian | Second aggregate boundary — `EmployeeEmploymentAggregate` |
| PR-5F | The Sentinel | Shared aggregate helpers extracted (refactor; no behavior change) |

## Phase: Domain Expansion — **Upcoming**

Widen the operational Domain surface across more of the business, one aggregate/command at a time,
following the established aggregate → handler pattern.

| Slice | Name | Intent |
|---|---|---|
| PR-5G | The Gatekeeper | Next controlled aggregate boundary in the employee/people domain |
| PR-5H | The Arbiter | Extend controlled, validated updates to a further bounded area |
| PR-5I | The Binder | Bring a relationship/consistency scope under a Domain boundary |
| PR-5J | The Accountant | Route a finance-adjacent operation through the Domain |
| PR-5K | The Ledger | Bring an auditable finance record path under a Domain boundary |

*Names are stable placeholders for approved directions; the precise aggregate, command, fields, and
typed failures for each are defined only when its Sprint Assignment is issued.*

## Phase: Domain Events — **Upcoming**

Promote the descriptive events registry toward operational, observable domain events emitted by
handlers after a committed transition — without introducing a framework or a message bus.

## Phase: Policies — **Upcoming**

Express cross-aggregate business rules as explicit, testable policies that aggregates consult, rather
than as scattered conditionals.

## Phase: Workflow — **Upcoming**

Model multi-step lifecycles (payroll, supplemental, finance execution) as explicit workflows over the
existing status values, preserving the derive-don't-duplicate rule.

## Phase: Intelligence Layer — **Upcoming**

Read-only analytical and advisory capabilities built strictly as **clients** of the Domain — never a
parallel source of business truth. See [AI_Architecture.md](../02-architecture/AI_Architecture.md).

## Phase: Enterprise Platform — **Upcoming**

The long-horizon direction: a fully Domain-governed operations platform whose every state change is a
registered command, every read a registered query, and every decision an aggregate — with clients
(UI, import, AI) that hold no business authority of their own.

---

*This roadmap records sequence and intent only. What has already landed is mirrored in
[Milestones](../05-milestones/Milestones.md); why the Domain is shaped this way is recorded in the
[Domain ADRs](../03-adr/README.md).*
