#!/usr/bin/env node
/*
 * verify-build.js — TAM Intelligence OS (Release Automation, v2.6.4+)
 * --------------------------------------------------------------------------------------
 * The dist JS is no longer byte-identical to v2.5.2 (search-focus fix, payroll workspace,
 * and later releases changed behavior intentionally). This verifier checks:
 *   - CSS still untouched  -> dist CSS == v2.5.2 CSS byte-for-byte (+ only the v2.6.3b
 *     floating-menu rule that later releases added).
 *   - Build fidelity: dist inlined payloads == concatenated modular source.
 *   - Version identity is DERIVED from js/core/constants.js (single source of truth) —
 *     APP_VERSION, <title>, APP_RELEASE_NAME, the Release Notes entry, and the generated
 *     dist filename must all agree with it (v2.6.4 Release Automation).
 *   - Data-safety invariants unchanged (keys, flags, schema 6, seed, mounts, init).
 *   - FOCUS FIX present: search boxes route to apply*Filter and no longer call the full
 *     page renderer on 'input'.
 *   - Payroll lifecycle + floating menu + module decomposition (as in prior releases).
 *   - v2.6.4 Activity Log + payroll audit timeline + post-blocker feedback present.
 * Usage:  node tools/verify-build.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { readAppMeta } = require('./app-version.js');
const root = path.resolve(__dirname, '..');
const LF = '\n';
const read = (p) => fs.readFileSync(p, 'utf8');
const trimLF = (s) => s.replace(/^\n+/, '').replace(/\n+$/, '');

// Version is derived from the single source of truth (constants.js) — never hardcoded here.
const meta = readAppMeta();

const orig = read(path.join(root, 'tam-intelligence-os-v2.5.2.html'));
if (!fs.existsSync(meta.distPath)) {
  console.error('Expected dist build not found: dist/' + meta.distName + ' — run `node tools/build-single-file.js` first.');
  process.exit(1);
}
const dist = read(meta.distPath);

let passes = 0; const fails = [];
const check = (cond, msg) => { if (cond) { passes++; console.log('  [PASS] ' + msg); } else { fails.push(msg); console.log('  [FAIL] ' + msg); } };
function extractStyle(h){ const a=h.indexOf('<style>'), b=h.indexOf('</style>'); if(a<0||b<0) return null; return trimLF(h.substring(a+7,b)); }
function extractMainScript(h){ const i=h.indexOf('const APP_VERSION'); if(i<0) return null; const o=h.lastIndexOf('<script>',i), c=h.indexOf('</script>',i); return trimLF(h.substring(o+8,c)); }

const distCss = extractStyle(dist), origCss = extractStyle(orig), distJs = extractMainScript(dist);

console.log('== CSS vs v2.5.2 (only the v2.6.3b floating-menu rule added) ==');
const cssAnchor = '.actions-dropdown{position:absolute;right:0;top:calc(100% + 4px);background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:4px;z-index:20;min-width:170px;box-shadow:0 8px 28px rgba(0,0,0,.45);}';
const cssAdded = cssAnchor + "\n/* v2.6.3b — floating layer: portaled to #menu-root and positioned with position:fixed\n   via JS (getBoundingClientRect), so it is never clipped by a table's overflow. */\n.actions-dropdown.floating{position:fixed;right:auto;z-index:990;}";
const expectedCss = origCss.split(cssAnchor).join(cssAdded);
check(distCss === expectedCss, 'dist CSS == v2.5.2 CSS + ONLY the v2.6.3b floating rule (no other style change)');

const cssFiles = ['tokens.css','base.css','shell.css','components.css','charts.css'];
const jsFiles = require('./module-order.js');
const srcCss = cssFiles.map((f)=>read(path.join(root,'css',f))).join(LF);
const srcJs = jsFiles.map((f)=>read(path.join(root,'js',f))).join(LF);
console.log('== BUILD FIDELITY (source -> dist) ==');
check(trimLF(srcCss) === distCss, 'concat(css/*.css) == dist CSS payload');
check(trimLF(srcJs) === distJs, 'concat(js/*.js) == dist JS payload');

