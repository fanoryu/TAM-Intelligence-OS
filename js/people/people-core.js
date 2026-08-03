/* ============================================================
   PEOPLE & CONTRACTS ENGINE (v2.2.0)
   Master data (employees, contracts), the calendar-month contract
   progress calculator, payroll planning, recurring expenses, and
   the monthly plan generator. All planned finance transactions that
   originate here carry structured links (employeeId / contractId /
   payrollPlanId / monthlyPlanId) — never description text alone.
   ============================================================ */

/* ============================================================
   CANONICAL PAYROLL COMMITTED-STATE PREDICATE (SPR-078)
   ------------------------------------------------------------
   ONE shared read predicate for "is this PayrollPlan committed?". It lives here,
   in the shared people-domain read helpers, because it is consumed across
   Contracts, the HR dashboard, reports, the monthly plan, the payroll engine, and
   the integrity checker — and this module loads BEFORE every one of them, so no
   consumer relies on cross-file hoisting.

   CANONICAL stored value is 'Committed' (see PAYROLL_STATUSES in
   payroll-ops-engine.js). It is the ONLY value any live writer may write.

   'committed' (lowercase) is a LEGACY READ-COMPATIBILITY value only. It was
   written by the retired Payroll Planning posting path (commitPayroll), which
   SPR-078 removed. The v2.5.0 migration (migrateToPayrollOpsSchema) already maps
   legacy lowercase forward, but it is one-time and flag-guarded, so rows written
   by the retired path AFTER that flag was set are never revisited. Those rows are
   real committed payroll with a real Finance transaction; before SPR-078 they read
   as stage "Draft", were invisible to the integrity checker and HR reports, and
   were rejected by PayrollLifecycleAggregate as an invalid state.

   Treating the legacy value as committed is the SAFE direction: a committed row is
   immutable (CLAUDE.md §8.1), so recognizing it PROTECTS it. Recognizing it is a
   READ concern only — this predicate never writes, and no migration is added or
   re-run (that remains separately authorized work).
   ============================================================ */
const PAYROLL_COMMITTED_STATUS = 'Committed';          // canonical — the only writable value
const PAYROLL_COMMITTED_STATUS_LEGACY = 'committed';   // legacy read compatibility ONLY

// Accepts a PayrollPlan record OR a bare status string. Read-only; never mutates.
function isPayrollCommitted(planOrStatus){
  if(planOrStatus == null) return false;
  const s = (typeof planOrStatus === 'string') ? planOrStatus : planOrStatus.status;
  return s === PAYROLL_COMMITTED_STATUS || s === PAYROLL_COMMITTED_STATUS_LEGACY;
}

/* ---------- month-key math ---------- */
// Transactions key months as "YYYY-MM". These helpers keep contract
// progress, payroll and planning consistent with that scheme.
function mkKey(y, m){ return `${y}-${String(m).padStart(2,'0')}`; }
function keyParts(key){ const y=+String(key).slice(0,4), m=+String(key).slice(5,7); return {y, m}; }
function keyToMonthObj(key){ const {y,m}=keyParts(key); return {key, month:NUM_MONTH[m], year:y, monthNum:m}; }
function dateToKey(iso){ if(!iso) return null; return String(iso).slice(0,7); }
function todayKey(){ return isoToday().slice(0,7); }
// 0-based absolute month index for arithmetic (year*12 + (month-1)).
function absMonth(y, m){ return y*12 + (m-1); }
function keyAbs(key){ const {y,m}=keyParts(key); return absMonth(y,m); }
function daysBetween(isoA, isoB){ return Math.round((new Date(isoB+'T00:00:00') - new Date(isoA+'T00:00:00'))/86400000); }

