/* ============================================================
   DOMAIN LAYER — BUSINESS COMMANDS (Enterprise Foundation, PR-5)
   ------------------------------------------------------------
   Additive, behavior-neutral catalogue of state-changing business
   commands (Contract PR-5.3 §1). Each command names the EXISTING global
   handler that already performs it, the aggregate it targets, and the
   lifecycle transition it causes. Nothing here changes control flow; the
   UI continues to call the existing functions directly (call-site
   migration is a later, separate phase per the Bridge decision).

   `handler` is a function NAME resolved lazily at dispatch time, so this
   module carries no load-order dependency on the handlers.
   ============================================================ */

const DOMAIN_COMMANDS = Object.freeze({
  // Payroll
  'payroll.commit':        Object.freeze({ aggregate: 'PayrollPlan',          handler: 'commitReadyPayroll',        transition: 'Ready -> Committed (freezes snapshots)' }),
  // Finance
  'finance.execute':       Object.freeze({ aggregate: 'Transaction',          handler: 'executeTransaction',        transition: 'planned -> actual' }),
  // Supplemental
  'supplemental.generate': Object.freeze({ aggregate: 'SupplementalPayment',  handler: 'generateSupplementalForPlan', transition: 'create (from overtime drift)' }),
  'supplemental.transition': Object.freeze({ aggregate: 'SupplementalPayment', handler: 'transitionSupplemental',    transition: 'Draft -> Review -> Approved -> ... -> Executed/Cancelled' }),
  'supplemental.post':     Object.freeze({ aggregate: 'SupplementalPayment',  handler: 'postSupplemental',          transition: 'Approved -> Posted (links a finance transaction)' }),
  // Audit (system-owned side effect of authorized actions)
  'audit.log':             Object.freeze({ aggregate: 'AuditTrail',           handler: 'logActivity',               transition: 'append (never mutate)' })
});