console.log('== VERSION IDENTITY (derived from constants.js — no hardcoded version) ==');
check(dist.includes("const APP_VERSION = '" + meta.version + "';"), 'APP_VERSION == ' + meta.version + ' (matches constants.js)');
check(dist.includes("const APP_RELEASE_NAME = '" + meta.releaseName + "';"), 'APP_RELEASE_NAME == "' + meta.releaseName + '" (matches constants.js)');
check(dist.includes('<title>TAM Intelligence OS v' + meta.version + '</title>'), '<title> == v' + meta.version);
check(dist.includes("{v:'" + meta.version + " "), 'Release Notes has a ' + meta.version + ' entry');
check(path.basename(meta.distPath) === 'tam-intelligence-os-v' + meta.version + '.html', 'generated dist filename derived from APP_VERSION (dist/' + meta.distName + ')');
// History preserved: prior release entries are permanent and must never disappear.
check(dist.includes("{v:'2.6.3c ") && dist.includes("{v:'2.6.3b ") && dist.includes("{v:'2.6.3a ") && dist.includes("{v:'2.6.3 "), 'Release Notes still has 2.6.3c/2.6.3b/2.6.3a/2.6.3 entries (history preserved)');

console.log('== DATA-SAFETY INVARIANTS ==');
const mDist = dist.match(/const SCHEMA_VERSION = (\d+);/);
check(mDist && mDist[1] === '6', 'SCHEMA_VERSION == 6 (UNCHANGED)');
const keys = ['tam_txns_v1','tam_settings_v1','tam_backups_v1','tam_employees_v1','tam_contracts_v1','tam_payroll_plans_v1','tam_recurring_expenses_v1','tam_monthly_plans_v1','tam_overtime_records_v1','tam_import_batches_v1','tam_payroll_adjustments_v1','tam_employee_merges_v1','tam_audit_log_v1'];
const flags = ['tam_migrated_exec_v21','tam_migrated_hr_v22','tam_migrated_norm_v221','tam_migrated_overtime_v23','tam_migrated_payrollops_v25','tam_migrated_dedup_v252','tam_v23_ack'];
keys.forEach((k)=>check(dist.includes(k)&&orig.includes(k), 'storage key present & unchanged: '+k));
flags.forEach((f)=>check(dist.includes(f)&&orig.includes(f), 'migration flag present & unchanged: '+f));
// v2.6.9 + v2.7.0 — additive storage keys not present in the v2.5.2 golden master, so they are
// checked in the current build only. Total known keys: 15 (13 legacy + company accounts + supplemental).
const newKeysPost252 = ['tam_company_accounts_v1', 'tam_supplemental_payments_v1'];
newKeysPost252.forEach((k)=>check(dist.includes(k), 'post-v2.5.2 additive storage key present: '+k));
check(keys.length + newKeysPost252.length === 15, 'exactly 15 known storage keys (13 legacy + companyAccounts + supplementalPayments)');
check(dist.includes('tam_migrated_bankaccts_v269'), 'v2.6.9 company-account seed migration flag present');
// Bank Master is reference data — a constant, NOT a storage key.
check(dist.includes('const BANK_MASTER_GROUPS') && dist.includes('const INDONESIAN_BANKS'), 'Indonesian Bank Master is a constant (single source, no storage key)');
check(!/tam_bank_master_v\d/.test(dist) && !/tam_banks_v\d/.test(dist), 'no bank-master storage key introduced (Bank Master stays a constant)');
// v2.7.0 — Supplemental Payroll Engine: store present, lifecycle constants, backup inclusion.
check(dist.includes("supplementalPayments: 'tam_supplemental_payments_v1'"), 'supplemental store registered in HR_KEYS');
check(dist.includes("const SUPPLEMENTAL_STATUSES = ['Draft','Review','Approved','Posted','Executed','Cancelled']"), 'supplemental lifecycle statuses defined');
check(dist.includes('function generateSupplementalForPlan(') && dist.includes('function transitionSupplemental('), 'supplemental generator + transition engine present');
check(dist.includes('function supplementalEligibleOvertime(') && dist.includes('function capturedOvertimeIdsForPlan('), 'supplemental duplicate-prevention helpers present');
check(dist.includes('supplementalPayments: State.supplementalPayments'), 'supplemental store included in Complete Backup');
check(dist.includes("SUPPLEMENTAL_SOURCE_TYPES = ['overtime_drift']"), 'supplemental v1 source is overtime_drift only (no speculative adjustment types)');
check(!orig.includes('tam_supplemental_payments_v1') && !orig.includes('SUPPLEMENTAL_STATUSES'), 'supplemental engine is genuinely new (absent from the v2.5.2 golden master)');
check(dist.includes('function postSupplemental(') && dist.includes('supplementalId:supp.id'), 'supplemental posting links to a finance transaction (both directions)');
check(dist.includes('function linkSupplementalExecution('), 'supplemental execution linkage present (reuses Execution Center)');
// v2.7.0 — feature lifecycle registry replaces the hardcoded sidebar PREVIEW badge.
check(dist.includes('const FEATURE_REGISTRY') && dist.includes('function featureBadgeHTML('), 'centralized feature registry + shared badge helper present');
check(!/nav-preview-tag">Preview</.test(dist), 'no hardcoded "Preview" sidebar badge outside the registry');
check(dist.includes('featureBadgeHTML(n.id)'), 'sidebar badge rendered via the feature registry helper');
// v2.7.0 — workflow step label is count-neutral (no hardcoded verifier count).
try {
  const ci = read(path.join(root, '.github', 'workflows', 'ci.yml'));
  const rel = read(path.join(root, '.github', 'workflows', 'release.yml'));
  check(/name:\s*Verify build\s*$/m.test(ci) && !/invariant checks\)/.test(ci), 'ci.yml verify step label is count-neutral');
  check(/name:\s*Verify build\s*$/m.test(rel) && !/invariant checks\)/.test(rel), 'release.yml verify step label is count-neutral');
} catch(e){ check(false, 'workflow files readable for label check: '+e.message); }
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

