/* ============================================================
   DOMAIN LAYER — READ-ONLY REGISTRY FACADE (Enterprise Foundation, PR-5A)
   ------------------------------------------------------------
   A thin, frozen, READ-ONLY view over the domain registries. Its only
   capabilities are (a) exposing the descriptive registries and (b)
   RESOLVING — not invoking — the existing handler for a registered
   command/query name.

   TRUTHFUL SCOPE (PR-5C.1 — First Operational Command Slice):
     - The registries are DESCRIPTIVE METADATA about the existing system.
     - `query(name, ...args)` routes ONE read-only query (`employee.filtered`,
       PR-5B): resolves and calls the existing read-only handler, returns its
       typed result unchanged; no mutation/persistence/audit.
     - `command(name, ...args)` routes ONE state-changing command
       (`employee.contact.update`, PR-5C.1): resolves and calls the existing
       handler EXACTLY ONCE and returns its typed outcome. The handler remains
       the implementation authority (its own validation, mutation, persistence,
       and audit). This facade adds NO aggregate enforcement and NO
       authorization — those are explicitly not operational.
     - There is NO legacy dispatch/ask surface. `commandHandler`/`queryHandler`
       only RESOLVE (return) a handler; they never invoke it.
     - Every other read/write still calls the existing functions directly; only
       the one migrated query and the one migrated command are routed here.

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
    // clearly on an unknown query or missing handler — never a silent no-op.
    query: function (name) {
      var q = DOMAIN_QUERIES[name];
      if (!q) throw new Error('Unknown domain query: ' + name);
      var fn = resolve(q.handler);
      if (!fn) throw new Error('Domain query handler not found: ' + q.handler);
      return fn.apply(null, Array.prototype.slice.call(arguments, 1));
    },

    // Operational command routing (PR-5C.1). Resolves and calls the registered
    // handler EXACTLY ONCE and returns its typed outcome unchanged. The handler
    // remains the implementation authority (its own validation, mutation,
    // persistence, and audit). Throws clearly on an unknown command or missing
    // handler. As of PR-5C.1 exactly ONE command (employee.contact.update) is
    // routed here; no aggregate enforcement or authorization is performed.
    command: function (name) {
      var c = DOMAIN_COMMANDS[name];
      if (!c) throw new Error('Unknown domain command: ' + name);
      var fn = resolve(c.handler);
      if (!fn) throw new Error('Domain command handler not found: ' + c.handler);
      return fn.apply(null, Array.prototype.slice.call(arguments, 1));
    }
  });
})();
