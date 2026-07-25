/* ============================================================
   NATIVE PAYROLL OPERATIONS ENGINE (v2.5.0)
   Persistent monthly payroll worksheet driven entirely by master
   data (employees, contracts, work schedules, approved overtime,
   recurring adjustments) — no Excel required for the monthly cycle.
   Payroll plans are the persistent records; review lifecycle is
   Draft → Reviewed → Ready → Committed (or Cancelled).
   ============================================================ */
const PAYROLL_STATUSES = ['Draft','Reviewed','Ready','Committed','Cancelled'];
const PAYROLL_STATUS_META = {
  'Draft':{pill:'pill-status-planned'}, 'Reviewed':{pill:'pill-status-scheduled'},
  'Ready':{pill:'pill-status-partial'}, 'Committed':{pill:'pill-status-completed'}, 'Cancelled':{pill:'pill-status-cancelled'},
};
const CYCLE_STATUSES = ['Not Generated','Draft','In Review','Ready to Commit','Committed','Partially Executed','Fully Executed'];

/* ---------- centralized payroll calculation (Part 5) ---------- */
function payrollBaseSalary(pp){ return num(pp.salaryOverride ? pp.salaryOverride.overridden : pp.baseSalary); }
function computePayrollPlanned(pp){
  // Full precision internally; round ONLY the final currency result.
  const base = payrollBaseSalary(pp);
  const ot = num(pp.overtimeAmount!=null ? pp.overtimeAmount : pp.overtime);
  const adds = num(pp.allowance)+num(pp.bonus)+num(pp.benefits)+num(pp.otherAddition!=null?pp.otherAddition:pp.otherAdjustment);
  const deds = num(pp.deduction)+num(pp.otherDeduction);
  return Math.round(base + ot + adds - deds);
}
function payrollIsNegative(pp){ return computePayrollPlanned(pp) < 0; }
function payrollTxnOf(pp){ return findTxn(pp.committedTxnId || pp.transactionId); }
function sameIdSet(a,b){ a=a||[]; b=b||[]; if(a.length!==b.length) return false; const sb=new Set(b); return a.every(x=>sb.has(x)); }

/* ---------- recurring payroll adjustments (Part 14) ---------- */
function adjustmentsForMonth(empId, monthKey){
  return State.payrollAdjustments.filter(a=>{
    if(a.active===false) return false;
    if(a.employeeId!==empId) return false;
    if(a.startMonth && monthKey < a.startMonth) return false;
    if(a.endMonth && monthKey > a.endMonth) return false;
    return true;
  });
}

/* ---------- eligibility & exclusion reasons (Part 3) ---------- */
function payrollExclusionReason(e, monthKey){
  if(e.active===false) return 'Inactive employee (record deactivated)';
  if(e.employmentStatus!=='Active') return 'Inactive employee (status: '+e.employmentStatus+')';
  const cts = contractsForEmployee(e.id);
  const ct = coveringContract(e.id, monthKey);
  if(!ct){
    if(!cts.length) return 'No active contract';
    // classify why none covers this month
    let notStarted=false, expired=false, cancelled=false;
    cts.forEach(c=>{ const es=contractEffectiveStatus(c, monthKey); const cc=contractCalc(c, monthKey);
      if(c.status==='Cancelled') cancelled=true;
      else if(cc.valid && cc.current<1) notStarted=true;
      else if(cc.valid && cc.current>cc.total) expired=true; });
    if(cancelled) return 'Cancelled contract';
    if(notStarted) return 'Contract not started';
    if(expired) return 'Contract expired';
    return 'No active contract covering this month';
  }
  if(overlappingActiveContracts(e.id).length) return 'Overlapping contract conflict';
  return null; // eligible (missing salary / schedule are flagged on the row, not excluded — see commit gating)
}