console.log('== PAYROLL LIFECYCLE (v2.6.3a) + FLOATING MENU (v2.6.3b) ==');
// Bug 1: Approve no longer gated by commit-blockers in the lifecycle helpers.
check(!dist.includes("if(status==='Ready' && payrollCommitBlockers(pp).length) continue;"), 'bulk Approve no longer skips on commit-blockers');
check(!dist.includes("if(status==='Ready'){ const b=payrollCommitBlockers(pp); if(b.length){"), 'single Approve no longer gated on commit-blockers');
// commit still validates — and (v2.6.4) records the exact skip reason per row (no relaxation of rules)
check(dist.includes('const blockers = payrollCommitBlockers(pp);'), 'Post to Finance still computes payrollCommitBlockers(pp) before posting');
check(dist.includes('if(blockers.length){ skipped++; skippedDetails.push({name:pp.employeeName, reasons:blockers}); continue; }'), 'Post to Finance skips blocked rows and records exact blocker reasons (v2.6.4)');
// Bug 2 (v2.6.3b): shared floating actions menu (portal, position:fixed, flip, close, reposition)
check(dist.includes('function openFloatingMenu(') && dist.includes('function closeFloatingMenu(') && dist.includes('function positionFloatingMenu('), 'floating menu controller defined');
check(dist.includes('<div id="menu-root"></div>'), '#menu-root portal layer present');
check(dist.includes('.actions-dropdown.floating{position:fixed'), 'CSS .actions-dropdown.floating (position:fixed) present');
check(!dist.includes('function positionActionsMenu('), 'old in-container positionActionsMenu removed');
check((dist.match(/openFloatingMenu\(btn, menu\)/g)||[]).length >= 2, 'floating menu wired into HR + finance action menus');
check(dist.includes("if(e.key==='Escape'){ e.stopPropagation(); closeFloatingMenu(); }"), 'menu closes on Escape');
check(dist.includes("window.addEventListener('scroll', s.onReposition, true)") || dist.includes("window.addEventListener('scroll', onReposition, true)"), 'menu repositions on window scroll');
check(dist.includes("window.addEventListener('resize', onReposition, true)"), 'menu repositions on window resize');

console.log('== PAYROLL INTELLIGENCE WORKSPACE (v2.6.3) ==');
['function payrollStage(','function payrollStagePill(','function payrollStageCounts(','function payrollSummary(','function payrollHealth(','function isPayrollLocked(','function setPayrollLock(','function renderPayrollWorkspace(']
  .forEach((fn)=>check(dist.includes(fn), 'defined: '+fn.replace('function ','').replace('(','')));
check(dist.includes("label:'Payroll Workspace'"), 'nav label renamed to Payroll Workspace');
check(dist.includes('payrollLocks: {}') || dist.includes('payrollLocks:{}'), 'payrollLocks settings field present (lock persistence, same settings key)');
check(dist.includes('Post to Finance') || dist.includes('Post Approved Payroll to Finance'), 'Post to Finance action present');
check(dist.includes("<h3>Payroll History</h3>") && dist.includes("<h3>Overtime History</h3>"), 'Employee timeline (Payroll + Overtime History) present');
// lifecycle mapped over existing stored values — no new payroll status persisted
check(dist.includes("const PAYROLL_STATUSES = ['Draft','Reviewed','Ready','Committed','Cancelled']"), 'stored payroll status values unchanged (no migration)');

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

