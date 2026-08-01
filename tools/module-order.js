/*
 * module-order.js — the single source of truth for JS load order (v2.6.2+).
 * Classic ordered scripts share one global scope; this array defines the exact
 * order they must load in (index.html mirrors it as <script src> tags, and the
 * build/verify tools require it). Paths are relative to js/.
 *
 * Order is behavior-critical: it reproduces the original single-file script order.
 * Do NOT reorder casually — top-level const initializations depend on it.
 */
'use strict';
module.exports = [
  // --- core leaves + data ---
  'core/constants.js',
  'core/utils.js',
  'core/storage-adapter.js',
  'ui/charts.js',
  'core/state.js',
  'core/state-load-migrations.js',
  'core/domain-services.js',
  'import/parser.js',
  'ui/shell-render.js',
  // --- finance pages (from 09) ---
  'finance/dashboard.js',
  'finance/execution-center.js',
  'finance/transaction-modals.js',
  'finance/transactions.js',
  'finance/add-upload.js',
  // --- HR persistence + portability (10) ---
  'core/hr-persistence-portability.js',
  // --- import UI + analytics + settings + reports (from 11) ---
  'import/import-preview.js',
  'analytics/plan-vs-actual.js',
  'analytics/compare.js',
  'analytics/trends.js',
  'analytics/executive-dashboard.js',
  'finance/cashflow.js',
  'finance/budget.js',
  'analytics/executive-insights.js',
  'ui/settings-about.js',
  'ui/activity-log.js',
  'analytics/reports.js',
  // --- people & contracts (from 12) ---
  'people/people-core.js',
  'people/employees.js',
  'people/contracts.js',
  'people/payroll-planning.js',
  'people/recurring-expenses.js',
  'people/monthly-plan.js',
  'people/legacy-mapping.js',
  'people/hr-dashboard-reports.js',
  // --- stabilization (13), overtime (14), onboarding (15) ---
  'core/stabilization.js',
  'people/overtime.js',
  'core/onboarding-reset.js',
  // --- smart import + dedup (16, 17) ---
  'import/smart-import-extract.js',
  'import/smart-import-commit.js',
  'people/employee-dedup.js',
  'import/smart-import-ui.js',
  // --- native payroll ops + workspace (from 18) ---
  'people/payroll-ops-engine.js',
  'people/payroll-workspace.js',
  // --- supplemental payroll engine (v2.7.0) ---
  'people/supplemental-engine.js',
  // --- domain layer (Enterprise Foundation, PR-5): additive, behavior-neutral
  //     single source of truth over the existing handlers. Loaded after all
  //     domain functions are defined and before bootstrap. ---
  'domain/aggregates.js',
  'domain/commands.js',
  'domain/queries.js',
  'domain/events.js',
  'domain/aggregate-helpers.js',
  'domain/employee-contact-aggregate.js',
  'domain/employee-employment-aggregate.js',
  'domain/employee-lifecycle-aggregate.js',
  'domain/domain-layer.js',
  // --- bootstrap (19) ---
  'core/app-bootstrap.js'
];