/* ---------- generate persistent payroll (Parts 3, 9, 14) ---------- */
function generatePayrollForMonth(monthKey){
  const mo = keyToMonthObj(monthKey); const now = new Date().toISOString();
  const result = {generated:0, refreshed:0, changed:0, excluded:[], skippedCommitted:0};
  State.employees.forEach(e=>{
    const reason = payrollExclusionReason(e, monthKey);
    if(reason){ result.excluded.push({employeeId:e.id, name:e.fullName, reason}); return; }
    const ct = coveringContract(e.id, monthKey);
    const cc = contractCalc(ct, monthKey);
    const sched = effectiveSchedule(e, ct);
    const base = (ct.monthlySalary!=null?ct.monthlySalary:e.monthlyBaseSalary)||0;
    const ot = approvedOvertimeForMonth(e.id, monthKey);
    const existing = State.payrollPlans.find(p=>p.monthKey===monthKey && p.employeeId===e.id && p.contractId===ct.id && p.status!=='Cancelled');
    if(existing && existing.status==='Committed'){
      // Committed payroll is never silently regenerated — detect overtime drift and flag.
      if(!sameIdSet(existing.overtimeIds, ot.ids)) { existing.otChanged=true; existing.updatedAt=now; }
      result.skippedCommitted++; return;
    }
    let pp = existing;
    if(!pp){
      pp = {id:uid('pp'), createdAt:now, status:'Draft', allowance:0, bonus:0, benefits:0, otherAddition:0, deduction:0, otherDeduction:0, notes:'', history:[]};
      const adjs = adjustmentsForMonth(e.id, monthKey);
      pp.otherAddition = adjs.filter(a=>a.type==='Addition').reduce((s,a)=>s+num(a.amount),0);
      pp.otherDeduction = adjs.filter(a=>a.type==='Deduction').reduce((s,a)=>s+num(a.amount),0);
      pp.recurringAdjustmentIds = adjs.map(a=>a.id);
      pp.adjustmentsSnapshot = adjs.map(a=>({id:a.id, name:a.name, type:a.type, amount:num(a.amount)}));
      State.payrollPlans.push(pp);
      pp.history.push({event:'generated', ts:now, note:`Generated for ${mo.month} ${mo.year}`});
      result.generated++;
    } else {
      // refresh system values on an existing non-committed row; preserve manual edits + review status.
      // Any change in the approved-overtime set (including none → some) flags the row Changed.
      if(!sameIdSet(pp.overtimeIds||[], ot.ids)){ pp.otChanged=true; result.changed++; }
      result.refreshed++;
      pp.history = pp.history || []; pp.history.push({event:'generated', ts:now, note:'Re-generated (system values refreshed)'});
    }
    pp.monthKey=monthKey; pp.month=mo.month; pp.year=mo.year; pp.monthNum=mo.monthNum;
    pp.employeeId=e.id; pp.employeeName=e.fullName; pp.department=e.department||null; pp.contractId=ct.id; pp.contractNumber=ct.contractNumber;
    if(!pp.salaryOverride) pp.baseSalary = base;                 // keep overridden base if present
    pp.baseSalarySnapshot = base;
    pp.contractProgress = cc.progress; pp.contractProgressSnapshot = cc.progress;
    pp.workScheduleSnapshot = {hoursPerDay:sched.hoursPerDay, daysPerWeek:sched.daysPerWeek, weeksPerMonth:sched.weeksPerMonth, source:sched.source, valid:sched.valid};
    pp.overtimeIds = ot.ids.slice(); pp.overtimeAmount = ot.amount; pp.overtimeHours = ot.records.reduce((s,o)=>s+num(o.overtimeHours),0);
    pp.missingSalary = base<=0; pp.missingSchedule = !sched.valid;
    pp.plannedAmount = computePayrollPlanned(pp);
    pp.updatedAt = now;
  });
  return result;
}