console.log('== ACTIVITY LOG + AUDIT VISIBILITY (v2.6.4) ==');
// Activity Log page: helpers, render, incremental filter, CSV, nav + dispatch.
check(dist.includes('function logActivity(') && dist.includes('function getAuditEvents('), 'audit helpers logActivity / getAuditEvents defined');
check(dist.includes("const AUDIT_LOG_KEY = 'tam_audit_log_v1'"), 'audit log reuses existing tam_audit_log_v1 key (no new storage key)');
check(dist.includes('function renderActivityLog('), 'Activity Log page renderer defined');
check(dist.includes('function applyActivityFilter('), 'Activity Log uses incremental filter (search focus preserved)');
check(dist.includes('id="actRows"'), 'Activity Log incremental tbody container present');
check(dist.includes('function exportActivityCsv('), 'Activity Log CSV export defined');
check(dist.includes("label:'Activity Log'"), 'Activity Log nav item present');
check(dist.includes("State.view==='activity'") && dist.includes('renderActivityLog(main)'), 'Activity Log wired into renderView dispatch');
// No brand-new storage key was introduced for activity (the audit trail reuses tam_audit_log_v1).
check(!/tam_activity_log_v\d/.test(dist) && !/tam_audit_v\d/.test(dist), 'no independent activity/audit storage key introduced');
// Instrumentation at the key chokepoints so the log actually has cross-module records.
['payroll.generate','payroll.post','payroll.lock','payroll.unlock','overtime.','finance.execute','import.commit']
  .forEach((t)=>check(dist.includes("'"+t) || dist.includes("type:'"+t), 'audit instrumentation present: '+t));
// Payroll audit timeline (real events only, derived — not duplicated state).
check(dist.includes('function buildPayrollTimeline(') && dist.includes('function buildPayrollPeriodTimeline('), 'payroll timeline builders defined (workspace + detail)');
check(dist.includes('<h3>Payroll Timeline</h3>') || dist.includes('Payroll Timeline'), 'Payroll Detail timeline present');
// Post-blocker feedback modal (posted vs skipped, employee + exact reason).
check(dist.includes('function openPostResultModal('), 'post-result summary modal defined (posted vs skipped)');
check(dist.includes('skippedDetails') && dist.includes('posted:'), 'commitReadyPayroll returns posted + skippedDetails');