/* ---------- contract progress calculator ---------- */
// Pure, calendar-month based. Never stores "8/12" — always derived from
// startDate + durationMonths for a given reference month (default: current).
//   before the contract starts → 0/N
//   during month 1             → 1/N
//   after it ends              → N/N and Expired
function contractCalc(c, refKey){
  const dur = Math.max(0, Number(c && c.durationMonths)||0);
  const start = c && c.startDate ? String(c.startDate).slice(0,10) : null;
  const ref = refKey || todayKey();
  const out = {total:dur, current:0, remaining:dur, pct:0, progress:`0/${dur}`,
    beforeStart:true, coversMonth:false, expiredForRef:false,
    startDate:start, endDate:null, daysUntilEnd:null, valid:!!(start && dur>0)};
  if(!out.valid) return out;
  const sp = keyParts(start.slice(0,7));
  const startAbs = absMonth(sp.y, sp.m);
  const refAbs = keyAbs(ref);
  const elapsed = refAbs - startAbs;      // 0 = start month
  const current = elapsed + 1;            // 1 during the start month
  // end date = start + duration months − 1 day (last covered calendar day)
  const endD = new Date(sp.y, (sp.m-1)+dur, 0);
  out.endDate = `${endD.getFullYear()}-${String(endD.getMonth()+1).padStart(2,'0')}-${String(endD.getDate()).padStart(2,'0')}`;
  out.daysUntilEnd = daysBetween(isoToday(), out.endDate);
  if(current < 1){ out.current=0; out.beforeStart=true; }
  else if(current > dur){ out.current=dur; out.expiredForRef=true; out.beforeStart=false; }
  else { out.current=current; out.beforeStart=false; out.coversMonth=true; }
  out.remaining = Math.max(0, dur - out.current);
  out.pct = dur ? Math.round(out.current/dur*100) : 0;
  out.progress = `${out.current}/${dur}`;
  return out;
}
// Effective status string (derived) — Draft/Cancelled/Renewed are stored;
// Active-family contracts resolve to Active / Expiring Soon / Expired by date.
function contractEffectiveStatus(c, refKey){
  if(!c) return '—';
  if(c.status==='Cancelled') return 'Cancelled';
  if(c.status==='Renewed') return 'Renewed';
  if(c.status==='Draft') return 'Draft';
  const calc = contractCalc(c, refKey||todayKey());
  if(!calc.valid) return 'Draft';
  if(calc.beforeStart) return 'Active';                 // confirmed, not yet started
  if(calc.expiredForRef) return 'Expired';
  const warn = Number(State.settings.contractExpiryWarningDays)||90;
  if(calc.daysUntilEnd!=null && calc.daysUntilEnd <= warn) return 'Expiring Soon';
  return 'Active';
}
function contractsForEmployee(empId){ return State.contracts.filter(c=>c.employeeId===empId); }
// The contract that funds payroll for a given month: covers it, and is not
// Draft/Cancelled. Prefer a live Active contract over a Renewed historical one.
function coveringContract(empId, monthKey){
  const cands = contractsForEmployee(empId).filter(c=>
    c.status!=='Cancelled' && c.status!=='Draft' && contractCalc(c, monthKey).coversMonth);
  if(!cands.length) return null;
  cands.sort((a,b)=> (a.status==='Renewed'?1:0)-(b.status==='Renewed'?1:0)
    || String(b.startDate||'').localeCompare(String(a.startDate||'')));
  return cands[0];
}
function activeContractToday(empId){ return coveringContract(empId, todayKey()); }
// Two Active contracts overlap if their covered month ranges intersect.
function overlappingActiveContracts(empId){
  const act = contractsForEmployee(empId).filter(c=>c.status==='Active' && contractCalc(c).valid);
  const ranges = act.map(c=>{ const sp=keyParts(String(c.startDate).slice(0,7)); const s=absMonth(sp.y,sp.m); return {c, s, e:s+(Number(c.durationMonths)||0)-1}; });
  const clash = [];
  for(let i=0;i<ranges.length;i++) for(let j=i+1;j<ranges.length;j++){
    if(ranges[i].s <= ranges[j].e && ranges[j].s <= ranges[i].e){ clash.push([ranges[i].c, ranges[j].c]); }
  }
  return clash;
}

/* ---------- linkage helpers ---------- */
function empById(id){ return State.employees.find(e=>e.id===id); }
function contractById(id){ return State.contracts.find(c=>c.id===id); }
function payrollPlanById(id){ return State.payrollPlans.find(p=>p.id===id); }
function txnsForEmployee(empId){ return State.txns.filter(t=>t.employeeId===empId); }
function txnsForContract(ctId){ return State.txns.filter(t=>t.contractId===ctId); }
function payrollPlansForContract(ctId){ return State.payrollPlans.filter(p=>p.contractId===ctId); }
function payrollPlansForEmployee(empId){ return State.payrollPlans.filter(p=>p.employeeId===empId); }
function empHasHistory(empId){ return txnsForEmployee(empId).length>0 || payrollPlansForEmployee(empId).length>0; }
function empEligible(e){ return e && e.active!==false && e.employmentStatus==='Active'; }
function monthlyPlanFor(key){ return State.monthlyPlans.find(p=>p.monthKey===key); }

/* ---------- shared HR UI helpers ---------- */
function openModalHTML(inner, opts){
  const root = document.getElementById('modal-root');
  State._modalOpener = document.activeElement; // remember for focus return on close
  root.innerHTML = `<div class="modal-overlay" id="hrModalOverlay"><div class="modal" role="dialog" aria-modal="true" style="max-width:${(opts&&opts.width)||560}px;max-height:88vh;overflow-y:auto;">${inner}</div></div>`;
  const ov = document.getElementById('hrModalOverlay');
  ov.addEventListener('click', e=>{ if(e.target.id==='hrModalOverlay') closeModal(); });
  if(opts && opts.onMount) opts.onMount(root);
  focusFirstIn(root); // move keyboard focus into the dialog
}
function progressBar(pct, color){ return `<div class="bar-track"><div class="bar-fill" style="width:${Math.min(100,Math.max(0,pct))}%;background:${color||'var(--accent)'};"></div></div>`; }
function hrNavTo(view, extra){ if(extra) Object.assign(State, extra); State.view=view; render(); }
function fmtDateID(iso){ if(!iso) return '—'; try{ return new Date(iso+'T00:00:00').toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'}); }catch(e){ return iso; } }
function nextEmployeeCode(){
  let max=0; State.employees.forEach(e=>{ const m=/(\d+)\s*$/.exec(e.employeeId||''); if(m) max=Math.max(max, +m[1]); });
  return 'EMP-'+String(max+1).padStart(3,'0');
}