/* ---------- cycle status (Part 2) ---------- */
function payrollPlansForMonth(monthKey, includeCancelled){
  return State.payrollPlans.filter(p=>p.monthKey===monthKey && (includeCancelled || p.status!=='Cancelled'));
}
function payrollCycleStatus(monthKey){
  const plans = payrollPlansForMonth(monthKey);
  if(!plans.length) return 'Not Generated';
  const committed = plans.filter(p=>p.status==='Committed');
  if(committed.length===plans.length && committed.length){
    const txns = committed.map(payrollTxnOf).filter(Boolean);
    if(txns.length){
      if(txns.every(t=>['completed','archived'].includes(statusOf(t)))) return 'Fully Executed';
      if(txns.some(t=>['completed','partial','archived'].includes(statusOf(t)))) return 'Partially Executed';
    }
    return 'Committed';
  }
  if(committed.length){
    const anyExec = committed.some(p=>{ const t=payrollTxnOf(p); return t && ['completed','partial','archived'].includes(statusOf(t)); });
    return anyExec ? 'Partially Executed' : 'Committed';
  }
  if(plans.some(p=>p.status==='Ready')) return 'Ready to Commit';
  if(plans.some(p=>p.status==='Reviewed')) return 'In Review';
  return 'Draft';
}
function payrollMonthTotals(monthKey){
  const plans = payrollPlansForMonth(monthKey);
  const t={base:0, overtime:0, additions:0, deductions:0, planned:0, count:plans.length,
    committed:0, ready:0, reviewed:0, draft:0, paid:0, remaining:0};
  plans.forEach(p=>{
    t.base += payrollBaseSalary(p);
    t.overtime += num(p.overtimeAmount!=null?p.overtimeAmount:p.overtime);
    t.additions += num(p.allowance)+num(p.bonus)+num(p.benefits)+num(p.otherAddition!=null?p.otherAddition:p.otherAdjustment);
    t.deductions += num(p.deduction)+num(p.otherDeduction);
    t.planned += num(p.plannedAmount!=null?p.plannedAmount:computePayrollPlanned(p));
    if(p.status==='Committed') t.committed++; else if(p.status==='Ready') t.ready++; else if(p.status==='Reviewed') t.reviewed++; else t.draft++;
    const txn = payrollTxnOf(p);
    if(txn && txn.actual!=null){ t.paid += num(txn.actual); }
  });
  t.remaining = t.planned - t.paid;
  return t;
}

/* ---------- review lifecycle (Part 7) ---------- */
function payrollCommitBlockers(pp){
  const b=[];
  if(!pp.employeeId || !empById(pp.employeeId)) b.push('invalid employee');
  if(!pp.contractId || !contractById(pp.contractId)) b.push('invalid contract');
  if(payrollBaseSalary(pp)<=0) b.push('missing salary');
  if(pp.workScheduleSnapshot && pp.workScheduleSnapshot.valid===false) b.push('invalid work schedule');
  if(payrollIsNegative(pp)) b.push('negative final payroll');
  const dup = State.payrollPlans.filter(x=>x.id!==pp.id && x.monthKey===pp.monthKey && x.employeeId===pp.employeeId && x.status!=='Cancelled');
  if(dup.length) b.push('duplicate payroll for this month');
  return b;
}
async function setPayrollStatus(id, status){
  const pp = payrollPlanById(id); if(!pp) return;
  if(pp.status==='Committed' && status!=='Committed'){ showWarning('Committed payroll cannot change status here — use the adjustment workflow.'); return; }
  if(status==='Ready'){ const b=payrollCommitBlockers(pp); if(b.length){ showWarning('Cannot mark Ready: '+b.join(', ')+'.'); return; } }
  pp.status = status; pp.updatedAt = new Date().toISOString();
  (pp.history=pp.history||[]).push({event:status==='Reviewed'?'reviewed':status==='Ready'?'marked-ready':status==='Cancelled'?'cancelled':'edited', ts:pp.updatedAt, note:'Status → '+status});
  await persistPayrollPlans();
}
async function bulkPayrollStatus(monthKey, ids, status){
  let done=0;
  for(const id of ids){ const pp=payrollPlanById(id); if(!pp||pp.status==='Committed') continue; if(status==='Ready' && payrollCommitBlockers(pp).length) continue; pp.status=status; pp.updatedAt=new Date().toISOString(); (pp.history=pp.history||[]).push({event:status.toLowerCase(), ts:pp.updatedAt, note:'Bulk → '+status}); done++; }
  await persistPayrollPlans(); return done;
}