console.log('== PAYROLL INTEGRITY & REPORTING FOUNDATION (v2.7.1) ==');
// Stage-aware historical source-of-truth helper + integrity notice.
check(dist.includes('function payrollHistoricalSnapshot('), 'stage-aware historical payroll helper (payrollHistoricalSnapshot) present');
check(dist.includes('function payrollIntegrityNoticeHTML(') && dist.includes('Payroll snapshot mismatch'), 'payroll snapshot-mismatch integrity notice present');
check(dist.includes('Base Payroll Snapshot'), 'Payroll Detail renders a committed Base Payroll Snapshot');
check(dist.includes('function payrollHoursDisplay(') && dist.includes('(unavailable)'), 'unknown legacy overtime hours render as unavailable (not zero)');
// Immutable overtime snapshots frozen at posting (both commit pipelines).
check(dist.includes('function buildPayrollOvertimeSnapshot(') && dist.includes('function buildPayrollCommittedSnapshot('), 'immutable overtime + committed snapshot builders present');
check((dist.match(/overtimeSnapshot:\s*otSnapshot\b/g)||[]).length >= 2 && (dist.match(/=\s*buildPayrollOvertimeSnapshot\(pp\.overtimeIds/g)||[]).length >= 2, 'both payroll commit pipelines freeze an overtimeSnapshot');
check(dist.includes('pp.committedSnapshot = buildPayrollCommittedSnapshot(pp)'), 'committed snapshot frozen on the plan at post time');
// Company-settings onboarding completion marker (Section 4).
check(dist.includes('companySettingsConfiguredAt') && dist.includes('function legacyMeaningfulCompanyProfile('), 'company-settings completion marker + legacy fallback present');
check(dist.includes('s.companySettingsConfiguredAt || legacyMeaningfulCompanyProfile(s)'), 'companySettingsConfigured uses explicit marker OR legacy fallback (not inference alone)');
check(!/tam_company_settings_v\d/.test(dist), 'settings marker is a settings field, not a new storage key');
// Supplemental hardening (Sections 11, 12).
check(dist.includes('function overtimeCapturedByOtherSupplemental('), 'supplemental GLOBAL duplicate guard present');
check(dist.includes('!overtimeCapturedByOtherSupplemental(id, exceptSupplementalId)') && dist.includes('!overtimeCapturedByOtherSupplemental(x, supp.id)'), 'global duplicate guard used by BOTH generation and refresh');
check(dist.includes("['Posted','Executed','Cancelled'].includes(supp.status)) return {ok:false, reason:'Notes are locked once the supplemental is Posted"), 'Posted supplemental notes are immutable');
check(dist.includes('supp.sourceOvertimeSnapshot = buildPayrollOvertimeSnapshot('), 'supplemental freezes a source-overtime snapshot at Approved');
// Execution Center deep-link (Section 13).
check(dist.includes('function focusTransactionInExecutionCenter(') && dist.includes('function execBucketKeyForTxn('), 'Execution Center deep-link/focus mechanism present');
check(!dist.includes("State.view='executioncenter'; State.execFilter='today'; render();"), 'generic today-filter Execution Center navigation replaced by focused deep-link');
// Persistence coordination (Section 15).
check(dist.includes('const txnOk = await persist();') && dist.includes('const suppOk = await persistSupplementalPayments();'), 'supplemental posting checks persistence results (no half-written linkage)');
// New integrity checks (Section 10).
['payroll-posted-no-transaction','payroll-plan-txn-total-diff','payroll-plan-txn-overtime-diff','payroll-missing-committed-snapshot','supplemental-missing-transaction','supplemental-orphan-transaction','supplemental-overtime-double-capture','supplemental-missing-source-snapshot']
  .forEach((c)=>check(dist.includes("'"+c+"'"), 'integrity check present: '+c));
// The released v2.7.0 artifact must never be OVERWRITTEN with v2.7.1 content. During development
// it stays present and unchanged; at release the dist-swap intentionally removes it from dist/
// (only the current artifact is kept — the historical GitHub Release asset is the real invariant
// and is never touched here). So ABSENCE is a valid released state; if still present it must be v2.7.0.
const prevDist = path.join(root, 'dist', 'tam-intelligence-os-v2.7.0.html');
if (fs.existsSync(prevDist)) {
  const prev = read(prevDist);
  check(prev.includes('<title>TAM Intelligence OS v2.7.0</title>') && prev.includes("const APP_VERSION = '2.7.0';"), 'if present, the v2.7.0 artifact is unchanged (still v2.7.0, never overwritten by the v2.7.1 build)');
} else {
  check(true, 'v2.7.0 artifact removed from dist/ by the release swap (historical GitHub Release asset untouched)');
}
// dist/ holds exactly one release artifact — the current version (release dist-swap invariant).
const distArtifacts = fs.readdirSync(path.join(root, 'dist')).filter((f)=>/^tam-intelligence-os-v[\d.]+\.html$/.test(f));
check(distArtifacts.length === 1 && distArtifacts[0] === 'tam-intelligence-os-v' + meta.version + '.html', 'dist/ holds exactly one release artifact — the current v' + meta.version);
check(meta.version === '2.7.3', 'APP_VERSION is 2.7.3 (this development release)');
// v2.7.1 polishing pass — snapshot metadata, single historical API, compact integrity badge.
check(dist.includes('function overtimeSnapshotMeta('), 'overtime snapshot audit metadata helper present');
check((dist.match(/overtimeSnapshotMeta:\s*overtimeSnapshotMeta\(/g)||[]).length >= 2, 'both commit pipelines store overtimeSnapshotMeta {recordCount,totalHours}');
check(dist.includes('if(txn.overtimeSnapshotMeta){') , 'historical snapshot reads frozen metadata (no recompute)');
check(dist.includes('function payrollIntegrityBadge(') && dist.includes('Integrity Verified') && dist.includes('Snapshot Mismatch'), 'compact Payroll Detail integrity badge present');
check(dist.includes('${payrollIntegrityBadge(p)}'), 'integrity badge rendered in Payroll Detail');
// Single historical API: Posted/Executed renderers migrated off direct plan-derived values.
check(dist.includes('empPlans.map(p=>{ const tc=payrollTotalCompensation(p)'), 'Employee Detail payroll history reads the immutable snapshot via payrollTotalCompensation');
check((dist.match(/const s=payrollHistoricalSnapshot\(p\); return \[p\.employeeName/g)||[]).length >= 1, 'payroll register/components reports use payrollHistoricalSnapshot');
check(!/<td class="num">\$\{fmtIDR\(payrollBaseSalary\(p\)\)\}<\/td>/.test(dist), 'no Employee Detail row renders payrollBaseSalary(p) directly');
check(!/fmtIDR\(p\.overtimeAmount\),fmtIDR\(num\(p\.allowance\)/.test(dist), 'payroll register no longer renders p.overtimeAmount directly');

// v2.7.2 — persistence / transactional-integrity fixes.
console.log('== PERSISTENCE & TRANSACTIONAL INTEGRITY (v2.7.2) ==');
// persistHR returns a strict boolean (false for unknown key, the actual set() result otherwise).
check(/function persistHR\(stateKey\)\{[\s\S]*?return false;[\s\S]*?return ok === true;\s*\}/.test(dist), 'persistHR returns a strict boolean (false on unknown key, set() result otherwise)');
check(dist.includes('async function saveBackups(){') && /saveBackups\(\)\{[\s\S]*?return ok === true;/.test(dist), 'saveBackups returns a strict boolean');
check(/async function persist\(\)\{[\s\S]*?return ok === true;/.test(dist) && /async function saveSettings\(\)\{[\s\S]*?return ok === true;/.test(dist), 'persist() and saveSettings() return strict booleans');
// postSupplemental verifies the rollback persisted and never leaves an orphan.
check(dist.includes('const rolledBack = await persist();') && dist.includes('unrecoverable:true') && dist.includes('orphanTxnId:txn.id'), 'supplemental posting verifies rollback persistence (no silent orphan)');
// executeTransaction snapshots, checks the write, rolls back in memory, and orders audit/supplemental.
check(dist.includes('const before = JSON.parse(JSON.stringify(t));') && dist.includes('const saved = await persist();') && dist.includes('Object.assign(t, before);'), 'executeTransaction snapshots + rolls back on failed persist');
check(/const saved = await persist\(\);\s*if\(!saved\)\{[\s\S]*?return \{ok:false/.test(dist), 'executeTransaction returns failure (no audit/supplemental) when persist fails');
check(dist.includes('let suppWarning = null;') && dist.includes('linkSupplementalExecution(t)'), 'linked supplemental executed only after transaction persists');
// linkSupplementalExecution reverts in memory and reports when its own persist fails.
check(/async function linkSupplementalExecution\(t\)\{[\s\S]*?const ok = await persistSupplementalPayments\(\);[\s\S]*?if\(!ok\)\{[\s\S]*?return \{ok:false/.test(dist), 'linkSupplementalExecution reverts + reports on failed persist (no misrepresented Executed)');
// restoreCompleteBackup is transaction-safe: validate, snapshot, checked writes, rollback.
check(dist.includes('const RESTORE_HR_KEYS') , 'restore uses a single RESTORE_HR_KEYS dataset list');
check(/async function restoreCompleteBackup\(data\)\{[\s\S]*?validateCompleteBackup\(data\)[\s\S]*?return \{ok:false/.test(dist), 'restoreCompleteBackup validates before mutating State');
check(dist.includes('const failed = writes.filter') && dist.includes('rbFail') && dist.includes('return {ok:true}'), 'restoreCompleteBackup checks every write, rolls back, returns {ok}');
check(dist.includes('if(!result || result.ok!==true)'), 'restore UI only reports success when result.ok === true');
// startup recovery for pre-2.7.2 failed-post orphan supplementals.
check(dist.includes('async function recoverSupplementalOrphans(') && dist.includes("s.status==='Posted'") && dist.includes('!s.executionId'), 'recoverSupplementalOrphans present (conservative failed-post repair)');
check(dist.includes('if(typeof recoverSupplementalOrphans===') && dist.includes('await recoverSupplementalOrphans()'), 'orphan recovery wired into startup load');
// existing bidirectional orphan integrity checks remain.
check(dist.includes("'supplemental-missing-transaction'") && dist.includes("'supplemental-orphan-transaction'"), 'integrity checks detect both orphan directions');

// v2.7.x Payroll History total-compensation reporting (read-only aggregate; no schema/persistence change).
console.log('== PAYROLL HISTORY — TOTAL COMPENSATION (v2.7.x reporting) ==');
check(dist.includes('function payrollTotalCompensation('), 'payrollTotalCompensation aggregate helper present');
check(/payrollTotalCompensation\(pp\)\{[\s\S]*?payrollHistoricalSnapshot\(pp\)/.test(dist), 'total-compensation is built on the immutable payrollHistoricalSnapshot');
check(dist.includes('baseTotal: num(snap.totalPayroll)') && dist.includes('totalCompensation: num(snap.totalPayroll) + committed'), 'base total is not redefined; total compensation is additive');
check(/s\.status==='Posted' \|\| s\.status==='Executed'/.test(dist) && /s\.status==='Draft' \|\| s\.status==='Review' \|\| s\.status==='Approved'/.test(dist), 'only Posted/Executed count; Draft/Review/Approved are pending (excluded from total)');
check(dist.includes('const tc=payrollTotalCompensation(p)') && dist.includes('>Total Compensation<') && dist.includes('>Supplemental<'), 'Payroll History renders Supplemental + Total Compensation columns');
check(dist.includes('Pending ${fmtIDR(tc.pendingSupplemental)}'), 'pending supplemental shown subtly, not added to Total Compensation');
check(dist.includes("'supplemental-missing-source-snapshot'") && dist.includes("'supplemental-missing-source-snapshot-legacy'"), 'integrity distinguishes legacy vs modern missing source snapshot');

// PR-5A — Enterprise Domain Registry: descriptive, read-only metadata layer.
// These checks guard the registry's integrity WITHOUT asserting it enforces
// anything (it does not). Handler names must resolve to real functions in dist;
// registry identifiers must be unique, frozen, and non-colliding.
console.log('== ENTERPRISE DOMAIN REGISTRY (PR-5A — descriptive, read-only) ==');
const domainFiles = ['aggregates.js','commands.js','queries.js','events.js','domain-layer.js'];
domainFiles.forEach((f)=>check(fs.existsSync(path.join(root,'js','domain',f)), 'domain module present: js/domain/'+f));
// module-order and index.html stay aligned for every domain module (belt-and-suspenders
// alongside the global idxTagBlock check above).
domainFiles.forEach((f)=>{
  const p = 'domain/'+f;
  check(jsFiles.indexOf(p) !== -1, 'module-order.js includes '+p);
  check(indexHtml.includes('<script src="js/'+p+'"></script>'), 'index.html includes '+p);
});
const cmdSrc = read(path.join(root,'js','domain','commands.js'));
const qrySrc = read(path.join(root,'js','domain','queries.js'));
const aggSrc = read(path.join(root,'js','domain','aggregates.js'));
const evtSrc = read(path.join(root,'js','domain','events.js'));
const facSrc = read(path.join(root,'js','domain','domain-layer.js'));
// Registries are frozen (Object.freeze) at their source of truth.
check(/const DOMAIN_COMMANDS = Object\.freeze\(/.test(cmdSrc), 'DOMAIN_COMMANDS is Object.freeze()');
check(/const DOMAIN_QUERIES = Object\.freeze\(/.test(qrySrc), 'DOMAIN_QUERIES is Object.freeze()');
check(/const DOMAIN_AGGREGATES = Object\.freeze\(/.test(aggSrc), 'DOMAIN_AGGREGATES is Object.freeze()');
check(/const DOMAIN_EVENTS = Object\.freeze\(/.test(evtSrc), 'DOMAIN_EVENTS is Object.freeze()');
check(/const Domain = \(function/.test(facSrc) && /Object\.freeze\(\{/.test(facSrc), 'Domain facade is a frozen object');
// No LEGACY execute surface: dispatch/ask must never appear on the facade.
check(!/\bdispatch\s*:/.test(facSrc) && !/\bask\s*:/.test(facSrc) && !/Domain\.(dispatch|ask)\(/.test(srcJs), 'no legacy dispatch/ask surface on the Domain facade');
// PR-5B — operational read-only query routing exists on the facade.
check(/\bquery:\s*function/.test(facSrc), 'Domain facade exposes read-only query() routing (PR-5B)');
// PR-5C.1 — operational command routing exists on the facade.
check(/\bcommand:\s*function/.test(facSrc), 'Domain facade exposes command() routing (PR-5C.1)');
// Exactly ONE query migrated (distinct routed query ids).
const migratedQueryIds = Array.from(new Set((srcJs.match(/Domain\.query\('([^']+)'\)/g)||[]).map(s=>s.match(/'([^']+)'/)[1])));
check(migratedQueryIds.length === 1 && migratedQueryIds[0] === 'employee.filtered', 'exactly one query id routed through Domain.query(): '+JSON.stringify(migratedQueryIds));
check(dist.includes("Domain.query('employee.filtered')"), 'migrated query call present in dist');
check(/'employee\.filtered':\s*Object\.freeze\(\{[^}]*handler:\s*'employeesFiltered'/.test(qrySrc), 'employee.filtered query registered to handler employeesFiltered');
// Exactly ONE command migrated (distinct routed command ids), and it is the approved contact command.
const migratedCmdIds = Array.from(new Set((srcJs.match(/Domain\.command\('([^']+)'/g)||[]).map(s=>s.match(/'([^']+)'/)[1])));
check(migratedCmdIds.length === 1 && migratedCmdIds[0] === 'employee.contact.update', 'exactly one command id routed through Domain.command(): '+JSON.stringify(migratedCmdIds));
check(dist.includes("Domain.command('employee.contact.update'"), 'migrated command call present in dist');
check(/'employee\.contact\.update':\s*Object\.freeze\(\{[^}]*handler:\s*'updateEmployeeContact'/.test(cmdSrc), 'employee.contact.update registered to handler updateEmployeeContact');
// The facade command() calls the handler exactly once (a single fn.apply, no loop).
const cmdMethod = (facSrc.match(/command:\s*function[\s\S]*?\n    \}/)||[''])[0];
check((cmdMethod.match(/fn\.apply\(/g)||[]).length === 1 && !/for\s*\(|while\s*\(|forEach/.test(cmdMethod), 'Domain.command invokes the handler exactly once (single fn.apply, no loop)');
// PR-5C.1 — approved-field allowlist: the contact handler mutates ONLY phone/email/notes.
const empSrc = read(path.join(root,'js','people','employees.js'));
check(/const EMPLOYEE_CONTACT_FIELDS = \['phone','email','notes'\]/.test(empSrc), 'contact command allowlist is exactly [phone, email, notes]');
const ucStart = empSrc.indexOf('async function updateEmployeeContact(');
check(ucStart !== -1, 'updateEmployeeContact handler present');
const ucRest = ucStart!==-1 ? empSrc.slice(ucStart+1) : '';
const ucNext = ucRest.search(/\n(async function|function) /);
const ucBody = ucNext>=0 ? ucRest.slice(0, ucNext) : ucRest;
['monthlyBaseSalary','employmentStatus','contractType','jobTitle','department','bankName','bankAccount','bankAccountNumber','monthlySalary','joinDate','active'].forEach((f)=>
  check(!ucBody.includes(f), 'contact handler does not touch forbidden field: '+f));
check(ucBody.includes('persistEmployees(') && (ucBody.match(/persistEmployees\(/g)||[]).length === 1, 'contact handler persists exactly once (persistEmployees)');
check(!/logActivity\(/.test(ucBody), 'contact handler adds no duplicate audit call (history-only, matching the edit path)');
check(/success:\s*true/.test(ucBody) && /success:\s*false/.test(ucBody), 'contact handler returns a typed success/failure outcome');
// The full employee save path is unchanged and still direct (not routed):
// the empForm submit handler exists and Domain.command is used exactly once in
// this module (the contact command only) — the monolithic save is not routed.
check(/querySelector\('#empForm'\)\.addEventListener\('submit'/.test(empSrc), 'full employee save (empForm) submit handler still present');
check((empSrc.match(/Domain\.command\(/g)||[]).length === 1, 'exactly one Domain.command() call site in employees.js (the contact command; monolithic save stays direct)');
// Extract command/query identifiers and their handler names.
function idKeys(src){ return (src.match(/^\s*'([a-z][a-zA-Z]*\.[a-zA-Z]+)':/gm)||[]).map(s=>s.match(/'([^']+)'/)[1]); }
function handlerNames(src){ return (src.match(/handler:\s*'([A-Za-z0-9_]+)'/g)||[]).map(s=>s.match(/'([^']+)'/)[1]); }
const cmdIds = idKeys(cmdSrc), qryIds = idKeys(qrySrc);
const cmdHandlers = handlerNames(cmdSrc), qryHandlers = handlerNames(qrySrc);
check(cmdIds.length > 0 && qryIds.length > 0, 'command and query registries are non-empty ('+cmdIds.length+' commands / '+qryIds.length+' queries)');
// Identifiers unique within each registry.
check(new Set(cmdIds).size === cmdIds.length, 'command identifiers are unique');
check(new Set(qryIds).size === qryIds.length, 'query identifiers are unique');
// No identifier collides between commands and queries.
check(cmdIds.filter(id=>qryIds.indexOf(id)!==-1).length === 0, 'no command/query identifier collision');
// Every registered handler name resolves to a real function present in dist.
cmdHandlers.forEach((h)=>check(dist.includes('function '+h+'('), 'command handler resolves to a real function: '+h+'()'));
qryHandlers.forEach((h)=>check(dist.includes('function '+h+'('), 'query handler resolves to a real function: '+h+'()'));

console.log('');
if (fails.length === 0) { console.log('VERIFICATION PASSED -- ' + passes + ' checks OK.'); process.exit(0); }
console.log('VERIFICATION FAILED -- ' + passes + ' passed, ' + fails.length + ' failed:');
fails.forEach((f)=>console.log('   - ' + f));
process.exit(1);
