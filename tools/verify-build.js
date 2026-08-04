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
// SPR-078 — exactly ONE payroll commit pipeline remains (payroll-planning's was retired).
// The transaction-side freeze happens once; buildPayrollOvertimeSnapshot(pp.overtimeIds) is
// called twice by design — once by that pipeline and once by buildPayrollCommittedSnapshot,
// the historical read model. Both live in payroll-ops-engine.js.
check((dist.match(/overtimeSnapshot:\s*otSnapshot\b/g)||[]).length === 1, 'the ONE remaining payroll commit pipeline freezes an overtimeSnapshot (SPR-078 retired the second)');
check((dist.match(/=\s*buildPayrollOvertimeSnapshot\(pp\.overtimeIds/g)||[]).length === 2, 'overtime snapshots are built in exactly two places (the one commit pipeline + the committed-snapshot read model)');
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
check(meta.version === '2.8.4', 'APP_VERSION is 2.8.4 (this development release)');
// v2.7.1 polishing pass — snapshot metadata, single historical API, compact integrity badge.
check(dist.includes('function overtimeSnapshotMeta('), 'overtime snapshot audit metadata helper present');
check((dist.match(/overtimeSnapshotMeta:\s*overtimeSnapshotMeta\(/g)||[]).length === 1, 'the ONE remaining commit pipeline stores overtimeSnapshotMeta {recordCount,totalHours}');
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
// PR-7B "The Conduit" — operational UI pathways now reach the Domain through the
// single UI-to-Transport seam (uiExecute), not via direct Domain.command/query. The
// seam id is the SECOND quoted literal: uiExecute('command'|'query', '<id>', [...]).
// Deriving from the seam call (which requires the '(' ) means comment-only mentions
// of Domain.command/Domain.query are NOT counted as operational call sites.
function seamIds(kind){ const re = new RegExp("uiExecute\\('"+kind+"',\\s*'([^']+)'","g"); const out=[]; let m; while((m=re.exec(srcJs))!==null) out.push(m[1]); return Array.from(new Set(out)); }
const migratedQueryIds = seamIds('query');
check(migratedQueryIds.length === 1 && migratedQueryIds[0] === 'employee.filtered', 'exactly one query id routed through the UI-to-Transport seam: '+JSON.stringify(migratedQueryIds));
check(dist.includes("uiExecute('command', 'employee.contact.update'") || dist.includes("uiExecute('query', 'employee.filtered'"), 'migrated query call present in dist (via the UI-to-Transport seam)');
check(/'employee\.filtered':\s*Object\.freeze\(\{[^}]*handler:\s*'employeesFiltered'/.test(qrySrc), 'employee.filtered query registered to handler employeesFiltered');
// Exactly ONE command migrated (distinct routed command ids), and it is the approved contact command.
const migratedCmdIds = seamIds('command');
const EXPECTED_OP_CMDS = ['employee.contact.update','employee.employment.update','employee.lifecycle.transition','employee.compensation.update','contract.dates.update','payroll.lifecycle.transition','contract.status.transition'];
check(migratedCmdIds.length === 8 && EXPECTED_OP_CMDS.every(id=>migratedCmdIds.indexOf(id)!==-1), 'exactly eight command ids routed through the UI-to-Transport seam: '+JSON.stringify(migratedCmdIds));
check(dist.includes("uiExecute('command', 'employee.contact.update'"), 'migrated command call present in dist (via the seam)');
check(dist.includes("uiExecute('command', 'employee.employment.update'"), 'employment command call present in dist (via the seam)');
check(dist.includes("uiExecute('command', 'employee.lifecycle.transition'"), 'lifecycle command call present in dist (via the seam)');
check(dist.includes("uiExecute('command', 'employee.compensation.update'"), 'compensation command call present in dist (via the seam)');
check(/'employee\.contact\.update':\s*Object\.freeze\(\{[^}]*handler:\s*'updateEmployeeContact'/.test(cmdSrc), 'employee.contact.update registered to handler updateEmployeeContact');
check(/'employee\.employment\.update':\s*Object\.freeze\(\{[^}]*handler:\s*'updateEmployeeEmployment'/.test(cmdSrc), 'employee.employment.update registered to handler updateEmployeeEmployment');
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
// PR-8A — the contact handler's persistence now goes through the Repository boundary.
// (comment-stripped: comments legitimately mention both symbols to describe the path.)
const ucCode = stripComments(ucBody);
check((ucCode.match(/EmployeeRepository\.save\(\)/g)||[]).length === 1, 'contact handler persists exactly once (via EmployeeRepository.save())');
check(!/persistEmployees\(/.test(ucCode), 'contact handler no longer calls persistEmployees() directly (routed through the Repository)');
check(!/logActivity\(/.test(ucBody), 'contact handler adds no duplicate audit call (history-only, matching the edit path)');
check(/success:\s*true/.test(ucBody) && /success:\s*false/.test(ucBody), 'contact handler returns a typed success/failure outcome');
// The full employee save path is unchanged and still direct (not routed):
// the empForm submit handler exists and Domain.command is used exactly once in
// this module (the contact command only) — the monolithic save is not routed.
check(/querySelector\('#empForm'\)\.addEventListener\('submit'/.test(empSrc), 'full employee save (empForm) submit handler still present');
// comment-stripped: a comment mentioning Domain.command()/Domain.query() is not an operational call site.
function stripComments(s){ return s.replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,''); }
const empCode = stripComments(empSrc);
check(!/Domain\.command\(/.test(empCode) && !/Domain\.query\(/.test(empCode), 'employees.js no longer calls Domain.command()/Domain.query() directly (authorized ops routed through the UI-to-Transport seam)');
check((empSrc.match(/uiExecute\('command'/g)||[]).length === 4, 'employees.js routes exactly four aggregate-backed commands through the seam (contact + employment + lifecycle + compensation)');

// PR-5D "The Steward" — first aggregate boundary (EmployeeContactAggregate).
console.log('== EMPLOYEE CONTACT AGGREGATE (PR-5D — business authority) ==');
const aggPath = path.join(root,'js','domain','employee-contact-aggregate.js');
check(fs.existsSync(aggPath), 'aggregate module present: js/domain/employee-contact-aggregate.js');
check(jsFiles.indexOf('domain/employee-contact-aggregate.js') !== -1, 'module-order.js includes domain/employee-contact-aggregate.js');
check(indexHtml.includes('<script src="js/domain/employee-contact-aggregate.js"></script>'), 'index.html includes domain/employee-contact-aggregate.js');
const aggSrc2 = read(aggPath);
check(/const EmployeeContactAggregate = Object\.freeze\(/.test(aggSrc2), 'EmployeeContactAggregate is a frozen object');
check(/prepare:\s*function/.test(aggSrc2), 'aggregate exposes prepare()');
// Exactly one operational aggregate: only one *Aggregate object with a prepare() exists in js/domain.
const aggregateDefs = (srcJs.match(/const \w*Aggregate = Object\.freeze\(\{\s*[\s\S]*?(?:prepare|transition):\s*function/g)||[]).length;
check(aggregateDefs === 8, 'exactly eight operational aggregates defined (found '+aggregateDefs+')');
// The command registry binds the aggregate as the boundary for the one command.
check(/'employee\.contact\.update':\s*Object\.freeze\(\{[^}]*boundary:\s*'EmployeeContactAggregate'/.test(cmdSrc), 'employee.contact.update declares boundary EmployeeContactAggregate');
// The facade routes a bounded command through the aggregate before the handler.
check(/c\.boundary/.test(facSrc) && /agg\[method\]\(/.test(facSrc), 'Domain.command routes bounded commands through the aggregate before the handler');
check(/c\.boundaryMethod \|\| 'prepare'/.test(facSrc) && /c\.boundaryPayload \|\| 'patch'/.test(facSrc), 'facade defaults boundary method/payload to prepare/patch (existing routing unchanged)');
// Aggregate PURITY — it must have no side effects. Assert its CODE (comments
// stripped) contains none of the forbidden operations. It reads existence via
// empById only.
const aggCode = aggSrc2.replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,'');
[['State mutation', /State\s*[.[]/],
 ['persistEmployees', /persistEmployees\s*\(/],
 ['history append', /\.history\b|history\s*=|\.push\(/],
 ['UI render', /\brender\s*\(/],
 ['localStorage', /localStorage/],
 ['audit logging', /logActivity\s*\(/]
].forEach(([label,re])=>check(!re.test(aggCode), 'aggregate never performs '+label));
// Aggregate returns only a sanitized patch or a typed business failure.
check(/return \{ ok: true, patch:/.test(aggSrc2), 'aggregate returns only a sanitized patch on success');
check(/return \{ ok: false, error: 'EmployeeNotFound' \}/.test(aggSrc2) && /error: 'NoContactFieldsProvided'/.test(aggSrc2), 'aggregate returns typed business failures (EmployeeNotFound / NoContactFieldsProvided)');
// Handler separation: mutation/persistence/history remain in the handler, NOT the aggregate.
check(ucBody.includes('EmployeeRepository.save('), 'handler still performs persistence (via EmployeeRepository.save())');
check(/e\.history/.test(ucBody) || /history/.test(ucBody), 'handler still performs history/audit');
check(/e\[k\] = applied\[k\]|e\[k\]=applied\[k\]/.test(ucBody), 'handler still performs the field mutation');

// PR-5E "The Custodian" — second aggregate boundary (EmployeeEmploymentAggregate).
console.log('== EMPLOYEE EMPLOYMENT AGGREGATE (PR-5E — business authority) ==');
const empAggPath = path.join(root,'js','domain','employee-employment-aggregate.js');
check(fs.existsSync(empAggPath), 'aggregate module present: js/domain/employee-employment-aggregate.js');
check(jsFiles.indexOf('domain/employee-employment-aggregate.js') !== -1, 'module-order.js includes domain/employee-employment-aggregate.js');
check(indexHtml.includes('<script src="js/domain/employee-employment-aggregate.js"></script>'), 'index.html includes domain/employee-employment-aggregate.js');
// Load order: the employment aggregate loads before the facade.
check(jsFiles.indexOf('domain/employee-employment-aggregate.js') < jsFiles.indexOf('domain/domain-layer.js'), 'employment aggregate loads before domain-layer.js');
const empAggSrc = read(empAggPath);
check(/const EmployeeEmploymentAggregate = Object\.freeze\(/.test(empAggSrc), 'EmployeeEmploymentAggregate is a frozen object');
check(/prepare:\s*function/.test(empAggSrc), 'employment aggregate exposes prepare()');
// EmployeeContactAggregate remains operational; both boundaries are declared.
check(/const EmployeeContactAggregate = Object\.freeze\(/.test(aggSrc2), 'EmployeeContactAggregate remains an operational aggregate');
check(/'employee\.employment\.update':\s*Object\.freeze\(\{[^}]*boundary:\s*'EmployeeEmploymentAggregate'/.test(cmdSrc), 'employee.employment.update declares boundary EmployeeEmploymentAggregate');
check(/'employee\.contact\.update':\s*Object\.freeze\(\{[^}]*boundary:\s*'EmployeeContactAggregate'/.test(cmdSrc), 'employee.contact.update still declares boundary EmployeeContactAggregate');
// Exactly one operational query remains (employee.filtered) — unchanged by PR-5E.
check(migratedQueryIds.length === 1 && migratedQueryIds[0] === 'employee.filtered', 'employee.filtered remains the only operational query');
// Employment aggregate PURITY — no side effects (comments stripped).
const empAggCode = empAggSrc.replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,'');
[['State mutation', /State\s*[.[]/],
 ['persistEmployees', /persistEmployees\s*\(/],
 ['history append', /\.history\b|history\s*=|\.push\(/],
 ['updatedAt mutation', /updatedAt/],
 ['UI render', /\brender\s*\(/],
 ['localStorage', /localStorage/],
 ['audit logging', /logActivity\s*\(/]
].forEach(([label,re])=>check(!re.test(empAggCode), 'employment aggregate never performs '+label));
// Employment aggregate returns only a sanitized patch or typed business failures.
check(/return \{ ok: true, patch:/.test(empAggSrc), 'employment aggregate returns only a sanitized patch on success');
['EmployeeNotFound','NoEmploymentFieldsProvided','InvalidEmploymentStatus','InvalidContractType'].forEach((err)=>
  check(empAggSrc.includes("error: '"+err+"'"), 'employment aggregate returns typed business failure: '+err));
// Employment field allowlist is exactly the five approved fields.
check(/const EMPLOYEE_EMPLOYMENT_FIELDS = \['jobTitle','department','employmentStatus','joinDate','contractType'\]/.test(empSrc), 'employment command allowlist is exactly [jobTitle, department, employmentStatus, joinDate, contractType]');
// Handler owns mutation/persistence/history/rollback (implementation authority).
const ueStart = empSrc.indexOf('async function updateEmployeeEmployment(');
check(ueStart !== -1, 'updateEmployeeEmployment handler present');
const ueRest = ueStart!==-1 ? empSrc.slice(ueStart+1) : '';
const ueNext = ueRest.search(/\n(async function|function) /);
const ueBody = ueNext>=0 ? ueRest.slice(0, ueNext) : ueRest;
['monthlyBaseSalary','email','phone','notes','bankName','bankAccount','bankAccountNumber','bankAccountHolder','active','fullName','employeeId','createdAt'].forEach((f)=>
  check(!ueBody.includes(f), 'employment handler does not touch forbidden field: '+f));
// PR-9A — the employment handler's persistence now goes through the Repository (comment-stripped).
const ueCode = stripComments(ueBody);
check((ueCode.match(/EmployeeRepository\.save\(\)/g)||[]).length === 1, 'employment handler persists exactly once (via EmployeeRepository.save())');
check(!/persistEmployees\(/.test(ueCode), 'employment handler no longer calls persistEmployees() directly (routed through the Repository)');
check(/e\[k\] = applied\[k\]/.test(ueBody), 'employment handler performs the field mutation');
check(/e\.updatedAt = new Date/.test(ueBody), 'employment handler updates updatedAt');
check(/event:'employment-edited'/.test(ueBody), 'employment handler appends exactly one employment-edited history entry');
check(/e\.history\.pop\(\)/.test(ueBody) && /e\.updatedAt = prevUpdatedAt/.test(ueBody), 'employment handler performs full rollback on persist failure');
check(/error:'PersistFailed'/.test(ueBody), 'employment handler returns PersistFailed on persistence failure');
check(/success:\s*true/.test(ueBody) && /success:\s*false/.test(ueBody), 'employment handler returns a typed success/failure outcome');
check(!/logActivity\(/.test(ueBody), 'employment handler adds no duplicate audit call (history-only)');
// Aggregate failure never invokes the handler: the facade returns early on !decision.ok.
check(/decision\.ok !== true/.test(facSrc) && /return \{ success: false, error:/.test(facSrc), 'facade returns a typed failure without invoking the handler when the aggregate rejects');

// PR-5G "The Gatekeeper" — third aggregate boundary (EmployeeLifecycleAggregate).
console.log('== EMPLOYEE LIFECYCLE AGGREGATE (PR-5G — business authority) ==');
const lifeAggPath = path.join(root,'js','domain','employee-lifecycle-aggregate.js');
check(fs.existsSync(lifeAggPath), 'aggregate module present: js/domain/employee-lifecycle-aggregate.js');
check(jsFiles.indexOf('domain/employee-lifecycle-aggregate.js') !== -1, 'module-order.js includes domain/employee-lifecycle-aggregate.js');
check(indexHtml.includes('<script src="js/domain/employee-lifecycle-aggregate.js"></script>'), 'index.html includes domain/employee-lifecycle-aggregate.js');
// Load order: the lifecycle aggregate loads before the facade and after the helpers.
check(jsFiles.indexOf('domain/employee-lifecycle-aggregate.js') < jsFiles.indexOf('domain/domain-layer.js') &&
      jsFiles.indexOf('domain/aggregate-helpers.js') < jsFiles.indexOf('domain/employee-lifecycle-aggregate.js'), 'lifecycle aggregate loads after helpers and before domain-layer.js');
const lifeAggSrc = read(lifeAggPath);
check(/const EmployeeLifecycleAggregate = Object\.freeze\(/.test(lifeAggSrc), 'EmployeeLifecycleAggregate is a frozen object');
check(/transition:\s*function/.test(lifeAggSrc), 'lifecycle aggregate exposes transition()');
// The command registry binds the aggregate as the boundary and declares its method/payload.
check(/'employee\.lifecycle\.transition':\s*Object\.freeze\(\{[^}]*boundary:\s*'EmployeeLifecycleAggregate'/.test(cmdSrc), 'employee.lifecycle.transition declares boundary EmployeeLifecycleAggregate');
check(/'employee\.lifecycle\.transition':\s*Object\.freeze\(\{[^}]*boundaryMethod:\s*'transition'/.test(cmdSrc) && /'employee\.lifecycle\.transition':\s*Object\.freeze\(\{[^}]*boundaryPayload:\s*'transition'/.test(cmdSrc), 'employee.lifecycle.transition declares boundaryMethod/boundaryPayload = transition');
check(/'employee\.lifecycle\.transition':\s*Object\.freeze\(\{[^}]*handler:\s*'transitionEmployeeLifecycle'/.test(cmdSrc), 'employee.lifecycle.transition registered to handler transitionEmployeeLifecycle');
// Only the four supported transitions are permitted; no extra lifecycle states.
check(/'Active':\s*\['Resigned',\s*'Terminated'\]/.test(lifeAggSrc) && /'Resigned':\s*\['Active'\]/.test(lifeAggSrc) && /'Terminated':\s*\['Active'\]/.test(lifeAggSrc), 'lifecycle transition map is exactly the four supported transitions');
check(/const EMPLOYEE_LIFECYCLE_STATES = \['Active', 'Resigned', 'Terminated'\]/.test(lifeAggSrc), 'lifecycle states are exactly [Active, Resigned, Terminated] (no new states)');
// Lifecycle aggregate PURITY — no side effects (comments stripped).
const lifeAggCode = lifeAggSrc.replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,'');
[['State mutation', /State\s*[.[]/],
 ['persistEmployees', /persistEmployees\s*\(/],
 ['Employee mutation', /\be\.\w+\s*=/],
 ['history append', /\.history\b|history\s*=|\.push\(/],
 ['updatedAt mutation', /updatedAt/],
 ['UI render', /\brender\s*\(/],
 ['localStorage', /localStorage/],
 ['audit logging', /logActivity\s*\(/]
].forEach(([label,re])=>check(!re.test(lifeAggCode), 'lifecycle aggregate never performs '+label));
// It uses the shared existence helper (PR-5F) rather than re-inlining empById.
check(/employeeExists\(/.test(lifeAggSrc), 'lifecycle aggregate uses the shared employeeExists helper');
// Aggregate returns a sanitized transition on success and typed failures otherwise.
check(/return \{ ok: true, transition:/.test(lifeAggSrc), 'lifecycle aggregate returns only a sanitized transition on success');
['EmployeeNotFound','InvalidLifecycleState','IllegalLifecycleTransition'].forEach((err)=>
  check(lifeAggSrc.includes("error: '"+err+"'"), 'lifecycle aggregate returns typed business failure: '+err));
// Handler owns mutation/persistence/history/rollback (implementation authority).
const tlStart = empSrc.indexOf('async function transitionEmployeeLifecycle(');
check(tlStart !== -1, 'transitionEmployeeLifecycle handler present');
const tlRest = tlStart!==-1 ? empSrc.slice(tlStart+1) : '';
const tlNext = tlRest.search(/\n(async function|function) /);
const tlBody = tlNext>=0 ? tlRest.slice(0, tlNext) : tlRest;
// Lifecycle changes ONLY employmentStatus (+ updatedAt/history); every other field is forbidden.
['monthlyBaseSalary','jobTitle','department','joinDate','contractType','email','phone','notes','bankName','bankAccount','bankAccountNumber','bankAccountHolder','active','fullName','employeeId','createdAt'].forEach((f)=>
  check(!tlBody.includes(f), 'lifecycle handler does not touch forbidden field: '+f));
// PR-9B — the lifecycle handler's persistence now goes through the Repository (comment-stripped).
const tlCodeLc = stripComments(tlBody);
check((tlCodeLc.match(/EmployeeRepository\.save\(\)/g)||[]).length === 1, 'lifecycle handler persists exactly once (via EmployeeRepository.save())');
check(!/persistEmployees\(/.test(tlCodeLc), 'lifecycle handler no longer calls persistEmployees() directly (routed through the Repository)');
check(/e\.employmentStatus = to/.test(tlBody), 'lifecycle handler performs the status mutation');
check(/e\.updatedAt = new Date/.test(tlBody), 'lifecycle handler updates updatedAt');
check(/event:'lifecycle-transition'/.test(tlBody), 'lifecycle handler appends exactly one lifecycle-transition history entry');
check(/e\.employmentStatus = prevStatus/.test(tlBody) && /e\.history\.pop\(\)/.test(tlBody) && /e\.updatedAt = prevUpdatedAt/.test(tlBody), 'lifecycle handler performs full rollback on persist failure');
check(/error:'PersistFailed'/.test(tlBody), 'lifecycle handler returns PersistFailed on persistence failure');
check(/error:'IllegalLifecycleTransition'/.test(tlBody), 'lifecycle handler performs defense-in-depth transition validation');
check(!/logActivity\(/.test(tlBody), 'lifecycle handler adds no duplicate audit call (history-only)');
check(/success:\s*true/.test(tlBody) && /success:\s*false/.test(tlBody), 'lifecycle handler returns a typed success/failure outcome');
// The existing contact and employment aggregates are untouched by PR-5G.
check(/const EmployeeContactAggregate = Object\.freeze\(/.test(aggSrc2) && /const EmployeeEmploymentAggregate = Object\.freeze\(/.test(empAggSrc), 'contact and employment aggregates remain operational');

// PR-5H "The Arbiter" — fourth aggregate boundary (EmployeeCompensationAggregate).
console.log('== EMPLOYEE COMPENSATION AGGREGATE (PR-5H — business authority) ==');
const compAggPath = path.join(root,'js','domain','employee-compensation-aggregate.js');
check(fs.existsSync(compAggPath), 'aggregate module present: js/domain/employee-compensation-aggregate.js');
check(jsFiles.indexOf('domain/employee-compensation-aggregate.js') !== -1, 'module-order.js includes domain/employee-compensation-aggregate.js');
check(indexHtml.includes('<script src="js/domain/employee-compensation-aggregate.js"></script>'), 'index.html includes domain/employee-compensation-aggregate.js');
// Load order: after helpers, before the facade.
check(jsFiles.indexOf('domain/aggregate-helpers.js') < jsFiles.indexOf('domain/employee-compensation-aggregate.js') &&
      jsFiles.indexOf('domain/employee-compensation-aggregate.js') < jsFiles.indexOf('domain/domain-layer.js'), 'compensation aggregate loads after helpers and before domain-layer.js');
const compAggSrc = read(compAggPath);
check(/const EmployeeCompensationAggregate = Object\.freeze\(/.test(compAggSrc), 'EmployeeCompensationAggregate is a frozen object');
check(/prepare:\s*function/.test(compAggSrc), 'compensation aggregate exposes prepare() (default entry contract)');
// Command registration + DEFAULT prepare/patch contract (no boundaryMethod/boundaryPayload).
check(/'employee\.compensation\.update':\s*Object\.freeze\(\{[^}]*boundary:\s*'EmployeeCompensationAggregate'/.test(cmdSrc), 'employee.compensation.update declares boundary EmployeeCompensationAggregate');
check(/'employee\.compensation\.update':\s*Object\.freeze\(\{[^}]*handler:\s*'updateEmployeeCompensation'/.test(cmdSrc), 'employee.compensation.update registered to handler updateEmployeeCompensation');
const compCmdEntry = (cmdSrc.match(/'employee\.compensation\.update':\s*Object\.freeze\(\{[^}]*\}\)/)||[''])[0];
check(compCmdEntry !== '' && !/boundaryMethod/.test(compCmdEntry) && !/boundaryPayload/.test(compCmdEntry), 'compensation command uses the DEFAULT prepare/patch contract (no boundaryMethod/boundaryPayload)');
// Domain routing (domain-layer.js) is UNCHANGED by PR-5H.
check(!/employee\.compensation|EmployeeCompensation/.test(facSrc), 'domain-layer.js is not modified for the compensation command');
// Compensation allowlist is exactly [monthlyBaseSalary].
check(/const EMPLOYEE_COMPENSATION_FIELDS = \['monthlyBaseSalary'\]/.test(empSrc), 'compensation allowlist is exactly [monthlyBaseSalary]');
// Compensation aggregate PURITY — no side effects (comments stripped).
const compAggCode = compAggSrc.replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,'');
[['State mutation', /State\s*[.[]/],
 ['persistEmployees', /persistEmployees\s*\(/],
 ['Employee mutation', /\be\.\w+\s*=/],
 ['history append', /\.history\b|history\s*=|\.push\(/],
 ['updatedAt mutation', /updatedAt/],
 ['UI render', /\brender\s*\(/],
 ['toast', /\btoast\s*\(/],
 ['localStorage', /localStorage/],
 ['audit logging', /logActivity\s*\(/]
].forEach(([label,re])=>check(!re.test(compAggCode), 'compensation aggregate never performs '+label));
// Uses the shared existence helper.
check(/employeeExists\(/.test(compAggSrc), 'compensation aggregate uses the shared employeeExists helper');
// Returns a sanitized {monthlyBaseSalary} patch on success and typed failures otherwise.
check(/return \{ ok: true, patch: \{ monthlyBaseSalary: value \} \}/.test(compAggSrc), 'compensation aggregate returns only a sanitized { monthlyBaseSalary } patch on success');
['EmployeeNotFound','NoCompensationFieldsProvided','InvalidMonthlyBaseSalary'].forEach((err)=>
  check(compAggSrc.includes("error: '"+err+"'"), 'compensation aggregate returns typed business failure: '+err));
// Handler owns mutation/updatedAt/history/persistence/rollback (implementation authority).
const ucoStart = empSrc.indexOf('async function updateEmployeeCompensation(');
check(ucoStart !== -1, 'updateEmployeeCompensation handler present');
const ucoRest = ucoStart!==-1 ? empSrc.slice(ucoStart+1) : '';
const ucoNext = ucoRest.search(/\n(async function|function) /);
const ucoBody = ucoNext>=0 ? ucoRest.slice(0, ucoNext) : ucoRest;
// Compensation changes ONLY monthlyBaseSalary (+ updatedAt/history); every other field forbidden.
['employmentStatus','jobTitle','department','joinDate','contractType','email','phone','notes','bankName','bankAccount','bankAccountNumber','bankAccountHolder','active','fullName','employeeId','createdAt'].forEach((f)=>
  check(!ucoBody.includes(f), 'compensation handler does not touch forbidden field: '+f));
// PR-9C — the compensation handler's persistence now goes through the Repository (comment-stripped).
const ucoCodeLc = stripComments(ucoBody);
check((ucoCodeLc.match(/EmployeeRepository\.save\(\)/g)||[]).length === 1, 'compensation handler persists exactly once (via EmployeeRepository.save())');
check(!/persistEmployees\(/.test(ucoCodeLc), 'compensation handler no longer calls persistEmployees() directly (routed through the Repository)');
check(/e\.monthlyBaseSalary = value/.test(ucoBody), 'compensation handler performs the monthlyBaseSalary mutation');
check(/e\.updatedAt = new Date/.test(ucoBody), 'compensation handler updates updatedAt');
check(/event:'compensation-edited'/.test(ucoBody), 'compensation handler appends exactly one compensation-edited history entry');
check(/e\.monthlyBaseSalary = before/.test(ucoBody) && /e\.history\.pop\(\)/.test(ucoBody) && /e\.updatedAt = prevUpdatedAt/.test(ucoBody), 'compensation handler performs full rollback on persist failure');
check(/error:'PersistFailed'/.test(ucoBody), 'compensation handler returns PersistFailed on persistence failure');
check(/error:'InvalidMonthlyBaseSalary'/.test(ucoBody), 'compensation handler performs defense-in-depth value validation');
check(!/logActivity\(/.test(ucoBody), 'compensation handler adds no duplicate audit call (history-only)');
check(/success:\s*true/.test(ucoBody) && /success:\s*false/.test(ucoBody), 'compensation handler returns a typed success/failure outcome');
// The history note must NOT record the salary value (no standard requires it).
check(/note:'Monthly base salary updated'/.test(ucoBody), 'compensation history note does not record the salary value');
// Existing aggregates remain operational and untouched by PR-5H.
check(/const EmployeeLifecycleAggregate = Object\.freeze\(/.test(lifeAggSrc), 'lifecycle aggregate remains operational');
// Architecture backlog / Proposed ADRs remain untouched (governance, not code — checked as docs).
check(/\*\*Status:\*\* Planned/.test(read(path.join(root,'docs','02-architecture','Architecture_Evolution_Backlog.md'))), 'ARCH backlog items remain Planned (not implemented here)');

// PR-5I "The Binder" — first Contract aggregate boundary (ContractDateAggregate).
console.log('== CONTRACT DATE AGGREGATE (PR-5I — business authority) ==');
const ctAggPath = path.join(root,'js','domain','contract-date-aggregate.js');
check(fs.existsSync(ctAggPath), 'aggregate module present: js/domain/contract-date-aggregate.js');
check(jsFiles.indexOf('domain/contract-date-aggregate.js') !== -1, 'module-order.js includes domain/contract-date-aggregate.js');
check(indexHtml.includes('<script src="js/domain/contract-date-aggregate.js"></script>'), 'index.html includes domain/contract-date-aggregate.js');
// Load order: after helpers, before the facade.
check(jsFiles.indexOf('domain/aggregate-helpers.js') < jsFiles.indexOf('domain/contract-date-aggregate.js') &&
      jsFiles.indexOf('domain/contract-date-aggregate.js') < jsFiles.indexOf('domain/domain-layer.js'), 'contract-date aggregate loads after helpers and before domain-layer.js');
const ctAggSrc = read(ctAggPath);
check(/const ContractDateAggregate = Object\.freeze\(/.test(ctAggSrc), 'ContractDateAggregate is a frozen object');
check(/prepare:\s*function/.test(ctAggSrc), 'contract-date aggregate exposes prepare() (default entry contract)');
// Command registration + DEFAULT prepare/patch contract (no boundaryMethod/boundaryPayload).
check(/'contract\.dates\.update':\s*Object\.freeze\(\{[^}]*boundary:\s*'ContractDateAggregate'/.test(cmdSrc), 'contract.dates.update declares boundary ContractDateAggregate');
check(/'contract\.dates\.update':\s*Object\.freeze\(\{[^}]*handler:\s*'updateContractDates'/.test(cmdSrc), 'contract.dates.update registered to handler updateContractDates');
check(/'contract\.dates\.update':\s*Object\.freeze\(\{[^}]*aggregate:\s*'Contract'/.test(cmdSrc), 'contract.dates.update declares aggregate Contract');
const ctCmdEntry = (cmdSrc.match(/'contract\.dates\.update':\s*Object\.freeze\(\{[^}]*\}\)/)||[''])[0];
check(ctCmdEntry !== '' && !/boundaryMethod/.test(ctCmdEntry) && !/boundaryPayload/.test(ctCmdEntry), 'contract.dates.update uses the DEFAULT prepare/patch contract (no boundaryMethod/boundaryPayload)');
check(dist.includes("uiExecute('command', 'contract.dates.update'"), 'contract dates command call present in dist (via the seam)');
// Domain routing (domain-layer.js) is UNCHANGED by PR-5I.
check(!/contract\.dates|ContractDate/.test(facSrc), 'domain-layer.js is not modified for the contract command');
// Allowlist is exactly [startDate, durationMonths] (stored facts; NOT endDate).
check(/const CONTRACT_DATE_FIELDS = \['startDate', 'durationMonths'\]/.test(ctAggSrc), 'contract date allowlist is exactly [startDate, durationMonths]');
// The aggregate never writes a stored endDate.
check(!/endDate\s*[:=]/.test(ctAggSrc.replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,'')), 'contract-date aggregate never writes endDate');
// Contract-date aggregate PURITY — no side effects (comments stripped).
const ctAggCode = ctAggSrc.replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,'');
[['State mutation', /State\s*[.[]/],
 ['persistContracts', /persistContracts\s*\(/],
 ['persistHR', /persistHR\s*\(/],
 ['Contract mutation', /\bc\.\w+\s*=/],
 ['history append', /\.history\b|history\s*=|\.push\(/],
 ['updatedAt mutation', /updatedAt/],
 ['UI render', /\brender\s*\(/],
 ['toast', /\btoast\s*\(/],
 ['localStorage', /localStorage/],
 ['audit logging', /logActivity\s*\(/]
].forEach(([label,re])=>check(!re.test(ctAggCode), 'contract-date aggregate never performs '+label));
// Returns a sanitized patch on success and typed failures otherwise.
check(/return \{ ok: true, patch: clean \}/.test(ctAggSrc), 'contract-date aggregate returns only a sanitized patch on success');
['ContractNotFound','NoContractDateFieldsProvided','InvalidStartDate','InvalidDurationMonths','InvalidContractDateRange'].forEach((err)=>
  check(ctAggSrc.includes("error: '"+err+"'"), 'contract-date aggregate returns typed business failure: '+err));
// Handler owns mutation/updatedAt/history/persistence/rollback (implementation authority).
const ctSrc = read(path.join(root,'js','people','contracts.js'));
const udStart = ctSrc.indexOf('async function updateContractDates(');
check(udStart !== -1, 'updateContractDates handler present');
const udRest = udStart!==-1 ? ctSrc.slice(udStart+1) : '';
const udNext = udRest.search(/\n(async function|function) /);
const udBody = udNext>=0 ? udRest.slice(0, udNext) : udRest;
// Contract dates change ONLY startDate/durationMonths (+ updatedAt/history); every other field forbidden.
['monthlySalary','contractNumber','contractType','employeeId','createdAt','notes','renewedFromId','renewedToId'].forEach((f)=>
  check(!udBody.includes(f), 'contract-date handler does not touch forbidden field: '+f));
// Handler must never write a stored endDate, and never mutate a status.
check(!/\.endDate\s*=/.test(udBody) && !/endDate:/.test(udBody), 'contract-date handler never writes endDate');
check(!/\.status\s*=/.test(udBody), 'contract-date handler never mutates Contract status');
// PR-10A — the contract-date handler's persistence now goes through the Repository (comment-stripped).
const udCode = stripComments(udBody);
check((udCode.match(/ContractRepository\.save\(\)/g)||[]).length === 1, 'contract-date handler persists exactly once (via ContractRepository.save())');
check(!/persistContracts\(/.test(udCode), 'contract-date handler no longer calls persistContracts() directly (routed through the Repository)');
check(!/persistEmployees\(|persistHR\(/.test(udBody), 'contract-date handler uses only the Contract persistence path');
check(/c\[k\] = applied\[k\]/.test(udBody), 'contract-date handler performs the stored-date mutation');
check(/c\.updatedAt = new Date/.test(udBody), 'contract-date handler updates updatedAt');
check(/event:'contract-dates-edited'/.test(udBody), 'contract-date handler appends exactly one contract-dates-edited history entry');
check(/c\[k\] = before\[k\]/.test(udBody) && /c\.history\.pop\(\)/.test(udBody) && /c\.updatedAt = prevUpdatedAt/.test(udBody), 'contract-date handler performs full rollback on persist failure');
check(/error:'PersistFailed'/.test(udBody), 'contract-date handler returns PersistFailed on persistence failure');
check(/error:'InvalidStartDate'/.test(udBody) && /error:'InvalidDurationMonths'/.test(udBody), 'contract-date handler performs defense-in-depth validation');
check(!/logActivity\(/.test(udBody), 'contract-date handler adds no duplicate audit call (history-only)');
check(/success:\s*true/.test(udBody) && /success:\s*false/.test(udBody), 'contract-date handler returns a typed success/failure outcome');
// The UI routes through Domain.command in contracts.js (dates seam + PR-5K status seam); no direct handler call.
check(!/Domain\.command\(/.test(ctSrc) && !/Domain\.query\(/.test(ctSrc), 'contracts.js no longer calls Domain.command()/Domain.query() directly (routed through the seam)');
check((ctSrc.match(/uiExecute\('command'/g)||[]).length === 3, 'contracts.js routes exactly three aggregate-backed commands through the seam (dates + status + renewal)');
check((ctSrc.match(/updateContractDates\(/g)||[]).length === 1, 'UI never calls updateContractDates() directly (only the function definition appears)');
// contractCalc() semantics are not modified by PR-5I (people-core.js untouched).
check(!/function contractCalc/.test(ctAggSrc) && !/function contractCalc/.test(udBody), 'contract-date capability does not redefine contractCalc()');

// PR-5J "The Accountant" — first Payroll aggregate boundary (PayrollLifecycleAggregate).
console.log('== PAYROLL LIFECYCLE AGGREGATE (PR-5J — business authority) ==');
const payAggPath = path.join(root,'js','domain','payroll-lifecycle-aggregate.js');
check(fs.existsSync(payAggPath), 'aggregate module present: js/domain/payroll-lifecycle-aggregate.js');
check(jsFiles.indexOf('domain/payroll-lifecycle-aggregate.js') !== -1, 'module-order.js includes domain/payroll-lifecycle-aggregate.js');
check(indexHtml.includes('<script src="js/domain/payroll-lifecycle-aggregate.js"></script>'), 'index.html includes domain/payroll-lifecycle-aggregate.js');
// Load order: after helpers + the payroll read/lock helpers, before the facade.
check(jsFiles.indexOf('domain/aggregate-helpers.js') < jsFiles.indexOf('domain/payroll-lifecycle-aggregate.js') &&
      jsFiles.indexOf('people/payroll-ops-engine.js') < jsFiles.indexOf('domain/payroll-lifecycle-aggregate.js') &&
      jsFiles.indexOf('domain/payroll-lifecycle-aggregate.js') < jsFiles.indexOf('domain/domain-layer.js'), 'payroll lifecycle aggregate loads after payroll helpers and before domain-layer.js');
const payAggSrc = read(payAggPath);
check(/const PayrollLifecycleAggregate = Object\.freeze\(/.test(payAggSrc), 'PayrollLifecycleAggregate is a frozen object');
check(/transition:\s*function/.test(payAggSrc), 'payroll lifecycle aggregate exposes transition()');
// Command registration: boundary + lifecycle transition/transition contract + handler + aggregate id.
check(/'payroll\.lifecycle\.transition':\s*Object\.freeze\(\{[^}]*boundary:\s*'PayrollLifecycleAggregate'/.test(cmdSrc), 'payroll.lifecycle.transition declares boundary PayrollLifecycleAggregate');
check(/'payroll\.lifecycle\.transition':\s*Object\.freeze\(\{[^}]*boundaryMethod:\s*'transition'/.test(cmdSrc) && /'payroll\.lifecycle\.transition':\s*Object\.freeze\(\{[^}]*boundaryPayload:\s*'transition'/.test(cmdSrc), 'payroll.lifecycle.transition declares boundaryMethod/boundaryPayload = transition');
check(/'payroll\.lifecycle\.transition':\s*Object\.freeze\(\{[^}]*handler:\s*'transitionPayrollLifecycle'/.test(cmdSrc), 'payroll.lifecycle.transition registered to handler transitionPayrollLifecycle');
check(/'payroll\.lifecycle\.transition':\s*Object\.freeze\(\{[^}]*aggregate:\s*'PayrollPlan'/.test(cmdSrc), 'payroll.lifecycle.transition declares aggregate PayrollPlan');
check(dist.includes("uiExecute('command', 'payroll.lifecycle.transition'"), 'payroll lifecycle command call present in dist (via the seam)');
// Domain routing (domain-layer.js) is UNCHANGED by PR-5J (reuses the transition/transition contract).
check(!/payroll\.lifecycle|PayrollLifecycle/.test(facSrc), 'domain-layer.js is not modified for the payroll lifecycle command');
// The transition graph is derived from runtime behavior — exactly the discovered edges, no more.
check(/'Draft':\s*\['Reviewed',\s*'Ready',\s*'Cancelled'\]/.test(payAggSrc) &&
      /'Reviewed':\s*\['Ready',\s*'Draft',\s*'Cancelled'\]/.test(payAggSrc) &&
      /'Ready':\s*\['Draft',\s*'Cancelled'\]/.test(payAggSrc) &&
      /'Committed':\s*\[\]/.test(payAggSrc) && /'Cancelled':\s*\[\]/.test(payAggSrc), 'payroll lifecycle transition map is exactly the derived pre-posting graph (Committed/Cancelled terminal)');
// Uses the existing stored statuses as the single source of truth (no invented states).
check(/PAYROLL_STATUSES/.test(payAggSrc), 'payroll lifecycle aggregate validates against the existing PAYROLL_STATUSES (single source)');
check(!/'Review'|'Approved'|'Posted'|'Executed'/.test(payAggSrc), 'aggregate never introduces UI/derived stages (Review/Approved/Posted/Executed) as stored statuses');
// Aggregate PURITY — no side effects (comments stripped). Reads only via payrollPlanById + isPayrollLocked.
const payAggCode = payAggSrc.replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,'');
[['State mutation', /State\s*[.[]/],
 ['persistPayrollPlans', /persistPayrollPlans\s*\(/],
 ['persist', /\bpersist(HR|Overtime|MonthlyPlans)?\s*\(/],
 ['PayrollPlan mutation', /\bpp\.\w+\s*=[^=]/],
 ['history append', /\.history\b|history\s*=|\.push\(/],
 ['updatedAt mutation', /updatedAt/],
 ['UI render', /\brender\s*\(/],
 ['toast/alert', /\btoast\s*\(|showWarning\s*\(|showSuccess\s*\(|\balert\s*\(/],
 ['localStorage', /localStorage/],
 ['audit logging', /logActivity\s*\(/],
 ['posting', /commitReadyPayroll\s*\(/],
 ['generation', /generatePayrollForMonth\s*\(/]
].forEach(([label,re])=>check(!re.test(payAggCode), 'payroll lifecycle aggregate never performs '+label));
check(/payrollPlanById\(/.test(payAggSrc) && /isPayrollLocked\(/.test(payAggSrc), 'aggregate reads existence + period lock read-only (payrollPlanById / isPayrollLocked)');
// Returns a sanitized transition on success and typed failures otherwise.
check(/return \{ ok: true, transition:/.test(payAggSrc), 'payroll lifecycle aggregate returns only a sanitized transition on success');
['PayrollPlanNotFound','InvalidPayrollLifecycleState','PayrollPeriodLocked','PayrollCommittedImmutable','IllegalPayrollLifecycleTransition'].forEach((err)=>
  check(payAggSrc.includes("error: '"+err+"'"), 'payroll lifecycle aggregate returns typed business failure: '+err));
// Handler owns mutation/updatedAt/history/persistence/rollback/audit (implementation authority).
const poeSrc = read(path.join(root,'js','people','payroll-ops-engine.js'));
const tpStart = poeSrc.indexOf('async function transitionPayrollLifecycle(');
check(tpStart !== -1, 'transitionPayrollLifecycle handler present');
const tpRest = tpStart!==-1 ? poeSrc.slice(tpStart+1) : '';
const tpNext = tpRest.search(/\n(async function|function) /);
const tpBody = tpNext>=0 ? tpRest.slice(0, tpNext) : tpRest;
// Lifecycle changes ONLY status (+ updatedAt/history); calculation/committed fields are forbidden.
['baseSalary','salaryOverride','overtimeAmount','overtimeHours','allowance','bonus','benefits','otherAddition','deduction','plannedAmount','committedSnapshot','committedTxnId','transactionId'].forEach((f)=>
  check(!tpBody.includes(f), 'payroll lifecycle handler does not touch forbidden field: '+f));
// PR-11A — the payroll-lifecycle handler's persistence now goes through the Repository (comment-stripped).
const tpCode = stripComments(tpBody);
check((tpCode.match(/PayrollRepository\.save\(\)/g)||[]).length === 1, 'handler persists exactly once (via PayrollRepository.save())');
check(!/persistPayrollPlans\(/.test(tpCode), 'payroll-lifecycle handler no longer calls persistPayrollPlans() directly (routed through the Repository)');
check(!/persist\(\)|persistOvertime\(|persistMonthlyPlans\(|persistSupplementalPayments\(/.test(tpBody), 'handler uses only the PayrollPlan persistence path (no other store written)');
check(/pp\.status = to/.test(tpBody), 'handler performs the status mutation (only PayrollPlan.status)');
check(/pp\.updatedAt = new Date/.test(tpBody), 'handler updates updatedAt');
check((tpBody.match(/\.push\(/g)||[]).length === 1, 'handler appends exactly one PayrollPlan history entry on success');
check(/pp\.status = prevStatus/.test(tpBody) && /pp\.history\.pop\(\)/.test(tpBody) && /pp\.updatedAt = prevUpdatedAt/.test(tpBody), 'handler performs full rollback on persist failure (status + history + updatedAt)');
check(/error:'PersistFailed'/.test(tpBody), 'handler returns PersistFailed on persistence failure');
check(/error:'IllegalPayrollLifecycleTransition'/.test(tpBody) && /error:'PayrollPeriodLocked'/.test(tpBody) && /error:'PayrollCommittedImmutable'/.test(tpBody), 'handler performs defense-in-depth lock/immutable/transition validation');
// Audit runs ONLY after a successful persist (never before, never on the failure path).
check(/PayrollRepository\.save\(\)[\s\S]*?persisted\.ok !== true[\s\S]*?return \{ success:false, error:'PersistFailed' \}[\s\S]*?logActivity\(/.test(tpBody), 'handler audits only after persistence succeeds (after the PersistFailed return)');
check(!/showWarning|showSuccess|\btoast\(|\brender\(/.test(tpBody), 'handler performs no UI (no toast/warning/render) — it is the implementation authority, not the UI');
check(!/commitReadyPayroll\(|generatePayrollForMonth\(|payrollCommitTxn\(|buildPayrollCommittedSnapshot\(/.test(tpBody), 'handler never posts, generates, or freezes a committed snapshot');
check(/success:\s*true/.test(tpBody) && /success:\s*false/.test(tpBody), 'handler returns a typed success/failure outcome');
// The former procedural mutators are gone — no second lifecycle mutation authority remains.
check(!/function setPayrollStatus\(/.test(poeSrc) && !/function bulkPayrollStatus\(/.test(poeSrc), 'setPayrollStatus / bulkPayrollStatus removed (single lifecycle authority via the Domain command)');
check(!/setPayrollStatus\(|bulkPayrollStatus\(/.test(srcJs), 'no caller of setPayrollStatus / bulkPayrollStatus remains anywhere');
// Single-record UI: routes through the one Domain-command seam (requestPayrollLifecycle); never the handler.
const pwsSrc = read(path.join(root,'js','people','payroll-workspace.js'));
check(/async function requestPayrollLifecycle\(/.test(pwsSrc) && /uiExecute\('command', 'payroll\.lifecycle\.transition', \[id, targetStatus\]\)/.test(pwsSrc), 'requestPayrollLifecycle routes single-record transitions through the UI-to-Transport seam');
check(/'prow-review'\)\s*\{ await requestPayrollLifecycle\(id,'Reviewed'\)/.test(empSrc) && /'prow-cancel'\)/.test(empSrc) && /requestPayrollLifecycle\(id,'Cancelled'\)/.test(empSrc), 'employee worksheet menu (prow-*) routes single-record transitions through requestPayrollLifecycle');
check(!/setPayrollStatus\(/.test(empSrc), 'the migrated single-record menu no longer calls setPayrollStatus directly');
check(!/transitionPayrollLifecycle\(/.test(empSrc) && !/transitionPayrollLifecycle\(/.test(pwsSrc), 'no UI file calls the handler transitionPayrollLifecycle() directly');
check((poeSrc.match(/transitionPayrollLifecycle\(/g)||[]).length === 1, 'transitionPayrollLifecycle appears only as its definition (never invoked outside the Domain command)');
// Bulk UI: one Domain command PER eligible record (no bulk aggregate/command, no cross-record rollback claim).
check(/for\(const pid of eligible\)\{[\s\S]*?uiExecute\('command', 'payroll\.lifecycle\.transition', \[pid, targetStatus\]\)/.test(pwsSrc), 'bulk runner invokes one seam transition per eligible PayrollPlan (via the UI-to-Transport seam)');
check(/partitionPayrollSelection\(/.test(pwsSrc), 'bulk runner preserves the existing eligible/ineligible partition (partitionPayrollSelection)');
check(!/BulkAggregate|bulkCommand|payroll\.lifecycle\.bulk/.test(srcJs), 'no second bulk aggregate/command introduced');
// Existing aggregates remain operational and untouched by PR-5J.
check(/const ContractDateAggregate = Object\.freeze\(/.test(ctAggSrc) && /const EmployeeLifecycleAggregate = Object\.freeze\(/.test(lifeAggSrc), 'existing Contract + Employee aggregates remain operational');

// PR-5K "The Ledger" — second Contract aggregate boundary (ContractStatusAggregate).
console.log('== CONTRACT STATUS AGGREGATE (PR-5K — business authority) ==');
const csAggPath = path.join(root,'js','domain','contract-status-aggregate.js');
check(fs.existsSync(csAggPath), 'aggregate module present: js/domain/contract-status-aggregate.js');
check(jsFiles.indexOf('domain/contract-status-aggregate.js') !== -1, 'module-order.js includes domain/contract-status-aggregate.js');
check(indexHtml.includes('<script src="js/domain/contract-status-aggregate.js"></script>'), 'index.html includes domain/contract-status-aggregate.js');
// Load order: after helpers, before the facade.
check(jsFiles.indexOf('domain/aggregate-helpers.js') < jsFiles.indexOf('domain/contract-status-aggregate.js') &&
      jsFiles.indexOf('domain/contract-status-aggregate.js') < jsFiles.indexOf('domain/domain-layer.js'), 'contract status aggregate loads after helpers and before domain-layer.js');
const csAggSrc = read(csAggPath);
check(/const ContractStatusAggregate = Object\.freeze\(/.test(csAggSrc), 'ContractStatusAggregate is a frozen object');
check(/transition:\s*function/.test(csAggSrc), 'contract status aggregate exposes transition()');
// Command registration: boundary + lifecycle transition/transition contract + handler + aggregate id.
check(/'contract\.status\.transition':\s*Object\.freeze\(\{[^}]*boundary:\s*'ContractStatusAggregate'/.test(cmdSrc), 'contract.status.transition declares boundary ContractStatusAggregate');
check(/'contract\.status\.transition':\s*Object\.freeze\(\{[^}]*boundaryMethod:\s*'transition'/.test(cmdSrc) && /'contract\.status\.transition':\s*Object\.freeze\(\{[^}]*boundaryPayload:\s*'transition'/.test(cmdSrc), 'contract.status.transition declares boundaryMethod/boundaryPayload = transition');
check(/'contract\.status\.transition':\s*Object\.freeze\(\{[^}]*handler:\s*'transitionContractStatus'/.test(cmdSrc), 'contract.status.transition registered to handler transitionContractStatus');
check(/'contract\.status\.transition':\s*Object\.freeze\(\{[^}]*aggregate:\s*'Contract'/.test(cmdSrc), 'contract.status.transition declares aggregate Contract');
check(dist.includes("uiExecute('command', 'contract.status.transition'"), 'contract status command call present in dist (via the seam)');
// Domain routing (domain-layer.js) is UNCHANGED by PR-5K (reuses the transition/transition contract).
check(!/contract\.status|ContractStatus/.test(facSrc), 'domain-layer.js is not modified for the contract status command');
// The transition graph is derived from runtime behavior — exactly the discovered edges, no more.
check(/'Draft':\s*\['Active',\s*'Cancelled'\]/.test(csAggSrc) && /'Active':\s*\['Cancelled'\]/.test(csAggSrc) &&
      /'Renewed':\s*\[\]/.test(csAggSrc) && /'Cancelled':\s*\[\]/.test(csAggSrc), 'contract status transition map is exactly the derived graph (Renewed/Cancelled terminal)');
// Uses the existing stored statuses; never treats derived display states as stored.
check(/CONTRACT_STORED_STATUSES/.test(csAggSrc), 'contract status aggregate validates against CONTRACT_STORED_STATUSES (single source)');
// Scope the following to the transition-map literal only (the header comment and the
// STATES fallback legitimately name derived states / list Renewed).
const csMapLit = (csAggSrc.match(/CONTRACT_STATUS_TRANSITIONS = Object\.freeze\(\{[\s\S]*?\}\)/)||[''])[0];
check(csMapLit !== '' && !/Expiring Soon|Expired/.test(csMapLit), 'transition map never treats derived display states (Expiring Soon/Expired) as stored statuses');
// Renewed is never a generic transition target: it appears in the map only as a key.
check(!/'Renewed'/.test(csMapLit.replace(/'Renewed':/,'')), 'Renewed is never a transition target (produced only by the renewal workflow)');
// Aggregate PURITY — no side effects (comments stripped).
const csAggCode = csAggSrc.replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,'');
[['State mutation', /State\s*[.[]/],
 ['persistContracts', /persistContracts\s*\(/],
 ['persist', /\bpersist(HR|Contracts)?\s*\(/],
 ['Contract mutation', /\bc\.\w+\s*=[^=]/],
 ['history append', /\.history\b|history\s*=|\.push\(/],
 ['updatedAt mutation', /updatedAt/],
 ['UI render', /\brender\s*\(/],
 ['toast/alert', /\btoast\s*\(|showWarning\s*\(|showSuccess\s*\(|\balert\s*\(|confirm\s*\(/],
 ['localStorage', /localStorage/],
 ['audit logging', /logActivity\s*\(/]
].forEach(([label,re])=>check(!re.test(csAggCode), 'contract status aggregate never performs '+label));
check(/contractById\(/.test(csAggSrc), 'aggregate reads existence read-only (contractById)');
// Returns a sanitized transition on success and typed failures otherwise.
check(/return \{ ok: true, transition:/.test(csAggSrc), 'contract status aggregate returns only a sanitized transition on success');
['ContractNotFound','InvalidContractStatusState','IllegalContractStatusTransition'].forEach((err)=>
  check(csAggSrc.includes("error: '"+err+"'"), 'contract status aggregate returns typed business failure: '+err));
// Handler owns mutation/updatedAt/history/persistence/rollback (implementation authority).
const tcStart = ctSrc.indexOf('async function transitionContractStatus(');
check(tcStart !== -1, 'transitionContractStatus handler present');
const tcRest = tcStart!==-1 ? ctSrc.slice(tcStart+1) : '';
const tcNext = tcRest.search(/\n(async function|function) /);
const tcBody = tcNext>=0 ? tcRest.slice(0, tcNext) : tcRest;
// Status changes ONLY c.status (+ updatedAt/history); dates/salary/renewal/links are forbidden.
['startDate','durationMonths','monthlySalary','renewedToId','renewedFromId','employeeId','contractNumber','notes','endDate'].forEach((f)=>
  check(!tcBody.includes(f), 'contract status handler does not touch forbidden field: '+f));
// PR-10B — the contract-status handler's persistence now goes through the Repository (comment-stripped).
const tcCode = stripComments(tcBody);
check((tcCode.match(/ContractRepository\.save\(\)/g)||[]).length === 1, 'handler persists exactly once (via ContractRepository.save())');
check(!/persistContracts\(/.test(tcCode), 'contract-status handler no longer calls persistContracts() directly (routed through the Repository)');
check(!/persistEmployees\(|persistHR\(|persist\(\)/.test(tcBody), 'handler uses only the Contract persistence path');
check(/c\.status = to/.test(tcBody), 'handler performs the status mutation (only Contract.status)');
check(/c\.updatedAt = new Date/.test(tcBody), 'handler updates updatedAt');
check((tcBody.match(/\.push\(/g)||[]).length === 1, 'handler appends exactly one Contract history entry on success');
check(/c\.status = prevStatus/.test(tcBody) && /c\.history\.pop\(\)/.test(tcBody) && /c\.updatedAt = prevUpdatedAt/.test(tcBody), 'handler performs full rollback on persist failure (status + history + updatedAt)');
check(/error:'PersistFailed'/.test(tcBody), 'handler returns PersistFailed on persistence failure');
check(/error:'IllegalContractStatusTransition'/.test(tcBody), 'handler performs defense-in-depth transition validation');
check(!/logActivity\(/.test(tcBody), 'handler adds no audit call (former setContractStatus wrote none — behavior preserved)');
check(/event:to\.toLowerCase\(\)/.test(tcBody) && /Status set to \$\{to\}/.test(tcBody), 'handler preserves the existing Contract history convention');
check(/success:\s*true/.test(tcBody) && /success:\s*false/.test(tcBody), 'handler returns a typed success/failure outcome');
// The former procedural mutator is gone — no second status-transition authority remains.
check(!/function setContractStatus\(/.test(ctSrc), 'setContractStatus removed (single status-transition authority via the Domain command)');
check(!/setContractStatus\(/.test(srcJs), 'no caller of setContractStatus remains anywhere');
// Single-record UI: routes through the one Domain-command seam (requestContractStatusTransition).
check(/async function requestContractStatusTransition\(/.test(ctSrc) && /uiExecute\('command', 'contract\.status\.transition', \[id, targetStatus\]\)/.test(ctSrc), 'requestContractStatusTransition routes status transitions through the UI-to-Transport seam');
check(/'ct-activate'\) requestContractStatusTransition\(id, 'Active'\)/.test(empSrc) && /'ct-cancel'\) requestContractStatusTransition\(id, 'Cancelled'\)/.test(empSrc), 'employee row menu (ct-activate/ct-cancel) routes through requestContractStatusTransition');
check(!/transitionContractStatus\(/.test(empSrc), 'no UI file calls the handler transitionContractStatus() directly (employees.js)');
check((ctSrc.match(/transitionContractStatus\(/g)||[]).length === 1, 'transitionContractStatus appears only as its definition (never invoked outside the Domain command)');
// The committed-payroll cancellation confirmation is preserved (moved into the UI seam, quirk unchanged).
check(/payrollPlansForContract\(id\)\.some\(isPayrollCommitted\)/.test(ctSrc), 'committed-payroll cancellation confirmation uses the shared canonical predicate (SPR-078 — the lowercase-only quirk is gone)');
// Transitions-only scope: creation (full editor) status writes intentionally remain (documented residual authority).
check(/rec\.status = fd\.get\('status'\)/.test(ctSrc), 'full-editor status assignment remains (creation — out of scope, documented residual authority)');
// SPR-077 supersedes the former PR-5K residual: the renewal status write is no longer
// an inline UI mutation — it is authored by ContractRenewalAggregate and applied by the
// renewContract handler. The old inline `c.status='Renewed'` MUST be gone.
check(!/c\.status='Renewed'/.test(ctSrc), 'inline renewal status assignment removed (SPR-077 — renewal is now aggregate-owned)');
// Existing aggregates remain operational and untouched by PR-5K.
check(/const ContractDateAggregate = Object\.freeze\(/.test(ctAggSrc) && /const PayrollLifecycleAggregate = Object\.freeze\(/.test(payAggSrc), 'existing Contract date + Payroll lifecycle aggregates remain operational');

// SPR-077 "The Successor" — third Contract aggregate boundary (ContractRenewalAggregate).
console.log('== CONTRACT RENEWAL AGGREGATE (SPR-077 — business authority) ==');
const crAggPath = path.join(root,'js','domain','contract-renewal-aggregate.js');
check(fs.existsSync(crAggPath), 'aggregate module present: js/domain/contract-renewal-aggregate.js');
check(jsFiles.indexOf('domain/contract-renewal-aggregate.js') !== -1, 'module-order.js includes domain/contract-renewal-aggregate.js');
check(indexHtml.includes('<script src="js/domain/contract-renewal-aggregate.js"></script>'), 'index.html includes domain/contract-renewal-aggregate.js');
// Load order: after helpers and after the date aggregate it reuses, before the facade.
check(jsFiles.indexOf('domain/aggregate-helpers.js') < jsFiles.indexOf('domain/contract-renewal-aggregate.js') &&
      jsFiles.indexOf('domain/contract-date-aggregate.js') < jsFiles.indexOf('domain/contract-renewal-aggregate.js') &&
      jsFiles.indexOf('domain/contract-renewal-aggregate.js') < jsFiles.indexOf('domain/domain-layer.js'), 'contract renewal aggregate loads after helpers + date aggregate and before domain-layer.js');
const crAggSrc = read(crAggPath);
check(/const ContractRenewalAggregate = Object\.freeze\(/.test(crAggSrc), 'ContractRenewalAggregate is a frozen object');
check(/prepare:\s*function/.test(crAggSrc), 'contract renewal aggregate exposes prepare()');
// EXACTLY ONE renewal aggregate and ONE renewal command — no second authority.
check((srcJs.match(/const \w*RenewalAggregate = Object\.freeze\(/g)||[]).length === 1, 'exactly one Contract renewal aggregate is defined');
check((cmdSrc.match(/'contract\.renewal\.[\w.]+':/g)||[]).length === 1, 'exactly one operational Contract renewal command is registered');
// Command registration: boundary + dedicated payload key + handler + aggregate id.
check(/'contract\.renewal\.execute':\s*Object\.freeze\(\{[^}]*boundary:\s*'ContractRenewalAggregate'/.test(cmdSrc), 'contract.renewal.execute declares boundary ContractRenewalAggregate');
check(/'contract\.renewal\.execute':\s*Object\.freeze\(\{[^}]*boundaryPayload:\s*'renewal'/.test(cmdSrc), 'contract.renewal.execute declares boundaryPayload = renewal');
check(/'contract\.renewal\.execute':\s*Object\.freeze\(\{[^}]*handler:\s*'renewContract'/.test(cmdSrc), 'contract.renewal.execute registered to handler renewContract');
check(/'contract\.renewal\.execute':\s*Object\.freeze\(\{[^}]*aggregate:\s*'Contract'/.test(cmdSrc), 'contract.renewal.execute declares aggregate Contract');
check(dist.includes("uiExecute('command', 'contract.renewal.execute'"), 'contract renewal command call present in dist (via the seam)');
// Domain routing is UNCHANGED by SPR-077 (reuses the default prepare entry contract).
check(!/contract\.renewal|ContractRenewal/.test(facSrc), 'domain-layer.js is not modified for the contract renewal command');
// Eligibility is derived from the EXISTING stored-status model: exactly the
// non-terminal statuses. Renewed/Cancelled are terminal and must never be renewable.
check(/CONTRACT_RENEWABLE_STATUSES = Object\.freeze\(\['Draft',\s*'Active'\]\)/.test(crAggSrc), 'renewable statuses are exactly the non-terminal stored statuses (Draft, Active)');
const crRenewableLit = (crAggSrc.match(/CONTRACT_RENEWABLE_STATUSES = Object\.freeze\(\[[\s\S]*?\]\)/)||[''])[0];
check(crRenewableLit !== '' && !/'Renewed'|'Cancelled'/.test(crRenewableLit), 'terminal statuses (Renewed/Cancelled) are never renewable');
check(/CONTRACT_RENEWAL_TARGET_STATUSES = Object\.freeze\(\['Active',\s*'Draft'\]\)/.test(crAggSrc), 'successor initial statuses match the existing form choices exactly (Active, Draft)');
// Aggregate PURITY — no side effects, no mutation, no id/timestamp generation
// (comments stripped). It reads existence via contractById only.
const crAggCode = crAggSrc.replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,'');
[['State mutation', /State\s*[.[]/],
 ['persistContracts', /persistContracts\s*\(/],
 ['persist', /\bpersist(HR|Contracts)?\s*\(/],
 ['Repository access', /\w*Repository\s*[.[]/],
 ['StorageAdapter access', /StorageAdapter/],
 ['Contract mutation', /\bc\.\w+\s*=[^=]/],
 ['history append', /\.history\b|history\s*=|\.push\(/],
 ['updatedAt mutation', /updatedAt/],
 ['id generation', /\buid\s*\(/],
 ['timestamp generation', /new Date\s*\(|Date\.now\s*\(/],
 ['DOM access', /document\s*[.[]|FormData/],
 ['UI render', /\brender\s*\(/],
 ['modal control', /openModalHTML\s*\(|closeModal\s*\(/],
 ['navigation', /hrNavTo\s*\(|detailContractId/],
 ['toast/alert', /\btoast\s*\(|showWarning\s*\(|showSuccess\s*\(|\balert\s*\(|confirm\s*\(/],
 ['localStorage', /localStorage/],
 ['audit logging', /logActivity\s*\(/]
].forEach(([label,re])=>check(!re.test(crAggCode), 'contract renewal aggregate never performs '+label));
check(/contractById\(/.test(crAggSrc), 'renewal aggregate reads existence read-only (contractById)');
// It REUSES the PR-5I date rules rather than restating them (one source of truth).
check(/isCanonicalContractDate\(/.test(crAggSrc) && /contractExtentIsValid\(/.test(crAggSrc), 'renewal aggregate reuses the canonical Contract date validators (PR-5I)');
// Returns an authored renewal on success and typed business failures otherwise.
check(/return \{\s*ok: true,\s*renewal:/.test(crAggSrc), 'renewal aggregate returns only an authored renewal decision on success');
["ContractNotFound","RenewalNotAllowed","ContractAlreadyRenewed","InvalidContractNumber","InvalidStartDate","InvalidDurationMonths","InvalidContractDateRange","InvalidMonthlySalary","InvalidContractStatusState"].forEach((e)=>
  check(new RegExp("error: '"+e+"'").test(crAggSrc), 'renewal aggregate returns typed business failure: '+e));
check(!/throw /.test(crAggCode), 'renewal aggregate never throws for an expected business outcome');
// The aggregate AUTHORS the successor shape and both history note texts as DATA.
check(/predecessorStatus: 'Renewed'/.test(crAggSrc), 'aggregate authors the predecessor canonical renewed status');
check(/predecessorNote:/.test(crAggSrc) && /successorNote:/.test(crAggSrc), 'aggregate authors both Contract history note texts');
check(/successor: \{/.test(crAggSrc), 'aggregate authors the successor Contract business shape');
// ADR-012 remains Proposed — renewal must NOT enforce overlap.
check(!/overlappingActiveContracts/.test(crAggCode), 'renewal aggregate enforces no contract overlap (ADR-012 remains Proposed)');

// SPR-077 — Contract renewal HANDLER (implementation authority) + UI seam.
console.log('== CONTRACT RENEWAL HANDLER (SPR-077 — implementation authority) ==');
const rcBody = stripComments((ctSrc.match(/async function renewContract\(id, renewal\)\{[\s\S]*?\n\}/)||[''])[0]);
check(rcBody !== '', 'renewContract handler is defined in js/people/contracts.js');
// The handler owns identity, timestamps, the history append, and the mutation.
check(/uid\('ct'\)/.test(rcBody), 'handler owns successor id generation (uid)');
check(/new Date\(\)\.toISOString\(\)/.test(rcBody), 'handler owns the business timestamp');
check(/c\.history=c\.history\|\|\[\]\)\.push\(/.test(rcBody), 'handler owns the predecessor history append');
check(/renewal\.predecessorNote/.test(rcBody) && /renewal\.successorNote/.test(rcBody), 'handler applies the aggregate-authored history notes');
check(/c\.status = renewal\.predecessorStatus/.test(rcBody), 'handler applies the aggregate-authored predecessor status');
check(/State\.contracts\.push\(nc\)/.test(rcBody), 'handler appends the successor to the ONE contracts collection');
// Persistence: exactly one Repository save, result strictly inspected, no direct persist.
check(/ContractRepository\.save\(\)/.test(rcBody), 'handler persists through ContractRepository.save()');
check((rcBody.match(/ContractRepository\.save\(/g)||[]).length === 1, 'handler invokes ContractRepository.save() exactly once');
check(!/persistContracts\s*\(/.test(rcBody), 'handler never calls persistContracts() directly');
check(/persisted\.ok !== true/.test(rcBody), 'handler strictly inspects the Repository result (no truthy/falsy ambiguity)');
// In-memory rollback on persistence failure: successor removed, predecessor restored.
check(/State\.contracts = State\.contracts\.filter\(x=>x\.id!==nc\.id\)/.test(rcBody), 'failed persist removes the successor from memory');
check(/c\.status = prevStatus/.test(rcBody) && /c\.history\.pop\(\)/.test(rcBody) && /c\.updatedAt = prevUpdatedAt/.test(rcBody), 'failed persist restores predecessor status, history, and updatedAt');
check(/prevRenewedToId/.test(rcBody), 'failed persist restores the predecessor renewedToId linkage');
check(/return \{ success:false, error:'PersistFailed' \}/.test(rcBody), 'handler returns the typed PersistFailed outcome');
check(/return \{ success:true, data:\{ predecessor:c, successor:nc \} \}/.test(rcBody), 'handler returns predecessor + successor on success');
// Defense-in-depth: the handler re-checks eligibility (the aggregate decided first).
check(/CONTRACT_RENEWABLE_STATUSES/.test(rcBody) && /c\.renewedToId/.test(rcBody), 'handler keeps its own defense-in-depth eligibility check');
// NO false success: every success action lives in the seam behind outcome.success.
const rcSeam = (ctSrc.match(/async function requestContractRenewal\(id, patch\)\{[\s\S]*?\n\}/)||[''])[0];
check(rcSeam !== '', 'requestContractRenewal UI seam is defined');
check(/uiExecute\('command', 'contract\.renewal\.execute'/.test(rcSeam), 'the seam routes through the Platform boundary (uiExecute)');
const rcSuccessBlock = (rcSeam.match(/if\(outcome && outcome\.success\)\{[\s\S]*?\n  \}/)||[''])[0];
check(rcSuccessBlock !== '', 'the seam gates its success actions on outcome.success');
['closeModal(','toast(','render()','detailContractId'].forEach((act)=>
  check(rcSuccessBlock.includes(act), 'success action runs ONLY after a confirmed persist: '+act));
// The renewal modal no longer authors business behavior.
const renewModalBody = stripComments((ctSrc.match(/function openRenewModal\(id\)\{[\s\S]*?\n\}/)||[''])[0]);
check(renewModalBody !== '', 'openRenewModal is defined');
check(/requestContractRenewal\(id,/.test(renewModalBody), 'the renewal modal delegates to the UI seam');
[['successor construction', /uid\('ct'\)/],
 ['predecessor mutation', /\bc\.\w+\s*=[^=]/],
 ['history append', /\.push\(\{event:/],
 ['direct persistence', /persistContracts\s*\(|ContractRepository\.save\(/]
].forEach(([label,re])=>check(!re.test(renewModalBody), 'renewal modal no longer performs '+label));
// UI eligibility mirrors the aggregate rule (single source of truth, no drift).
check(/function contractIsRenewable\(c\)\{/.test(ctSrc), 'contractIsRenewable UI eligibility mirror is defined');
check(/contractIsRenewable\(c\)\?\['ct-renew','Renew'\]:null/.test(ctSrc), 'the row menu offers Renew only for renewable contracts');
check(/contractIsRenewable\(c\)\?'<button class="btn btn-accent" id="renewCtD">/.test(ctSrc), 'contract detail offers Renew only for renewable contracts');
// NO compound-persistence abstraction is introduced anywhere by this slice.
[['transaction abstraction', /beginTransaction|commitTransaction|TransactionCoordinator/],
 ['unit of work', /unitOfWork|UnitOfWork/],
 ['coordinator', /PersistenceCoordinator|PostingCoordinator/],
 ['storage batch', /StorageAdapter\.(setMany|batch|transaction)/],
 ['write-ahead journal', /writeAhead|journalWrite/]
].forEach(([label,re])=>check(!re.test(crAggSrc) && !re.test(ctSrc), 'SPR-077 introduces no '+label));
// ADR-013 remains valid: the Repository contract is untouched and single-collection.
check(/async save\(\)\{[\s\S]*?await persistContracts\(\);[\s\S]*?\}/.test(read(path.join(root,'js','repository','contract-repository.js'))), 'ContractRepository.save() remains a single-collection delegate (ADR-013 unchanged)');

// SPR-077 — the behavioral counterpart to the structural checks above. This file
// proves SHAPE; tools/verify-renewal-runtime.js proves BEHAVIOR by executing the
// command through the Platform path against a failable in-memory storage shim.
check(fs.existsSync(path.join(root,'tools','verify-renewal-runtime.js')), 'SPR-077 runtime verification harness present: tools/verify-renewal-runtime.js');

// SPR-078 — LEGACY PAYROLL PLANNING RETIRED + CANONICAL COMMITTED-STATE PREDICATE.
console.log('== SPR-078 PAYROLL POSTING AUTHORITY (single path + one committed predicate) ==');
const planSrc078 = read(path.join(root,'js','people','payroll-planning.js'));
const planCode078 = stripComments(planSrc078);
const coreSrc078 = read(path.join(root,'js','people','people-core.js'));
const shellSrc078 = read(path.join(root,'js','ui','shell-render.js'));

// (a) THE DEAD SURFACE IS GONE. None of these had an external consumer.
['commitPayroll','renderPayrollPlanning','renderPayrollDraft','payrollRowHTML','generatePayrollRows','buildPayrollTxn','payrollAmount','samePayrollComponents'].forEach((fname)=>
  check(!new RegExp('function\\s+'+fname+'\\s*\\(').test(planCode078), 'retired dead payroll-planning surface: '+fname+'() is removed'));
check(!/commitPayroll\s*\(/.test(stripComments(srcJs)), 'no caller of the retired commitPayroll() remains anywhere');
check(!/renderPayrollPlanning\s*\(/.test(stripComments(srcJs)), 'no caller of the retired renderPayrollPlanning() remains anywhere');
// The retired screen must NOT be re-routed (Atlas: the missing route is not a bug).
check(!/State\.view===['"]payrollPlanning['"]/.test(srcJs), 'the retired planning screen is not re-routed');
// (b) THE SHARED UTILITIES SURVIVE — they are defined nowhere else and have real consumers.
check(/function num\(x\)/.test(planSrc078), 'shared utility num() is preserved in payroll-planning.js');
check(/function ensureMonthlyPlan\(monthKey\)/.test(planSrc078), 'shared utility ensureMonthlyPlan() is preserved in payroll-planning.js');
check((srcJs.match(/^function num\(/gm)||[]).length === 1, 'num() has exactly one definition repository-wide');
check((srcJs.match(/^function ensureMonthlyPlan\(/gm)||[]).length === 1, 'ensureMonthlyPlan() has exactly one definition repository-wide');
check(jsFiles.indexOf('people/payroll-planning.js') !== -1 && indexHtml.includes('<script src="js/people/payroll-planning.js"></script>'), 'payroll-planning.js remains loaded (retained for its shared utilities)');
// (c) ONE LIVE POSTING PATH.
check(/async function commitReadyPayroll\(monthKey, ids\)\{/.test(poeSrc), 'commitReadyPayroll is defined');
check((stripComments(srcJs).match(/steps\.push\(\['payrollPlans',\s+await persistPayrollPlans\(\)\]\);/g)||[]).length === 1,
  'exactly ONE four-store payroll posting sequence exists repository-wide (single posting authority)');
check(/isPayrollLocked\(monthKey\)/.test(poeSrc) && /payrollCommitBlockers\(pp\)/.test(poeSrc) && /pp\.status!=='Ready'/.test(poeSrc),
  'the sole posting path enforces period lock + commit blockers + the Ready gate');
check((stripComments(srcJs).match(/logActivity\(\{type:'payroll\.post'/g)||[]).length === 1, 'exactly one successful-posting audit entry exists (not duplicated by any wrapper)');
// (d) NO LIVE LOWERCASE WRITER. The v2.5.0 migration is the ONLY permitted mention.
const lowerWriters = [];
jsFiles.forEach((f)=>{
  if(f === 'core/hr-persistence-portability.js') return;          // the one-time v2.5.0 migration — untouched by SPR-078
  const code = stripComments(read(path.join(root,'js',f)));
  if(/status\s*[:=]\s*'committed'/.test(code)) lowerWriters.push(f);
});
check(lowerWriters.length === 0, 'no live writer writes the lowercase legacy payroll status (found: '+(lowerWriters.join(', ')||'none')+')');
check(/p\.status==='committed'\?'Committed':'Draft'/.test(read(path.join(root,'js','core','hr-persistence-portability.js'))), 'the one-time v2.5.0 migration is unchanged (no migration added or re-run)');
// (e) THE CANONICAL PREDICATE — one definition, in the shared people-domain boundary.
check(/const PAYROLL_COMMITTED_STATUS = 'Committed';/.test(coreSrc078), 'canonical committed status constant is defined (Committed)');
check(/const PAYROLL_COMMITTED_STATUS_LEGACY = 'committed';/.test(coreSrc078), 'legacy read-compatibility constant is defined (committed)');
check(/function isPayrollCommitted\(planOrStatus\)\{/.test(coreSrc078), 'the shared predicate isPayrollCommitted() is defined');
check((srcJs.match(/^function isPayrollCommitted\(/gm)||[]).length === 1, 'isPayrollCommitted() has exactly one definition repository-wide');
// It must load BEFORE every consumer, so no consumer relies on cross-file hoisting.
['people/contracts.js','people/hr-dashboard-reports.js','people/monthly-plan.js','people/payroll-ops-engine.js'].forEach((f)=>
  check(jsFiles.indexOf('people/people-core.js') < jsFiles.indexOf(f), 'the predicate module loads before its consumer: '+f));
// The predicate is a pure READ helper — it never writes a status.
const predBody = (coreSrc078.match(/function isPayrollCommitted\(planOrStatus\)\{[\s\S]*?\n\}/)||[''])[0];
check(predBody !== '', 'the predicate body is resolvable');
[['State access', /State\s*[.[]/], ['persistence', /persist/], ['record mutation', /\.\w+\s*=[^=]/],
 ['UI/DOM access', /document|render\s*\(|toast\s*\(/], ['id/timestamp generation', /\buid\s*\(|new Date\s*\(/]
].forEach(([label,re])=> check(!re.test(predBody), 'the predicate performs no '+label));
// (f) EVERY LIVE PayrollPlan COMMITTED READER USES THE PREDICATE.
const READER_FILES = ['people/contracts.js','people/hr-dashboard-reports.js','people/monthly-plan.js','people/payroll-ops-engine.js','core/stabilization.js','core/onboarding-reset.js'];
const strayReaders = [];
READER_FILES.forEach((f)=>{
  const code = stripComments(read(path.join(root,'js',f)));
  // A PayrollPlan status comparison is one made against a payroll record (p/pp/existing),
  // never against a MonthlyPlan or an Overtime record. MonthlyPlan reads are excluded by
  // their collection (State.monthlyPlans) or their variable name (plan/mplan).
  const m = (code.split('\n')
    .filter(line => !/monthlyPlans|\b(plan|mplan)\.status/.test(line))
    .join('\n')
    .match(/\b(p|pp|existing)\.status\s*===?\s*'(C|c)ommitted'/g)) || [];
  if(m.length) strayReaders.push(f+': '+m.join(' | '));
});
check(strayReaders.length === 0, 'every live PayrollPlan committed-state read goes through isPayrollCommitted() (stray: '+(strayReaders.join(' ;; ')||'none')+')');
check(/payrollPlansForContract\(id\)\.some\(isPayrollCommitted\)/.test(ctSrc), 'the contract-cancellation safety guard uses the shared predicate');
check(/isPayrollCommitted\(pp\)\{?[\s\S]{0,80}payrollTxnOf/.test(poeSrc) || /if\(isPayrollCommitted\(pp\)\)\{/.test(poeSrc), 'payrollStage() resolves committed state through the shared predicate');
check(/filter\(p=>p\.monthKey===monthKey && isPayrollCommitted\(p\)\)/.test(read(path.join(root,'js','people','hr-dashboard-reports.js'))), 'the HR dashboard payroll rollup uses the shared predicate');
check(/isPayrollCommitted\(p\) && Array\.isArray\(p\.overtimeIds\)/.test(read(path.join(root,'js','core','stabilization.js'))), 'the integrity checker uses the shared predicate');
// (g) SPR-078 INTRODUCES NO NEW ARCHITECTURE.
check(!/PayrollPostingAggregate/.test(srcJs), 'SPR-078 introduces no PayrollPostingAggregate');
check(aggregateDefs === 8, 'aggregate count is unchanged by SPR-078 (still eight)');
[['coordinator', /PostingCoordinator|PersistenceCoordinator/], ['unit of work', /unitOfWork|UnitOfWork/],
 ['transaction abstraction', /beginTransaction|TransactionCoordinator/], ['batch persistence', /saveMany|StorageAdapter\.(setMany|batch)/],
 ['journal/recovery record', /writeAhead|journalWrite|recoveryRecord/]
].forEach(([label,re])=> check(!re.test(srcJs), 'SPR-078 introduces no '+label));
check(/const SCHEMA_VERSION = 6;/.test(read(path.join(root,'js','core','constants.js'))), 'SCHEMA_VERSION remains 6');
check(fs.existsSync(path.join(root,'tools','verify-payroll-committed-runtime.js')), 'SPR-078 runtime harness present: tools/verify-payroll-committed-runtime.js');

// SPR-079 — UNIFIED PERSISTENCE RESULT INTEGRITY (saveAllData honesty).
console.log('== SPR-079 saveAllData RESULT INTEGRITY (no false success) ==');
const stabSrc079 = read(path.join(root,'js','core','stabilization.js'));
const sadBody = stripComments((stabSrc079.match(/async function saveAllData\(\)\{[\s\S]*?\n\}/)||[''])[0]);
check(sadBody !== '', 'saveAllData() is defined in js/core/stabilization.js');
// (a) NO UNCONDITIONAL SUCCESS.
check(!/\}\s*$/.test('') && !/await Promise\.all\(\[[\s\S]*?\]\);\s*return true;/.test(sadBody), 'saveAllData() no longer returns unconditional true after the fan-out');
check((sadBody.match(/return true;/g)||[]).length === 1 && /return false;/.test(sadBody), 'saveAllData() has exactly one success return and at least one failure return');
// (b) EVERY REQUIRED RESULT IS AWAITED AND INSPECTED.
check(/const results = await Promise\.all\(\[/.test(sadBody), 'saveAllData() awaits every write and captures the results');
check(/results\[i\] !== true/.test(sadBody), 'saveAllData() inspects every result strictly (!== true, no truthy ambiguity)');
check(/if\(failed\.length\)\{[\s\S]*?return false;/.test(sadBody), 'saveAllData() returns false when any required write fails');
// (c) THE FAN-OUT STILL COVERS THE SAME DATASETS, IN A DETERMINISTIC ORDER.
check(/persist\(\), saveSettings\(\), saveBackups\(\)/.test(sadBody) && /Object\.keys\(HR_KEYS\)\.map\(k=>persistHR\(k\)\)/.test(sadBody), 'saveAllData() invokes the same authorized persistence operations');
check(/const labels = \['transactions', 'settings', 'backups', \.\.\.Object\.keys\(HR_KEYS\)\]/.test(sadBody), 'saveAllData() labels are positionally aligned with the promise list (deterministic ordering)');
// (d) NO ATOMICITY / ROLLBACK CLAIM, AND NO NEW MACHINERY.
// NOTE: the fan-out legitimately labels one dataset 'transactions', so the
// transaction-abstraction probe targets identifiers, never that data label.
[['retry', /\bretry\b|setTimeout|attempt\s*\+\+/i], ['compensation/rollback', /rollback|compensat/i],
 ['journal', /journal|writeAhead/i], ['recovery marker', /recoveryMarker|operationId/i],
 ['transaction abstraction', /unitOfWork|UnitOfWork|beginTransaction|commitTransaction|TransactionCoordinator/],
 ['StorageAdapter access', /StorageAdapter/]
].forEach(([label,re])=> check(!re.test(sadBody), 'saveAllData() introduces no '+label));
// It must not duplicate the user-facing failure notification StorageAdapter already emits.
check(!/toast\(|showError\(|showWarning\(/.test(sadBody), 'saveAllData() emits no duplicate user-facing notification (console only)');
check(/console\.error\(/.test(sadBody), 'saveAllData() reports which datasets failed to the console');

// (e) EVERY LIVE CALLER AWAITS AND CHECKS THE RESULT.
const CALLER_FILES_079 = ['people/employee-dedup.js','import/smart-import-commit.js'];
const uncheckedCallers = [];
CALLER_FILES_079.forEach((f)=>{
  const code = stripComments(read(path.join(root,'js',f)));
  // Every saveAllData() call must be awaited INTO a variable that is then tested.
  (code.match(/^.*saveAllData\(\).*$/gm)||[]).forEach((line)=>{
    if(!/=\s*await saveAllData\(\)/.test(line)) uncheckedCallers.push(f+': '+line.trim());
  });
});
check(uncheckedCallers.length === 0, 'every live caller awaits saveAllData() into a checked variable (unchecked: '+(uncheckedCallers.join(' ;; ')||'none')+')');
check((stripComments(srcJs).match(/await saveAllData\(\)/g)||[]).length === 3, 'exactly three live saveAllData() call sites exist (merge, import commit, import undo)');
check((stripComments(srcJs).match(/=\s*await saveAllData\(\)/g)||[]).length === 3, 'all three call sites capture the result');

// (f) NO SUCCESS UI / AUDIT / COMPLETION AFTER FAILURE.
const dedupSrc079 = read(path.join(root,'js','people','employee-dedup.js'));
const siCommitSrc079 = read(path.join(root,'js','import','smart-import-commit.js'));
const siUiSrc079 = read(path.join(root,'js','import','smart-import-ui.js'));
// Employee merge: typed result; UI shows success only on ok===true.
check(/return \{ ok: saved === true, audit: auditRec \};/.test(dedupSrc079), 'mergeEmployeeGroup returns a typed result carrying the persistence outcome');
check(/if\(res\.ok !== true\)\{[\s\S]{0,600}showError\(/.test(dedupSrc079), 'employee merge reports failure with showError before any success path');
const dedupFailBlock = (stripComments(dedupSrc079).match(/if\(res\.ok !== true\)\{[\s\S]*?\n    \}/)||[''])[0];
check(dedupFailBlock !== '' && !/showSuccess\(/.test(dedupFailBlock), 'employee merge shows no success message on failure');
check(dedupFailBlock !== '' && !/delete State\.dedupCanon/.test(dedupFailBlock), 'employee merge clears no completion state on failure');
// Smart Import commit: the success audit entry is written only after success.
check(/if\(saved !== true\) return \{ ok:false, audit \};/.test(siCommitSrc079), 'commitSmartImport returns failure before writing the success audit entry');
const siCommitBody079 = stripComments((siCommitSrc079.match(/async function commitSmartImport\(model\)\{[\s\S]*?\n\}/)||[''])[0]);
check(/if\(saved !== true\) return[\s\S]*?logActivity\(\{type:'import\.commit'/.test(siCommitBody079), 'the import.commit audit entry is unreachable on a failed persist');
// Smart Import UI: no success, no navigation, model retained for retry.
// Extract the failure branch from its opening brace to its `return;`, independent
// of indentation depth.
const siUiFail079 = (stripComments(siUiSrc079).match(/if\(res\.ok !== true\)\{[\s\S]*?return;/)||[''])[0];
check(siUiFail079 !== '', 'the Smart Import UI has an explicit failure branch');
[['success message', /showSuccess\(/], ['results navigation', /State\.view='importResults'/],
 ['model discard (retry blocked)', /State\.smartImport=null/], ['completion step', /State\.smartStep=9/]
].forEach(([label,re])=> check(!re.test(siUiFail079), 'Smart Import failure branch performs no '+label));
check(/showError\(/.test(siUiFail079), 'the Smart Import failure branch reports the failure to the user');
// Smart Import undo: failure branch, no success toast.
const siUndo079 = stripComments((siCommitSrc079.match(/async function undoLastSmartImport\(\)\{[\s\S]*?\n\}/)||[''])[0]);
check(/if\(saved !== true\)\{[\s\S]*?showError\([\s\S]*?return;/.test(siUndo079), 'undoLastSmartImport reports failure and returns before its success path');
const siUndoFail079 = (siUndo079.match(/if\(saved !== true\)\{[\s\S]*?return;/)||[''])[0];
check(siUndoFail079 !== '' && !/showSuccess\(/.test(siUndoFail079), 'undoLastSmartImport shows no success message on failure');
// The `undone` flag is BOTH the completion marker and the batch selector
// (`find(b=>!b.undone)`). Leaving it set after a failed write would misrepresent
// completion AND block every further attempt for the session, so it must be cleared.
check(/batch\.undone = false;\s*delete batch\.undoneAt;\s*delete batch\.keptTxns;/.test(siUndoFail079),
  'undoLastSmartImport clears the completion marker on failure (retry is not blocked)');
check(/find\(b=>!b\.undone\)/.test(siUndo079), 'the undo selector keys off the same `undone` flag the failure path clears');
// Clearing a marker is not a rollback — the wording must not imply one.
check(/you can try again, or reload the page/.test(siUndoFail079), 'undo failure offers retry AND reload without claiming a rollback');

// (g) FAILURE WORDING MUST NOT CLAIM A ROLLBACK (the fan-out is not atomic).
[dedupSrc079, siCommitSrc079, siUiSrc079].forEach((src, i)=>{
  const msgs = (stripComments(src).match(/showError\('[^']*'/g)||[]).join(' ');
  check(!/rolled back|reverted|nothing was changed|no data was saved|undone automatically/i.test(msgs),
    'SPR-079 failure wording claims no rollback in caller file #'+(i+1));
});
check(/was not completed successfully/.test(dedupSrc079) && /was not completed successfully/.test(siCommitSrc079) && /was not completed successfully/.test(siUiSrc079),
  'every failure message states the operation was not completed successfully');

// (h) SAFETY BACKUPS SURVIVE A FAILURE — no caller prunes State.backups.
[['people/employee-dedup.js', dedupSrc079], ['import/smart-import-commit.js', siCommitSrc079]].forEach(([f,src])=>
  check(!/State\.backups\s*=\s*State\.backups\.filter|State\.backups\.splice|State\.backups\s*=\s*\[\]/.test(stripComments(src)), 'no safety backup is removed by '+f));
check(/State\.backups\.unshift\(\{[\s\S]{0,300}Pre-merge safety backup|State\.backups\.unshift\(\{[\s\S]{0,300}Pre-employee-merge backup/.test(dedupSrc079), 'employee merge still takes a pre-operation safety backup');
check(/State\.backups\.unshift\(\{[\s\S]{0,300}Pre-Smart-Import backup/.test(siCommitSrc079), 'Smart Import still takes a pre-operation safety backup');

// (i) SPR-079 CHANGES NOTHING ELSE.
check(read(path.join(root,'js','core','storage-adapter.js')).indexOf('async set(key, value)') !== -1, 'StorageAdapter still exposes its unchanged single-key set()');
check(/const SCHEMA_VERSION = 6;/.test(read(path.join(root,'js','core','constants.js'))), 'SCHEMA_VERSION remains 6');
check(aggregateDefs === 8, 'aggregate count is unchanged by SPR-079 (still eight)');
check(fs.existsSync(path.join(root,'tools','verify-savealldata-runtime.js')), 'SPR-079 runtime harness present: tools/verify-savealldata-runtime.js');

// SPR-081 — PAYROLL POSTING RESULT INTEGRITY + PARTIAL-STATE DETECTION.
console.log('== SPR-081 PAYROLL POSTING INTEGRITY (result checking + Scenario A/C detection) ==');
const poeSrc081 = read(path.join(root,'js','people','payroll-ops-engine.js'));
const crpBody081 = stripComments((poeSrc081.match(/async function commitReadyPayroll\(monthKey, ids\)\{[\s\S]*?\n\}/)||[''])[0]);
const stabSrc081 = read(path.join(root,'js','core','stabilization.js'));
const wsSrc081 = read(path.join(root,'js','people','payroll-workspace.js'));

// (a) ALL FOUR RESULTS CAPTURED AND STRICTLY INSPECTED.
['payrollPlans','monthlyPlans','overtime','transactions'].forEach((step)=>
  check(new RegExp("steps\\.push\\(\\['"+step+"',").test(crpBody081), 'payroll posting captures the result of the '+step+' write'));
check(/const failedSteps\s+= steps\.filter\(s=>s\[1\]!==true\)/.test(crpBody081), 'payroll posting inspects every result strictly (!== true)');
check(/const completedSteps = steps\.filter\(s=>s\[1\]===true\)/.test(crpBody081), 'payroll posting reports completed steps deterministically');
// (b) TYPED FAILURE / SUCCESS CONTRACT.
check(/error:\s*'PayrollPersistenceFailed'/.test(crpBody081), 'payroll posting returns the typed PayrollPersistenceFailed outcome');
check(/failedStep: failedSteps\[0\]/.test(crpBody081), 'the failed step is the FIRST failure in the fixed write order (deterministic)');
check(/partialPersistence: completedSteps\.length > 0/.test(crpBody081), 'partialPersistence is true only when at least one write succeeded');
check(/recoveryHint: 'RunIntegrityCheckAndReview'/.test(crpBody081), 'the failure result carries an actionable recovery hint');
check(/return \{ok:true, created, updated, skipped, posted, skippedDetails\}/.test(crpBody081), 'success returns ok:true with the existing summary fields');
check(/return \{ok:false, error:'PayrollPeriodLocked'/.test(crpBody081), 'the locked-period refusal is also typed');
// (c) SUCCESS AUDIT ONLY AFTER FULL PERSISTENCE SUCCESS.
check(/if\(failedSteps\.length\)\{[\s\S]*?return \{ok:false[\s\S]*?\}\s*logActivity\(\{type:'payroll\.post'/.test(crpBody081),
  "the payroll.post success audit is unreachable when any write failed");
check((crpBody081.match(/logActivity\(\{type:'payroll\.post'/g)||[]).length === 1, 'exactly one payroll.post audit call exists');
// (d) NO SUCCESS UI AFTER FAILURE.
const wsFail081 = (stripComments(wsSrc081).match(/if\(res\.ok !== true && res\.error === 'PayrollPersistenceFailed'\)\{[\s\S]*?return;/)||[''])[0];
check(wsFail081 !== '', 'the posting caller has an explicit persistence-failure branch');
[['success toast', /showSuccess\(/], ['posted-vs-skipped summary', /openPostResultModal\(/]].forEach(([label,re])=>
  check(!re.test(wsFail081), 'the payroll failure branch shows no '+label));
check(/showError\(/.test(wsFail081) && /Run Integrity Check/.test(wsFail081), 'the payroll failure branch reports the failure and directs the user to Integrity Check');
// SPR-081 follow-up — CONTROL-FLOW ORDERING. Clearing the selection is completion
// behaviour and must never precede result inspection. Scope the scan to the Post
// click handler so unrelated sel.clear() sites cannot mask a regression.
const postHandler081 = stripComments((wsSrc081.match(/const res=await commitReadyPayroll\(monthKey, readyIds\);[\s\S]*?\n      \}\);/)||[''])[0]);
check(postHandler081 !== '', 'the Post click handler is resolvable');
const iCommit081 = postHandler081.indexOf('await commitReadyPayroll');
const iFailBranch081 = postHandler081.indexOf("res.error === 'PayrollPersistenceFailed'");
const iSuccessClear081 = postHandler081.lastIndexOf('sel.clear()');
const iSummary081 = postHandler081.indexOf('openPostResultModal(');
const iSuccessToast081 = postHandler081.indexOf('showSuccess(');
check(iCommit081 > -1 && iFailBranch081 > iCommit081, 'the persistence-failure branch is evaluated after the posting call');
check(iSuccessClear081 > iFailBranch081, 'the success-path selection clear occurs AFTER the persistence-failure branch');
check(iSummary081 > iFailBranch081, 'the posted-vs-skipped summary occurs AFTER the persistence-failure branch');
check(iSuccessToast081 > iFailBranch081, 'the success toast occurs AFTER the persistence-failure branch');
// Nothing completion-shaped may sit between the call and the failure branch.
const preFail081 = postHandler081.slice(iCommit081, iFailBranch081);
[['selection clear', /sel\.clear\(\)/], ['success summary', /openPostResultModal\(/], ['success toast', /showSuccess\(/]
].forEach(([label,re])=> check(!re.test(preFail081.replace(/if\(res\.locked\)\{[^}]*\}/,'')), 'no success-only '+label+' precedes the persistence-failure branch'));
// The failure branch itself must not clear the selection.
check(!/sel\.clear\(\)/.test(wsFail081), 'the persistence-failure branch retains the selection (no sel.clear())');
// Locked keeps its own completion behaviour, and only warns once (from the engine).
check(/if\(res\.locked\)\{ sel\.clear\(\); closeModal\(\); return; \}/.test(postHandler081), 'the locked branch preserves its existing clear+close behaviour and returns');
check(!/showWarning\(|showError\(/.test((postHandler081.match(/if\(res\.locked\)\{[^}]*\}/)||[''])[0]), 'the locked branch adds no second warning');
check(!/rolled back|reverted|nothing was saved|nothing was written/i.test(wsFail081), 'the payroll failure message claims no rollback');
check(/Some data may already have been saved/.test(wsSrc081), 'the payroll failure message states that data may already have been saved');

// (e) TRANSACTION LOOKUP — forward first, narrow unique reverse fallback.
check(/function payrollTxnOf\(pp\)\{/.test(poeSrc081), 'payrollTxnOf is defined');
check(/const direct = findTxn\(pp && \(pp\.committedTxnId \|\| pp\.transactionId\)\);/.test(poeSrc081), 'the lookup still tries the FORWARD linkage first');
check(/function payrollTxnCandidates\(pp\)\{/.test(poeSrc081), 'the reverse-lookup candidate set is a named function');
const candBody081 = stripComments((poeSrc081.match(/function payrollTxnCandidates\(pp\)\{[\s\S]*?\n\}/)||[''])[0]);
check(/t\.source==='payroll'/.test(candBody081), 'the reverse lookup considers payroll-sourced transactions only');
check(/t\.payrollPlanId===pp\.id/.test(candBody081), 'the reverse lookup requires a matching payrollPlanId');
check(/t\.monthKey===pp\.monthKey/.test(candBody081), 'the reverse lookup requires matching period identity');
const resolveBody081 = stripComments((poeSrc081.match(/function resolvePayrollTxn\(pp\)\{[\s\S]*?\n\}/)||[''])[0]);
check(/if\(cands\.length > 1\) return \{ ambiguous: true/.test(resolveBody081), 'more than one candidate yields an AMBIGUOUS result, never a guess');
check(/cands\.length === 1 \? cands\[0\] : null/.test(resolveBody081), 'the reverse lookup resolves only when exactly one candidate exists');
// (f) SCENARIO A — a retry can never create a second transaction.
check(/const resolved = resolvePayrollTxn\(pp\);[\s\S]{0,400}if\(resolved\.ambiguous\)\{[\s\S]{0,600}continue;/.test(crpBody081),
  'ambiguity is detected BEFORE any mutation and the row is skipped uncommitted');
check(/PayrollTransactionAmbiguous/.test(crpBody081), 'the ambiguous skip reason uses the typed PayrollTransactionAmbiguous concept');
check(/if\(txn && pp\.committedTxnId!==txn\.id && pp\.transactionId!==txn\.id\)\{[\s\S]{0,400}pp\.committedTxnId=txn\.id/.test(crpBody081),
  'a reverse-matched transaction has its forward linkage restored instead of being duplicated');
check(/let txn = resolved\.txn;/.test(crpBody081), 'the posting path uses the resolved transaction (no second lookup that could create one)');
const createBlock081 = (crpBody081.match(/if\(!txn\)\{[\s\S]*?\}/)||[''])[0];
check(createBlock081 !== '' && /payrollCommitTxn\(pp, mo\)/.test(createBlock081), 'a transaction is created ONLY when none resolved');
check((crpBody081.match(/State\.txns\.push\(/g)||[]).length === 1, 'the posting path has exactly one transaction-creation site');

// (g) INTEGRITY RULE A + RULE C — critical, read-only.
check(/add\('critical','payroll-orphan-transaction'/.test(stabSrc081), 'Integrity Rule A (orphan payroll transaction) exists and is CRITICAL');
check(/add\('critical','payroll-overtime-uncommitted'/.test(stabSrc081), 'Integrity Rule C (committed payroll, uncommitted overtime) exists and is CRITICAL');
const ruleA081 = stripComments((stabSrc081.match(/const orphanPayrollTxns=\[\];[\s\S]*?\}\);\s*\n\s*orphanPayrollTxns\.forEach\([\s\S]*?\}\);/)||[''])[0]);
check(ruleA081 !== '', 'Rule A body is resolvable');
check(/t\.source!=='payroll'/.test(ruleA081) && /t\.payrollPlanId/.test(ruleA081), 'Rule A scans payroll transactions carrying a payrollPlanId');
check(/pp\.committedTxnId===t\.id \|\| pp\.transactionId===t\.id/.test(ruleA081), 'Rule A checks the forward linkage back to the transaction');
check(/isPayrollCommitted\(pp\)/.test(ruleA081), 'Rule A checks whether the payroll row is committed');
// Findings must carry review identifiers.
check(/Finance transaction \$\{t\.id\}[\s\S]{0,200}payroll row \$\{pp\.id\}/.test(stabSrc081), 'Rule A reports transaction id, amount, period, payroll row and employee');
check(/its linked overtime \$\{o\.id\}/.test(stabSrc081), 'Rule C reports payroll row, period, overtime id, amount and status');
// READ-ONLY: neither rule mutates or persists.
[ruleA081, (stabSrc081.match(/State\.payrollPlans\.forEach\(pp=>\{\s*if\(!isPayrollCommitted\(pp\)\) return;[\s\S]*?\}\);\s*\n\s*\}\);/)||[''])[0]
].forEach((body, i)=>{
  const label = i===0 ? 'Rule A' : 'Rule C';
  check(body !== '', label+' body is resolvable for the purity scan');
  [['status mutation', /\.status\s*=[^=]/], ['link mutation', /committedTxnId\s*=[^=]/], ['persistence', /persist|StorageAdapter/],
   ['deletion', /\.filter\(|splice\(/], ['snapshot rewrite', /committedSnapshot\s*=[^=]/]
  ].forEach(([l,re])=> check(!re.test(body), label+' performs no '+l+' (read-only detection, not repair)'));
});

// (h) WRITE ORDER UNCHANGED + NO NEW ARCHITECTURE.
const orderIdx081 = ['payrollPlans','monthlyPlans','overtime','transactions'].map(k=>crpBody081.indexOf("['"+k+"'"));
check(orderIdx081.every((v,i)=> v > -1 && (i===0 || v > orderIdx081[i-1])), 'the payroll write order is unchanged (plans, monthlyPlans, overtime, transactions)');
check(!/return \{ok:false[\s\S]{0,200}\}\s*steps\.push/.test(crpBody081), 'the attempt-all behaviour is preserved (no early abort between writes)');
[['coordinator', /PostingCoordinator|PersistenceCoordinator/], ['unit of work', /unitOfWork|UnitOfWork/],
 ['transaction abstraction', /beginTransaction|TransactionCoordinator/], ['journal', /writeAhead|journalWrite/],
 // NOTE: `payrollTotalCompensation` is a pre-existing v2.7.3 read-model, so the
 // probe targets compensation MACHINERY, never the word itself.
 ['compensation framework', /compensationStep|runCompensation|compensator|CompensationRunner/],
 ['batch persistence', /saveMany|StorageAdapter\.(setMany|batch)/]
].forEach(([label,re])=> check(!re.test(poeSrc081) && !re.test(stabSrc081), 'SPR-081 introduces no '+label));
check(/const SCHEMA_VERSION = 6;/.test(read(path.join(root,'js','core','constants.js'))), 'SCHEMA_VERSION remains 6');
check(read(path.join(root,'js','core','storage-adapter.js')).indexOf('async set(key, value)') !== -1, 'StorageAdapter is unchanged');
check(fs.existsSync(path.join(root,'tools','verify-payroll-posting-runtime.js')), 'SPR-081 runtime harness present: tools/verify-payroll-posting-runtime.js');

// SPR-082 — MONTHLY PLAN COMMIT RESULT INTEGRITY + PARTIAL-STATE DETECTION.
console.log('== SPR-082 MONTHLY PLAN RESULT INTEGRITY (result checking + orphan detection) ==');
const mpSrc082 = read(path.join(root,'js','people','monthly-plan.js'));
const cmpBody082 = stripComments((mpSrc082.match(/async function commitMonthlyPlan\(preview\)\{[\s\S]*?\n\}/)||[''])[0]);
const stabSrc082 = read(path.join(root,'js','core','stabilization.js'));
check(cmpBody082 !== '', 'commitMonthlyPlan body is resolvable for the scan');

// (a) BOTH RESULTS CAPTURED AND STRICTLY INSPECTED.
check(/const txnsOk = await persist\(\)/.test(cmpBody082), 'the transactions write result is captured');
check(/const plansOk = await persistMonthlyPlans\(\)/.test(cmpBody082), 'the monthlyPlans write result is captured');
check(!/await persist\(\); await persistMonthlyPlans\(\)/.test(cmpBody082), 'the old fire-and-forget write pair is gone');
check(/ok:\s*txnsOk===true/.test(cmpBody082) && /ok:\s*plansOk===true/.test(cmpBody082), 'both results are inspected strictly (=== true)');
check(/const completedSteps = steps\.filter\(s=>s\.ok\)/.test(cmpBody082), 'completed steps are derived from the captured results');
check(/const failedSteps = steps\.filter\(s=>!s\.ok\)/.test(cmpBody082), 'failed steps are derived from the captured results');

// (b) TYPED FAILURE / SUCCESS CONTRACT.
check(/error:\s*'MonthlyPlanPersistenceFailed'/.test(cmpBody082), 'the typed MonthlyPlanPersistenceFailed outcome is returned');
check(/failedStep: failedSteps\[0\]/.test(cmpBody082), 'the failed step is the FIRST failure in the fixed write order (deterministic)');
check(/partialPersistence: completedSteps\.length > 0/.test(cmpBody082), 'partialPersistence is true only when at least one write succeeded');
check(/recoveryHint:'RunIntegrityCheckAndReview'/.test(cmpBody082), 'the failure result carries an actionable recovery hint');
check(/return \{ok:true, created/.test(cmpBody082), 'success returns ok:true');
check(/monthlyPlanId:plan\.id/.test(cmpBody082), 'the result identifies the monthly plan');

// (c) SUCCESS REQUIRES BOTH WRITES — the failure return precedes the success return.
check(cmpBody082.indexOf("error:'MonthlyPlanPersistenceFailed'") < cmpBody082.indexOf('return {ok:true'),
  'the failure branch precedes the success return (success requires both writes)');
check(/if\(failedSteps\.length\)\{[\s\S]*?return \{ok:false/.test(cmpBody082), 'any failed step short-circuits to the typed failure result');

// (d) SUCCESS UI UNREACHABLE AFTER FAILURE (single live caller, same module).
const caller082 = stripComments((mpSrc082.match(/#commitPlan'\)\.addEventListener[\s\S]*?\n  \}\);/)||[''])[0]);
check(caller082 !== '', 'the commit caller body is resolvable for the scan');
check(/if\(!res\.ok\)\{[\s\S]*?return;\s*\}/.test(caller082), 'the caller inspects the result before any completion behaviour');
check(caller082.indexOf('if(!res.ok)') < caller082.indexOf('State.planPreview=null'),
  'the failure branch precedes clearing the preview (completion behaviour is gated)');
check(caller082.indexOf('if(!res.ok)') < caller082.indexOf('Monthly plan committed:'),
  'the failure branch precedes the success toast');
const failBranch082 = (caller082.match(/if\(!res\.ok\)\{[\s\S]*?return;\s*\}/)||[''])[0];
check(!/State\.planPreview\s*=\s*null/.test(failBranch082), 'the failure branch does NOT clear the preview (review context is retained)');
check(!/toast\(/.test(failBranch082), 'the failure branch shows no success toast');
check(/showError\(/.test(failBranch082), 'the failure branch shows an explicit error');
check(/did not complete successfully/.test(failBranch082), 'the failure message states the commit did not complete');
check(/Some data may already have been saved/.test(failBranch082), 'the failure message admits partial persistence');
check(/Run Integrity Check/.test(failBranch082), 'the failure message directs the user to Integrity Check');
check(!/localStorage|browser storage|developer tools/i.test(failBranch082), 'the failure message never tells the user to edit browser storage');

// (e) NO AUDIT REGRESSION — the module wrote no success audit before SPR-082 and still writes none.
check(!/logActivity\(/.test(mpSrc082), 'the monthly-plan module emits no activity audit entry (unchanged by SPR-082)');

// (f) NEW INTEGRITY RULE — read-only detection of the reverse-linkage break.
const ruleM082 = (stabSrc082.match(/State\.txns\.filter\(t=>t\.source!=='payroll' && t\.monthlyPlanId\)\.forEach\(t=>\{[\s\S]*?\n  \}\);/)||[''])[0];
check(ruleM082 !== '', 'Rule M body is resolvable for the purity scan');
check(/add\('critical','monthlyplan-orphan-transaction'/.test(stabSrc082), 'monthlyplan-orphan-transaction exists and is CRITICAL');
check(/t\.source!=='payroll'/.test(ruleM082), 'Rule M excludes payroll-sourced transactions (SPR-081 rules own those)');
// Reload evidence proved the plan can be ABSENT after a failed first commit of a
// month, so the rule must report that case rather than skip it.
check(/no such monthly plan exists/.test(ruleM082), 'Rule M reports an ABSENT monthly plan (the reloaded first-commit failure state)');
check(!/if\(!mp\) return;/.test(ruleM082), 'Rule M no longer silently skips a missing plan');
check((ruleM082.match(/add\('critical','monthlyplan-orphan-transaction'/g)||[]).length === 2,
  'Rule M raises Critical for BOTH the absent-plan and the not-linked-back cases');
check(/if\(\(mp\.committedTxnIds\|\|\[\]\)\.includes\(t\.id\)\) return;/.test(ruleM082), 'Rule M treats a linked-back transaction as healthy');
check(/Finance transaction \$\{t\.id\}/.test(ruleM082), 'Rule M reports the transaction id');
check(/monthly plan \$\{mp\.id\}/.test(ruleM082), 'Rule M reports the monthly plan id');
check(/Review the plan and this transaction/.test(ruleM082), 'Rule M gives an actionable manual-review instruction');
[['status mutation', /\.status\s*=[^=]/], ['link mutation', /committedTxnIds\s*=[^=]/], ['persistence', /persist|StorageAdapter/],
 ['deletion', /\.splice\(/], ['push mutation', /committedTxnIds\.push/]
].forEach(([l,re])=> check(!re.test(ruleM082), 'Rule M performs no '+l+' (read-only detection, not repair)'));

// (g) WRITE ORDER UNCHANGED + ATTEMPT-ALL PRESERVED + NO NEW ARCHITECTURE.
check(cmpBody082.indexOf('await persist()') < cmpBody082.indexOf('await persistMonthlyPlans()'),
  'the write order is unchanged (transactions, then monthlyPlans)');
check(!/if\(!txnsOk\)[\s\S]{0,80}return/.test(cmpBody082), 'the attempt-all behaviour is preserved (no early abort between the two writes)');
check(!/rolled back|rollback/i.test((cmpBody082.match(/'[^'\n]*'|`[^`]*`/g)||[]).join(' ')), 'no user-facing message in the slice claims a rollback');
[['coordinator', /PlanCoordinator|PersistenceCoordinator/], ['unit of work', /unitOfWork|UnitOfWork/],
 ['transaction abstraction', /beginTransaction|TransactionCoordinator/], ['journal', /writeAhead|journalWrite/],
 ['compensation framework', /compensationStep|runCompensation|compensator|CompensationRunner/],
 ['batch persistence', /saveMany|StorageAdapter\.(setMany|batch)/]
].forEach(([label,re])=> check(!re.test(mpSrc082) && !re.test(stabSrc082), 'SPR-082 introduces no '+label));
check(/const SCHEMA_VERSION = 6;/.test(read(path.join(root,'js','core','constants.js'))), 'SCHEMA_VERSION remains 6 (SPR-082 adds no migration)');
check(read(path.join(root,'js','core','storage-adapter.js')).indexOf('async set(key, value)') !== -1, 'StorageAdapter is unchanged by SPR-082');
check(!/HR_KEYS\s*=/.test(mpSrc082), 'SPR-082 introduces no storage key');
check(fs.existsSync(path.join(root,'tools','verify-monthlyplan-runtime.js')), 'SPR-082 runtime harness present: tools/verify-monthlyplan-runtime.js');

/* ---------- SPR-089 — Critical Integrity Rule harness discoverability ----------
   This verifier proves the STRUCTURE of the Integrity Check; tools/verify-integrity-
   rules-runtime.js proves that its CRITICAL rules actually fire. The two checks below
   make that harness discoverable and keep its Critical-rule scope honest — they do NOT
   execute it (this file stays a static, single-process verifier with no child_process),
   and they deliberately govern the 11 Critical rule IDs ONLY. Warning/Info coverage and
   the full derived-registry completeness mechanism are out of scope for SPR-089. */
console.log('== CRITICAL INTEGRITY RULE HARNESS (SPR-089 — discoverability only) ==');
const intgHarnessPath = path.join(root,'tools','verify-integrity-rules-runtime.js');
check(fs.existsSync(intgHarnessPath), 'SPR-089 runtime harness present: tools/verify-integrity-rules-runtime.js');
const intgHarnessSrc = fs.existsSync(intgHarnessPath) ? read(intgHarnessPath) : '';
// The 11 Critical rules that had NO harness coverage before SPR-089. Each must appear
// as an explicit rule() block in the harness, not merely as a mention in a comment.
['contract-multiple-employees','duplicate-employee-name','duplicate-id',
 'overtime-double-commit','overtime-negative-hours','payroll-negative',
 'payroll-posted-no-transaction','schema-error','supplemental-missing-transaction',
 'supplemental-orphan-transaction','supplemental-overtime-double-capture'
].forEach((id)=>check(intgHarnessSrc.indexOf("rule('"+id+"'") !== -1,
  'SPR-089 harness asserts Critical rule: '+id));
// Scope honesty — the harness must not silently grow into a no-op or drop its baseline.
check(/the healthy fabricated baseline produces ZERO findings/.test(intgHarnessSrc), 'SPR-089 harness asserts a clean healthy baseline before any defect fixture');
check(/RUNTIME VERIFICATION PASSED/.test(intgHarnessSrc) && /process\.exit\(1\)/.test(intgHarnessSrc), 'SPR-089 harness fails non-zero on assertion failure');
// SPR-089 is verification-only: the harness must not write to the repository or shell out.
check(!/fs\.(writeFile|writeFileSync|appendFile|appendFileSync|unlink|rm|rmSync|mkdir)/.test(intgHarnessSrc), 'SPR-089 harness writes nothing to disk');
check(!/child_process|require\('http|require\("http/.test(intgHarnessSrc), 'SPR-089 harness spawns no process and opens no network');

/* ---------- SPR-090 — Warning/Info harness discoverability (families F1/F2/F3/F4/F8/F10/F11) ----------
   Same treatment as the SPR-089 block: make the harness discoverable and keep its
   scope honest, WITHOUT executing it (no child_process — this file stays a static,
   single-process verifier). Deliberately governs only the 24 rule IDs assigned to
   SPR-090. The all-rule derived-registry completeness invariant is reserved for
   SPR-091, when the last 25 Warning/Info rules land; until then an uncovered
   SPR-091 rule must NOT fail the verifier. */
console.log('== WARNING/INFO INTEGRITY RULE HARNESS (SPR-090 — discoverability only) ==');
const warnHarnessPath = path.join(root,'tools','verify-integrity-warning-rules-runtime.js');
check(fs.existsSync(warnHarnessPath), 'SPR-090 runtime harness present: tools/verify-integrity-warning-rules-runtime.js');
const warnHarnessSrc = fs.existsSync(warnHarnessPath) ? read(warnHarnessPath) : '';
// The 24 Warning/Info rule IDs assigned to SPR-090, grouped as the approved families.
[['F1',['broken-employee-link','broken-contract-link','broken-payroll-link','corrupt-plan-ref','orphan-transaction','broken-import-link']],
 ['F2',['invalid-date','invalid-amount','overlapping-contracts','invalid-contract-evidence']],
 ['F3',['duplicate-payroll','duplicate-payroll-plan','payroll-duplicate-month','duplicate-payroll-txn']],
 ['F4',['overtime-broken-employee','overtime-broken-contract','overtime-broken-payroll','overtime-bad-snapshot','overtime-outside-contract','overtime-payroll-mismatch']],
 ['F8',['import-multiple-employees-per-candidate','rollback-preserved']],
 ['F10',['adjustment-invalid-period']],
 ['F11',['schema-warning']]
].forEach(([fam,ids])=>ids.forEach((id)=>check(warnHarnessSrc.indexOf("'"+id+"'") !== -1,
  'SPR-090 harness covers '+fam+' rule: '+id)));
// Scope honesty — the harness must say what it is, and must not overclaim.
check(/Fixture families F1 \/ F2 \/ F3 \/ F4 \/ F8 \/ F10 \/ F11/.test(warnHarnessSrc), 'SPR-090 harness identifies itself as Warning/Info family coverage (F1/F2/F3/F4/F8/F10/F11)');
check(/RESERVED FOR SPR-091/.test(warnHarnessSrc) && /RESERVED_SPR091/.test(warnHarnessSrc), 'SPR-090 harness names the SPR-091 families as reserved and NOT covered');
check(/NOT complete predicate coverage|is NOT complete predicate coverage/.test(warnHarnessSrc), 'SPR-090 harness does not claim complete predicate coverage');
check(/the healthy fabricated baseline produces ZERO findings/.test(warnHarnessSrc), 'SPR-090 harness asserts a clean healthy baseline before any defect fixture');
check(/RUNTIME VERIFICATION PASSED/.test(warnHarnessSrc) && /process\.exit\(1\)/.test(warnHarnessSrc), 'SPR-090 harness fails non-zero on assertion failure');
check(!/fs\.(writeFile|writeFileSync|appendFile|appendFileSync|unlink|rm|rmSync|mkdir)/.test(warnHarnessSrc), 'SPR-090 harness writes nothing to disk');
check(!/child_process|require\('http|require\("http/.test(warnHarnessSrc), 'SPR-090 harness spawns no process and opens no network');
// The two integrity harnesses stay separate artifacts with separate scopes.
check(warnHarnessPath !== intgHarnessPath && intgHarnessSrc.indexOf('F1 / F2 / F3') === -1, 'SPR-089 Critical harness is untouched by SPR-090 (separate files, separate scope)');

// PR-5F "The Sentinel" — shared aggregate helpers (refactor; no behavior change).
console.log('== SHARED AGGREGATE HELPERS (PR-5F — business-support utilities) ==');
const helpPath = path.join(root,'js','domain','aggregate-helpers.js');
check(fs.existsSync(helpPath), 'helper module present: js/domain/aggregate-helpers.js');
check(jsFiles.indexOf('domain/aggregate-helpers.js') !== -1, 'module-order.js includes domain/aggregate-helpers.js');
check(indexHtml.includes('<script src="js/domain/aggregate-helpers.js"></script>'), 'index.html includes domain/aggregate-helpers.js');
// Helpers must load BEFORE both aggregates that consume them.
check(jsFiles.indexOf('domain/aggregate-helpers.js') < jsFiles.indexOf('domain/employee-contact-aggregate.js') &&
      jsFiles.indexOf('domain/aggregate-helpers.js') < jsFiles.indexOf('domain/employee-employment-aggregate.js'), 'helpers load before both aggregates');
const helpSrc = read(helpPath);
// It is a toolkit of small functions, NOT a generic framework.
['AggregateBase','BaseAggregate','AbstractAggregate','AggregateFactory','AggregateRegistry','class '].forEach((bad)=>
  check(!helpSrc.includes(bad), 'helper module introduces no generic framework construct: '+bad.trim()));
check(/function employeeExists\(/.test(helpSrc) && /function normalizeAllowedFields\(/.test(helpSrc) && /function validateEnum\(/.test(helpSrc), 'helper module defines the extracted utilities (employeeExists / normalizeAllowedFields / validateEnum)');
// Helper PURITY — no implementation-side effects (comments stripped).
const helpCode = helpSrc.replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,'');
[['State mutation', /State\s*[.[]/],
 ['persistEmployees', /persistEmployees\s*\(/],
 ['history append', /\.history\b|history\s*=|\.push\(/],
 ['updatedAt mutation', /updatedAt/],
 ['UI render', /\brender\s*\(/],
 ['localStorage', /localStorage/],
 ['audit logging', /logActivity\s*\(/]
].forEach(([label,re])=>check(!re.test(helpCode), 'helper module never performs '+label));
// Extraction actually happened: both aggregates now call the shared helpers.
check(/employeeExists\(/.test(aggSrc2) && /normalizeAllowedFields\(/.test(aggSrc2), 'contact aggregate uses the shared helpers');
check(/employeeExists\(/.test(empAggSrc) && /normalizeAllowedFields\(/.test(empAggSrc) && /validateEnum\(/.test(empAggSrc), 'employment aggregate uses the shared helpers');
// Operational surface is UNCHANGED by this refactor: still 2 aggregates, 2 commands, 1 query
// (asserted above via aggregateDefs===2, migratedCmdIds.length===2, migratedQueryIds.length===1).
check(aggregateDefs === 8, 'operational aggregate count remains exactly eight');
check(migratedCmdIds.length === 8, 'operational command count remains exactly eight');
check(migratedQueryIds.length === 1, 'operational query count remains exactly one');

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

// PR-6A "The Gateway" — first Platform Layer boundary (ApplicationGateway).
// Infrastructure only: a pure application boundary that DELEGATES to the Domain
// facade and owns no business behavior. Implements the ATR-004 / SRD-062A canonical
// Platform Contract (request {kind,name,args,meta?}; uniform response envelope;
// three-class errors). Milestone Delta begins here.
console.log('== APPLICATION GATEWAY (PR-6A — canonical platform contract) ==');
const gwPath = path.join(root,'js','platform','application-gateway.js');
check(fs.existsSync(gwPath), 'platform module present: js/platform/application-gateway.js');
check(jsFiles.indexOf('platform/application-gateway.js') !== -1, 'module-order.js includes platform/application-gateway.js');
check(indexHtml.includes('<script src="js/platform/application-gateway.js"></script>'), 'index.html includes platform/application-gateway.js');
// Load order: AFTER the Domain facade it delegates to, and before bootstrap.
check(jsFiles.indexOf('domain/domain-layer.js') < jsFiles.indexOf('platform/application-gateway.js') &&
      jsFiles.indexOf('platform/application-gateway.js') < jsFiles.indexOf('core/app-bootstrap.js'), 'gateway loads after domain-layer.js and before app-bootstrap.js');
const gwSrc = read(gwPath);
check(/const ApplicationGateway = \(function/.test(gwSrc) && /Object\.freeze\(\{/.test(gwSrc), 'ApplicationGateway is a frozen object');
check(/execute:\s*(async\s+)?function/.test(gwSrc), 'gateway exposes execute()');
check(dist.includes('const ApplicationGateway') && dist.includes('window.ApplicationGateway = ApplicationGateway'), 'gateway present and exposed in dist');
// DELEGATION CONTRACT — the gateway reaches business behavior ONLY via the Domain facade.
check(/domain\.command\.apply\(/.test(gwSrc) && /domain\.query\.apply\(/.test(gwSrc), 'gateway delegates to Domain.command and Domain.query');
check(/typeof Domain !== 'undefined'/.test(gwSrc), 'gateway resolves the Domain facade (delegation target)');
// GATEWAY PURITY — it owns no business behavior (comments stripped).
const gwCode = gwSrc.replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,'');
[['State access', /State\s*[.[]/],
 ['persistence', /\bpersist\w*\s*\(/],
 ['history append', /\.history\b|history\s*=|\.push\(/],
 ['updatedAt mutation', /updatedAt/],
 ['UI render', /\brender\s*\(/],
 ['toast/alert', /\btoast\s*\(|showWarning\s*\(|showSuccess\s*\(|\balert\s*\(|confirm\s*\(/],
 ['localStorage', /localStorage/],
 ['audit logging', /logActivity\s*\(/]
].forEach(([label,re])=>check(!re.test(gwCode), 'gateway never performs '+label));
// NO DOMAIN BYPASS — the gateway never calls a handler or aggregate directly.
cmdHandlers.forEach((h)=>check(!new RegExp('\\b'+h+'\\s*\\(').test(gwCode), 'gateway does not call handler directly: '+h));
check(!/\w+Aggregate\s*[.[]/.test(gwCode), 'gateway does not touch any aggregate directly');
// NO DUPLICATE AUTHORITY — the gateway does not re-implement command/query routing.
check(!/DOMAIN_COMMANDS|DOMAIN_QUERIES|commandHandler\s*\(|queryHandler\s*\(/.test(gwCode), 'gateway does not re-implement the Domain registry/routing');
// --- CANONICAL REQUEST CONTRACT (ATR-004 / SRD-062A) ---
check(/request\.kind/.test(gwSrc) && /request\.name/.test(gwSrc) && /request\.args/.test(gwSrc) && /request\.meta/.test(gwSrc), 'gateway request contract reads kind / name / args / meta');
check(/kind !== 'command' && kind !== 'query'/.test(gwSrc), 'kind is constrained to command | query');
check(/request\.args === undefined\) \? \[\]/.test(gwSrc), 'args defaults to [] and is the canonical positional carrier');
check(/meta !== undefined/.test(gwSrc) && /INVALID_META/.test(gwSrc), 'meta is OPTIONAL and shape-validated (plain object) when present');
// --- CANONICAL RESPONSE ENVELOPE (uniform: ok/kind/name/result?/error?/meta?) ---
check(/\{ ok: true, kind: n\.kind, name: n\.name, result: result \}/.test(gwSrc), 'success envelope is { ok:true, kind, name, result } with the Domain result verbatim');
check(/ok: false, error: \{ source: 'gateway'/.test(gwSrc), 'structural failure envelope is { ok:false, error:{ source:"gateway", ... } }');
check(/if \(n\.meta !== undefined\) ok\.meta = n\.meta/.test(gwSrc), 'meta is transported back into the response verbatim (opaque)');
// `ok` reflects GATEWAY execution only — a business failure stays inside `result` (ok stays true).
check(!/result\.success|result\.ok|result\.error/.test(gwCode), 'gateway never inspects/reinterprets the Domain business outcome (result is opaque)');
// --- STRUCTURAL ERROR CONTRACT — typed codes, never reaches the Domain ---
['INVALID_REQUEST','INVALID_KIND','INVALID_NAME','INVALID_ARGS','INVALID_META'].forEach((code)=>
  check(gwSrc.includes("'"+code+"'"), 'gateway returns typed structural rejection code: '+code));
// --- FAULT CONTRACT — unexpected Domain exceptions are caught and enveloped ---
check(/try \{[\s\S]*domain\.(command|query)\.apply[\s\S]*\} catch \(err\)/.test(gwSrc), 'gateway wraps Domain delegation in try/catch (no unhandled exception escapes)');
// Domain command handlers are async — the gateway AWAITS delegation so result is the
// resolved outcome and async rejections are caught (not left as unhandled Promises).
check(/execute:\s*async function/.test(gwSrc), 'gateway execute() is async (Domain handlers return Promises)');
check(/await domain\.command\.apply\(/.test(gwSrc) && /await domain\.query\.apply\(/.test(gwSrc), 'gateway awaits Domain delegation (resolved result under `result`; async rejections caught)');
check(/source: 'domain', code: 'DOMAIN_FAULT'/.test(gwSrc), 'fault envelope is { ok:false, error:{ source:"domain", code:"DOMAIN_FAULT" } }');
check(/DOMAIN_UNAVAILABLE/.test(gwSrc), 'a missing Domain facade returns a typed gateway-source DOMAIN_UNAVAILABLE (never throws)');
// --- DETERMINISM — the gateway generates no ids/timestamps/randomness of its own ---
check(!/Math\.random|Date\.now|new Date\(|Date\.now\(|crypto\./.test(gwCode), 'gateway is deterministic — it generates no ids/timestamps/randomness (a transport-adapter concern)');
// The Domain facade must NOT depend on the platform layer (one-way dependency).
check(!/ApplicationGateway|application-gateway|platform\//.test(facSrc), 'domain-layer.js has no dependency on the platform layer (one-way)');
check(!/ApplicationGateway/.test(cmdSrc) && !/ApplicationGateway/.test(qrySrc) && !/ApplicationGateway/.test(aggSrc), 'domain registries have no dependency on the gateway');
// Operational surface is UNCHANGED by PR-6A (infrastructure only).
check(aggregateDefs === 8 && migratedCmdIds.length === 8 && migratedQueryIds.length === 1, 'operational surface unchanged by the gateway (8 aggregates / 8 commands / 1 query)');

// PR-7A "The Transport" — Transport Layer boundary (TransportAdapter), the first
// operational Platform expansion. Infrastructure only: the canonical application
// transport boundary ABOVE the Application Gateway. It DELEGATES solely to the
// Gateway and owns no business behavior. It never touches the Domain directly.
console.log('== TRANSPORT ADAPTER (PR-7A — canonical application transport boundary) ==');
const txPath = path.join(root,'js','transport','transport-adapter.js');
check(fs.existsSync(txPath), 'transport module present: js/transport/transport-adapter.js');
check(jsFiles.indexOf('transport/transport-adapter.js') !== -1, 'module-order.js includes transport/transport-adapter.js');
check(indexHtml.includes('<script src="js/transport/transport-adapter.js"></script>'), 'index.html includes transport/transport-adapter.js');
// Load order: ABOVE the gateway it delegates to — AFTER application-gateway.js and before bootstrap.
check(jsFiles.indexOf('platform/application-gateway.js') < jsFiles.indexOf('transport/transport-adapter.js') &&
      jsFiles.indexOf('transport/transport-adapter.js') < jsFiles.indexOf('core/app-bootstrap.js'), 'transport loads after application-gateway.js and before app-bootstrap.js');
const txSrc = read(txPath);
check(/const TransportAdapter = \(function/.test(txSrc) && /Object\.freeze\(\{/.test(txSrc), 'TransportAdapter is a frozen object');
check(/execute:\s*async function/.test(txSrc), 'transport exposes async execute() (awaits the async Gateway)');
check(dist.includes('const TransportAdapter') && dist.includes('window.TransportAdapter = TransportAdapter'), 'transport present and exposed in dist');
// DELEGATION CONTRACT — the transport reaches business behavior ONLY via the Application Gateway.
check(/gateway\.execute\(request\)/.test(txSrc) && /return await gateway\.execute\(/.test(txSrc), 'transport delegates to (and awaits) ApplicationGateway.execute — the canonical request passes through unchanged');
check(/typeof ApplicationGateway !== 'undefined'/.test(txSrc), 'transport resolves the Application Gateway (its sole delegation target)');
// TRANSPORT PURITY — it owns no business behavior (comments stripped).
const txCode = txSrc.replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,'');
[['State access', /State\s*[.[]/],
 ['persistence', /\bpersist\w*\s*\(/],
 ['history append', /\.history\b|history\s*=|\.push\(/],
 ['updatedAt mutation', /updatedAt/],
 ['UI render', /\brender\s*\(/],
 ['toast/alert', /\btoast\s*\(|showWarning\s*\(|showSuccess\s*\(|\balert\s*\(|confirm\s*\(/],
 ['localStorage', /localStorage/],
 ['audit logging', /logActivity\s*\(/]
].forEach(([label,re])=>check(!re.test(txCode), 'transport never performs '+label));
// NO PLATFORM BYPASS — the transport never reaches the Domain, an Aggregate, a Handler, or a registry.
check(!/\bDomain\s*[.[]/.test(txCode), 'transport never calls the Domain facade directly (must go through the Gateway)');
check(!/domain\.(command|query)/.test(txCode), 'transport never invokes Domain.command/Domain.query directly');
cmdHandlers.forEach((h)=>check(!new RegExp('\\b'+h+'\\s*\\(').test(txCode), 'transport does not call handler directly: '+h));
check(!/\w+Aggregate\s*[.[]/.test(txCode), 'transport does not touch any aggregate directly');
check(!/DOMAIN_COMMANDS|DOMAIN_QUERIES|commandHandler\s*\(|queryHandler\s*\(/.test(txCode), 'transport does not re-implement the Domain registry/routing');
// TRANSPORT RESPONSE — the canonical Platform response is returned VERBATIM (business outcome never reinterpreted).
check(!/result\.success|result\.ok|result\.error|\.result\b/.test(txCode), 'transport never inspects/reinterprets the Platform/Domain result (returned verbatim)');
// TRANSPORT ERROR CONTRACT — may classify ONLY invalid transport request + transport unavailable (source:'transport').
check(/error: \{ source: 'transport', code: 'INVALID_TRANSPORT_REQUEST'/.test(txSrc), 'transport classifies an invalid transport request: { ok:false, error:{ source:"transport", code:"INVALID_TRANSPORT_REQUEST" } }');
check(/error: \{ source: 'transport', code: 'TRANSPORT_UNAVAILABLE'/.test(txSrc), 'transport classifies a missing Gateway: { ok:false, error:{ source:"transport", code:"TRANSPORT_UNAVAILABLE" } }');
check(!/DOMAIN_FAULT|'gateway'|source: 'domain'/.test(txCode), 'transport does not mint Platform/Domain error sources (only source:"transport")');
// META is opaque — the transport carries the request through and never rewrites meta contents.
check(!/meta\s*=\s*\{|meta\.[a-zA-Z]/.test(txCode), 'transport treats meta as opaque (never constructs or reads meta contents)');
// DETERMINISM — the transport generates no ids/timestamps/randomness of its own.
check(!/Math\.random|Date\.now|new Date\(|crypto\./.test(txCode), 'transport is deterministic — it generates no ids/timestamps/randomness');
// ONE-WAY DEPENDENCY — neither the Domain nor the Gateway depends on the transport.
check(!/TransportAdapter|transport-adapter|transport\//.test(facSrc), 'domain-layer.js has no dependency on the transport layer (one-way)');
// (test the comment-stripped gateway code: its comments legitimately mention "a transport-adapter concern")
check(!/TransportAdapter|transport-adapter|transport\//.test(gwCode), 'application-gateway.js has no dependency on the transport layer (one-way; the Gateway stays the boundary below)');
// EXPLICIT ONE-WAY INVARIANT (FAA-PR7A) — the Application Gateway must NEVER reference
// TransportAdapter. Preserves Transport -> Application Gateway -> Domain; the Platform
// Layer stays independent of the Transport Layer (no reverse dependency permitted).
check(!/\bTransportAdapter\b/.test(gwCode), 'one-way invariant: Application Gateway never references TransportAdapter (Platform independent of Transport)');
// Operational surface is UNCHANGED by PR-7A (infrastructure only).
check(aggregateDefs === 8 && migratedCmdIds.length === 8 && migratedQueryIds.length === 1, 'operational surface unchanged by the transport (8 aggregates / 8 aggregate-backed commands / 1 aggregate-backed query)');
// Registered executable surface (full registry, incl. multi-segment ids) is 13 commands / 4 queries.
function allRegisteredIds(src){ return (src.match(/^\s*'([a-z][a-zA-Z]*(?:\.[a-zA-Z]+)+)':/gm)||[]).map(s=>s.match(/'([^']+)'/)[1]); }
const allCmdIds = allRegisteredIds(cmdSrc), allQryIds = allRegisteredIds(qrySrc);
check(allCmdIds.length === 14, 'registered command surface is exactly 14 (found '+allCmdIds.length+')');
check(allQryIds.length === 4, 'registered query surface is exactly 4 (found '+allQryIds.length+')');

// PR-7B "The Conduit" — the browser UI now CONSUMES the canonical application path.
// The authorized aggregate-backed operations reach the Domain ONLY through one
// official UI-to-Transport seam (uiExecute) → TransportAdapter → ApplicationGateway →
// Domain. No business authority moves into the UI, Transport, or Platform layers.
console.log('== UI-TO-TRANSPORT SEAM (PR-7B — operational transport consumption) ==');
const pwsSrc7b = read(path.join(root,'js','people','payroll-workspace.js'));
// ONE official seam exists, is async, and is present in the build.
check(/async function uiExecute\(kind, name, args, meta\)\{/.test(empSrc), 'exactly one official UI-to-Transport seam is defined: async uiExecute(kind, name, args, meta)');
check((srcJs.match(/async function uiExecute\(/g)||[]).length === 1, 'the UI-to-Transport seam is defined exactly once (single official seam)');
check(dist.includes('async function uiExecute('), 'UI-to-Transport seam present in dist');
// The seam DELEGATES only to the Transport Adapter — its single application dependency.
const seamStart = empSrc.indexOf('async function uiExecute(');
const seamBody = seamStart!==-1 ? empSrc.slice(seamStart, empSrc.indexOf('\n}', seamStart)+2) : '';
check(/await TransportAdapter\.execute\(request\)/.test(seamBody), 'the seam delegates to (and awaits) TransportAdapter.execute — its only application execution dependency');
check(!/\bDomain\s*[.[]/.test(seamBody) && !/ApplicationGateway/.test(seamBody), 'the seam never calls Domain or ApplicationGateway directly (Transport is the only path)');
cmdHandlers.forEach((h)=>check(!new RegExp('\\b'+h+'\\s*\\(').test(seamBody), 'the seam does not call handler directly: '+h));
check(!/\w+Aggregate\s*[.[]/.test(seamBody), 'the seam does not touch any aggregate directly');
// The seam owns NO business behavior (no state/persistence/history/rollback/render/UI writes).
[['State access', /State\s*[.[]/],
 ['persistence', /\bpersist\w*\s*\(/],
 ['history append', /\.history\b|\.push\(/],
 ['updatedAt mutation', /updatedAt/],
 ['UI render', /\brender\s*\(|innerHTML/],
 ['toast/alert', /\btoast\s*\(|showWarning\s*\(|showSuccess\s*\(/],
 ['localStorage', /localStorage/]
].forEach(([label,re])=>check(!re.test(seamBody), 'the seam never performs '+label));
// The seam distinguishes a BOUNDARY failure from the Domain business RESULT (not collapsed).
check(/response\.ok !== true/.test(seamBody) && /return response\.result/.test(seamBody), 'the seam distinguishes a Transport/Gateway boundary failure from the Domain result (returned verbatim on ok:true)');
// ZERO direct Domain bypass remains in any migrated UI file for the authorized ops.
const ctCode7b = stripComments(ctSrc), pwsCode7b = stripComments(pwsSrc7b);
check(!/Domain\.command\(/.test(empCode) && !/Domain\.command\(/.test(ctCode7b) && !/Domain\.command\(/.test(pwsCode7b), 'no direct Domain.command() call remains in employees.js / contracts.js / payroll-workspace.js');
check(!/Domain\.query\(/.test(empCode) && !/Domain\.query\(/.test(ctCode7b) && !/Domain\.query\(/.test(pwsCode7b), 'no direct Domain.query() call remains in employees.js / contracts.js / payroll-workspace.js');
// employee.lifecycle.transition is NOT exempted — it is migrated through the seam.
check(migratedCmdIds.indexOf('employee.lifecycle.transition')!==-1, 'employee.lifecycle.transition is migrated through the seam (not left as a direct bypass)');
// Payroll lifecycle migration is verified specifically in js/people/payroll-workspace.js (both live call sites).
check((pwsSrc7b.match(/uiExecute\('command', 'payroll\.lifecycle\.transition'/g)||[]).length === 2, 'payroll-workspace.js routes both live payroll.lifecycle.transition call sites through the seam');
// One-way independence: the Gateway and the Domain never reference the UI seam.
check(!/uiExecute/.test(gwCode), 'Application Gateway is independent of the UI seam (never references uiExecute)');
check(!/uiExecute|TransportAdapter/.test(facSrc), 'Domain is independent of the Transport/UI seam (never references uiExecute/TransportAdapter)');
// Operational surface is UNCHANGED by PR-7B (consumption paths only; no Domain op added/removed).
check(aggregateDefs === 8 && migratedCmdIds.length === 8 && migratedQueryIds.length === 1 && allCmdIds.length === 14 && allQryIds.length === 4, 'operational surface unchanged by the conduit (8 aggregates / 8 aggregate-backed commands / 1 aggregate-backed query; 14 registered commands / 4 registered queries)');

// PR-8A "The Repository" — the first persistence-MECHANICS boundary, proven on one
// bounded reference slice (Employee Identity / employee.contact.update). It isolates
// HOW an entity collection is persisted from the handler that decides WHAT to persist.
// It owns NO business behavior; the handler keeps mutation/updatedAt/history/rollback.
console.log('== EMPLOYEE REPOSITORY (PR-8A — persistence-mechanics boundary) ==');
const repoPath = path.join(root,'js','repository','employee-repository.js');
check(fs.existsSync(repoPath), 'repository module present: js/repository/employee-repository.js');
check(jsFiles.indexOf('repository/employee-repository.js') !== -1, 'module-order.js includes repository/employee-repository.js');
check(indexHtml.includes('<script src="js/repository/employee-repository.js"></script>'), 'index.html includes repository/employee-repository.js');
// Load order: AFTER the persist infrastructure it delegates to, and BEFORE the migrated handler.
check(jsFiles.indexOf('core/hr-persistence-portability.js') < jsFiles.indexOf('repository/employee-repository.js') &&
      jsFiles.indexOf('repository/employee-repository.js') < jsFiles.indexOf('people/employees.js'), 'repository loads after hr-persistence-portability.js and before people/employees.js');
const repoSrc = read(repoPath);
const repoCode = stripComments(repoSrc);
check(/const EmployeeRepository = Object\.freeze\(\{/.test(repoSrc), 'EmployeeRepository is a frozen object');
check(/async save\(\)/.test(repoSrc), 'repository exposes async save()');
check(dist.includes('const EmployeeRepository') && dist.includes('window.EmployeeRepository = EmployeeRepository'), 'repository present and exposed in dist');
// DELEGATION — the repository delegates persistence to the EXISTING persist function only (code, not comments).
check(/await persistEmployees\(\)/.test(repoCode) && (repoCode.match(/persistEmployees\(/g)||[]).length === 1, 'repository delegates persistence to the existing persistEmployees() exactly once');
// RESULT CONTRACT — strict { ok:true } / { ok:false, error:'PersistFailed' }; no truthy/falsy ambiguity.
check(/ok:\s*true/.test(repoCode) && /ok:\s*false,\s*error:\s*'PersistFailed'/.test(repoCode) && /ok === true/.test(repoCode), 'repository normalizes the strict boolean into { ok:true } / { ok:false, error:"PersistFailed" }');
// REPOSITORY PURITY — persistence mechanics ONLY (comments stripped).
[['State access', /State\s*[.[]/],
 ['field mutation', /\be\[[^\]]+\]\s*=|\.updatedAt\s*=/],
 ['history creation', /\.history\b|\.push\(/],
 ['rollback', /rollback|\.pop\(/],
 ['UI render', /\brender\s*\(|innerHTML/],
 ['toast/alert', /\btoast\s*\(|showWarning\s*\(|showSuccess\s*\(/],
 ['navigation', /State\.view\s*=|hrNavTo\s*\(/],
 ['audit logging', /logActivity\s*\(/],
 ['Domain call', /\bDomain\s*[.[]/],
 ['aggregate call', /\w+Aggregate\s*[.[]/],
 ['direct storage bypass', /localStorage|window\.storage|StorageAdapter\s*[.[]/]
].forEach(([label,re])=>check(!re.test(repoCode), 'repository never performs '+label));
// The migrated handler still OWNS rollback (the repository does not roll back).
check(/e\.history\.pop\(\)/.test(ucBody) && /e\.updatedAt = prevUpdatedAt/.test(ucBody) && /Object\.keys\(before\)\.forEach/.test(ucBody), 'contact handler still owns full rollback (fields + history.pop + updatedAt) on persistence failure');
check(/error:'PersistFailed'/.test(ucBody), 'contact handler returns the typed PersistFailed on repository failure');
// StorageAdapter remains the untouched storage-backend boundary (repository goes through persistEmployees).
const storageSrc = read(path.join(root,'js','core','storage-adapter.js'));
check(/const StorageAdapter = \{/.test(storageSrc) && /async set\(key, value\)/.test(storageSrc) && /async get\(key\)/.test(storageSrc), 'StorageAdapter remains the unchanged storage-backend boundary (get/set present)');
check(!/EmployeeRepository|repository\//.test(storageSrc), 'StorageAdapter has no dependency on the Repository (one-way)');
// Unrelated employee handlers are UNCHANGED — they still persist directly (only contact migrated).
// PR-9C adoption state: the Employee aggregate is now FULLY Repository-mediated (all four handlers).
const tlCode = stripComments(tlBody), ucoCode = stripComments(ucoBody);
check((ucCode.match(/EmployeeRepository\.save\(\)/g)||[]).length === 1 && (ueCode.match(/EmployeeRepository\.save\(\)/g)||[]).length === 1 && (tlCode.match(/EmployeeRepository\.save\(\)/g)||[]).length === 1 && (ucoCode.match(/EmployeeRepository\.save\(\)/g)||[]).length === 1, 'exactly four aggregate-backed Employee handlers are Repository-mediated (contact + employment + lifecycle + compensation) — Employee aggregate fully mediated');
check(!/persistEmployees\(/.test(ucCode) && !/persistEmployees\(/.test(ueCode) && !/persistEmployees\(/.test(tlCode) && !/persistEmployees\(/.test(ucoCode), 'no aggregate-backed Employee handler calls persistEmployees() directly (all four route through the Repository)');
// Total Repository call sites across employees.js is exactly four (no unrelated migration).
check((stripComments(empSrc).match(/EmployeeRepository\.save\(\)/g)||[]).length === 4, 'exactly four EmployeeRepository.save() call sites in employees.js (contact + employment + lifecycle + compensation only)');
// The Domain facade has no dependency on the Repository (one-way).
check(!/EmployeeRepository|repository\//.test(facSrc), 'domain-layer.js has no dependency on the repository layer (one-way)');
// Operational surface is UNCHANGED by PR-8A (persistence infrastructure only).
check(aggregateDefs === 8 && migratedCmdIds.length === 8 && migratedQueryIds.length === 1 && allCmdIds.length === 14 && allQryIds.length === 4, 'operational surface unchanged by the repository (8 aggregates / 8 aggregate-backed commands / 1 query; 14 registered / 4 registered)');

// PR-10A "The Contract Foundation" — the SECOND entity Repository (ContractRepository),
// proving the Repository architecture generalizes to a second aggregate. Introduced on
// one bounded slice (contract.dates.update). Persistence mechanics only; handler keeps
// validation/mutation/updatedAt/history/rollback.
console.log('== CONTRACT REPOSITORY (PR-10A — second entity repository) ==');
const contractRepoPath = path.join(root,'js','repository','contract-repository.js');
check(fs.existsSync(contractRepoPath), 'repository module present: js/repository/contract-repository.js');
check(jsFiles.indexOf('repository/contract-repository.js') !== -1, 'module-order.js includes repository/contract-repository.js');
check(indexHtml.includes('<script src="js/repository/contract-repository.js"></script>'), 'index.html includes repository/contract-repository.js');
// Load order: AFTER the persist infrastructure it delegates to, and BEFORE the migrated handler (contracts.js).
check(jsFiles.indexOf('core/hr-persistence-portability.js') < jsFiles.indexOf('repository/contract-repository.js') &&
      jsFiles.indexOf('repository/contract-repository.js') < jsFiles.indexOf('people/contracts.js'), 'contract repository loads after hr-persistence-portability.js and before people/contracts.js');
const contractRepoSrc = read(contractRepoPath);
const contractRepoCode = stripComments(contractRepoSrc);
check(/const ContractRepository = Object\.freeze\(\{/.test(contractRepoSrc), 'ContractRepository is a frozen object');
check(/async save\(\)/.test(contractRepoSrc), 'ContractRepository exposes async save()');
check(dist.includes('const ContractRepository') && dist.includes('window.ContractRepository = ContractRepository'), 'ContractRepository present and exposed in dist');
// DELEGATION — the repository delegates persistence to the EXISTING persistContracts() only.
check(/await persistContracts\(\)/.test(contractRepoCode) && (contractRepoCode.match(/persistContracts\(/g)||[]).length === 1, 'ContractRepository delegates persistence to the existing persistContracts() exactly once');
// RESULT CONTRACT — strict { ok:true } / { ok:false, error:'PersistFailed' } (identical to EmployeeRepository).
check(/ok:\s*true/.test(contractRepoCode) && /ok:\s*false,\s*error:\s*'PersistFailed'/.test(contractRepoCode) && /ok === true/.test(contractRepoCode), 'ContractRepository normalizes the strict boolean into { ok:true } / { ok:false, error:"PersistFailed" }');
// REPOSITORY PURITY — persistence mechanics ONLY.
[['State access', /State\s*[.[]/],
 ['field mutation', /\bc\[[^\]]+\]\s*=|\.updatedAt\s*=|\.status\s*=/],
 ['history creation', /\.history\b|\.push\(/],
 ['rollback', /rollback|\.pop\(/],
 ['validation', /Invalid|isCanonical|contractExtent/],
 ['UI render', /\brender\s*\(|innerHTML/],
 ['Domain call', /\bDomain\s*[.[]/],
 ['aggregate call', /\w+Aggregate\s*[.[]/],
 ['direct storage bypass', /localStorage|window\.storage|StorageAdapter\s*[.[]/],
 ['Employee persistence', /persistEmployees\(/]
].forEach(([label,re])=>check(!re.test(contractRepoCode), 'ContractRepository never performs '+label));
// The migrated handler still OWNS rollback (the repository does not roll back).
check(/c\[k\] = before\[k\]/.test(udCode) && /c\.history\.pop\(\)/.test(udCode) && /c\.updatedAt = prevUpdatedAt/.test(udCode), 'contract-date handler still owns full rollback (fields + history.pop + updatedAt) on persistence failure');
// PR-10B — exactly two ContractRepository call sites across contracts.js (dates + status).
check((stripComments(ctSrc).match(/ContractRepository\.save\(\)/g)||[]).length === 3, 'exactly three ContractRepository.save() call sites in contracts.js (contract.dates.update + contract.status.transition + contract.renewal.execute)');
// Renewal (compound create-successor persistence, ARCH-006) remains DIRECT and out of scope.
check(!/State\.contracts\.push\(nc\);\s*\n\s*await persistContracts\(\)/.test(ctSrc) && /State\.contracts\.push\(nc\);[\s\S]{0,600}ContractRepository\.save\(\)/.test(ctSrc), 'renewal is Repository-mediated (SPR-077 — create-successor persists through ContractRepository)');
// EmployeeRepository is unchanged and independent of the Contract repository.
check(!/ContractRepository/.test(repoSrc), 'EmployeeRepository has no dependency on ContractRepository (independent)');
check(!/ContractRepository|contract-repository/.test(facSrc), 'domain-layer.js has no dependency on the contract repository (one-way)');
check(!/ContractRepository|contract-repository/.test(storageSrc), 'StorageAdapter has no dependency on the contract repository (one-way)');
// Operational surface is UNCHANGED by PR-10A.
check(aggregateDefs === 8 && migratedCmdIds.length === 8 && migratedQueryIds.length === 1 && allCmdIds.length === 14 && allQryIds.length === 4, 'operational surface unchanged by the contract repository (8 aggregates / 8 aggregate-backed commands / 1 query; 14 registered / 4 registered)');

// PR-10B "The Contract Status Slice" — the SECOND Contract handler adopts the existing
// ContractRepository, completing Repository adoption for the Contract aggregate
// (5 of 7 -> 6 of 7 aggregate-backed handlers). Repository contract UNCHANGED; no new
// Repository module; handler keeps validation/mutation/updatedAt/history/rollback.
console.log('== CONTRACT STATUS REPOSITORY SLICE (PR-10B — Contract aggregate complete) ==');
// The migrated handler delegates persistence exactly once and never persists directly.
check((tcCode.match(/ContractRepository\.save\(\)/g)||[]).length === 1, 'transitionContractStatus() uses exactly one ContractRepository.save()');
check(!/persistContracts\(/.test(tcCode), 'transitionContractStatus() contains no direct persistContracts()');
// Strict result handling — no truthy/falsy ambiguity at either Repository call site.
check(/persisted\.ok !== true/.test(tcCode), 'contract-status handler uses strict persisted.ok handling (no truthy/falsy ambiguity)');
check(/persisted\.ok !== true/.test(udCode), 'contract-date handler still uses strict persisted.ok handling');
// The first slice remains Repository-mediated (no regression of PR-10A).
check((udCode.match(/ContractRepository\.save\(\)/g)||[]).length === 1 && !/persistContracts\(/.test(udCode), 'updateContractDates() remains Repository-mediated');
// Exactly two aggregate-backed Contract handlers use the Repository — the Contract
// aggregate is now FULLY Repository-mediated (contract.dates.update + contract.status.transition).
check((stripComments(ctSrc).match(/ContractRepository\.save\(\)/g)||[]).length === 3, 'exactly three aggregate-backed Contract handlers use ContractRepository (Contract aggregate fully Repository-mediated)');
check(migratedCmdIds.filter(id=>/^contract\./.test(id)).length === 3, 'all three registered aggregate-backed Contract commands are Repository-mediated');
// Rollback remains HANDLER-owned (the Repository does not roll back).
check(/c\.status = prevStatus/.test(tcCode) && /c\.history\.pop\(\)/.test(tcCode) && /c\.updatedAt = prevUpdatedAt/.test(tcCode), 'contract-status handler still owns full rollback (status + history.pop + updatedAt) on persistence failure');
check(/error:'PersistFailed'/.test(tcCode), 'contract-status handler preserves the typed PersistFailed result');
// Non-aggregate Contract persistence pathways remain DIRECT and unmigrated.
check(!/c\.status='Renewed'/.test(ctSrc) && /renewal\.predecessorStatus/.test(ctSrc), 'renewal status is aggregate-authored, not an inline UI write (SPR-077)');
check(/rec\.status = fd\.get\('status'\)[\s\S]{0,400}await persistContracts\(\)/.test(ctSrc), 'full Contract editor remains direct (not migrated)');
check(/State\.contracts = State\.contracts\.filter\(x=>x\.id!==id\);\s*\n\s*await persistContracts\(\)/.test(ctSrc), 'delete Contract path remains direct (not migrated)');
// Committed-payroll confirmation stays in the UI seam — never inside the Repository.
check(/payrollPlansForContract\(id\)\.some\(isPayrollCommitted\)/.test(ctSrc) && !/committed|confirm\s*\(|payrollPlansForContract/.test(contractRepoCode), 'committed-payroll confirmation remains outside the Repository (UI seam only)');
check(!/confirm\s*\(|payrollPlansForContract/.test(tcCode), 'committed-payroll confirmation remains outside the handler (UI seam only)');
// The Repository contract itself is UNCHANGED by PR-10B (no contract evolution, no new module).
check(/async save\(\)/.test(contractRepoSrc) && (contractRepoCode.match(/async \w+\(/g)||[]).length === 1, 'ContractRepository still exposes exactly one method (save) — contract unchanged');
check(/ok === true/.test(contractRepoCode) && /ok:\s*false,\s*error:\s*'PersistFailed'/.test(contractRepoCode), 'ContractRepository result contract remains { ok:true } / { ok:false, error:"PersistFailed" }');
check(!/ContractRepository/.test(poeSrc), 'payroll ops engine has no ContractRepository dependency (repositories stay independent)');
// Operational + registered surface UNCHANGED by PR-10B.
check(aggregateDefs === 8 && migratedCmdIds.length === 8 && migratedQueryIds.length === 1 && allCmdIds.length === 14 && allQryIds.length === 4, 'operational + registered surface unchanged by the contract status slice');

// PR-11A "The Payroll Foundation" — the THIRD entity Repository (PayrollRepository),
// completing aggregate-backed Repository adoption (7 of 7) across Employee, Contract,
// and Payroll. Introduced on one bounded slice (payroll.lifecycle.transition).
// Persistence mechanics only; the handler keeps validation/mutation/updatedAt/history/
// rollback AND the Payroll-specific best-effort post-persistence audit.
console.log('== PAYROLL REPOSITORY (PR-11A — third entity repository, adoption complete) ==');
const payrollRepoPath = path.join(root,'js','repository','payroll-repository.js');
check(fs.existsSync(payrollRepoPath), 'repository module present: js/repository/payroll-repository.js');
check(jsFiles.indexOf('repository/payroll-repository.js') !== -1, 'module-order.js includes repository/payroll-repository.js');
check(indexHtml.includes('<script src="js/repository/payroll-repository.js"></script>'), 'index.html includes repository/payroll-repository.js');
// Load order: AFTER the persist infrastructure it delegates to, and BEFORE the migrated handler.
check(jsFiles.indexOf('core/hr-persistence-portability.js') < jsFiles.indexOf('repository/payroll-repository.js') &&
      jsFiles.indexOf('repository/payroll-repository.js') < jsFiles.indexOf('people/payroll-ops-engine.js'), 'payroll repository loads after hr-persistence-portability.js and before people/payroll-ops-engine.js');
const payrollRepoSrc = read(payrollRepoPath);
const payrollRepoCode = stripComments(payrollRepoSrc);
check(/const PayrollRepository = Object\.freeze\(\{/.test(payrollRepoSrc), 'PayrollRepository is a frozen object');
check(/async save\(\)/.test(payrollRepoSrc) && (payrollRepoCode.match(/async \w+\(/g)||[]).length === 1, 'PayrollRepository exposes exactly one method (async save)');
check(dist.includes('const PayrollRepository') && dist.includes('window.PayrollRepository = PayrollRepository'), 'PayrollRepository present and exposed in dist');
// DELEGATION — the repository delegates persistence to the EXISTING persistPayrollPlans() only.
check(/await persistPayrollPlans\(\)/.test(payrollRepoCode) && (payrollRepoCode.match(/persistPayrollPlans\(/g)||[]).length === 1, 'PayrollRepository delegates persistence to the existing persistPayrollPlans() exactly once');
check(!/persistEmployees\(|persistContracts\(|persistMonthlyPlans\(|persistOvertime\(|persist\(\)/.test(payrollRepoCode), 'PayrollRepository writes no other store (no compound persistence)');
// RESULT CONTRACT — strict, identical to the two existing repositories (no contract evolution).
check(/ok:\s*true/.test(payrollRepoCode) && /ok:\s*false,\s*error:\s*'PersistFailed'/.test(payrollRepoCode) && /ok === true/.test(payrollRepoCode), 'PayrollRepository normalizes the strict boolean into { ok:true } / { ok:false, error:"PersistFailed" }');
// REPOSITORY PURITY — persistence mechanics ONLY (audit explicitly included).
[['State access', /State\s*[.[]/],
 ['field mutation', /\bpp\.\w+\s*=|\.updatedAt\s*=|\.status\s*=/],
 ['history creation', /\.history\b|\.push\(/],
 ['rollback', /rollback|\.pop\(/],
 ['validation', /Invalid|isPayrollLocked|Locked|Immutable|TRANSITIONS/],
 ['audit', /logActivity\s*\(|payrollAuditType\s*\(/],
 ['UI render', /\brender\s*\(|innerHTML|toast\s*\(|showSuccess\s*\(|showWarning\s*\(/],
 ['Domain call', /\bDomain\s*[.[]/],
 ['aggregate call', /\w+Aggregate\s*[.[]/],
 ['direct storage bypass', /localStorage|window\.storage|StorageAdapter\s*[.[]/],
 ['other-entity persistence', /persistEmployees\(|persistContracts\(/]
].forEach(([label,re])=>check(!re.test(payrollRepoCode), 'PayrollRepository never performs '+label));
// No generic Repository / factory / base class / transaction abstraction.
check(!/class\s+\w*Repository|createRepository|RepositoryFactory|extends\s+\w+|transaction/i.test(payrollRepoCode), 'PayrollRepository introduces no generic repository, factory, base class, or transaction abstraction');
// HANDLER MIGRATION — exactly one Repository call, no direct persist, strict handling.
check((tpCode.match(/PayrollRepository\.save\(\)/g)||[]).length === 1, 'transitionPayrollLifecycle() uses exactly one PayrollRepository.save()');
check(!/persistPayrollPlans\(/.test(tpCode), 'transitionPayrollLifecycle() contains no direct persistPayrollPlans()');
check(/persisted\.ok !== true/.test(tpCode), 'payroll-lifecycle handler uses strict persisted.ok handling (no truthy/falsy ambiguity)');
// ROLLBACK remains HANDLER-owned (the repository does not roll back).
check(/pp\.status = prevStatus/.test(tpCode) && /pp\.history\.pop\(\)/.test(tpCode) && /pp\.updatedAt = prevUpdatedAt/.test(tpCode), 'payroll-lifecycle handler still owns full rollback (status + history.pop + updatedAt)');
check(/error:'PersistFailed'/.test(tpCode), 'payroll-lifecycle handler preserves the typed PersistFailed result');
// AUDIT INVARIANT (Payroll-specific — deliberately NOT the Contract "no audit" rule).
check(/logActivity\(/.test(tpCode), 'the best-effort audit remains inside transitionPayrollLifecycle()');
check((tpCode.match(/logActivity\(/g)||[]).length === 1, 'exactly one audit call in the payroll-lifecycle handler (no duplicate audit)');
check(/PayrollRepository\.save\(\)[\s\S]*?return \{ success:false, error:'PersistFailed' \}[\s\S]*?logActivity\(/.test(tpCode), 'the audit occurs AFTER successful Repository persistence (below the PersistFailed return)');
check(/try \{[\s\S]*?logActivity\([\s\S]*?\} catch/.test(tpCode), 'the audit remains try/catch-wrapped (best-effort; never alters the result)');
// The failure path spans the rollback through the PersistFailed return; no audit may appear inside it.
const tpFailStart = tpCode.indexOf('persisted.ok !== true');
const tpFailEnd = tpCode.indexOf("return { success:false, error:'PersistFailed' }");
const tpFailPath = (tpFailStart !== -1 && tpFailEnd > tpFailStart) ? tpCode.slice(tpFailStart, tpFailEnd) : '';
check(tpFailPath !== '' && !/logActivity\(/.test(tpFailPath), 'the audit is absent from the rollback/failure path (no audit between the failure branch and the PersistFailed return)');
check(!/logActivity\(/.test(payrollRepoCode), 'the audit stays OUTSIDE PayrollRepository');
// FENCED — every other persistPayrollPlans() call site remains DIRECT and unchanged.
const poeCode = stripComments(poeSrc);
check((poeCode.match(/persistPayrollPlans\(\)/g)||[]).length === 4, 'the four non-aggregate payroll-ops persistence sites remain direct (override clear/set, regeneration, compound posting)');
check(/steps\.push\(\['payrollPlans',\s+await persistPayrollPlans\(\)\]\);[\s\S]{0,400}steps\.push\(\['monthlyPlans',\s+await persistMonthlyPlans\(\)\]\);[\s\S]{0,400}steps\.push\(\['overtime',\s+await persistOvertime\(\)\]\);[\s\S]{0,400}steps\.push\(\['transactions',\s+await persist\(\)\]\);/.test(poeSrc), 'commitReadyPayroll compound posting remains direct and compound (4 stores, unchanged order)');
const planSrc = read(path.join(root,'js','people','payroll-planning.js'));
check(!/await persistPayrollPlans\(\)/.test(planSrc) && !/PayrollRepository/.test(planSrc), 'payroll-planning performs NO persistence at all (SPR-078 — posting path retired, not migrated)');
const wsSrc = read(path.join(root,'js','people','payroll-workspace.js'));
check(/await persistPayrollPlans\(\)/.test(wsSrc) && !/PayrollRepository/.test(wsSrc), 'payroll generation (payroll-workspace) remains direct (not migrated)');
check(/if\(touched\) await persistPayrollPlans\(\)/.test(read(path.join(root,'js','core','hr-persistence-portability.js'))), 'the v2.5 schema migration persistence remains direct (not migrated)');
// Repositories stay INDEPENDENT and one-way.
check(!/PayrollRepository/.test(repoSrc) && !/PayrollRepository/.test(contractRepoSrc), 'Employee/Contract repositories have no dependency on PayrollRepository (independent)');
check(!/PayrollRepository|payroll-repository/.test(facSrc), 'domain-layer.js has no dependency on the payroll repository (one-way)');
check(!/PayrollRepository|payroll-repository/.test(storageSrc), 'StorageAdapter has no dependency on the payroll repository (one-way)');
// ADOPTION — 4 (Employee) + 2 (Contract) + 1 (Payroll) = 7 of 7 aggregate-backed handlers.
check((stripComments(empSrc).match(/EmployeeRepository\.save\(\)/g)||[]).length === 4, 'Employee Repository adoption remains 4 of 4');
check((stripComments(ctSrc).match(/ContractRepository\.save\(\)/g)||[]).length === 3, 'Contract Repository adoption is 3 of 3');
check((poeCode.match(/PayrollRepository\.save\(\)/g)||[]).length === 1, 'Payroll Repository adoption becomes 1 of 1');
check(((stripComments(empSrc).match(/EmployeeRepository\.save\(\)/g)||[]).length +
       (stripComments(ctSrc).match(/ContractRepository\.save\(\)/g)||[]).length +
       (poeCode.match(/PayrollRepository\.save\(\)/g)||[]).length) === 8, 'overall aggregate-backed Repository adoption is 8 of 8 (aggregate-backed handlers only — NOT all persistence, NOT compound, NOT backend readiness)');
check(fs.readdirSync(path.join(root,'js','repository')).length === 3, 'exactly three Repository modules (Employee + Contract + Payroll); no generic repository added');
// Existing Repository contracts are UNCHANGED by PR-11A.
check(/async save\(\)/.test(contractRepoSrc) && (contractRepoCode.match(/async \w+\(/g)||[]).length === 1, 'ContractRepository contract unchanged by PR-11A');
check(/async save\(\)/.test(repoSrc) && (stripComments(repoSrc).match(/async \w+\(/g)||[]).length === 1, 'EmployeeRepository contract unchanged by PR-11A');
// Operational + registered surface UNCHANGED by PR-11A.
check(aggregateDefs === 8 && migratedCmdIds.length === 8 && migratedQueryIds.length === 1 && allCmdIds.length === 14 && allQryIds.length === 4, 'operational + registered surface unchanged by the payroll repository slice');

// ============================================================
// ARCHITECTURAL MILESTONE — AGGREGATE-BACKED REPOSITORY ADOPTION COMPLETE (7 of 7).
// This section locks ONE claim: every aggregate-backed handler delegates persistence
// through an entity-named Repository. It deliberately does NOT assert — and must never
// be read as asserting — complete persistence abstraction, compound-persistence
// support, multi-store transactions, or backend readiness. The paired assertions below
// prove the boundary by ALSO pinning the non-aggregate and compound paths as DIRECT:
// adoption completeness and persistence abstraction are different things, and the
// second is explicitly NOT claimed. See the DESIGN NOTE in payroll-repository.js.
// ============================================================
console.log('== AGGREGATE-BACKED REPOSITORY ADOPTION MILESTONE (8 of 8 — bounded claim) ==');
const empCode2 = stripComments(empSrc), ctCode2 = stripComments(ctSrc);
const adoption = {
  Employee: (empCode2.match(/EmployeeRepository\.save\(\)/g)||[]).length,
  Contract: (ctCode2.match(/ContractRepository\.save\(\)/g)||[]).length,
  Payroll:  (poeCode.match(/PayrollRepository\.save\(\)/g)||[]).length
};
// (a) THE MILESTONE: all seven aggregate-backed handlers are Repository-mediated.
check(adoption.Employee === 4 && adoption.Contract === 3 && adoption.Payroll === 1 &&
      (adoption.Employee + adoption.Contract + adoption.Payroll) === 8,
      'MILESTONE: all eight aggregate-backed handlers are Repository-mediated through entity-named repositories (Employee 4 + Contract 3 + Payroll 1 = 8 of 8)');
check(migratedCmdIds.length === 8, 'the milestone count matches the eight aggregate-backed commands routed through the seam');
check(fs.readdirSync(path.join(root,'js','repository')).length === 3, 'exactly three entity-named repositories back the milestone (no generic repository)');
// (b) THE BOUND: non-aggregate paths remain DIRECT — adoption completeness is NOT
//     persistence abstraction. Each entity keeps direct collection writes.
check((empCode2.match(/await persistEmployees\(\)/g)||[]).length >= 1, 'non-aggregate Employee paths remain direct (persistEmployees still called directly in employees.js)');
check((ctCode2.match(/await persistContracts\(\)/g)||[]).length === 2, 'non-aggregate Contract paths remain direct (full editor + delete only — renewal migrated by SPR-077)');
check((poeCode.match(/persistPayrollPlans\(\)/g)||[]).length === 4, 'non-aggregate Payroll paths remain direct (override set/clear, regeneration, compound posting)');
check(/await persistPayrollPlans\(\)/.test(wsSrc) && !/PayrollRepository/.test(wsSrc), 'non-aggregate Payroll generation remains direct (payroll-workspace.js)');
// (c) THE BOUND: compound multi-store paths remain DIRECT and unexpressible in the contract.
check(/renewedToId = nc\.id;[\s\S]{0,900}ContractRepository\.save\(\)/.test(ctSrc), 'Contract renewal create-successor is Repository-mediated in ONE collection write (SPR-077 — not compound)');
check(/steps\.push\(\['payrollPlans',\s+await persistPayrollPlans\(\)\]\);[\s\S]{0,400}steps\.push\(\['monthlyPlans',\s+await persistMonthlyPlans\(\)\]\);[\s\S]{0,400}steps\.push\(\['overtime',\s+await persistOvertime\(\)\]\);[\s\S]{0,400}steps\.push\(\['transactions',\s+await persist\(\)\]\);/.test(poeSrc), 'compound Payroll posting remains direct (commitReadyPayroll — four stores in one operation)');
check(!/persist/.test(planSrc), 'the second compound Payroll posting path no longer exists (SPR-078 retired payroll-planning posting)');
// (d) THE DISCLAIMER, mechanically enforced: the Repository layer mediates only a
//     MINORITY of the collection persist functions. 7 of 7 is adoption, not coverage.
const hrPersistSrc = read(path.join(root,'js','core','hr-persistence-portability.js'));
const persistFnCount = (hrPersistSrc.match(/^async function persist\w*\(/gm)||[]).length;
check(persistFnCount > 3, 'persistence abstraction is NOT complete: the repository layer mediates 3 collections out of '+persistFnCount+' persist functions (adoption completeness != persistence abstraction)');
// (e) No repository may imply a backend or a transaction boundary.
[['employee-repository.js', repoSrc], ['contract-repository.js', contractRepoSrc], ['payroll-repository.js', payrollRepoSrc]].forEach(([name, src])=>{
  const code = stripComments(src);
  check(!/fetch\s*\(|XMLHttpRequest|WebSocket|axios|\bapi\b|endpoint|server|http/i.test(code), name+' implies no backend (no network/remote surface)');
  check(!/transaction|unitOfWork|commit\s*\(|rollback\s*\(/i.test(code), name+' implies no transaction/unit-of-work abstraction');
});

// PR-8B "The CLI" — the first NON-BROWSER ingress. It proves the canonical Platform
// contract is transport-agnostic: a CLI reaches the Domain through TransportAdapter
// with NO change to Domain/Aggregates/Handlers/Repository/Platform/StorageAdapter.
// Read-only this sprint (employee.filtered only); it delegates SOLELY to the Transport.
console.log('== CLI TRANSPORT (PR-8B — first non-browser ingress, read-only) ==');
const cliPath = path.join(root,'js','cli','cli.js');
check(fs.existsSync(cliPath), 'CLI module present: js/cli/cli.js');
const cliSrc = read(cliPath);
const cliCode = stripComments(cliSrc);
// The CLI is a Node ingress — it is NOT part of the browser build (module-order / dist).
check(jsFiles.indexOf('cli/cli.js') === -1, 'CLI is not in the browser module-order (Node-only ingress)');
check(!dist.includes('js/cli/cli.js') && !indexHtml.includes('js/cli/cli.js'), 'CLI is not loaded by index.html / dist (does not touch the browser build)');
// DELEGATION — the CLI delegates ONLY through the Transport Adapter.
check(/TransportAdapter\.execute\(/.test(cliCode), 'CLI delegates through TransportAdapter.execute()');
check(!/ApplicationGateway/.test(cliCode), 'CLI performs no direct Application Gateway access');
check(!/\bDomain\s*[.[]|domain\.(command|query)/.test(cliCode), 'CLI performs no direct Domain access');
check(!/\w+Aggregate\s*[.[]/.test(cliCode), 'CLI performs no direct Aggregate access');
check(!/updateEmployeeContact\(|employeesFiltered\(|transitionContractStatus\(/.test(cliCode), 'CLI performs no direct Handler access');
check(!/EmployeeRepository|repository\//.test(cliCode), 'CLI performs no direct Repository access');
// NO PERSISTENCE — the CLI never calls a persist function or the storage backend.
check(!/persistEmployees\(|persistHR\(|persist\(\)|StorageAdapter\.(set|remove)\(/.test(cliCode), 'CLI performs no persistence (no persist*/StorageAdapter writes)');
// READ-ONLY SCOPE — only the aggregate-backed query employee.filtered is permitted; commands are rejected.
check(/CLI_ALLOWED_QUERIES\s*=\s*\['employee\.filtered'\]/.test(cliCode), 'CLI read-only allowlist is exactly [employee.filtered]');
check(/kind !== 'query'/.test(cliCode), 'CLI rejects any non-query kind (no command / no write execution)');
// It reproduces the browser load order but EXCLUDES the only DOM-executing load-time module.
check(/!==\s*'core\/app-bootstrap\.js'/.test(cliCode), 'CLI runtime excludes core/app-bootstrap.js (the only DOM-executing load-time module)');
// The CLI classifies ONLY its own two failure modes (source:'cli'); Platform responses pass through.
check(/source:\s*'cli'/.test(cliCode) && /INVALID_CLI_INVOCATION/.test(cliCode) && /INVALID_CLI_ARGUMENTS/.test(cliCode), 'CLI classifies only INVALID_CLI_INVOCATION / INVALID_CLI_ARGUMENTS under { source:"cli" }');
check(!/DOMAIN_FAULT|source:\s*'gateway'|source:\s*'domain'|source:\s*'transport'/.test(cliCode), 'CLI does not mint Platform error sources (Platform responses are returned verbatim)');
// CLI ⇏ Browser UI (FAA-PR8B) — the CLI must NEVER evolve into a second UI layer.
// It performs no rendering and invokes no browser UI entry point. The loadRuntime()
// inert stubs name `window`/`document` only as loader plumbing for the classic
// shared-global scripts (see the FAA-PR8B design note in cli.js); those identifiers
// are never USED to render or to reach a real DOM — so the invariant is usage-based.
check(!/\brender\w*\s*\(|\btoast\s*\(|showWarning\s*\(|showSuccess\s*\(|openModal\w*\s*\(|closeModal\s*\(/.test(cliCode), 'CLI invokes no browser UI / rendering entry point (render/toast/modal)');
check(!/\bshell\b|renderShell|hrNavTo\s*\(|State\.view\s*=|\.innerHTML/.test(cliCode), 'CLI performs no shell/navigation/DOM rendering (CLI is not a UI layer)');
check(!/document\.(getElementById|querySelector|querySelectorAll|createElement|write)\s*\(|window\.(location|open)\b/.test(cliCode), 'CLI makes no real DOM/browser-UI calls (inert loader stubs only, never used to render)');
// Operational surface is UNCHANGED by PR-8B (a new ingress adds no Domain operation).
check(aggregateDefs === 8 && migratedCmdIds.length === 8 && migratedQueryIds.length === 1 && allCmdIds.length === 14 && allQryIds.length === 4, 'operational surface unchanged by the CLI (8 aggregates / 8 aggregate-backed commands / 1 query; 14 registered / 4 registered)');

console.log('');
if (fails.length === 0) { console.log('VERIFICATION PASSED -- ' + passes + ' checks OK.'); process.exit(0); }
console.log('VERIFICATION FAILED -- ' + passes + ' passed, ' + fails.length + ' failed:');
fails.forEach((f)=>console.log('   - ' + f));
process.exit(1);
