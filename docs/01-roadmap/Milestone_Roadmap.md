# Milestone Roadmap

The milestone track is the coarse-grained view of the project's progress. Where the
[Domain Roadmap](Domain_Roadmap.md) sequences individual pull requests, the milestone track groups
them into named eras. Detailed, per-milestone scope is recorded in
[Milestones.md](../05-milestones/Milestones.md).

| Milestone | Status | Theme |
|---|---|---|
| **Alpha** | Completed | Product foundation — application, deterministic build, mechanical verifier |
| **Beta** | Completed | Domain Foundation — registry, query, command, aggregates, shared helpers |
| **Gamma** | Completed | Domain Expansion — widened the operational aggregate/command surface (PR-5G–PR-5J) |
| **Delta** | Upcoming | Domain Events & Policies — observable transitions and explicit cross-aggregate rules |
| **Epsilon** | Upcoming | Workflow — explicit lifecycles over existing status values |
| **Zeta** | Upcoming | Intelligence Layer — read-only analytical clients of the Domain |
| **Omega** | Upcoming | Enterprise Platform — fully Domain-governed operations |

## Status meaning

- **Completed** — every pull request in the milestone is merged, verified, and reflected on `main`.
- **Upcoming** — an approved direction whose work is authorized only as Sprint Assignments are issued.

*Milestone status advances only when the work beneath it has actually landed. This document tracks
the track; it does not itself authorize work.*
