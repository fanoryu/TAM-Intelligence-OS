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
  logActivity({type:'payroll.generate', module:'Payroll', entity:`${mo.month} ${mo.year}`, entityId:monthKey,
    desc:`Generated payroll — ${result.generated} new, ${result.refreshed} refreshed, ${result.excluded.length} excluded`,
    refs:{monthKey}});
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
// v2.6.4 — map a stored status change to an Activity Log event type.
function payrollAuditType(status){
  return status==='Reviewed'?'payroll.review':status==='Ready'?'payroll.approve':status==='Draft'?'payroll.return':status==='Cancelled'?'payroll.cancel':'payroll.edit';
}
async function setPayrollStatus(id, status){
  const pp = payrollPlanById(id); if(!pp) return;
  if(isPayrollLocked(pp.monthKey)){ showWarning('This payroll period is locked — unlock it to change status.'); return; }
  if(pp.status==='Committed' && status!=='Committed'){ showWarning('Committed payroll cannot change status here — use the adjustment workflow.'); return; }
  // v2.6.3a — Approve is a sign-off and is NOT gated by commit-blockers; validation
  // happens at Post (commitReadyPayroll re-checks and skips blocked rows). This keeps
  // the Review → Approved → Posted lifecycle moving.
  pp.status = status; pp.updatedAt = new Date().toISOString();
  (pp.history=pp.history||[]).push({event:status==='Reviewed'?'reviewed':status==='Ready'?'marked-ready':status==='Cancelled'?'cancelled':'edited', ts:pp.updatedAt, note:'Status → '+status});
  await persistPayrollPlans();
  logActivity({type:payrollAuditType(status), module:'Payroll', entity:pp.employeeName, entityId:pp.id,
    desc:`${pp.employeeName} → ${payrollStage(pp)} (status ${status})`,
    refs:{employeeId:pp.employeeId, payrollPlanId:pp.id, contractId:pp.contractId, monthKey:pp.monthKey}});
}
async function bulkPayrollStatus(monthKey, ids, status){
  if(isPayrollLocked(monthKey)){ showWarning('This payroll period is locked — unlock it to make changes.'); return 0; }
  // v2.6.3a — bulk Approve/Review is a sign-off; it is NOT gated by commit-blockers.
  // Only Committed rows are skipped. Post (commitReadyPayroll) validates before creating
  // finance transactions, so blocked rows can be Approved but will not post.
  let done=0;
  for(const id of ids){ const pp=payrollPlanById(id); if(!pp||pp.status==='Committed') continue; pp.status=status; pp.updatedAt=new Date().toISOString(); (pp.history=pp.history||[]).push({event:status.toLowerCase(), ts:pp.updatedAt, note:'Bulk → '+status}); done++; }
  await persistPayrollPlans();
  if(done){ const mo=keyToMonthObj(monthKey); logActivity({type:payrollAuditType(status), module:'Payroll', entity:`${mo.month} ${mo.year}`, entityId:monthKey, desc:`${done} row(s) → ${status} (bulk)`, refs:{monthKey}}); }
  return done;
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
      const clr=root.querySelector('#ovClear'); if(clr) clr.addEventListener('click', async ()=>{ pp.baseSalary=pp.baseSalarySnapshot; pp.salaryOverride=null; pp.plannedAmount=computePayrollPlanned(pp); pp.updatedAt=new Date().toISOString(); (pp.history=pp.history||[]).push({event:'edited',ts:pp.updatedAt,note:'Salary override cleared'}); await persistPayrollPlans(); logActivity({type:'payroll.override', module:'Payroll', entity:pp.employeeName, entityId:pp.id, desc:`Salary override cleared (back to ${fmtIDR(pp.baseSalarySnapshot)})`, refs:{employeeId:pp.employeeId, payrollPlanId:pp.id, contractId:pp.contractId, monthKey:pp.monthKey}}); closeModal(); render(); });
      root.querySelector('#ovForm').addEventListener('submit', async ev=>{
        ev.preventDefault(); const fd=new FormData(ev.target);
        const val=Number(fd.get('salary')); const reason=(fd.get('reason')||'').trim();
        if(!reason){ showWarning('A reason is required for a salary override.'); return; }
        pp.salaryOverride={original:pp.baseSalarySnapshot, overridden:val, reason, ts:new Date().toISOString()};
        pp.baseSalary=val; pp.plannedAmount=computePayrollPlanned(pp); pp.updatedAt=new Date().toISOString();
        (pp.history=pp.history||[]).push({event:'edited', ts:pp.updatedAt, note:`Salary overridden to ${fmtIDR(val)} — ${reason}`});
        await persistPayrollPlans();
        logActivity({type:'payroll.override', module:'Payroll', entity:pp.employeeName, entityId:pp.id, desc:`Salary overridden to ${fmtIDR(val)} — ${reason}`, refs:{employeeId:pp.employeeId, payrollPlanId:pp.id, contractId:pp.contractId, monthKey:pp.monthKey}});
        closeModal(); showSuccess('Salary overridden for this payroll only.'); render();
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
  if(isPayrollLocked(monthKey)){ showWarning('This payroll period is locked — finance posting cannot run again.'); return {created:0, updated:0, skipped:ids.length, posted:[], skippedDetails:[], locked:true}; }
  const mo=keyToMonthObj(monthKey); const plan=ensureMonthlyPlan(monthKey); const now=new Date().toISOString();
  let created=0, updated=0, skipped=0;
  const posted=[], skippedDetails=[];   // v2.6.4 — per-row outcome for the Post result summary
  for(const id of ids){
    const pp=payrollPlanById(id);
    if(!pp){ skipped++; continue; }
    // Only Approved rows post. Blocked rows are SKIPPED (never posted), stay Approved, and
    // the exact reason is reported. Blocker rules are unchanged (payrollCommitBlockers).
    if(pp.status!=='Ready'){ skipped++; skippedDetails.push({name:pp.employeeName||'—', reasons:['not Approved (current stage: '+payrollStage(pp)+')']}); continue; }
    const blockers = payrollCommitBlockers(pp);
    if(blockers.length){ skipped++; skippedDetails.push({name:pp.employeeName, reasons:blockers}); continue; }
    pp.status='Committed'; pp.monthlyPlanId=plan.id; pp.plannedAmount=computePayrollPlanned(pp); pp.committedAt=now; pp.updatedAt=now;
    let txn = payrollTxnOf(pp); let wasCreated=false;
    if(!txn){ txn=payrollCommitTxn(pp, mo); State.txns.push(txn); pp.committedTxnId=txn.id; pp.transactionId=txn.id; created++; wasCreated=true; (pp.history=pp.history||[]).push({event:'transaction-created', ts:now, note:'Planned Gaji transaction created'}); }
    else if(txn.actual==null){ txn.planned=pp.plannedAmount; txn.hargaSatuan=pp.plannedAmount; txn.overtimeIds=(pp.overtimeIds||[]).slice(); txn.overtimeAmount=num(pp.overtimeAmount); pushHistory(txn,'edited','Payroll re-committed'); updated++; }
    // flip approved overtime → Committed to Payroll (prevent double inclusion)
    (pp.overtimeIds||[]).forEach(oid=>{ const o=overtimeById(oid); if(o && o.status==='Approved'){ o.status='Committed to Payroll'; o.payrollPlanId=pp.id; o.committedTxnId=pp.committedTxnId; o.updatedAt=now; (o.history=o.history||[]).push({event:'committed', ts:now, note:'Committed to payroll'}); } });
    if(pp.committedTxnId && !plan.committedTxnIds.includes(pp.committedTxnId)) plan.committedTxnIds.push(pp.committedTxnId);
    pp.otChanged=false;
    posted.push({name:pp.employeeName||'—', txnId:pp.committedTxnId, created:wasCreated});
    (pp.history=pp.history||[]).push({event:'committed', ts:now, note:'Committed to monthly plan'});
  }
  if(plan.status==='Draft'||plan.status==='Reviewed') plan.status='Committed';
  plan.committedAt=now; plan.updatedAt=now;
  await persistPayrollPlans(); await persistMonthlyPlans(); await persistOvertime(); await persist();
  logActivity({type:'payroll.post', module:'Payroll', entity:`${mo.month} ${mo.year}`, entityId:monthKey,
    desc:`Posted to finance — ${created} created, ${updated} updated, ${skipped} skipped`, refs:{monthKey}});
  return {created, updated, skipped, posted, skippedDetails};
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

/* ============================================================
   PAYROLL INTELLIGENCE (v2.6.3) — display lifecycle stages, period
   lock, deterministic health rules, and period summary. Additive:
   the operational lifecycle Draft → Review → Approved → Posted →
   Executed is a display mapping over the stored status values
   (Reviewed/Ready/Committed) with Executed derived from the linked
   finance transaction — so no data migration, storage key, or
   SCHEMA_VERSION change is needed. Locks live in settings.
   Payroll = Base Salary + Approved Overtime (TAM uses no other
   components), so computePayrollPlanned is the read-only Total.
   ============================================================ */
const PAYROLL_STAGE_META = {
  'Draft':    {pill:'pill-status-planned'},
  'Review':   {pill:'pill-status-scheduled'},
  'Approved': {pill:'pill-status-partial'},
  'Posted':   {pill:'pill-status-completed'},
  'Executed': {pill:'pill-status-completed'},
  'Cancelled':{pill:'pill-status-cancelled'},
};
const PAYROLL_STAGES = ['Draft','Review','Approved','Posted','Executed'];
// Map a stored payroll plan to its operational stage (Executed derived from its transaction).
function payrollStage(pp){
  if(!pp || pp.status==='Cancelled') return 'Cancelled';
  if(pp.status==='Committed'){
    const t=payrollTxnOf(pp);
    if(t && ['completed','archived'].includes(statusOf(t))) return 'Executed';
    return 'Posted';
  }
  if(pp.status==='Ready') return 'Approved';
  if(pp.status==='Reviewed') return 'Review';
  return 'Draft';
}
function payrollStagePill(pp){ return hrStatusBadge(payrollStage(pp), PAYROLL_STAGE_META); }
/* v2.6.8 (Issue 1) — GENERIC bulk-selection model.
   The selection set is stage-agnostic: it simply holds the rows the user picked.
   Each bulk action declares its OWN eligible stages here, so a row that is not
   eligible for one action (e.g. a Posted row for Approve) can still be selected and
   acted on by another action (e.g. a future Export). Adding a new action = adding one
   entry below; no change to the selection model. This is display/selection only — no
   payroll status rule and no committed-payroll immutability changes. */
const PAYROLL_BULK_ACTIONS = {
  review:  { label:'Review',  eligibleLabel:'Draft',            eligible:(p)=>payrollStage(p)==='Draft' },
  approve: { label:'Approve', eligibleLabel:'Draft and Review', eligible:(p)=>['Draft','Review'].includes(payrollStage(p)) },
  post:    { label:'Post',    eligibleLabel:'Approved',         eligible:(p)=>payrollStage(p)==='Approved' },
};
// Human-readable reason a selected row is skipped by a given action (for eligible/skipped reporting).
function payrollActionSkipReason(action, stage){
  if(action==='post' && (stage==='Draft' || stage==='Review')) return `not yet Approved (currently ${stage})`;
  return `already at ${stage} stage`;
}
// Partition a set of selected ids for one action into { eligible:[ids], skipped:[{id,name,stage,reason}] }.
function partitionPayrollSelection(ids, action){
  const spec = PAYROLL_BULK_ACTIONS[action];
  const eligible=[], skipped=[];
  (ids||[]).forEach(id=>{ const p=payrollPlanById(id); if(!p) return;
    if(spec.eligible(p)) eligible.push(id);
    else { const stage=payrollStage(p); skipped.push({id, name:p.employeeName||'—', stage, reason:payrollActionSkipReason(action, stage)}); }
  });
  return {eligible, skipped};
}
// Compact "2 already at Posted stage; 1 not yet Approved (currently Draft)" summary.
function payrollSkipSummary(skipped){
  const byReason={};
  (skipped||[]).forEach(s=>{ byReason[s.reason]=(byReason[s.reason]||0)+1; });
  return Object.entries(byReason).map(([r,n])=>`${n} ${r}`).join('; ');
}
// Does the active period contain any row eligible for this action? (drives button disabling)
function payrollPeriodHasEligible(monthKey, action){
  return payrollPlansForMonth(monthKey).some(PAYROLL_BULK_ACTIONS[action].eligible);
}
function payrollStageCounts(monthKey){
  const c={Draft:0, Review:0, Approved:0, Posted:0, Executed:0};
  payrollPlansForMonth(monthKey).forEach(p=>{ const s=payrollStage(p); if(c[s]!=null) c[s]++; });
  return c;
}
// Period summary: totals + average/highest/lowest (Feature 9).
function payrollSummary(monthKey){
  const plans=payrollPlansForMonth(monthKey);
  const amts=plans.map(p=>num(p.plannedAmount!=null?p.plannedAmount:computePayrollPlanned(p)));
  const total=amts.reduce((s,x)=>s+x,0);
  return {count:plans.length, total, overtime:plans.reduce((s,p)=>s+num(p.overtimeAmount),0),
    average: plans.length?Math.round(total/plans.length):0,
    highest: amts.length?Math.max(...amts):0, lowest: amts.length?Math.min(...amts):0};
}
// Deterministic (no AI) payroll health rules for the active period (Feature 7).
function payrollHealth(monthKey){
  const out=[]; const prevKey=prevMonthKey(monthKey);
  payrollPlansForMonth(monthKey).forEach(p=>{
    const ct=contractById(p.contractId);
    if(ct){ const cc=contractCalc(ct, monthKey); if(cc.valid && cc.daysUntilEnd!=null && cc.daysUntilEnd>=0 && cc.daysUntilEnd<=30) out.push({sev:'warn', title:'Contract expiring within 30 days', detail:`${p.employeeName}: ${ct.contractNumber||'contract'} ends in ${cc.daysUntilEnd} day(s).`}); }
    const prev=State.payrollPlans.find(x=>x.monthKey===prevKey && x.employeeId===p.employeeId && x.status!=='Cancelled');
    if(prev){ const a=computePayrollPlanned(prev), b=computePayrollPlanned(p); if(a>0){ const d=(b-a)/a;
      if(d>=0.2) out.push({sev:'warn', title:'Payroll increased more than 20%', detail:`${p.employeeName}: ${fmtIDRShort(a)} → ${fmtIDRShort(b)} (+${Math.round(d*100)}%).`});
      else if(d<=-0.2) out.push({sev:'warn', title:'Payroll decreased more than 20%', detail:`${p.employeeName}: ${fmtIDRShort(a)} → ${fmtIDRShort(b)} (${Math.round(d*100)}%).`}); } }
    const base=payrollBaseSalary(p);
    if(base>0 && num(p.overtimeAmount) > 0.5*base) out.push({sev:'warn', title:'Unusually high overtime', detail:`${p.employeeName}: overtime ${fmtIDRShort(p.overtimeAmount)} exceeds 50% of base salary.`});
    else if(num(p.overtimeHours) > 60) out.push({sev:'warn', title:'Unusually high overtime hours', detail:`${p.employeeName}: ${num(p.overtimeHours)} overtime hours this period.`});
  });
  State.employees.forEach(e=>{ if(e.active===false || e.employmentStatus!=='Active') return;
    const reason=payrollExclusionReason(e, monthKey);
    if(reason) out.push({sev:'info', title: /contract/i.test(reason)?'Employee missing active contract':'Employee not in payroll', detail:`${e.fullName}: ${reason}.`});
  });
  return out;
}
/* ---------- payroll period lock (Feature 6) ---------- */
function isPayrollLocked(monthKey){ return !!(State.settings.payrollLocks && State.settings.payrollLocks[monthKey]); }
async function setPayrollLock(monthKey, locked){
  if(!State.settings.payrollLocks) State.settings.payrollLocks={};
  if(locked) State.settings.payrollLocks[monthKey]=true; else delete State.settings.payrollLocks[monthKey];
  await saveSettings();
  const mo=keyToMonthObj(monthKey);
  logActivity({type:locked?'payroll.lock':'payroll.unlock', module:'Payroll', entity:`${mo.month} ${mo.year}`, entityId:monthKey,
    desc:`Payroll period ${locked?'locked':'unlocked'}`, refs:{monthKey}});
}

/* ---------- payroll audit timeline (v2.6.4) — derived, real events only ----------
   No new state: the per-plan timeline is derived from the plan's own history[], the
   linked finance transaction's history, and lock/unlock records in the audit log.
   Events with no real timestamp are simply omitted (never fabricated). */
function buildPayrollTimeline(pp){
  if(!pp) return [];
  const ev=[]; const hist = pp.history||[];
  const firstOf = (match)=>{ const h=hist.filter(match).sort((a,b)=>new Date(a.ts||0)-new Date(b.ts||0))[0]; return h?h.ts:null; };
  const lastOf  = (match)=>{ const h=hist.filter(match).sort((a,b)=>new Date(a.ts||0)-new Date(b.ts||0)).pop(); return h?h.ts:null; };
  const push=(label, ts, detail)=>{ if(ts) ev.push({label, ts, detail:detail||''}); };
  push('Generated', firstOf(h=>h.event==='generated'), 'Generated from active contract + approved overtime');
  push('Reviewed', lastOf(h=>h.event==='reviewed'), 'Marked reviewed');
  push('Approved', lastOf(h=>h.event==='marked-ready'||h.event==='ready'), 'Approved (ready to post)');
  push('Posted to Finance', lastOf(h=>h.event==='committed'||h.event==='transaction-created'), 'Planned Gaji transaction created in finance');
  const txn=payrollTxnOf(pp);
  if(txn){
    const exec=(txn.history||[]).filter(h=>h.event==='executed').sort((a,b)=>new Date(a.ts||0)-new Date(b.ts||0)).pop();
    if(exec) push('Executed', exec.ts, exec.note||'Paid via Execution Center');
    else if(['completed','archived'].includes(statusOf(txn)) && txn.execution && txn.execution.ts) push('Executed', txn.execution.ts, 'Paid via Execution Center');
  }
  // Period lock / unlock come from the audit log for this month (only if recorded).
  if(typeof auditEventsForMonth==='function'){
    auditEventsForMonth(pp.monthKey).forEach(e=>{
      if(e.type==='payroll.lock') push('Period Locked', e.ts, e.desc);
      else if(e.type==='payroll.unlock') push('Period Unlocked', e.ts, e.desc);
    });
  }
  ev.sort((a,b)=> new Date(a.ts) - new Date(b.ts)); // chronological
  return ev;
}
// Period-level activity for the whole month (generate / post / lock / unlock), newest first.
function buildPayrollPeriodTimeline(monthKey){
  if(typeof auditEventsForMonth!=='function') return [];
  return auditEventsForMonth(monthKey)
    .filter(e=> ['payroll.generate','payroll.post','payroll.lock','payroll.unlock'].includes(e.type))
    .map(e=>({label:auditTypeLabel(e.type), ts:e.ts, detail:e.desc}))
    .sort((a,b)=> new Date(b.ts||0) - new Date(a.ts||0));
}

/* ============================================================
   OVERTIME DRIFT VISIBILITY (v2.6.8, Issue 2)
   Derived, read-only comparison between the approved overtime that
   currently applies to a payroll plan's employee/month and the set the
   plan actually captured at generation/commit. Reuses the existing
   overtime comparison logic (approvedOvertimeForMonth + sameIdSet).
   No stored flag and no schema/storage/migration change: the warning is
   recomputed at render, so it appears immediately after an overtime
   approval (no Generate click required) and survives reload without
   duplicating. Posted/Executed payroll stays immutable — totals, posted
   and executed transactions are never touched; this only surfaces that a
   supplemental payment will be needed. Supplemental Payment itself is not
   implemented in v2.6.8 (disabled placeholder only). */
const OT_DRIFT_MSG_UNCOMMITTED = 'Overtime approved. Regenerate payroll to include the updated overtime.';
// Returns null when the plan's captured overtime still matches the currently approved
// overtime, otherwise a small descriptor of the drift (committed vs not, amount added).
function payrollOvertimeDrift(pp){
  if(!pp || pp.status==='Cancelled') return null;
  const current = approvedOvertimeForMonth(pp.employeeId, pp.monthKey);
  const stored  = pp.overtimeIds||[];
  if(sameIdSet(stored, current.ids)) return null;   // in sync — no drift
  const stage = payrollStage(pp);
  const committed = (stage==='Posted' || stage==='Executed');
  const addedIds   = current.ids.filter(id=>!stored.includes(id));
  const removedIds = stored.filter(id=>!current.ids.includes(id));
  const addedAmount = addedIds.reduce((s,id)=>{ const o=overtimeById(id); return s + (o?num(o.approvedAmount!=null?o.approvedAmount:o.calculatedAmount):0); }, 0);
  return {stage, committed, addedIds, removedIds, addedAmount};
}
function payrollPlansWithDrift(plans){
  return (plans||[]).filter(p=>p && p.status!=='Cancelled')
    .map(p=>({pp:p, drift:payrollOvertimeDrift(p)}))
    .filter(x=>x.drift);
}
// Reusable warning banner for overtime drift across a set of plans (Overtime page,
// Payroll Workspace, Payroll Detail all render this from the same source of truth).
function payrollDriftBannerHTML(plans){
  const rows = payrollPlansWithDrift(plans);
  if(!rows.length) return '';
  const uncommitted = rows.filter(x=>!x.drift.committed);
  const committed   = rows.filter(x=> x.drift.committed);
  const item = x=>`<div class="insight-item warn"><b>${escapeHtml(x.pp.employeeName||'—')}</b> — ${escapeHtml(x.pp.month)} ${x.pp.year}${x.drift.addedAmount?`: +${fmtIDR(x.drift.addedAmount)} approved overtime`:''} <span class="faint">(${escapeHtml(payrollStage(x.pp))})</span></div>`;
  let html='';
  if(uncommitted.length){
    html += `<div class="card ot-drift-banner" style="margin-bottom:14px;border-left:3px solid var(--accent);">
      <h3>Overtime approved — payroll not yet updated <span class="tag">${uncommitted.length}</span></h3>
      <p style="margin:4px 0 8px;">${OT_DRIFT_MSG_UNCOMMITTED}</p>
      <div class="insight-list">${uncommitted.map(item).join('')}</div>
    </div>`;
  }
  if(committed.length){
    // v2.7.0 — the committed-drift banner is now actionable via the Supplemental Payroll
    // Engine. Show only plans that still need action: generate a supplemental, or open the
    // existing Draft/Review one. Drift already captured by a frozen (Approved/Posted/Executed)
    // supplemental is settled and is not shown here (see the Supplemental Payments page).
    const stateOf = (pp)=> (typeof supplementalPlanState==='function') ? supplementalPlanState(pp) : {needsGeneration:false, open:null, elig:{amount:0}};
    const actionable = committed.map(x=>({x, st:stateOf(x.pp)})).filter(o=>o.st.needsGeneration || o.st.open);
    if(actionable.length){
      const rowHTML = actionable.map(({x,st})=>{
        const amt = st.elig && st.elig.amount ? st.elig.amount : x.drift.addedAmount;
        const action = st.open
          ? `<button class="btn btn-sm" data-supp-open="${st.open.id}">Open ${escapeHtml(st.open.status)} Supplemental</button>`
          : `<button class="btn btn-sm btn-accent" data-supp-gen="${x.pp.id}">Generate Supplemental (${fmtIDR(amt)})</button>`;
        return `<div class="insight-item warn"><b>${escapeHtml(x.pp.employeeName||'—')}</b> — ${escapeHtml(x.pp.month)} ${x.pp.year}: +${fmtIDR(amt)} unpaid overtime <span style="margin-left:8px;">${action}</span></div>`;
      }).join('');
      html += `<div class="card ot-drift-banner" style="margin-bottom:14px;border-left:3px solid var(--brick);">
        <h3>Approved overtime added after payroll was posted <span class="tag">${actionable.length}</span></h3>
        <p style="margin:4px 0 2px;">Approved overtime was added after payroll was posted. The original payroll remains unchanged.</p>
        <p style="margin:0 0 8px;"><b>Settle it with a supplemental payment — the base payroll is never modified.</b></p>
        <div class="insight-list">${rowHTML}</div>
      </div>`;
    }
  }
  return html;
}