/* ---------- salary override (Part 6) ---------- */
function openSalaryOverride(id, main){
  const pp = payrollPlanById(id); if(!pp) return;
  openModalHTML(`<h3>Override Salary for This Payroll Only</h3>
    <p class="dim" style="font-size:12.5px;">Employee <b>${escapeHtml(pp.employeeName)}</b> · ${escapeHtml(pp.month)} ${pp.year}. Contract salary <b class="mono">${fmtIDR(pp.baseSalarySnapshot)}</b>. This changes only this month's payroll — the contract is not modified.</p>
    <form id="ovForm"><div class="form-grid" style="grid-template-columns:1fr 1fr;">
      <div class="field"><label>Overridden Salary (Rp)</label><input class="input" type="number" step="any" name="salary" value="${payrollBaseSalary(pp)}" required></div>
      <div class="field"><label>Reason</label><input class="input" name="reason" required placeholder="e.g. prorated / correction"></div>
    </div><div class="modal-actions"><button type="button" class="btn" id="ovCancel">Cancel</button><button type="submit" class="btn btn-accent">Apply Override</button>${pp.salaryOverride?'<button type="button" class="btn btn-danger" id="ovClear">Clear Override</button>':''}</div></form>`,
    {width:560, onMount:(root)=>{
      root.querySelector('#ovCancel').addEventListener('click', closeModal);
      const clr=root.querySelector('#ovClear'); if(clr) clr.addEventListener('click', async ()=>{ pp.baseSalary=pp.baseSalarySnapshot; pp.salaryOverride=null; pp.plannedAmount=computePayrollPlanned(pp); pp.updatedAt=new Date().toISOString(); (pp.history=pp.history||[]).push({event:'edited',ts:pp.updatedAt,note:'Salary override cleared'}); await persistPayrollPlans(); closeModal(); render(); });
      root.querySelector('#ovForm').addEventListener('submit', async ev=>{
        ev.preventDefault(); const fd=new FormData(ev.target);
        const val=Number(fd.get('salary')); const reason=(fd.get('reason')||'').trim();
        if(!reason){ showWarning('A reason is required for a salary override.'); return; }
        pp.salaryOverride={original:pp.baseSalarySnapshot, overridden:val, reason, ts:new Date().toISOString()};
        pp.baseSalary=val; pp.plannedAmount=computePayrollPlanned(pp); pp.updatedAt=new Date().toISOString();
        (pp.history=pp.history||[]).push({event:'edited', ts:pp.updatedAt, note:`Salary overridden to ${fmtIDR(val)} — ${reason}`});
        await persistPayrollPlans(); closeModal(); showSuccess('Salary overridden for this payroll only.'); render();
      });
    }});
}

