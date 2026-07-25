#!/usr/bin/env node
/*
 * decompose.js — TAM Intelligence OS v2.6.2 (one-time module decomposition)
 * ------------------------------------------------------------------------
 * Splits the flat js/00..19 files into a feature-folder tree by moving exact,
 * contiguous LINE ranges. It is a PURE MOVE: no code is edited. The global load
 * order is preserved, so the concatenation of the new files (in load order) is
 * byte-identical to the concatenation of the old files. The script refuses to
 * write anything unless that identity holds.
 *
 * One-time: after it runs, the flat files are gone. Re-running is a no-op.
 * Usage:  node tools/decompose.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const jsdir = path.join(root, 'js');
const LF = '\n';

const oldOrder = [
  '00-constants.js', '01-utils.js', '02-storage-adapter.js', '03-chart-engine.js', '04-state.js',
  '05-state-load-migrations.js', '06-domain-services.js', '07-import-parser.js', '08-ui-shell-render.js',
  '09-finance-pages.js', '10-hr-persistence-portability.js', '11-import-ui-analytics.js', '12-people-pages.js',
  '13-stabilization.js', '14-overtime.js', '15-onboarding-reset.js', '16-smart-import.js', '17-employee-dedup.js',
  '18-payroll-ops.js', '19-app-bootstrap.js'
];

// For each flat source: ordered [outRelPath, startLine]. endLine = next start-1 (or EOF).
const map = {
  '00-constants.js': [['core/constants.js', 1]],
  '01-utils.js': [['core/utils.js', 1]],
  '02-storage-adapter.js': [['core/storage-adapter.js', 1]],
  '03-chart-engine.js': [['ui/charts.js', 1]],
  '04-state.js': [['core/state.js', 1]],
  '05-state-load-migrations.js': [['core/state-load-migrations.js', 1]],
  '06-domain-services.js': [['core/domain-services.js', 1]],
  '07-import-parser.js': [['import/parser.js', 1]],
  '08-ui-shell-render.js': [['ui/shell-render.js', 1]],
  '09-finance-pages.js': [
    ['finance/dashboard.js', 1], ['finance/execution-center.js', 168], ['finance/transaction-modals.js', 380],
    ['finance/transactions.js', 635], ['finance/add-upload.js', 814]
  ],
  '10-hr-persistence-portability.js': [['core/hr-persistence-portability.js', 1]],
  '11-import-ui-analytics.js': [
    ['import/import-preview.js', 1], ['analytics/plan-vs-actual.js', 258], ['analytics/compare.js', 320],
    ['analytics/trends.js', 440], ['analytics/executive-dashboard.js', 742], ['finance/cashflow.js', 916],
    ['finance/budget.js', 983], ['analytics/executive-insights.js', 1083], ['ui/settings-about.js', 1137],
    ['analytics/reports.js', 1490]
  ],
  '12-people-pages.js': [
    ['people/people-core.js', 1], ['people/employees.js', 122], ['people/contracts.js', 441],
    ['people/payroll-planning.js', 744], ['people/recurring-expenses.js', 962], ['people/monthly-plan.js', 1053],
    ['people/legacy-mapping.js', 1269], ['people/hr-dashboard-reports.js', 1346]
  ],
  '13-stabilization.js': [['core/stabilization.js', 1]],
  '14-overtime.js': [['people/overtime.js', 1]],
  '15-onboarding-reset.js': [['core/onboarding-reset.js', 1]],
  '16-smart-import.js': [['import/smart-import-extract.js', 1]],
  '17-employee-dedup.js': [
    ['import/smart-import-commit.js', 1], ['people/employee-dedup.js', 314], ['import/smart-import-ui.js', 427]
  ],
  '18-payroll-ops.js': [['people/payroll-ops-engine.js', 1], ['people/payroll-workspace.js', 263]],
  '19-app-bootstrap.js': [['core/app-bootstrap.js', 1]]
};

// Load order for the NEW tree (must reproduce the old concatenation exactly).
const newOrder = [
  'core/constants.js', 'core/utils.js', 'core/storage-adapter.js', 'ui/charts.js', 'core/state.js',
  'core/state-load-migrations.js', 'core/domain-services.js', 'import/parser.js', 'ui/shell-render.js',
  'finance/dashboard.js', 'finance/execution-center.js', 'finance/transaction-modals.js', 'finance/transactions.js',
  'finance/add-upload.js', 'core/hr-persistence-portability.js', 'import/import-preview.js',
  'analytics/plan-vs-actual.js', 'analytics/compare.js', 'analytics/trends.js', 'analytics/executive-dashboard.js',
  'finance/cashflow.js', 'finance/budget.js', 'analytics/executive-insights.js', 'ui/settings-about.js',
  'analytics/reports.js', 'people/people-core.js', 'people/employees.js', 'people/contracts.js',
  'people/payroll-planning.js', 'people/recurring-expenses.js', 'people/monthly-plan.js', 'people/legacy-mapping.js',
  'people/hr-dashboard-reports.js', 'core/stabilization.js', 'people/overtime.js', 'core/onboarding-reset.js',
  'import/smart-import-extract.js', 'import/smart-import-commit.js', 'people/employee-dedup.js',
  'import/smart-import-ui.js', 'people/payroll-ops-engine.js', 'people/payroll-workspace.js', 'core/app-bootstrap.js'
];

// Guard: already decomposed?
const haveOld = oldOrder.every((f) => fs.existsSync(path.join(jsdir, f)));
if (!haveOld) {
  console.log('Flat js/00..19 files not present — already decomposed. No-op.');
  process.exit(0);
}

const oldConcat = oldOrder.map((f) => fs.readFileSync(path.join(jsdir, f), 'utf8')).join(LF);

const written = {};
for (const src of oldOrder) {
  const lines = fs.readFileSync(path.join(jsdir, src), 'utf8').split(LF);
  const slices = map[src];
  for (let i = 0; i < slices.length; i++) {
    const [outRel, start] = slices[i];
    const end = (i + 1 < slices.length) ? slices[i + 1][1] - 1 : lines.length;
    if (outRel in written) throw new Error('duplicate output path: ' + outRel);
    written[outRel] = lines.slice(start - 1, end).join(LF);
  }
}

// newOrder must be exactly the set of produced files.
const producedSet = new Set(Object.keys(written));
if (producedSet.size !== newOrder.length) throw new Error('count mismatch: produced ' + producedSet.size + ' vs newOrder ' + newOrder.length);
for (const p of newOrder) if (!producedSet.has(p)) throw new Error('newOrder references un-produced file: ' + p);

const newConcat = newOrder.map((p) => written[p]).join(LF);

if (newConcat !== oldConcat) {
  let i = 0; while (i < Math.min(newConcat.length, oldConcat.length) && newConcat[i] === oldConcat[i]) i++;
  throw new Error('BYTE MISMATCH at offset ' + i + ' (newLen=' + newConcat.length + ', oldLen=' + oldConcat.length + ') — refusing to write.');
}
console.log('Concatenation byte-identical to flat source: OK (' + newConcat.length + ' chars, ' + newOrder.length + ' files).');

for (const [rel, content] of Object.entries(written)) {
  const full = path.join(jsdir, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
}
for (const f of oldOrder) fs.unlinkSync(path.join(jsdir, f));
console.log('Wrote ' + newOrder.length + ' files into js/{core,ui,finance,people,import,analytics}; removed ' + oldOrder.length + ' flat files.');
