# 02 — Architecture

How the system is built **today**. These documents describe implemented reality, not plans. Future
direction lives in the [Roadmap](../01-roadmap/README.md); the reasoning behind each decision lives
in the [Domain ADRs](../03-adr/README.md).

| Document | Read it for |
|---|---|
| [Domain_Architecture.md](Domain_Architecture.md) | The Domain layer: modules, load order, facade, and how a call flows |
| [Aggregate_Pattern.md](Aggregate_Pattern.md) | The aggregate/handler split — business authority vs. implementation authority |
| [Command_Query_Model.md](Command_Query_Model.md) | How commands and queries are registered and routed |
| [AI_Architecture.md](AI_Architecture.md) | How AI capabilities are positioned as Domain clients |

The authoritative, file-by-file module map for the whole application remains
[`ARCHITECTURE.md`](../../ARCHITECTURE.md) at the repository root. This folder focuses on the Domain
layer and its patterns; it links to the root map rather than duplicating it.

> **Rule for this folder:** document only what is implemented. If a statement here cannot be traced
> to code on `main`, it belongs in the Roadmap, not in Architecture.
