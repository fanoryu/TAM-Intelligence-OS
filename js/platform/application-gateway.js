/* ============================================================
   PLATFORM LAYER — APPLICATION GATEWAY (PR-6A "The Gateway")
   ------------------------------------------------------------
   The FIRST Platform Layer boundary and the beginning of Milestone Delta. It is
   the single application entry point that future platform integrations (backend
   services, public APIs, modern frontends) will call. It sits ABOVE the Domain
   facade and does exactly three things: normalize a platform request, route it,
   and DELEGATE it to the Domain. It owns NO business behavior.

   ARCHITECTURE (target — this PR establishes the boundary; existing UI is not
   migrated in this infrastructure-only slice):

     Browser / API client
          ↓
     ApplicationGateway.execute(request)   ← application boundary (this file)
          ↓
     Domain.command(name, ...args)  /  Domain.query(name, ...args)
          ↓
     Aggregate → Handler → Persistence

   PLATFORM REQUEST ABSTRACTION (canonical, API-friendly shape):
     { kind: 'command' | 'query',   // default 'command'
       name: '<domain operation id>',
       args: [ ...positional args ] // default []
     }

   Contract (enforced by the verifier):
     - The Gateway MUST NOT own business rules, mutate State, persist, append
       history, update timestamps, roll back, render UI, access localStorage, or
       audit. It contains no aggregate or handler references.
     - The Gateway MUST reach business behavior ONLY by delegating to the Domain
       facade (Domain.command / Domain.query) — it never bypasses the Domain and
       never re-implements command/query routing.

   execute(request) returns:
     - the Domain result UNCHANGED for a well-formed, delegated request; or
     - { ok: false, error: 'InvalidGatewayRequest' | 'InvalidGatewayKind'
                       | 'InvalidGatewayName' | 'InvalidGatewayArgs'
                       | 'DomainUnavailable' }   for a structurally invalid
       request (never delegated — the Domain is not touched).
   ============================================================ */

const ApplicationGateway = (function () {
  // Structural request normalization ONLY (no business validation). Returns a
  // canonical { ok, kind, name, args } or a typed structural rejection.
  function normalize(request) {
    if (!request || typeof request !== 'object' || Array.isArray(request)) return { ok: false, error: 'InvalidGatewayRequest' };
    var kind = (request.kind == null) ? 'command' : String(request.kind);
    if (kind !== 'command' && kind !== 'query') return { ok: false, error: 'InvalidGatewayKind' };
    var name = request.name;
    if (typeof name !== 'string' || name.trim() === '') return { ok: false, error: 'InvalidGatewayName' };
    var args = (request.args === undefined) ? [] : request.args;
    if (!Array.isArray(args)) return { ok: false, error: 'InvalidGatewayArgs' };
    return { ok: true, kind: kind, name: name.trim(), args: args };
  }

  return Object.freeze({
    // The single application entry point. Normalizes, then DELEGATES to the
    // Domain facade. It performs no mutation/persistence/history/rollback of its
    // own — all business behavior stays behind Domain.command / Domain.query.
    execute: function (request) {
      var n = normalize(request);
      if (!n.ok) return { ok: false, error: n.error };
      // Resolve the Domain facade lazily (top-level const, not on window). The
      // Gateway loads after domain-layer.js, so Domain exists at call time.
      var domain = (typeof Domain !== 'undefined') ? Domain : ((typeof window !== 'undefined') ? window.Domain : null);
      if (!domain) return { ok: false, error: 'DomainUnavailable' };
      // Delegate — never bypass. The Domain's typed result is returned unchanged.
      if (n.kind === 'command') return domain.command.apply(domain, [n.name].concat(n.args));
      return domain.query.apply(domain, [n.name].concat(n.args));
    }
  });
})();

// Expose on the global object so future platform clients can resolve the single
// entry point by name. Classic shared global scope; no eval, no module system.
if (typeof window !== 'undefined') { window.ApplicationGateway = ApplicationGateway; }