/* ---------- commit ready payroll (Part 10) ---------- */
function payrollCommitTxn(pp, mo){
  const ts=new Date().toISOString();
  const uraian=`${pp.employeeName}${pp.contractNumber?' · '+pp.contractNumber:''}${pp.contractProgress?' · '+pp.contractProgress:''}`;
  return {id:uid('pay'), monthKey:pp.monthKey, month:mo.month, year:mo.year, monthNum:mo.monthNum,
    category:State.settings.defaultPayrollCategory||'Gaji', categoryCode:'A', no:null, uraian, vol:1, satuan:'bulan', hargaSatuan:pp.plannedAmount,
    planned:pp.plannedAmount, actual:null, type:'expense', txnDate:null, source:'payroll', unplanned:false,
    scheduledDate:null, paymentMethod:null, bankAccount:null, referenceNumber:null, notes:'Native payroll', vendor:null,
    executionId:null, executionTimestamp:null, execution:null, status:'planned',
    employeeId:pp.employeeId, contractId:pp.contractId, payrollPlanId:pp.id, overtimeIds:(pp.overtimeIds||[]).slice(), overtimeAmount:num(pp.overtimeAmount),
    monthlyPlanId:pp.monthlyPlanId||null, payrollMeta:{employeeName:pp.employeeName, contractNumber:pp.contractNumber, contractProgress:pp.contractProgress},
    history:[{event:'created', ts, note:'Created from Payroll Planning commit'}]};
}
function commitPayrollPreview(monthKey, ids){
  const plans = ids.map(payrollPlanById).filter(Boolean);
  const s={employees:plans.length, base:0, overtime:0, additions:0, deductions:0, planned:0, newTxn:0, existingTxn:0, changedTxn:0, conflicts:0, skipped:0};
  plans.forEach(p=>{
    if(p.status!=='Ready'){ s.skipped++; return; }
    s.base+=payrollBaseSalary(p); s.overtime+=num(p.overtimeAmount); s.additions+=num(p.allowance)+num(p.bonus)+num(p.benefits)+num(p.otherAddition); s.deductions+=num(p.deduction)+num(p.otherDeduction); s.planned+=num(p.plannedAmount);
    const txn=payrollTxnOf(p);
    if(!txn) s.newTxn++; else if(txn.actual==null && txn.planned!==p.plannedAmount) s.changedTxn++; else s.existingTxn++;
    if(payrollCommitBlockers(p).length) s.conflicts++;
  });
  return s;
}
async function commitReadyPayroll(monthKey, ids){
  const mo=keyToMonthObj(monthKey); const plan=ensureMonthlyPlan(monthKey); const now=new Date().toISOString();
  let created=0, updated=0, skipped=0;
  for(const id of ids){
    const pp=payrollPlanById(id); if(!pp || pp.status!=='Ready'){ skipped++; continue; }
    if(payrollCommitBlockers(pp).length){ skipped++; continue; }
    pp.status='Committed'; pp.monthlyPlanId=plan.id; pp.plannedAmount=computePayrollPlanned(pp); pp.committedAt=now; pp.updatedAt=now;
    let txn = payrollTxnOf(pp);
    if(!txn){ txn=payrollCommitTxn(pp, mo); State.txns.push(txn); pp.committedTxnId=txn.id; pp.transactionId=txn.id; created++; (pp.history=pp.history||[]).push({event:'transaction-created', ts:now, note:'Planned Gaji transaction created'}); }
    else if(txn.actual==null){ txn.planned=pp.plannedAmount; txn.hargaSatuan=pp.plannedAmount; txn.overtimeIds=(pp.overtimeIds||[]).slice(); txn.overtimeAmount=num(pp.overtimeAmount); pushHistory(txn,'edited','Payroll re-committed'); updated++; }
    // flip approved overtime → Committed to Payroll (prevent double inclusion)
    (pp.overtimeIds||[]).forEach(oid=>{ const o=overtimeById(oid); if(o && o.status==='Approved'){ o.status='Committed to Payroll'; o.payrollPlanId=pp.id; o.committedTxnId=pp.committedTxnId; o.updatedAt=now; (o.history=o.history||[]).push({event:'committed', ts:now, note:'Committed to payroll'}); } });
    if(pp.committedTxnId && !plan.committedTxnIds.includes(pp.committedTxnId)) plan.committedTxnIds.push(pp.committedTxnId);
    pp.otChanged=false;
    (pp.history=pp.history||[]).push({event:'committed', ts:now, note:'Committed to monthly plan'});
  }
  if(plan.status==='Draft'||plan.status==='Reviewed') plan.status='Committed';
  plan.committedAt=now; plan.updatedAt=now;
  await persistPayrollPlans(); await persistMonthlyPlans(); await persistOvertime(); await persist();
  return {created, updated, skipped};
}

/* ---------- prepare next month (Part 13) ---------- */
async function prepareNextMonthPayroll(monthKey){
  const abs=keyAbs(monthKey)+1; const nextKey=mkKey(Math.floor(abs/12),(abs%12)+1);
  State.payrollMonth=nextKey;
  const res=generatePayrollForMonth(nextKey);   // regenerates from master data; actuals/overrides never copied
  await persistPayrollPlans();
  showSuccess(`Prepared ${keyToMonthObj(nextKey).month} ${keyToMonthObj(nextKey).year}: ${res.generated} generated, ${res.excluded.length} excluded. Regenerated from active contracts — actuals and execution status are not carried over.`, 6000);
  render();
}
