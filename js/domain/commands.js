/* ============================================================
   DOMAIN LAYER — BUSINESS COMMANDS (Enterprise Foundation, PR-5)
   ------------------------------------------------------------
   DESCRIPTIVE catalogue of state-changing business commands (Contract
   PR-5.3 §1). Each entry names the EXISTING global handler that already
   performs the command, the aggregate it targets, and the lifecycle
   transition it causes. This is metadata, not an execution path: the UI
   continues to call the existing functions directly, and this layer does
   NOT execute commands (call-site migration is a later, separate phase).

   `handler` is a function NAME resolved on demand (read-only) by the
   Domain facade, so this module carries no load-order dependency on the
   handlers and never invokes them.
   ============================================================ */

const DOMAIN_COMMANDS = Object.freeze({
  // PR-5C.1 — first OPERATIONAL command routed through Domain.command().
  // Narrow, non-financial, non-lifecycle: contact fields only.
  'employee.contact.update': Object.freeze({ aggregate: 'Employee', boundary: 'EmployeeContactAggregate', handler: 'updateEmployeeContact', transition: 'update contact fields (phone/email/notes) — OPERATIONAL via Domain.command(); business authority = EmployeeContactAggregate (PR-5D)' }),
  // PR-5E — second OPERATIONAL command routed through Domain.command().
  // Narrow, non-financial, non-lifecycle: employment fields only.
  'employee.employment.update': Object.freeze({ aggregate: 'Employee', boundary: 'EmployeeEmploymentAggregate', handler: 'updateEmployeeEmployment', transition: 'controlled update of Employee employment fields (jobTitle/department/employmentStatus/joinDate/contractType) — OPERATIONAL via Domain.command(); business authority = EmployeeEmploymentAggregate (PR-5E)' }),
  // PR-5G — third OPERATIONAL command routed through Domain.command().
  // Narrow lifecycle state machine over employmentStatus (Active/Resigned/Terminated).
  'employee.lifecycle.transition': Object.freeze({ aggregate: 'Employee', boundary: 'EmployeeLifecycleAggregate', boundaryMethod: 'transition', boundaryPayload: 'transition', handler: 'transitionEmployeeLifecycle', transition: 'controlled Employee lifecycle transition (Active↔Resigned, Active↔Terminated) — OPERATIONAL via Domain.command(); business authority = EmployeeLifecycleAggregate (PR-5G)' }),
  // PR-5H — fourth OPERATIONAL command routed through Domain.command().
  // Narrow: monthly base salary only. Uses the DEFAULT prepare/patch contract.
  'employee.compensation.update': Object.freeze({ aggregate: 'Employee', boundary: 'EmployeeCompensationAggregate', handler: 'updateEmployeeCompensation', transition: 'controlled update of Employee monthly base compensation — OPERATIONAL via Domain.command(); business authority = EmployeeCompensationAggregate (PR-5H)' }),
  // PR-5I — fifth OPERATIONAL command, first Contract boundary. Narrow: stored
  // Contract date facts (startDate + durationMonths) only; endDate stays derived.
  // Uses the DEFAULT prepare/patch contract.
  'contract.dates.update': Object.freeze({ aggregate: 'Contract', boundary: 'ContractDateAggregate', handler: 'updateContractDates', transition: 'controlled update of Contract start date and duration (endDate remains derived) — OPERATIONAL via Domain.command(); business authority = ContractDateAggregate (PR-5I)' }),
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
