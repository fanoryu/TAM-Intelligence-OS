/* ============================================================
   DOMAIN LAYER — READ-ONLY REGISTRY FACADE (Enterprise Foundation, PR-5A)
   ------------------------------------------------------------
   A thin, frozen, READ-ONLY view over the domain registries. Its only
   capabilities are (a) exposing the descriptive registries and (b)
   RESOLVING — not invoking — the existing handler for a registered
   command/query name.

   TRUTHFUL SCOPE (PR-5A — Enterprise Domain Registry):
     - The registries are DESCRIPTIVE METADATA about the existing system.
     - This layer does NOT enforce any invariant, execute any command,
       isolate any query, or guarantee any event. Those remain enforced by
       the existing handlers exactly as before.
     - The application's UI still calls the existing functions DIRECTLY and
       bypasses this facade entirely.
     - There is deliberately no dispatch/execute here. The facade becomes
       an operational seam only in a later phase (PR-5B onward), under a
       separate, approved change.

   `commandHandler(name)` / `queryHandler(name)` RETURN the existing global
   function (or null) so callers — and the verifier — can confirm every
   registered handler name resolves to a real function. They never call it.
   ============================================================ */

const Domain = (function () {
  // Resolve a handler by name from the shared global scope. Returns the
  // function itself (never invokes it) or null if it is not a function.
  function resolve(name) {
    var g = (typeof window !== 'undefined') ? window : this;
    var fn = g ? g[name] : undefined;
    return (typeof fn === 'function') ? fn : null;
  }

  return Object.freeze({
    // Descriptive registries (single source of truth for the domain map).
    aggregates: DOMAIN_AGGREGATES,
    invariants: DOMAIN_INVARIANTS,
    commands: DOMAIN_COMMANDS,
    queries: DOMAIN_QUERIES,
    events: DOMAIN_EVENTS,

    // Read-only handler resolution: returns the existing handler function
    // for a registered command/query name, or null. Does NOT execute it.
    commandHandler: function (name) {
      var c = DOMAIN_COMMANDS[name];
      return c ? resolve(c.handler) : null;
    },
    queryHandler: function (name) {
      var q = DOMAIN_QUERIES[name];
      return q ? resolve(q.handler) : null;
    }
  });
})();
