/* ============================================================
   DOMAIN LAYER — FACADE (Enterprise Foundation, PR-5)
   ------------------------------------------------------------
   A thin, read-only facade over the domain registries. This is the
   Bridge decision's Phase-1 seam: a single, discoverable entry point
   for the business vocabulary that delegates to the EXISTING handlers.

   IMPORTANT — behavior is unchanged: the application's UI still calls the
   existing functions directly. `dispatch`/`ask` are provided so that a
   later, separately-approved phase can migrate call sites through this
   seam (and, further out, delegate to a server authority). Nothing in the
   app invokes this facade yet, so runtime behavior is byte-identical.

   No server, no authentication, no persistence changes here — purely an
   organizing seam over the current in-process handlers.
   ============================================================ */

const Domain = (function () {
  // Resolve a handler by name from the shared global scope at call time,
  // so the facade has no load-order dependency on the handlers.
  function resolve(name) {
    var g = (typeof window !== 'undefined') ? window : this;
    var fn = g ? g[name] : undefined;
    return (typeof fn === 'function') ? fn : null;
  }

  return Object.freeze({
    aggregates: DOMAIN_AGGREGATES,
    invariants: DOMAIN_INVARIANTS,
    commands: DOMAIN_COMMANDS,
    queries: DOMAIN_QUERIES,
    events: DOMAIN_EVENTS,

    // Look up the (existing) handler for a command/query without calling it.
    commandHandler: function (name) {
      var c = DOMAIN_COMMANDS[name];
      return c ? resolve(c.handler) : null;
    },
    queryHandler: function (name) {
      var q = DOMAIN_QUERIES[name];
      return q ? resolve(q.handler) : null;
    },

    // Phase-1 pass-through dispatch (delegates verbatim to the existing
    // handler). Unused by the current UI; provided for the future call-site
    // migration. Throws clearly if a name is unknown — never silently no-ops.
    dispatch: function (name) {
      var fn = this.commandHandler(name);
      if (!fn) throw new Error('Unknown domain command: ' + name);
      return fn.apply(null, Array.prototype.slice.call(arguments, 1));
    },
    ask: function (name) {
      var fn = this.queryHandler(name);
      if (!fn) throw new Error('Unknown domain query: ' + name);
      return fn.apply(null, Array.prototype.slice.call(arguments, 1));
    }
  });
})();
