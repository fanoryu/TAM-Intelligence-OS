/* ============================================================
   DASHBOARD & REPORT INTEGRATION HELPERS (v2.2.0)
   ============================================================ */
function hrDashboardStats(monthKey){
  const activeEmployees = State.employees.filter(empEligible).length;
  const activeContracts = State.contracts.filter(c=>contractEffectiveStatus(c)==='Active').length;
  const expiringSoon = State.contracts.filter(c=>contractEffectiveStatus(c)==='Expiring Soon').length;
  const plans = State.payrollPlans.filter(p=>p.monthKey===monthKey && p.status==='committed');
  const payrollPlanned = plans.reduce((s,p)=>s+(p.plannedAmount||0),0);
  const plan = monthlyPlanFor(monthKey);
  // payroll generation status for the month
  let payrollGen='Not generated';
  const eligible = State.employees.filter(empEligible).filter(e=>coveringContract(e.id, monthKey));
  if(plans.length){ payrollGen = plans.length>=eligible.length ? 'Committed' : 'Partially committed'; }
  else if(State.payrollDraft && State.payrollDraft.monthKey===monthKey){ payrollGen='Generated, not committed'; }
  return {activeEmployees, activeContracts, expiringSoon, payrollPlanned, payrollCount:plans.length, planStatus:plan?plan.status:'Not started', payrollGen, eligibleCount:eligible.length};
}
function hrDashboardAlerts(monthKey){
  const alerts = [];
  const warn = Number(State.settings.contractExpiryWarningDays)||90;
  const soon = State.contracts.filter(c=>contractEffectiveStatus(c)==='Expiring Soon');
  soon.slice(0,4).forEach(c=>{ const cc=contractCalc(c); alerts.push({type:'warn', text:`Contract ${escapeHtml(c.contractNumber||'')} (${escapeHtml(c.employeeName||'')}) is expiring soon — ${cc.daysUntilEnd} days left.`}); });
  const expired = State.contracts.filter(c=>contractEffectiveStatus(c)==='Expired' && c.status==='Active');
  expired.slice(0,3).forEach(c=>alerts.push({type:'warn', text:`Contract ${escapeHtml(c.contractNumber||'')} (${escapeHtml(c.employeeName||'')}) has expired — renew or close it.`}));
  State.employees.filter(empEligible).forEach(e=>{ if(!activeContractToday(e.id)) alerts.push({type:'warn', text:`${escapeHtml(e.fullName)} is Active with no current contract.`}); });
  const st = hrDashboardStats(monthKey);
  if(st.eligibleCount>0 && st.payrollGen==='Not generated') alerts.push({type:'info', text:`Payroll for ${escapeHtml(keyToMonthObj(monthKey).month)} has not been generated yet (${st.eligibleCount} eligible employee${st.eligibleCount>1?'s':''}).`});
  if(st.payrollGen==='Generated, not committed') alerts.push({type:'warn', text:`Payroll for ${escapeHtml(keyToMonthObj(monthKey).month)} is generated but not committed to the monthly plan.`});
  if(st.planStatus==='Draft') alerts.push({type:'info', text:`Monthly plan for ${escapeHtml(keyToMonthObj(monthKey).month)} is still in Draft.`});
  // duplicate payroll safety check
  const seen={}; let dup=0;
  State.txns.filter(t=>t.source==='payroll' && t.monthKey===monthKey).forEach(t=>{ const k=t.employeeId+'|'+t.contractId; if(seen[k]) dup++; else seen[k]=1; });
  if(dup) alerts.push({type:'warn', text:`${dup} potential duplicate payroll transaction(s) detected for ${escapeHtml(keyToMonthObj(monthKey).month)}.`});
  return alerts;
}
function hrStatStripHTML(monthKey){
  const st = hrDashboardStats(monthKey);
  return `<div class="grid grid-4" style="margin-bottom:14px;">
    <div class="card stat-card"><div class="stat-label">Active Employees</div><div class="stat-value">${st.activeEmployees}</div><div class="stat-sub dim">eligible for payroll</div></div>
    <div class="card stat-card"><div class="stat-label">Active Contracts</div><div class="stat-value">${st.activeContracts}</div><div class="stat-sub ${st.expiringSoon?'neg':'dim'}">${st.expiringSoon} expiring soon</div></div>
    <div class="card stat-card"><div class="stat-label">Payroll Planned (${escapeHtml(keyToMonthObj(monthKey).month)})</div><div class="stat-value">${fmtIDRShort(st.payrollPlanned)}</div><div class="stat-sub dim">${st.payrollCount} committed plan${st.payrollCount===1?'':'s'}</div></div>
    <div class="card stat-card"><div class="stat-label">Monthly Plan</div><div class="stat-value" style="font-size:15px;">${st.planStatus==='Not started'?'<span class="faint">Not started</span>':hrStatusBadge(st.planStatus,PLAN_STATUS_META)}</div><div class="stat-sub dim">Payroll: ${escapeHtml(st.payrollGen)}</div></div>
  </div>`;
}

