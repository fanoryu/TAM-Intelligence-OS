#!/usr/bin/env node
/*
 * verify-build.js — TAM Intelligence OS v2.6.1 (Search Focus & Incremental Rendering Fix)
 * --------------------------------------------------------------------------------------
 * v2.6.1 intentionally changes the render PATH for search/filter controls, so the dist JS
 * is no longer byte-identical to v2.5.2 (that was the v2.6.0 golden master). This checks:
 *   - CSS still untouched  -> dist CSS == v2.5.2 CSS byte-for-byte.
 *   - Build fidelity: dist inlined payloads == concatenated modular source.
 *   - Data-safety invariants unchanged (keys, flags, schema 6, seed, mounts, init).
 *   - FOCUS FIX present: search boxes route to apply*Filter and no longer call the full
 *     page renderer on 'input'.
 * Usage:  node tools/verify-build.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const LF = '\n';
const read = (p) => fs.readFileSync(p, 'utf8');
const trimLF = (s) => s.replace(/^\n+/, '').replace(/\n+$/, '');

const orig = read(path.join(root, 'tam-intelligence-os-v2.5.2.html'));
const dist = read(path.join(root, 'dist', 'tam-intelligence-os-v2.6.2.html'));

let passes = 0; const fails = [];
const check = (cond, msg) => { if (cond) { passes++; console.log('  [PASS] ' + msg); } else { fails.push(msg); console.log('  [FAIL] ' + msg); } };
function extractStyle(h){ const a=h.indexOf('<style>'), b=h.indexOf('</style>'); if(a<0||b<0) return null; return trimLF(h.substring(a+7,b)); }
function extractMainScript(h){ const i=h.indexOf('const APP_VERSION'); if(i<0) return null; const o=h.lastIndexOf('<script>',i), c=h.indexOf('</script>',i); return trimLF(h.substring(o+8,c)); }

const distCss = extractStyle(dist), origCss = extractStyle(orig), distJs = extractMainScript(dist);

console.log('== CSS UNCHANGED vs v2.5.2 ==');
check(distCss === origCss, 'dist CSS == v2.5.2 CSS byte-for-byte (styles untouched since v2.5.2)');

const cssFiles = ['tokens.css','base.css','shell.css','components.css','charts.css'];
const jsFiles = require('./module-order.js');
const srcCss = cssFiles.map((f)=>read(path.join(root,'css',f))).join(LF);
const srcJs = jsFiles.map((f)=>read(path.join(root,'js',f))).join(LF);
console.log('== BUILD FIDELITY (source -> dist) ==');
check(trimLF(srcCss) === distCss, 'concat(css/*.css) == dist CSS payload');
check(trimLF(srcJs) === distJs, 'concat(js/*.js) == dist JS payload');

console.log('== VERSION IDENTITY ==');
check(dist.includes("const APP_VERSION = '2.6.2';"), 'APP_VERSION == 2.6.2');
check(dist.includes("const APP_RELEASE_NAME = 'Developer Experience & Module Decomposition';"), 'APP_RELEASE_NAME updated');
check(dist.includes('<title>TAM Intelligence OS v2.6.2</title>'), '<title> updated to v2.6.2');
check(dist.includes("{v:'2.6.2 "), 'Release Notes has a 2.6.2 entry');
check(dist.includes("{v:'2.6.1 "), 'Release Notes still has the 2.6.1 entry (history preserved)');

console.log('== DATA-SAFETY INVARIANTS ==');
const mDist = dist.match(/const SCHEMA_VERSION = (\d+);/);
check(mDist && mDist[1] === '6', 'SCHEMA_VERSION == 6 (UNCHANGED)');
const keys = ['tam_txns_v1','tam_settings_v1','tam_backups_v1','tam_employees_v1','tam_contracts_v1','tam_payroll_plans_v1','tam_recurring_expenses_v1','tam_monthly_plans_v1','tam_overtime_records_v1','tam_import_batches_v1','tam_payroll_adjustments_v1','tam_employee_merges_v1','tam_audit_log_v1'];
const flags = ['tam_migrated_exec_v21','tam_migrated_hr_v22','tam_migrated_norm_v221','tam_migrated_overtime_v23','tam_migrated_payrollops_v25','tam_migrated_dedup_v252','tam_v23_ack'];
keys.forEach((k)=>check(dist.includes(k)&&orig.includes(k), 'storage key present & unchanged: '+k));
flags.forEach((f)=>check(dist.includes(f)&&orig.includes(f), 'migration flag present & unchanged: '+f));
check(dist.includes('<script id="seed-data" type="application/json">[]</script>'), 'seed-data JSON present and EMPTY');
check(dist.includes('<div id="app"></div>')&&dist.includes('<div id="toast-root"></div>')&&dist.includes('<div id="modal-root"></div>'), 'all three mount points present');
const initCount = (dist.match(/\(async function init\(\)/g)||[]).length;
check(initCount === 1, 'exactly one bootstrap init() (found '+initCount+')');
check(!dist.includes('type="module"'), 'no type=module (still classic scripts)');

console.log('== SEARCH FOCUS / INCREMENTAL RENDER FIX ==');
['function applyEmployeeFilter','function applyContractFilter','function applyTxnFilter','function applyOvertimeFilter','function applyPayrollFilter']
  .forEach((fn)=>check(dist.includes(fn), 'incremental refresh defined: '+fn.replace('function ','')));
const newHandlers = [
  "getElementById('eSearch').addEventListener('input', e=>{ State.empFilter.search=e.target.value; applyEmployeeFilter(main); })",
  "getElementById('cSearch').addEventListener('input', e=>{ State.contractFilter.search=e.target.value; applyContractFilter(main); })",
  "getElementById('fSearch').addEventListener('input', e=>{ State.txFilter.search=e.target.value; applyTxnFilter(main); })",
  "getElementById('otSearch').addEventListener('input', e=>{ State.overtimeFilter.search=e.target.value; applyOvertimeFilter(main); })",
  "getElementById('pfSearch').addEventListener('input', e=>{ f.search=e.target.value; applyPayrollFilter(area, monthKey, main); })",
];
newHandlers.forEach((h)=>check(dist.includes(h), 'search handler is incremental: '+h.substring(14,38)+'...'));
const oldHandlers = [
  'State.empFilter.search=e.target.value; renderEmployees(main)',
  'State.contractFilter.search=e.target.value; renderContracts(main)',
  'State.txFilter.search=e.target.value; renderTransactions(main)',
  'State.overtimeFilter.search=e.target.value; renderOvertime(main)',
];
oldHandlers.forEach((h)=>check(!dist.includes(h), 'old full-render search handler removed: '+h.substring(0,24)+'...'));
['id="empRows"','id="ctRows"','id="otRows"','id="txnRows"','id="pwRows"','id="txnCount"']
  .forEach((id)=>check(dist.includes(id), 'incremental container present: '+id));

console.log('== MODULE DECOMPOSITION (v2.6.2) ==');
const jsdir = path.join(root, 'js');
// every module in the manifest exists on disk
let allExist = true; jsFiles.forEach((f)=>{ if(!fs.existsSync(path.join(jsdir,f))) { allExist=false; } });
check(allExist, 'all ' + jsFiles.length + ' modules in module-order.js exist on disk');
check(jsFiles.length >= 40, 'decomposed into ' + jsFiles.length + ' modules (was 20)');
// the flat js/NN-*.js files are gone
const flatLeft = fs.readdirSync(jsdir).filter((n)=>/^\d\d-.*\.js$/.test(n));
check(flatLeft.length === 0, 'no flat js/NN-*.js files remain' + (flatLeft.length?(' ('+flatLeft.join(',')+')'):''));
// subfolders present
['core','ui','finance','people','import','analytics'].forEach((d)=>check(fs.existsSync(path.join(jsdir,d)), 'js/'+d+'/ folder present'));
// index.html references the subfolder script paths, in manifest order
const indexHtml = read(path.join(root,'index.html'));
const idxTagBlock = jsFiles.map((f)=>`<script src="js/${f}"></script>`).join(LF);
check(indexHtml.includes(idxTagBlock), 'index.html <script> tags match module-order.js exactly (order + paths)');

console.log('');
if (fails.length === 0) { console.log('VERIFICATION PASSED -- ' + passes + ' checks OK.'); process.exit(0); }
console.log('VERIFICATION FAILED -- ' + passes + ' passed, ' + fails.length + ' failed:');
fails.forEach((f)=>console.log('   - ' + f));
process.exit(1);
