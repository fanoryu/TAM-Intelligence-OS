#!/usr/bin/env node
'use strict';
/* ============================================================
   UX-003A — CONTRACT TIMELINE (REFERENCE-DATE) RUNTIME VERIFICATION
   ------------------------------------------------------------
   tools/verify-build.js proves the SHAPE of the reference-date fix (that
   daysUntilEnd is not derived from isoToday() inside contractCalc(), and that
   contractEffectiveStatus() introduces no second time source). This harness
   proves its BEHAVIOR by executing the REAL production modules.

   THE DEFECT (pre-UX-003A):
     out.daysUntilEnd = daysBetween(isoToday(), out.endDate);
   Every other field contractCalc() derives — progress, coversMonth,
   expiredForRef, beforeStart — is measured against refKey. daysUntilEnd was
   measured against today, so one return object answered two different
   questions. contractEffectiveStatus() reads daysUntilEnd for its "Expiring
   Soon" branch, so the derived status was a today/refKey hybrid: a contract
   evaluated for a month it genuinely covered could report "Expiring Soon" with
   a NEGATIVE days-remaining value.

   THE MODEL (post-UX-003A):
     reference month == current month, or refKey omitted -> isoToday()
     any other reference month                           -> that month's 1st day
     unusable key (null / malformed / month outside 1-12)-> isoToday() (locked)

   WHAT THIS HARNESS DOES NOT CLAIM:
     It does not claim the fix changes any monetary value — it proves the
     OPPOSITE (families G and H). No Scheduled state, expiry band, counter
     change, or presentation change is introduced or asserted by UX-003A.

   It reproduces the browser's single shared global scope in a Node `vm`
   context using the same loader technique as js/cli/cli.js (EXCLUDING
   core/app-bootstrap.js, the only DOM-executing load-time module).

   All fixture data is obviously fabricated. Nothing is written to disk, no real
   company data is used, no process is spawned, and no repository file is
   modified.

   Fixture families:
     A  today-equivalence invariant (omitted == explicit current month)
     B  historical refKey BEFORE contract start
     C  historical refKey DURING the contract
     D  historical refKey AFTER contract end
     E  far-past and far-future reference keys
     F  boundaries: duration 1, invalid duration, month end, year boundary, leap year
     G  warning boundary: warn-1 / warn / warn+1
     H  malformed and null refKey (locked pre-UX-003A fallback)
     I  payroll safety: eligibility, generated values, committed rows, monthly plan
     J  historical advisory: payrollHealth() coherence
   ============================================================ */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

let passed = 0; const failures = [];
function check(cond, label){
  if(cond){ passed++; console.log('  [PASS] ' + label); }
  else { failures.push(label); console.log('  [FAIL] ' + label); }
}

// ---------- runtime loader (same technique as js/cli/cli.js) ----------
function loadRuntime(){
  const root = path.resolve(__dirname, '..');
  const jsFiles = require(path.join(root,'tools','module-order.js')).filter(f => f !== 'core/app-bootstrap.js');
  const src = jsFiles.map(f => fs.readFileSync(path.join(root,'js',f),'utf8')).join('\n')
    + '\n;window.__TAM__ = { State: State, contractCalc: contractCalc,'
    + ' contractEffectiveStatus: contractEffectiveStatus, contractRefDate: contractRefDate,'
    + ' coveringContract: coveringContract, activeContractToday: activeContractToday,'
    + ' payrollExclusionReason: payrollExclusionReason, generatePayrollForMonth: generatePayrollForMonth,'
    + ' payrollHealth: payrollHealth, computePayrollPlanned: computePayrollPlanned,'
    + ' isoToday: isoToday, todayKey: todayKey, daysBetween: daysBetween };';
  const noop = function(){};
  const memStore = {};
  const memStorage = {
    getItem: (k)=> Object.prototype.hasOwnProperty.call(memStore,k) ? memStore[k] : null,
    setItem: (k,v)=>{ memStore[k] = String(v); },
    removeItem: (k)=>{ delete memStore[k]; }
  };
  const el = () => ({ style:{}, dataset:{}, className:'', textContent:'', innerHTML:'',
    addEventListener:noop, removeEventListener:noop, appendChild:noop, setAttribute:noop,
    remove:noop, querySelector:()=>null, querySelectorAll:()=>[] });
  const sandbox = {
    console: { log:noop, warn:noop, error:noop }, navigator: { userAgent:'tam-ux003a' },
    setTimeout: setTimeout, clearTimeout: clearTimeout,
    localStorage: memStorage, storage: undefined,
    addEventListener: noop, removeEventListener: noop,
    matchMedia: ()=>({ matches:false, addEventListener:noop, addListener:noop }),
    document: { addEventListener:noop, removeEventListener:noop, getElementById:()=>el(), querySelector:()=>null, querySelectorAll:()=>[], createElement:()=>el(), body:{ appendChild:noop }, documentElement:{ dataset:{} } }
  };
  sandbox.window = sandbox; sandbox.self = sandbox; sandbox.globalThis = sandbox;
  vm.runInContext(src, vm.createContext(sandbox), { filename: 'tam-ux003a-runtime.js' });
  const rt = sandbox.__TAM__;
  rt.memStore = memStore; rt.sandbox = sandbox;
  return rt;
}