/* ---------- HR reports ---------- */
function hrReportDefs(){
  return [
    {id:'employees', label:'Employee List'},
    {id:'active-contracts', label:'Active Contracts'},
    {id:'expiring', label:'Expiring Contracts'},
    {id:'payroll-month', label:'Monthly Payroll Plan'},
    {id:'payroll-employee', label:'Payroll by Employee'},
    {id:'payroll-contract', label:'Payroll by Contract'},
    {id:'contract-cost', label:'Contract Cost Summary'},
    {id:'overtime-month', label:'Monthly Overtime Summary'},
    {id:'overtime-employee', label:'Overtime by Employee'},
    {id:'overtime-contract', label:'Overtime by Contract'},
    {id:'overtime-top', label:'Employees with Highest Overtime'},
    {id:'overtime-pending', label:'Overtime Pending Review'},
    {id:'payroll-overtime', label:'Payroll with Overtime Breakdown'},
    {id:'import-batches', label:'Smart Import Batches'},
    {id:'employee-duplicate-audit', label:'Employee Duplicate Audit'},
    {id:'payroll-register', label:'Monthly Payroll Register'},
    {id:'payroll-department', label:'Payroll by Department'},
    {id:'payroll-components', label:'Payroll Components'},
    {id:'payroll-execution', label:'Payroll Execution Status'},
    {id:'payroll-excluded', label:'Excluded Employees Report'},
  ];
}
function hrReportRows(id, monthKey){
  if(id==='employees'){
    let emps = State.employees.slice();
    if(!State.settings.includeInactiveInReports) emps = emps.filter(e=>e.active!==false);
    return {headers:['Employee ID','Name','Job Title','Department','Status','Active Contract','Base Salary'],
      rows:emps.map(e=>{ const ct=activeContractToday(e.id); return [e.employeeId,e.fullName,e.jobTitle,e.department,e.employmentStatus,ct?ct.contractNumber:'—',fmtIDR(e.monthlyBaseSalary)]; })};
  }
  if(id==='active-contracts'){
    const cs = State.contracts.filter(c=>['Active','Expiring Soon'].includes(contractEffectiveStatus(c)));
    return {headers:['Contract #','Employee','Start','End','Progress','Monthly','Status'],
      rows:cs.map(c=>{ const cc=contractCalc(c); return [c.contractNumber,c.employeeName,cc.startDate,cc.endDate,cc.progress,fmtIDR(c.monthlySalary),contractEffectiveStatus(c)]; })};
  }
  if(id==='expiring'){
    const cs = State.contracts.filter(c=>contractEffectiveStatus(c)==='Expiring Soon' || contractEffectiveStatus(c)==='Expired');
    return {headers:['Contract #','Employee','End Date','Days Left','Status'],
      rows:cs.map(c=>{ const cc=contractCalc(c); return [c.contractNumber,c.employeeName,cc.endDate,cc.daysUntilEnd,contractEffectiveStatus(c)]; })};
  }
  if(id==='payroll-month'){
    const ps = State.payrollPlans.filter(p=>p.monthKey===monthKey);
    return {headers:['Employee','Contract','Progress','Base','Overtime','Allowance','Bonus','Benefits','Deduction','Planned','Status'],
      rows:ps.map(p=>[p.employeeName,p.contractNumber,p.contractProgress,fmtIDR(p.baseSalary),fmtIDR(p.overtime),fmtIDR(p.allowance),fmtIDR(p.bonus),fmtIDR(p.benefits),fmtIDR(p.deduction),fmtIDR(p.plannedAmount),p.status])};
  }
  if(id==='payroll-employee'){
    const map={}; State.payrollPlans.forEach(p=>{ (map[p.employeeName]=map[p.employeeName]||{n:0,sum:0}); map[p.employeeName].n++; map[p.employeeName].sum+=p.plannedAmount||0; });
    return {headers:['Employee','Payroll Plans','Total Planned'], rows:Object.entries(map).map(([k,v])=>[k,v.n,fmtIDR(v.sum)])};
  }
  if(id==='payroll-contract'){
    const map={}; State.payrollPlans.forEach(p=>{ (map[p.contractNumber]=map[p.contractNumber]||{n:0,sum:0}); map[p.contractNumber].n++; map[p.contractNumber].sum+=p.plannedAmount||0; });
    return {headers:['Contract','Payroll Plans','Total Planned'], rows:Object.entries(map).map(([k,v])=>[k,v.n,fmtIDR(v.sum)])};
  }
  if(id==='contract-cost'){
    return {headers:['Contract #','Employee','Monthly','Duration','Total Contract Value','Status'],
      rows:State.contracts.map(c=>[c.contractNumber,c.employeeName,fmtIDR(c.monthlySalary),c.durationMonths,fmtIDR((c.monthlySalary||0)*(c.durationMonths||0)),contractEffectiveStatus(c)])};
  }
  const otAmt = o=>num(o.approvedAmount!=null?o.approvedAmount:o.calculatedAmount);
  if(id==='overtime-month'){
    const recs = State.overtimeRecords.filter(o=>o.monthKey===monthKey);
    return {headers:['Employee','Contract','Date','Hours','Hourly Rate','Amount','Status'],
      rows:recs.map(o=>[o.employeeName,o.contractNumber,o.overtimeDate||'',o.overtimeHours,fmtIDRfull(o.hourlyRate),fmtIDR(otAmt(o)),o.status])};
  }
  if(id==='overtime-employee'){
    const map={}; State.overtimeRecords.forEach(o=>{ (map[o.employeeName]=map[o.employeeName]||{h:0,amt:0,n:0}); map[o.employeeName].h+=num(o.overtimeHours); map[o.employeeName].amt+=otAmt(o); map[o.employeeName].n++; });
    return {headers:['Employee','Records','Total Hours','Total Amount'], rows:Object.entries(map).map(([k,v])=>[k,v.n,v.h,fmtIDR(v.amt)])};
  }
  if(id==='overtime-contract'){
    const map={}; State.overtimeRecords.forEach(o=>{ const k=o.contractNumber||'—'; (map[k]=map[k]||{h:0,amt:0,n:0}); map[k].h+=num(o.overtimeHours); map[k].amt+=otAmt(o); map[k].n++; });
    return {headers:['Contract','Records','Total Hours','Total Amount'], rows:Object.entries(map).map(([k,v])=>[k,v.n,v.h,fmtIDR(v.amt)])};
  }
  if(id==='overtime-top'){
    const map={}; State.overtimeRecords.forEach(o=>{ (map[o.employeeName]=map[o.employeeName]||{h:0,amt:0}); map[o.employeeName].h+=num(o.overtimeHours); map[o.employeeName].amt+=otAmt(o); });
    const rows=Object.entries(map).map(([k,v])=>[k,v.h,v.amt]).sort((a,b)=>b[1]-a[1]).map(r=>[r[0],r[1],fmtIDR(r[2])]);
    return {headers:['Employee','Total Hours','Total Amount'], rows};
  }
  if(id==='overtime-pending'){
    const recs = State.overtimeRecords.filter(o=>['Draft','Submitted','Reviewed'].includes(o.status));
    return {headers:['Employee','Month','Date','Hours','Amount','Status'], rows:recs.map(o=>[o.employeeName,o.monthKey,o.overtimeDate||'',o.overtimeHours,fmtIDR(otAmt(o)),o.status])};
  }
  if(id==='payroll-overtime'){
    const ps = State.payrollPlans.filter(p=>p.monthKey===monthKey);
    return {headers:['Employee','Contract','Base','Overtime','Planned Total','OT Records','Status'],
      rows:ps.map(p=>[p.employeeName,p.contractNumber,fmtIDR(p.baseSalary),fmtIDR(p.overtime),fmtIDR(p.plannedAmount),(p.overtimeIds||[]).length,p.status])};
  }
  if(id==='import-batches'){
    return {headers:['File','Committed','Employees','Contracts','Payroll','Transactions','Duplicates Skipped','Status'],
      rows:State.importBatches.map(b=>[b.fileName, new Date(b.ts).toLocaleString('id-ID'), b.counts.employees, b.counts.contracts, b.counts.payrollPlans, b.counts.txns, b.counts.duplicatesSkipped||0, b.undone?'Undone':'Active'])};
  }
  if(id==='employee-duplicate-audit'){
    // Part 12 — one row per normalized name that has (or had) duplicates, plus any merged names.
    const rows=[];
    findEmployeeDuplicateGroups().forEach(g=>{
      const canon=g.canonical; const t=employeeLinkTotals; let cts=0,pps=0,txs=0;
      g.employees.forEach(e=>{ const x=t(e.id); cts+=x.contracts; pps+=x.payrollPlans; txs+=x.txns; });
      rows.push([g.name, g.employees.map(e=>e.employeeId||e.id).join(' / '), (canon.employeeId||canon.id)+' (suggested)', cts, pps, txs, 'Needs Merge']);
    });
    (State.employeeMerges||[]).forEach(m=>{
      rows.push([m.canonicalName||'—', (m.duplicateCodes||m.duplicateEmployeeIds).join(' / '), m.canonicalCode||m.canonicalEmployeeId, m.relinkedCounts.contracts, m.relinkedCounts.payrollPlans, m.relinkedCounts.txns, 'Merged '+new Date(m.ts).toLocaleDateString('id-ID')]);
    });
    return {headers:['Normalized Name','Employee IDs','Canonical Employee','Contracts','Payroll Plans','Transactions','Merge Status'], rows};
  }
  if(id==='payroll-register'){
    const ps=payrollPlansForMonth(monthKey,true);
    return {headers:['Employee','Contract','Progress','Department','Base','Overtime','Additions','Deductions','Planned','Status'],
      rows:ps.map(p=>[p.employeeName,p.contractNumber,p.contractProgress,p.department,fmtIDR(payrollBaseSalary(p)),fmtIDR(p.overtimeAmount),fmtIDR(num(p.allowance)+num(p.bonus)+num(p.benefits)+num(p.otherAddition)),fmtIDR(num(p.deduction)+num(p.otherDeduction)),fmtIDR(computePayrollPlanned(p)),p.status])};
  }
  if(id==='payroll-department'){
    const map={}; payrollPlansForMonth(monthKey).forEach(p=>{ const d=p.department||'—'; (map[d]=map[d]||{n:0,sum:0}); map[d].n++; map[d].sum+=computePayrollPlanned(p); });
    return {headers:['Department','Employees','Total Planned'], rows:Object.entries(map).map(([k,v])=>[k,v.n,fmtIDR(v.sum)])};
  }
  if(id==='payroll-components'){
    const ps=payrollPlansForMonth(monthKey);
    return {headers:['Employee','Base','Overtime','Allowance','Bonus','Benefits','Other +','Deduction','Other −','Planned'],
      rows:ps.map(p=>[p.employeeName,fmtIDR(payrollBaseSalary(p)),fmtIDR(p.overtimeAmount),fmtIDR(p.allowance),fmtIDR(p.bonus),fmtIDR(p.benefits),fmtIDR(p.otherAddition),fmtIDR(p.deduction),fmtIDR(p.otherDeduction),fmtIDR(computePayrollPlanned(p))])};
  }
  if(id==='payroll-execution'){
    const ps=payrollPlansForMonth(monthKey).filter(p=>p.status==='Committed');
    return {headers:['Employee','Planned','Actual Paid','Remaining','Transaction Status','Execution Date'],
      rows:ps.map(p=>{ const t=payrollTxnOf(p); return [p.employeeName,fmtIDR(p.plannedAmount),t&&t.actual!=null?fmtIDR(t.actual):'—',t?fmtIDR(num(t.planned)-num(t.actual)):'—',t?statusOf(t):'—',(t&&t.execution&&t.execution.executionDate)||'—']; })};
  }
  if(id==='payroll-excluded'){
    const ex=State.employees.map(e=>({e,reason:payrollExclusionReason(e,monthKey)})).filter(x=>x.reason);
    return {headers:['Employee','Department','Reason'], rows:ex.map(x=>[x.e.fullName,x.e.department||'—',x.reason])};
  }
  return {headers:[], rows:[]};
}
function exportHRReportCsv(id, monthKey){
  const def = hrReportDefs().find(d=>d.id===id);
  const {headers, rows} = hrReportRows(id, monthKey);
  const lines = [`# ${APP_NAME} v${APP_VERSION} — ${def?def.label:id}`, headers.map(csvSafe).join(',')];
  rows.forEach(r=>lines.push(r.map(csvSafe).join(',')));
  downloadBlob(lines.join('\n'), `${FILE_BASE}-${id}.csv`, 'text/csv');
  toast('Report exported (CSV).');
}
