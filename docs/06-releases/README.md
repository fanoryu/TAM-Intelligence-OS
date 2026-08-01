# 06 — Releases

How versions are shipped. This folder holds the release *strategy*; the enforceable rules are in the
[Release Standard](../04-standards/Release_Standard.md) and the step-by-step procedure is
[`docs/RELEASE-PROCESS.md`](../RELEASE-PROCESS.md).

| Document | Read it for |
|---|---|
| [Release_Strategy.md](Release_Strategy.md) | Versioning philosophy, release flow, checklist, and hotfix flow |

Releases are proposed, never published directly; they are tag-driven, guarded, idempotent, and
immutable once shipped. Implementation and documentation changes do not trigger a release.