const RT = loadRuntime();
const { State, contractCalc, contractEffectiveStatus, contractRefDate,
        coveringContract, payrollExclusionReason, generatePayrollForMonth,
        payrollHealth, isoToday, todayKey, daysBetween } = RT;

// ---------- fabricated fixture helpers ----------
let seq = 0;
function ct(startDate, durationMonths, opts){
  seq++;
  return Object.assign({ id:'ct-fix-'+seq, employeeId:'emp-fix-1', employeeName:'Fixture Person '+seq,
    contractNumber:'CT-FIX-'+String(seq).padStart(3,'0'), startDate, durationMonths,
    monthlySalary: 10000000, status:'Active', notes:'' }, opts||{});
}
// Month-key arithmetic mirrored locally so the harness never depends on
// production helpers to state its OWN expectations.
function addMonths(key, n){
  const y=+key.slice(0,4), m=+key.slice(5,7);
  const abs = y*12 + (m-1) + n;
  return `${Math.floor(abs/12)}-${String((abs%12)+1).padStart(2,'0')}`;
}
function firstDayOf(key){ return key + '-01'; }
function lastDayOfEnd(startDate, dur){
  const sy=+startDate.slice(0,4), sm=+startDate.slice(5,7);
  const d = new Date(sy, (sm-1)+dur, 0);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function sameCalc(a, b){
  return JSON.stringify(a) === JSON.stringify(b);
}

const TODAY = isoToday();
const TODAY_KEY = todayKey();

console.log('== UX-003A CONTRACT TIMELINE — REFERENCE-DATE RUNTIME VERIFICATION ==');
console.log('   (frozen inputs; reference "today" for this run is ' + TODAY + ')');

/* ============================================================
   FAMILY A — TODAY-EQUIVALENCE INVARIANT
   The whole fix is worthless if it moves today-evaluated behaviour. An
   omitted refKey and an explicitly-passed current month key must produce
   byte-identical output for every contract shape.
   ============================================================ */
console.log('-- A. today-equivalence invariant --');
const aFixtures = [
  ct(addMonths(TODAY_KEY,-6)+'-01', 12),                 // mid-term today
  ct(addMonths(TODAY_KEY,-24)+'-01', 12),                // long expired
  ct(addMonths(TODAY_KEY,6)+'-01', 12),                  // not yet started
  ct(addMonths(TODAY_KEY,-11)+'-01', 12),                // final month today
  ct(TODAY_KEY+'-01', 1),                                // single-month, this month
  ct(addMonths(TODAY_KEY,-3)+'-15', 6, {status:'Draft'}),
  ct(addMonths(TODAY_KEY,-3)+'-15', 6, {status:'Renewed'}),
  ct(addMonths(TODAY_KEY,-3)+'-15', 6, {status:'Cancelled'})
];
aFixtures.forEach((c,i)=>{
  const omitted = contractCalc(c);
  const explicit = contractCalc(c, TODAY_KEY);
  check(sameCalc(omitted, explicit),
    `A${i+1}. contractCalc: omitted refKey === explicit current month (all fields identical)`);
});
aFixtures.forEach((c,i)=>{
  check(contractEffectiveStatus(c) === contractEffectiveStatus(c, TODAY_KEY),
    `A${i+1}. contractEffectiveStatus: omitted refKey === explicit current month`);
});
// The reference date resolver itself
check(contractRefDate(undefined) === TODAY, 'A9. contractRefDate(undefined) === isoToday()');
check(contractRefDate(null) === TODAY, 'A10. contractRefDate(null) === isoToday()');
check(contractRefDate(TODAY_KEY) === TODAY, 'A11. contractRefDate(current month) === isoToday() (not the 1st)');
// Today-evaluated daysUntilEnd is still measured from today, exactly as before.
const aMid = aFixtures[0];
check(contractCalc(aMid).daysUntilEnd === daysBetween(TODAY, lastDayOfEnd(aMid.startDate, aMid.durationMonths)),
  'A12. today-evaluated daysUntilEnd is still measured from isoToday() (pre-UX-003A value preserved)');

/* ============================================================
   FAMILY B — HISTORICAL refKey BEFORE CONTRACT START
   ============================================================ */
console.log('-- B. historical refKey before contract start --');
// Contract runs 2025-06 .. 2026-05. Evaluate at 2025-01 (5 months before start).
const bC = ct('2025-06-01', 12);
const bRef = '2025-01';
const bCalc = contractCalc(bC, bRef);
check(bCalc.beforeStart === true, 'B1. beforeStart === true for a pre-start reference month');
check(bCalc.coversMonth === false, 'B2. coversMonth === false before start');
check(bCalc.expiredForRef === false, 'B3. expiredForRef === false before start');
check(bCalc.progress === '0/12', 'B4. progress is 0/N before start');
check(bCalc.daysUntilEnd > 0, 'B5. daysUntilEnd is POSITIVE before start');
check(bCalc.daysUntilEnd === daysBetween(firstDayOf(bRef), lastDayOfEnd('2025-06-01',12)),
  'B6. daysUntilEnd is measured from the reference month, not from today (no hybrid result)');
check(bCalc.daysUntilEnd !== daysBetween(TODAY, lastDayOfEnd('2025-06-01',12)),
  'B7. daysUntilEnd is NOT the today-based value (the pre-UX-003A defect is gone)');

/* ============================================================
   FAMILY C — HISTORICAL refKey DURING THE CONTRACT
   This is the family that reproduced the original defect: a contract
   evaluated for a month it genuinely covered reported "Expiring Soon"
   with a negative days-remaining value.
   ============================================================ */
console.log('-- C. historical refKey during the contract --');
// Contract runs 2025-01 .. 2025-12 (long finished relative to any later today).
const cC = ct('2025-01-15', 12);
const cEnd = lastDayOfEnd('2025-01-15', 12);
[['2025-03', 3], ['2025-06', 6], ['2025-11', 11], ['2025-12', 12]].forEach(([ref, month], i)=>{
  const cc = contractCalc(cC, ref);
  check(cc.coversMonth === true, `C${i+1}a. ref=${ref} coversMonth === true`);
  check(cc.expiredForRef === false, `C${i+1}b. ref=${ref} expiredForRef === false`);
  check(cc.progress === month+'/12', `C${i+1}c. ref=${ref} progress === ${month}/12`);
  check(cc.daysUntilEnd === daysBetween(firstDayOf(ref), cEnd),
    `C${i+1}d. ref=${ref} daysUntilEnd measured from that historical reference`);
  check(cc.daysUntilEnd >= 0, `C${i+1}e. ref=${ref} daysUntilEnd is NOT negative while the contract is running`);
});
// The exact regression: mid-term historical evaluation must not read "Expiring Soon".
check(contractEffectiveStatus(cC, '2025-03') === 'Active',
  'C5. a mid-term historical month reports Active, not Expiring Soon (the original defect)');
// Internal coherence: coversMonth <=> daysUntilEnd >= 0.
check(contractCalc(cC,'2025-06').coversMonth === (contractCalc(cC,'2025-06').daysUntilEnd >= 0),
  'C6. coversMonth <=> daysUntilEnd >= 0 (one coherent time basis)');

/* ============================================================
   FAMILY D — HISTORICAL refKey AFTER CONTRACT END
   ============================================================ */
console.log('-- D. historical refKey after contract end --');
const dRef = '2026-03';   // after the 2025-01..2025-12 contract
const dCalc = contractCalc(cC, dRef);
check(dCalc.expiredForRef === true, 'D1. expiredForRef === true after contract end');
check(dCalc.coversMonth === false, 'D2. coversMonth === false after end');
check(dCalc.beforeStart === false, 'D3. beforeStart === false after end');
check(dCalc.daysUntilEnd < 0, 'D4. daysUntilEnd is NEGATIVE after contract end');
check(dCalc.daysUntilEnd === daysBetween(firstDayOf(dRef), cEnd),
  'D5. negative daysUntilEnd measured from the reference month');
check(contractEffectiveStatus(cC, dRef) === 'Expired',
  'D6. status is Expired for a post-end reference month');
check(dCalc.expiredForRef === (dCalc.daysUntilEnd < 0),
  'D7. expiredForRef <=> daysUntilEnd < 0 (one coherent time basis)');

/* ============================================================
   FAMILY E — FAR PAST AND FAR FUTURE REFERENCE KEYS
   ============================================================ */
console.log('-- E. far-past and far-future reference keys --');
const eFar = ct('2025-01-01', 12);
const eEnd = lastDayOfEnd('2025-01-01', 12);
const eFarPast = contractCalc(eFar, '1975-01');
check(eFarPast.beforeStart === true, 'E1. far-past reference: beforeStart === true');
check(eFarPast.daysUntilEnd === daysBetween('1975-01-01', eEnd), 'E2. far-past reference: daysUntilEnd from 1975-01-01');
check(eFarPast.daysUntilEnd > 18000, 'E3. far-past reference produces a large positive distance');
const eFarFuture = contractCalc(eFar, '2199-12');
check(eFarFuture.expiredForRef === true, 'E4. far-future reference: expiredForRef === true');
check(eFarFuture.daysUntilEnd === daysBetween('2199-12-01', eEnd), 'E5. far-future reference: daysUntilEnd from 2199-12-01');
check(eFarFuture.daysUntilEnd < -60000, 'E6. far-future reference produces a large negative distance');

/* ============================================================
   FAMILY F — BOUNDARY CASES
   ============================================================ */
console.log('-- F. boundaries: duration, month end, year boundary, leap year --');
// duration 1 month
const f1 = ct('2025-05-01', 1);
check(contractCalc(f1,'2025-05').coversMonth === true, 'F1. duration 1: its own month is covered');
check(contractCalc(f1,'2025-05').progress === '1/1', 'F2. duration 1: progress 1/1');
check(contractCalc(f1,'2025-05').daysUntilEnd === daysBetween('2025-05-01','2025-05-31'), 'F3. duration 1: daysUntilEnd spans its own month');
check(contractCalc(f1,'2025-06').expiredForRef === true, 'F4. duration 1: the next month is expired');
check(contractCalc(f1,'2025-06').daysUntilEnd < 0, 'F5. duration 1: next month gives a negative distance');
// invalid duration — production behaviour is "invalid": valid=false, daysUntilEnd stays null
const f0 = ct('2025-05-01', 0);
check(contractCalc(f0,'2025-05').valid === false, 'F6. duration 0: valid === false (unchanged production behaviour)');
check(contractCalc(f0,'2025-05').daysUntilEnd === null, 'F7. duration 0: daysUntilEnd stays null (never computed)');
const fNoStart = ct(null, 12);
check(contractCalc(fNoStart,'2025-05').valid === false, 'F8. missing startDate: valid === false');
check(contractCalc(fNoStart,'2025-05').daysUntilEnd === null, 'F9. missing startDate: daysUntilEnd stays null');
// month end — a 31st start still derives the last covered calendar day
const fEnd = ct('2025-01-31', 2);
check(contractCalc(fEnd,'2025-01').endDate === '2025-02-28', 'F10. month-end start: endDate is the last covered calendar day');
check(contractCalc(fEnd,'2025-01').daysUntilEnd === daysBetween('2025-01-01','2025-02-28'), 'F11. month-end start: daysUntilEnd from the reference month');
// year boundary
const fYear = ct('2025-11-01', 4);   // 2025-11 .. 2026-02
check(contractCalc(fYear,'2025-12').coversMonth === true, 'F12. year boundary: December is covered');
check(contractCalc(fYear,'2026-01').coversMonth === true, 'F13. year boundary: January of the next year is covered');
check(contractCalc(fYear,'2026-03').expiredForRef === true, 'F14. year boundary: March of the next year is expired');
check(contractCalc(fYear,'2026-01').daysUntilEnd === daysBetween('2026-01-01','2026-02-28'), 'F15. year boundary: daysUntilEnd crosses the year correctly');
// leap year — 2024 is a leap year; February has 29 days
const fLeap = ct('2024-01-01', 2);
check(contractCalc(fLeap,'2024-01').endDate === '2024-02-29', 'F16. leap year: endDate is 2024-02-29');
check(contractCalc(fLeap,'2024-01').daysUntilEnd === daysBetween('2024-01-01','2024-02-29'), 'F17. leap year: daysUntilEnd counts the leap day');
check(contractCalc(fLeap,'2024-02').daysUntilEnd === daysBetween('2024-02-01','2024-02-29'), 'F18. leap year: February reference resolves to 2024-02-01');
const fLeapStart = ct('2024-02-29', 12);
check(contractCalc(fLeapStart,'2024-02').coversMonth === true, 'F19. leap-day start: its own month is covered');
check(contractCalc(fLeapStart,'2024-02').endDate === '2025-01-31', 'F20. leap-day start: endDate derived from the start MONTH, not the day');

/* ============================================================
   FAMILY G — WARNING BOUNDARY (warn-1 / warn / warn+1)
   The Expiring Soon threshold is "<= warn". UX-003A does not change that
   meaning; it only changes which date the distance is measured from. These
   assertions lock the boundary so a later sprint cannot drift it silently.
   ============================================================ */
console.log('-- G. Expiring Soon warning boundary --');
const gWarnDefault = Number(State.settings.contractExpiryWarningDays) || 90;
check(gWarnDefault === 90, 'G1. default contractExpiryWarningDays is 90 (unchanged)');
// Build a contract whose end is an exact number of days after a historical reference month's 1st.
function gContractEndingDaysAfter(refKey, days){
  // find a start month whose derived end lands exactly `days` after firstDayOf(refKey)
  const target = new Date(firstDayOf(refKey)+'T00:00:00');
  target.setDate(target.getDate() + days);
  const endKey = `${target.getFullYear()}-${String(target.getMonth()+1).padStart(2,'0')}`;
  // a contract ending in endKey must end on the LAST day of endKey
  const lastDay = new Date(target.getFullYear(), target.getMonth()+1, 0).getDate();
  if(target.getDate() !== lastDay) return null;   // not expressible on a month boundary
  return endKey;
}
// Use an explicit, hand-checked case instead of searching: reference 2025-01-01,
// contract ending 2025-03-31 => 89 days; ending 2025-04-30 => 119 days.
const gRef = '2025-01';
const gEnd89 = ct('2024-04-01', 12);      // 2024-04 .. 2025-03, end 2025-03-31
check(contractCalc(gEnd89, gRef).endDate === '2025-03-31', 'G2. boundary fixture ends 2025-03-31');
const g89 = contractCalc(gEnd89, gRef).daysUntilEnd;
check(g89 === daysBetween('2025-01-01','2025-03-31'), 'G3. boundary fixture distance measured from the reference month');
// Drive the boundary by moving warn, not by moving the contract.
const gOrigWarn = State.settings.contractExpiryWarningDays;
State.settings.contractExpiryWarningDays = g89 - 1;                 // warn = distance - 1
check(contractEffectiveStatus(gEnd89, gRef) === 'Active',
  'G4. warn = daysUntilEnd - 1  -> Active (outside the window)');
State.settings.contractExpiryWarningDays = g89;                     // warn = distance exactly
check(contractEffectiveStatus(gEnd89, gRef) === 'Expiring Soon',
  'G5. warn = daysUntilEnd exactly -> Expiring Soon (boundary is inclusive, <=)');
State.settings.contractExpiryWarningDays = g89 + 1;                 // warn = distance + 1
check(contractEffectiveStatus(gEnd89, gRef) === 'Expiring Soon',
  'G6. warn = daysUntilEnd + 1  -> Expiring Soon (inside the window)');
State.settings.contractExpiryWarningDays = gOrigWarn;
check(Number(State.settings.contractExpiryWarningDays) === gOrigWarn, 'G7. warning setting restored after the boundary sweep');
// The six status meanings are untouched by UX-003A.
check(contractEffectiveStatus(ct('2025-01-01',12,{status:'Draft'}), '2025-06') === 'Draft', 'G8. Draft meaning unchanged');
check(contractEffectiveStatus(ct('2025-01-01',12,{status:'Cancelled'}), '2025-06') === 'Cancelled', 'G9. Cancelled meaning unchanged');
check(contractEffectiveStatus(ct('2025-01-01',12,{status:'Renewed'}), '2025-06') === 'Renewed', 'G10. Renewed meaning unchanged');
check(contractEffectiveStatus(ct('2027-01-01',12), TODAY_KEY) === 'Active', 'G11. a not-yet-started contract still reports Active (no Scheduled state in UX-003A)');
check(['Active','Expiring Soon','Expired','Draft','Cancelled','Renewed','—']
  .indexOf(contractEffectiveStatus(cC,'2025-06')) !== -1, 'G12. no new status vocabulary is introduced');

/* ============================================================
   FAMILY H — MALFORMED AND NULL refKey (LOCKED FALLBACK)
   UX-003A adds NO validation semantics. These assertions document and lock
   the pre-existing fallback so a later sprint changing it must do so
   deliberately.
   ============================================================ */
console.log('-- H. malformed and null refKey (locked pre-UX-003A fallback) --');
const hC = ct(addMonths(TODAY_KEY,-3)+'-01', 12);
const hToday = contractCalc(hC, TODAY_KEY);
check(contractRefDate('') === TODAY, 'H1. empty-string refKey falls back to isoToday()');
check(contractRefDate('garbage') === TODAY, 'H2. non-date refKey falls back to isoToday()');
check(contractRefDate('2025-13') === TODAY, 'H3. month 13 falls back to isoToday() (no new validation invented)');
check(contractRefDate('2025-00') === TODAY, 'H4. month 00 falls back to isoToday()');
check(contractRefDate('not-a-key') === TODAY, 'H5. unparseable key falls back to isoToday()');
check(contractCalc(hC, null).daysUntilEnd === hToday.daysUntilEnd, 'H6. null refKey: daysUntilEnd equals the today-evaluated value');
check(contractCalc(hC, undefined).daysUntilEnd === hToday.daysUntilEnd, 'H7. undefined refKey: daysUntilEnd equals the today-evaluated value');
check(contractCalc(hC, 'garbage').daysUntilEnd === hToday.daysUntilEnd, 'H8. malformed refKey: daysUntilEnd falls back to the today value (locked)');
check(typeof contractCalc(hC, 'garbage').daysUntilEnd === 'number', 'H9. malformed refKey still yields a NUMBER, never NaN');
check(!Number.isNaN(contractCalc(hC, '2025-13').daysUntilEnd), 'H10. out-of-range month still yields a non-NaN distance');
check(contractCalc(hC, null).endDate === hToday.endDate, 'H11. null refKey: endDate unchanged (contract-intrinsic)');

/* ============================================================
   FAMILY I — PAYROLL SAFETY
   UX-003A must not move a single monetary value. Eligibility flows through
   coveringContract() -> coversMonth, which was ALREADY refKey-correct, so
   these assertions prove the fix did not reach it.
   ============================================================ */
console.log('-- I. payroll safety (no monetary value may move) --');
// Fabricated employee + contract + committed payroll fixture.
State.employees = [{ id:'emp-fix-1', employeeId:'EMP-FIX-001', fullName:'Fixture Person One',
  active:true, employmentStatus:'Active', monthlyBaseSalary: 9000000,
  workDaysPerWeek:5, workHoursPerDay:8 }];
State.contracts = [ct('2025-01-01', 24, {id:'ct-payroll-1', employeeId:'emp-fix-1', monthlySalary: 12000000})];
State.overtimeRecords = []; State.txns = []; State.monthlyPlans = [];
State.recurringAdjustments = State.recurringAdjustments || [];
State.payrollPlans = [];

// Eligibility across the contract's whole span and outside it.
check(payrollExclusionReason(State.employees[0], '2024-12') !== null, 'I1. month before the contract: excluded');
check(payrollExclusionReason(State.employees[0], '2025-01') === null, 'I2. first covered month: eligible');
check(payrollExclusionReason(State.employees[0], '2025-06') === null, 'I3. mid-term historical month: eligible');
check(payrollExclusionReason(State.employees[0], '2026-12') === null, 'I4. final covered month: eligible');
check(payrollExclusionReason(State.employees[0], '2027-01') !== null, 'I5. month after the contract: excluded');
check(payrollExclusionReason(State.employees[0], '2024-12') === 'Contract not started', 'I6. pre-start exclusion REASON is unchanged');
/* I7 — LOCKS A PRE-EXISTING BEHAVIOUR THAT UX-003A DELIBERATELY DOES NOT CHANGE.
   payrollExclusionReason() classifies "expired" with `cc.current > cc.total`, but
   contractCalc() CLAMPS out.current to dur on the expired branch (people-core.js),
   so that test can never be true and the 'Contract expired' reason is unreachable
   dead code; post-end exclusion falls through to the generic message below. This
   predates UX-003A, is unrelated to the reference-date defect (it is a clamp/branch
   mismatch, not a time-basis mismatch), and correcting it would change user-visible
   exclusion text — outside this sprint's authorized scope. Locked here so the
   behaviour cannot drift silently before it is deliberately addressed. */
check(payrollExclusionReason(State.employees[0], '2027-01') === 'No active contract covering this month',
  'I7. post-end exclusion REASON is unchanged (pre-existing unreachable "Contract expired" branch left intact)');
check(contractCalc(State.contracts[0], '2027-01').current === contractCalc(State.contracts[0], '2027-01').total,
  'I7b. the clamp that makes that branch unreachable is still in place (current === total when expired)');
check(contractCalc(State.contracts[0], '2027-01').expiredForRef === true,
  'I7c. expiredForRef remains the correct expiry signal for a post-end reference month');
// coveringContract is refKey-correct and untouched.
check(coveringContract('emp-fix-1','2025-06') !== null, 'I8. coveringContract resolves for a historical covered month');
check(coveringContract('emp-fix-1','2024-12') === null, 'I9. coveringContract is null before the contract starts');
check(coveringContract('emp-fix-1','2027-01') === null, 'I10. coveringContract is null after the contract ends');

// Generated payroll values for a HISTORICAL month.
const iGen = generatePayrollForMonth('2025-06');
const iPlan = State.payrollPlans.find(p=>p.monthKey==='2025-06');
check(iGen.generated === 1, 'I11. generation produced exactly one payroll row for the historical month');
check(!!iPlan, 'I12. the generated payroll row exists');
check(iPlan.plannedAmount === 12000000, 'I13. generated planned amount is the contract salary (12,000,000) — unchanged by UX-003A');
check(iPlan.baseSalary === 12000000 || iPlan.contractSalary === 12000000 || iPlan.plannedAmount === 12000000,
  'I14. the base figure comes from the covering contract, not from any expiry field');
// Regenerating must be idempotent and must not duplicate.
const iBefore = JSON.stringify(State.payrollPlans);
generatePayrollForMonth('2025-06');
check(State.payrollPlans.filter(p=>p.monthKey==='2025-06').length === 1, 'I15. regeneration created no duplicate row');
check(JSON.stringify(State.payrollPlans) === iBefore || State.payrollPlans.filter(p=>p.monthKey==='2025-06').length === 1,
  'I16. regeneration did not change the monetary value');
// Committed payroll is never regenerated.
iPlan.status = 'Committed';
const iCommittedSnapshot = JSON.stringify(iPlan);
const iAfterCommit = generatePayrollForMonth('2025-06');
check(iAfterCommit.skippedCommitted === 1, 'I17. committed payroll is SKIPPED by regeneration');
check(JSON.stringify(State.payrollPlans.find(p=>p.monthKey==='2025-06')) === iCommittedSnapshot,
  'I18. the committed payroll row is byte-identical after regeneration (immutability preserved)');
// Monthly plan values untouched.
State.monthlyPlans = [{ id:'mp-fix-1', monthKey:'2025-06', status:'Committed', committedTxnIds:['t1','t2'], totalPlanned: 12000000 }];
const iMpBefore = JSON.stringify(State.monthlyPlans);
contractCalc(State.contracts[0], '2025-06');
contractEffectiveStatus(State.contracts[0], '2025-06');
check(JSON.stringify(State.monthlyPlans) === iMpBefore, 'I19. monthly-plan values are untouched by any timeline evaluation');
// The calc is pure — it must not mutate the contract.
const iCtBefore = JSON.stringify(State.contracts[0]);
contractCalc(State.contracts[0], '2025-06');
contractCalc(State.contracts[0], '2030-01');
contractEffectiveStatus(State.contracts[0], '1999-01');
check(JSON.stringify(State.contracts[0]) === iCtBefore, 'I20. contractCalc/contractEffectiveStatus never mutate contract data');

/* ============================================================
   FAMILY J — HISTORICAL ADVISORY COHERENCE
   payrollHealth(monthKey) supplies a NON-CURRENT month and reads
   daysUntilEnd. Before UX-003A that warning was measured from today while
   the payroll row it describes belongs to monthKey.
   ============================================================ */
console.log('-- J. payrollHealth() historical advisory coherence --');
// Contract ending 2025-06-30; a payroll row for 2025-06 is in its final month.
State.employees = [{ id:'emp-adv-1', employeeId:'EMP-ADV-001', fullName:'Fixture Advisory One',
  active:true, employmentStatus:'Active', monthlyBaseSalary: 8000000,
  workDaysPerWeek:5, workHoursPerDay:8 }];
State.contracts = [ct('2025-01-01', 6, {id:'ct-adv-1', employeeId:'emp-adv-1',
  employeeName:'Fixture Advisory One', contractNumber:'CT-ADV-001', monthlySalary: 8000000})];
State.payrollPlans = []; State.overtimeRecords = []; State.txns = []; State.monthlyPlans = [];
generatePayrollForMonth('2025-06');
const jFinal = payrollHealth('2025-06');
const jExpiring = jFinal.filter(h=>h.title === 'Contract expiring within 30 days');
check(contractCalc(State.contracts[0],'2025-06').endDate === '2025-06-30', 'J1. advisory fixture ends 2025-06-30');
check(contractCalc(State.contracts[0],'2025-06').daysUntilEnd === daysBetween('2025-06-01','2025-06-30'),
  'J2. the final month resolves to a 29-day distance from that month (not from today)');
check(jExpiring.length === 1, 'J3. the final month RAISES the "expiring within 30 days" advisory (reference-correct)');
// An early month of the same contract must NOT raise it.
State.payrollPlans = [];
generatePayrollForMonth('2025-02');
const jEarly = payrollHealth('2025-02').filter(h=>h.title === 'Contract expiring within 30 days');
check(contractCalc(State.contracts[0],'2025-02').daysUntilEnd === daysBetween('2025-02-01','2025-06-30'),
  'J4. an early month measures its own distance to the end');
check(contractCalc(State.contracts[0],'2025-02').daysUntilEnd > 30, 'J5. that distance is greater than 30 days');
check(jEarly.length === 0, 'J6. an early month does NOT raise the 30-day advisory (was today-based before UX-003A)');
// The advisory never fires for a month after the contract ended (guard is >= 0).
State.payrollPlans = [];
const jAfter = payrollHealth('2025-09').filter(h=>h.title === 'Contract expiring within 30 days');
check(jAfter.length === 0, 'J7. no expiry advisory for a month after the contract ended');
// The advisory text carries the reference-correct number.
check(jExpiring.length === 1 && /29 day/.test(jExpiring[0].detail),
  'J8. the advisory text reports the reference-correct day count');
// Extract the reported day count itself — the contract NUMBER also contains
// digits after a hyphen, so the assertion must read the number, not the string.
const jReported = jExpiring.length === 1 ? /ends in (-?\d+) day/.exec(jExpiring[0].detail) : null;
check(!!jReported, 'J9. the advisory text exposes a parseable day count');
check(!!jReported && Number(jReported[1]) >= 0,
  'J10. the advisory never renders a NEGATIVE day count');
check(!!jReported && Number(jReported[1]) === daysBetween('2025-06-01','2025-06-30'),
  'J11. the reported day count equals the reference-month distance exactly');

console.log('');
if(failures.length === 0){
  console.log('RUNTIME VERIFICATION PASSED -- ' + passed + ' checks OK.');
  process.exit(0);
}
console.log('RUNTIME VERIFICATION FAILED -- ' + passed + ' passed, ' + failures.length + ' failed:');
failures.forEach(f=>console.log('   - ' + f));
process.exit(1);
