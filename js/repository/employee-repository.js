/* ============================================================
   REPOSITORY LAYER — EMPLOYEE REPOSITORY (PR-8A "The Repository")
   ------------------------------------------------------------
   The FIRST Repository abstraction: a persistence-MECHANICS boundary between a
   handler's mutation and the existing collection persistence, proven on ONE
   bounded reference slice — Employee Identity (the employee.contact.update
   handler). It isolates HOW an entity collection is persisted from the handler
   that decides WHAT to persist, so a future backend can be introduced behind
   this seam without redesigning the canonical application path.

   Persistence shape (target reference shape):
     Handler (updateEmployeeContact)
       -> EmployeeRepository.save()        (this layer — persistence mechanics only)
          -> persistEmployees()            (existing collection persist; UNCHANGED)
             -> StorageAdapter.set(...)    (existing storage-backend boundary; UNCHANGED)
                -> localStorage / window.storage

   The Repository owns ONLY persistence mechanics: it DELEGATES to the existing
   persist function and NORMALIZES its strict-boolean result into one explicit
   result contract. It owns NO business behavior — no mutation, no updatedAt, no
   history, no rollback, no UI, no navigation, no authorization, no audit, and it
   never calls Domain commands or Aggregates and never reinterprets a business
   outcome. The HANDLER remains the sole owner of mutation, updatedAt, history,
   the single persistence invocation, and rollback on failure.

   RESULT CONTRACT (strict — no truthy/falsy ambiguity):
     success -> { ok: true }
     failure -> { ok: false, error: 'PersistFailed' }
   ============================================================ */

const EmployeeRepository = Object.freeze({
  // Persist the Employee collection's CURRENT in-memory state. The handler has
  // already applied its mutation (mutation is handler-owned); this method only
  // delegates the write to the existing persistEmployees() and normalizes its
  // strict boolean into the explicit result contract. Async because the
  // underlying storage write is async. It performs no mutation and no rollback.
  async save(){
    const ok = await persistEmployees();
    return (ok === true) ? { ok: true } : { ok: false, error: 'PersistFailed' };
  }
});

// Expose on the global object so the reference handler resolves it by name.
// Classic shared global scope; no eval, no module system.
if (typeof window !== 'undefined') { window.EmployeeRepository = EmployeeRepository; }
