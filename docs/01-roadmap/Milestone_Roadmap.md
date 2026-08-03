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
| **Delta** | Completed | Platform & Transport — Application Gateway, Transport Adapter, first Repository boundary, CLI ingress |
| **Epsilon** | Engineering complete · closure pending | Repository Adoption — entity-named repositories across every aggregate (7 of 7) |
| **Zeta** | Upcoming | Intelligence Layer — read-only analytical clients of the Domain |
| **Omega** | Upcoming | Enterprise Platform — fully Domain-governed operations |

**Superseded themes (recorded, not deleted).** Two milestones were re-chartered as their work was
authorized; the original directions are preserved here and remain available as future themes:

| Milestone | Original theme | Delivered theme | Re-chartered by |
|---|---|---|---|
| Delta | Domain Events & Policies | Platform & Transport | Milestone Delta sequence (PR-6A … PR-8B); recorded in [RDR-007](../RDR/RDR-007-delta-repository-snapshot.md) / [DPR-005](../DPR/DPR-005-delta-completion-report.md) |
| Epsilon | Workflow — explicit lifecycles over existing status values | Repository Adoption | Accepted Atlas sequence beginning **ATR-008**; recorded in [RDR-011](../RDR/RDR-011-epsilon-repository-snapshot.md) / [DPR-009](../DPR/DPR-009-epsilon-repository-adoption-completion.md) / [ADR-013](../03-adr/ADR-013-Repository-Layer.md) |

## Status meaning

- **Completed** — every pull request in the milestone is merged, verified, and reflected on `main`.
- **Engineering complete · closure pending** — the milestone's work is merged, verified and
  governance-synchronized on `main`, awaiting only a formal closure record.
- **Upcoming** — an approved direction whose work is authorized only as Sprint Assignments are issued.

*Milestone status advances only when the work beneath it has actually landed. This document tracks
the track; it does not itself authorize work.*
