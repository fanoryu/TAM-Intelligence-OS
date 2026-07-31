/* ============================================================
   DOMAIN LAYER — AGGREGATES & INVARIANTS (Enterprise Foundation, PR-5)
   ------------------------------------------------------------
   Additive, behavior-neutral single source of truth for the business
   domain. This module DECLARES the aggregate boundaries and invariants
   that the existing functions already enforce; it does not change any
   behavior and nothing here is invoked at load time (Bridge Phase 1:
   introduce the domain layer with local handlers, no functional change —
   call-site migration is a separate, later phase).

   Boundaries and invariants are the ones approved in the Blueprint
   (PR-5.1) and Contract (PR-5.3) decision packages. Lifecycle values
   reference the existing *_STATUSES constants (core/constants.js) — the
   real, enforced source of truth — rather than restating them.
   ============================================================ */

// Aggregate roots: each owns exactly one set of invariants. References to
// lifecycle enums are resolved lazily (by name) so this module has no
// load-order dependency and stays purely declarative.
const DOMAIN_AGGREGATES = Object.freeze({
  Employee:          Object.freeze({ identity: 'employeeId',    lifecycleEnum: 'EMPLOYMENT_STATUSES',       owns: ['identity', 'employment status', 'contracts (consistency scope)'] }),
  Contract:          Object.freeze({ identity: 'contract id',   lifecycleEnum: 'CONTRACT_STORED_STATUSES',  owns: ['salary base', 'contract lifecycle'] }),
  OvertimeRecord:    Object.freeze({ identity: 'overtime id',   lifecycleEnum: 'OVERTIME_STATUSES',         owns: ['overtime approval lifecycle', 'immutable-once-committed input'] }),
  PayrollPlan:       Object.freeze({ identity: 'payrollPlanId', lifecycleEnum: 'PAYROLL_STATUSES',          owns: ['payroll status transitions', 'committed snapshot', 'frozen overtime snapshot', 'one-per-employee-per-period'] }),
  SupplementalPayment: Object.freeze({ identity: 'supplemental id', lifecycleEnum: 'SUPPLEMENTAL_STATUSES', owns: ['supplemental lifecycle', 'source-overtime snapshot', 'duplicate-capture guard'] }),
  Transaction:       Object.freeze({ identity: 'txn id',        lifecycleEnum: null,                        owns: ['planned vs actual', 'execution', 'no-duplicate'] }),
  MonthlyPlan:       Object.freeze({ identity: 'period key',    lifecycleEnum: 'PLAN_STATUSES',             owns: ['period-level cycle state'] }),
  CompanyAccount:    Object.freeze({ identity: 'account id',    lifecycleEnum: 'COMPANY_ACCOUNT_STATUSES',  owns: ['company bank account state'] }),
  RecurringExpense:  Object.freeze({ identity: 'recurring id',  lifecycleEnum: null,                        owns: ['recurring template -> generated transactions'] }),
  ImportBatch:       Object.freeze({ identity: 'batch id',      lifecycleEnum: null,                        owns: ['atomic import commit/undo'] }),
  AuditTrail:        Object.freeze({ identity: 'append-only',   lifecycleEnum: null,                        owns: ['append-only, system-owned history'] })
});

// Invariants (Blueprint §8 / Contract §9). Text mirrors CLAUDE.md §7–§9;
// enforcement lives in the referenced functions, not here.
const DOMAIN_INVARIANTS = Object.freeze([
  'Committed payroll/finance is immutable once committed/executed.',
  'Planned != Actual: posting creates planned; execution records actual; no auto-execution.',
  'No duplicates: one payroll per employee per period; re-run updates or skips, never duplicates.',
  'Single transparent formula: Payroll = Base Salary + Approved Overtime (+ Supplemental).',
  'Money is exact internally; round only the final payable.',
  'Snapshots are frozen at commit; historical reads use the frozen snapshot, never a recompute.',
  'Audit is append-only; never rewritten or deleted.',
  'Drift is surfaced, not silently applied to committed amounts.',
  'unavailable != zero for unknown legacy overtime hours.',
  'Derive, do not duplicate: computed states are derived from stored facts.'
]);
