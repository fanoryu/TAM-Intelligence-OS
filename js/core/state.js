/* ---------- state ---------- */
const DEFAULT_SETTINGS = {
  companyName: COMPANY_NAME_DEFAULT,
  productName: APP_NAME,
  currency: 'IDR',
  openingCashBalance: null, // null = not supplied; never inferred
  defaultTrendRange: 'all',
  defaultLandingPage: 'execDashboard',
  defaultPaymentMethod: 'Bank Transfer',
  defaultBank: 'Mandiri Operational',
  autoArchiveCompleted: false,
  autoCompleteWhenEqual: true,
  // People & Contracts / planning defaults (v2.2.0)
  contractExpiryWarningDays: 90,
  defaultContractDuration: 12,
  defaultPayrollGenerationDay: 25,
  defaultPayrollCategory: 'Gaji',
  includeInactiveInReports: false,
  autoGenerateRecurring: true,
  autoCalcContractProgress: true,
  lastMigrationAt: null, // ISO timestamp of the most recent one-time migration (v2.2.1)
  // Work schedule & overtime defaults (v2.3.0). These are the company-level
  // fallback used only when neither the contract nor the employee carries its
  // own schedule — every employee/contract may override them independently.
  companyWorkHoursPerDay: 8,
  companyWorkDaysPerWeek: 5,
  companyWeeksPerMonth: 4,
  overtimeRounding: 'rupiah',      // 'none' | 'rupiah' | 'hundred' | 'thousand'
  overtimeMethodLabel: 'TAM Internal Overtime Calculation Method',
  requireOvertimeApproval: true,
  highOvertimeWarningHours: 40,
  allowPayrollCommitWithUnapprovedOvertime: false,
  onboardingDismissed: false,      // first-run guided checklist dismissal
  appearance: 'system',            // 'system' | 'dark' | 'light' (v2.4.0)
  payrollLocks: {},                // v2.6.3 — { monthKey: true } locked payroll periods (additive; same settings key)
  schemaVersion: SCHEMA_VERSION,
};
const State = {
  txns: [],       // all transactions
  view: 'execDashboard',
  selectedMonth: null, // monthKey
  compareMonths: [],
  compareTrendRange: 'all',
  txFilter: {month:'all', category:'all', search:'', budget:'all', type:'all', status:'all', method:'all', bank:'all'},
  execFilter: 'today', // Execution Center active view
  execFocusTxnId: null, // v2.7.1 — deep-link: linked transaction to reveal/highlight
  execModalTxnId: null, // transaction currently being executed
  detailTxnId: null, // transaction whose detail/history panel is open
  pendingImport: null, // {batches, fileName}
  backups: [],
  trendsFilter: {range:'all', start:null, end:null, category:'Gaji'},
  settings: {...DEFAULT_SETTINGS},
  navCollapsed: {}, // group id -> collapsed bool, session-only
  sidebarScrollTop: 0, // preserved across full re-renders so nav doesn't jump to top on navigation
  budgetSim: {expensePct:0, payrollPct:0, opsPct:0}, // ephemeral, never persisted
  storageReady: false,
  lastSaveAt: null,        // epoch ms of the last successful StorageAdapter write (session-only, v2.2.1)
  lastIntegrity: null,     // cached result of the last Run Integrity Check (session-only)
  // ----- People & Contracts / Planning (v2.2.0) -----
  employees: [],
  contracts: [],
  payrollPlans: [],
  recurringExpenses: [],
  monthlyPlans: [],
  empFilter: {search:'', status:'all', department:'all', active:'all'},
  contractFilter: {search:'', status:'all'},
  payrollMonth: null,          // monthKey selected in Payroll Planning
  payrollDraft: null,          // {monthKey, rows:[...], warnings:[...]} pending generation
  planGenMonth: null,          // monthKey selected in Monthly Plan Generator
  planPreview: null,           // pending monthly-plan preview
  detailReturnView: null,      // view to return to after a drill-down (employee/contract detail)
  // ----- Overtime engine (v2.3.0) -----
  overtimeRecords: [],
  // ----- Native Payroll Operations (v2.5.0) -----
  payrollAdjustments: [],      // recurring payroll adjustments (addition/deduction)
  payrollFilter: {search:'', department:'all', status:'all', contractStatus:'all'},
  payrollSel: {},              // monthKey -> Set of selected payrollPlan ids (session)
  detailPayrollId: null,       // payroll plan whose detail view is open
  // ----- Smart Import (v2.4.0) -----
  importBatches: [],           // committed import audit records (for undo/reports)
  smartImport: null,           // in-progress wizard model (never persisted until commit)
  importMode: 'smart',         // 'smart' | 'finance' | 'review'
  importPurpose: null,         // 'setup' | 'historical' | 'finance' | 'review' (v2.5.0)
  smartStep: 1,                // wizard step 1..9
  smartTab: 'all',             // review tab
  overtimeFilter: {search:'', status:'all', month:'all'},
  overtimeMonth: null,         // monthKey selected in the bulk worksheet
  otWorksheet: null,           // pending bulk worksheet rows
  // ----- Employee Deduplication (v2.5.2) -----
  employeeMerges: [],          // merge audit records (persisted)
  lastSmartImportUnique: null, // last import's workbook-wide unique-employee summary
  dedupCanon: {},              // dedup review: chosen canonical id per group key (session)
  _hadStoredData: false,       // set on load: meaningful business data was found in storage
};