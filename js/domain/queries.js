/* ============================================================
   DOMAIN LAYER — BUSINESS QUERIES (Enterprise Foundation, PR-5)
   ------------------------------------------------------------
   Additive, behavior-neutral catalogue of side-effect-free reads
   (Contract PR-5.3 §2). Each query names the EXISTING global function
   that already serves it. Queries never change state and never emit
   events. Nothing here is invoked at load time.
   ============================================================ */

const DOMAIN_QUERIES = Object.freeze({
  'payroll.totalCompensation':  Object.freeze({ aggregate: 'PayrollPlan',   handler: 'payrollTotalCompensation',  note: 'base + committed supplemental' }),
  'payroll.historicalSnapshot': Object.freeze({ aggregate: 'PayrollPlan',   handler: 'payrollHistoricalSnapshot', note: 'reads the frozen snapshot; never recomputes' }),
  'audit.events':               Object.freeze({ aggregate: 'AuditTrail',    handler: 'getAuditEvents',            note: 'normalized, newest first' })
});
