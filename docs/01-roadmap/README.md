# 01 — Roadmap

Where the project is going, and in what order. The roadmap is the single forward-looking source of
truth; the [Governance](../00-governance/README.md) layer above it is timeless and the
[Milestones](../05-milestones/README.md) layer records what has landed.

| Document | Read it for |
|---|---|
| [Domain_Roadmap.md](Domain_Roadmap.md) | The sequenced evolution of the Domain layer |
| [Milestone_Roadmap.md](Milestone_Roadmap.md) | The high-level milestone track (Alpha → Omega) |
| [UX-004-Sidebar-Navigation-Discovery.md](UX-004-Sidebar-Navigation-Discovery.md) | UX-004 sidebar & navigation: discovery, approved design constraints, and phase sequence (not started) |
| [UX-005-Executive-Personal-Workspace-Architecture.md](UX-005-Executive-Personal-Workspace-Architecture.md) | UX-005/UX-006 product architecture freeze: Executive vs Personal Workspace model, KPI ownership, data-grid & Action Center contracts, and the UX-005A–F / UX-006A–E sequence. UX-005A–F all merged and the UX-005 Platform Freeze Review complete; sequence was resequenced (C=Design System, D=Global Search, E=Responsive/Density, F=Accessibility Hardening) |
| [MAINT-001-repository-maintenance.md](MAINT-001-repository-maintenance.md) | Repository maintenance & branding refresh: legacy-script removal, documentation sync, official branding adoption, and README refresh — **merged (core complete)**; §7 records the post-merge follow-up backlog (branding asset organization, README screenshot refresh, brand integration) |
| [UX-006-Identity-Personal-Workspace-Architecture.md](UX-006-Identity-Personal-Workspace-Architecture.md) | UX-006 **discovery / architecture baseline** (NOT IMPLEMENTED): identity/`currentUser` contracts, Personal Workspace & ownership model, roles/permissions & authorization enforcement, legacy v2.9.0 migration & schema strategy, backend-compatibility seam, invariants, test/verifier strategy, ADR-006-01…10, and the UX-006A–F decomposition. Extends the UX-005 Executive/Personal Workspace freeze. Owner decisions incorporated (§1A): provider-based local principal selection as an identity abstraction, and v3.0.0 ships both CEO + Employee principals — UX-006A planning is GO, implementation not yet authorized; ready for final owner review |

Roadmap entries describe **intent**, not commitments to dates. A future item is a direction, not a
promise; it is authorized for implementation only when a Sprint Assignment is issued for it.
Speculative design detail does not belong here or in the architecture documents — only the sequence
does.
