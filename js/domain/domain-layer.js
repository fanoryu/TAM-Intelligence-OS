/* ============================================================
   DOMAIN LAYER — READ-ONLY REGISTRY FACADE (Enterprise Foundation, PR-5A)
   ------------------------------------------------------------
   A thin, frozen, READ-ONLY view over the domain registries. Its only
   capabilities are (a) exposing the descriptive registries and (b)
   RESOLVING — not invoking — the existing handler for a registered
   command/query name.

   TRUTHFUL SCOPE (PR-5B — First Operational Domain Slice):
     - The registries are DESCRIPTIVE METADATA about the existing system.
     - `query(name, ...args)` is the FIRST operational routing: it resolves
       and calls the existing READ-ONLY handler for a registered query and
       returns its typed result unchanged. It performs no mutation, no
       persistence, no audit — it is a pass-through over a read-only handler.
       As of PR-5B exactly ONE query (`employee.filtered`) travels this path.
     - COMMANDS remain NON-OPERATIONAL: there is deliberately no dispatch/
       execute surface for commands. `commandHandler` only RESOLVES (returns)
       a handler; it never invokes it. No mutation, event, or aggregate
       command is routed through this facade.
     - Every other read still calls the existing functions directly; only
       the one migrated query is routed here.

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
    },

    // Operational query routing (PR-5B). Resolves and calls the registered
    // READ-ONLY handler and returns its typed result unchanged. Throws
    // clearly on an unknown query or missing handler — never a silent
    // no-op. There is intentionally NO equivalent for commands.
    query: function (name) {
      var q = DOMAIN_QUERIES[name];
      if (!q) throw new Error('Unknown domain query: ' + name);
      var fn = resolve(q.handler);
      if (!fn) throw new Error('Domain query handler not found: ' + q.handler);
      return fn.apply(null, Array.prototype.slice.call(arguments, 1));
    }
  });
})();
