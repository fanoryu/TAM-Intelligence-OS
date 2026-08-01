# Engineering Principles

Principles turn the [Core Values](Core_Values.md) into daily practice. Each is a default strong
enough to require a stated reason to deviate.

## Architecture Before Features
The shape of the system is decided before behavior is added to it. A feature fits the existing
architecture; it does not bend the architecture to fit itself. When a feature would require an
architectural change, that change is proposed and recorded as an ADR first, then the feature follows.
The Domain layer was built (registry → query → command → aggregate → helpers) before any call site
was migrated onto it — architecture led, features followed.

## One PR, One Purpose
Every pull request carries a single intent and lands as exactly one feature commit. Refactors are
not smuggled inside feature work; feature work is not smuggled inside refactors. The diff stays
within the approved scope named in its Sprint Assignment. This keeps review honest, merges reversible,
and history readable.

## Single Source of Truth
Each fact is defined once. `APP_VERSION` and `SCHEMA_VERSION` live in the source constants; the load
order lives in one manifest that `index.html` mirrors; a business rule lives in one aggregate. Every
other reference derives from or links to that source. Duplication that can drift is treated as a
defect.

## Documentation Is a Feature
A change is incomplete until the documentation it affects is updated in the same change. Sprint
Assignments, ADRs, standards, and roadmaps are delivered alongside code, not deferred. The repository
is expected to be self-documenting: a newcomer understands the system from the repository alone.

## No Knowledge Loss
Reasoning is recorded so it survives the loss of chat history. Architectural decisions become ADRs;
work is authorized by Sprint Assignments and expressed as pull requests; supersession replaces
rewriting. Nothing important lives only in someone's memory or a transient conversation.

---

*These principles serve the [Engineering Constitution](Engineering_Constitution.md). Where a
principle and an invariant conflict, the invariant governs.*
