/* ============================================================
   PAYROLL WORKSPACE UI (Parts 2, 4, 6, 7, 8, 18)
   ============================================================ */
function payrollSelSet(monthKey){ if(!State.payrollSel[monthKey]) State.payrollSel[monthKey]=new Set(); return State.payrollSel[monthKey]; }
function cycleStatusPill(cs){
  const map={'Not Generated':'pill-status-archived','Draft':'pill-status-planned','In Review':'pill-status-scheduled','Ready to Commit':'pill-status-partial','Committed':'pill-status-completed','Partially Executed':'pill-status-partial','Fully Executed':'pill-status-completed'};
  return `<span class="pill ${map[cs]||'pill-other'}">${escapeHtml(cs)}</span>`;
}
function renderPayrollWorkspace(main){
  // Empty-state onboarding (Part 18)
  if(!State.employees.length || !State.contracts.length){
    main.innerHTML = pageHeader('Payroll Planning','The monthly payroll operations workspace — run the full cycle inside TAM Intelligence OS.')
      + `<div class="card"><div class="empty">
        <div class="big">৳</div>
        <div style="color:var(--text);font-weight:600;margin-bottom:6px;">No employees and contracts are available yet</div>
        <div style="margin-bottom:14px;">Add employees and active contracts, then generate payroll — no Excel required for the monthly cycle.</div>
        <div class="small-btn-row" style="justify-content:center;flex-wrap:wrap;">
          <button class="btn btn-accent" data-empty-nav="employees">Add Employee</button>
          <button class="btn" data-empty-nav="contracts">Create Contract</button>
          <button class="btn" data-empty-nav="add">Import Initial Company Data</button>
        </div></div></div>`;
    bindActionEmptyState(main); return;
  }
  const months = getMonths();
  const keys = [...new Set([...months.map(m=>m.key), ...State.payrollPlans.map(p=>p.monthKey), todayKey()])].sort();
  if(!State.payrollMonth || !keys.includes(State.payrollMonth)) State.payrollMonth = keys[keys.length-1];
  const monthKey = State.payrollMonth, mo = keyToMonthObj(monthKey);
  const cs = payrollCycleStatus(monthKey);
  const plans = payrollPlansForMonth(monthKey, true);
  const tot = payrollMonthTotals(monthKey);
  const eligible = State.employees.filter(e=>!payrollExclusionReason(e, monthKey));
  const excludedNow = State.employees.map(e=>({e, reason:payrollExclusionReason(e, monthKey)})).filter(x=>x.reason);
  const f = State.payrollFilter;
  const depts=[...new Set(State.employees.map(e=>e.department).filter(Boolean))].sort();

  main.innerHTML = `
    <div class="page-head">
      <div><h1>Payroll Planning</h1><p class="desc">Monthly payroll operations workspace — Employee → Contract → Overtime → Generate → Review → Commit → Execution.</p></div>
      <div class="head-controls">
        <select class="input" id="payMonth">${keys.map(k=>{const o=keyToMonthObj(k);return `<option value="${k}" ${k===monthKey?'selected':''}>${o.month} ${o.year}</option>`;}).join('')}</select>
        <button class="btn btn-accent" id="genPay">Generate Payroll for ${escapeHtml(mo.month)}</button>
        <button class="btn" id="nextMonth">Prepare Next Month</button>
        <button class="btn" id="adjBtn">Adjustments</button>
      </div>
    </div>
    <div class="grid grid-4" style="margin-bottom:14px;">
      <div class="card stat-card"><div class="stat-label">Payroll Cycle</div><div class="stat-value" style="font-size:15px;">${cycleStatusPill(cs)}</div><div class="stat-sub dim">${escapeHtml(mo.month)} ${mo.year}</div></div>
      <div class="card stat-card"><div class="stat-label">Employees</div><div class="stat-value">${plans.filter(p=>p.status!=='Cancelled').length}</div><div class="stat-sub dim">${eligible.length} eligible · ${excludedNow.length} excluded</div></div>
      <div class="card stat-card"><div class="stat-label">Review</div><div class="stat-value" style="font-size:15px;">${tot.reviewed} reviewed · ${tot.ready} ready</div><div class="stat-sub dim">${tot.committed} committed · ${tot.draft} draft</div></div>
      <div class="card stat-card"><div class="stat-label">Total Planned Payroll</div><div class="stat-value">${fmtIDRShort(tot.planned)}</div><div class="stat-sub dim">paid ${fmtIDRShort(tot.paid)} · remaining ${fmtIDRShort(tot.remaining)}</div></div>
    </div>
    <div class="grid grid-4" style="margin-bottom:14px;">
      <div class="chart-mini-stat"><div class="lbl">Total Base Salary</div><div class="val">${fmtIDRShort(tot.base)}</div></div>
      <div class="chart-mini-stat"><div class="lbl">Total Overtime</div><div class="val">${fmtIDRShort(tot.overtime)}</div></div>
      <div class="chart-mini-stat"><div class="lbl">Total Additions</div><div class="val">${fmtIDRShort(tot.additions)}</div></div>
      <div class="chart-mini-stat"><div class="lbl">Total Deductions</div><div class="val">${fmtIDRShort(tot.deductions)}</div></div>
    </div>
    <div id="payArea"></div>
    ${excludedNow.length?`<div class="card" style="margin-top:14px;"><h3>Excluded Employees <span class="tag">${excludedNow.length}</span></h3><div class="insight-list">${excludedNow.map(x=>`<div class="insight-item warn"><b>${escapeHtml(x.e.fullName)}</b> — ${escapeHtml(x.reason)}</div>`).join('')}</div></div>`:''}`;

  document.getElementById('payMonth').addEventListener('change', e=>{ State.payrollMonth=e.target.value; renderPayrollWorkspace(main); });
  document.getElementById('genPay').addEventListener('click', async ()=>{
    const res = generatePayrollForMonth(monthKey); await persistPayrollPlans();
    let msg=`Generated ${res.generated}, refreshed ${res.refreshed}, ${res.excluded.length} excluded.`;
    if(res.skippedCommitted) msg+=` ${res.skippedCommitted} committed row(s) left unchanged.`;
    if(res.changed) msg+=` ${res.changed} row(s) marked Changed (overtime updated).`;
    showSuccess(msg, 6000); renderPayrollWorkspace(main);
  });
  document.getElementById('nextMonth').addEventListener('click', ()=>prepareNextMonthPayroll(monthKey));
  document.getElementById('adjBtn').addEventListener('click', ()=>hrNavTo('payrollAdjustments'));

  const area = document.getElementById('payArea');
  const workRows = plans.filter(p=>p.status!=='Cancelled');
  if(!workRows.length){
    area.innerHTML = `<div class="card"><div class="empty"><div style="color:var(--text);font-weight:600;margin-bottom:6px;">Payroll has not been generated for this month.</div><div style="margin-bottom:12px;">Click “Generate Payroll for ${escapeHtml(mo.month)}” to build the worksheet from active contracts, approved overtime, and recurring adjustments.</div><button class="btn btn-accent" id="genPay2">Generate Payroll</button></div></div>`;
    const g2=document.getElementById('genPay2'); if(g2) g2.addEventListener('click', ()=>document.getElementById('genPay').click());
    return;
  }
  renderPayrollWorksheet(area, monthKey, main);
}

/* v2.6.1 — Payroll worksheet incremental list. The search box and the three filter
   selects call applyPayrollFilter, which swaps only the <tbody> and re-binds the row
   controls (selection checkboxes, inline amount/notes edits, row actions). The search
   input keeps focus/caret/selection, the worksheet keeps its scroll, and selection
   checkbox state survives filtering (it lives in State.payrollSel). */
const PAYROLL_STICKY='position:sticky;left:0;background:var(--surface);z-index:1;box-shadow:1px 0 0 var(--border-soft);';
function payrollRowsFiltered(monthKey){
  const f=State.payrollFilter;
  let rows = payrollPlansForMonth(monthKey, true).filter(p=>p.status!=='Cancelled');
  if(f.search.trim()){ const s=normStr(f.search); rows=rows.filter(p=>[p.employeeName,p.contractNumber,p.department,p.notes].some(x=>normStr(x||'').includes(s))); }
  if(f.department!=='all') rows=rows.filter(p=>(p.department||'')===f.department);
  if(f.status!=='all') rows=rows.filter(p=>p.status===f.status);
  if(f.contractStatus!=='all') rows=rows.filter(p=>{ const c=contractById(p.contractId); return c && contractEffectiveStatus(c, monthKey)===f.contractStatus; });
  rows.sort((a,b)=>String(a.employeeName||'').localeCompare(String(b.employeeName||'')));
  return rows;
}
function payrollWorksheetBodyHTML(monthKey, sel, sticky){
  return payrollRowsFiltered(monthKey).map(p=>payrollWorksheetRowHTML(p, sel, sticky)).join('') || '<tr><td colspan="19" class="empty">No rows match these filters.</td></tr>';
}
function bindPayrollRows(area, monthKey, main, sel){
  // selection
  area.querySelectorAll('[data-psel]').forEach(cb=>cb.addEventListener('change', e=>{ const id=e.target.dataset.psel; if(e.target.checked) sel.add(id); else sel.delete(id); }));
  // inline edit — persist on change (blur), live-update planned + totals on input
  area.querySelectorAll('input[data-pp]').forEach(inp=>{
    const id=inp.dataset.pp, field=inp.dataset.field;
    const live=()=>{ const pp=payrollPlanById(id); if(!pp) return; pp[field]= field==='notes'?inp.value:num(inp.value); pp.plannedAmount=computePayrollPlanned(pp); const cell=area.querySelector(`#pl-${id}`); if(cell) cell.innerHTML=`<b style="${payrollIsNegative(pp)?'color:var(--brick);':''}">${fmtIDR(pp.plannedAmount)}</b>`; };
    inp.addEventListener('input', live);
    inp.addEventListener('change', async ()=>{ const pp=payrollPlanById(id); if(!pp) return; pp.updatedAt=new Date().toISOString(); (pp.history=pp.history||[]).push({event:'edited', ts:pp.updatedAt, note:'Component edited: '+field}); if(pp.status==='Reviewed'||pp.status==='Ready'){ pp.status='Draft'; (pp.history=pp.history||[]).push({event:'edited',ts:pp.updatedAt,note:'Returned to Draft after edit'}); } await persistPayrollPlans(); });
  });
  // row actions
  area.querySelectorAll('[data-pact]').forEach(b=>b.addEventListener('click', async ()=>{
    const id=b.dataset.pid, act=b.dataset.pact;
    if(act==='detail') hrNavTo('payrollDetail',{detailPayrollId:id});
    else if(act==='review'){ await setPayrollStatus(id,'Reviewed'); render(); }
    else if(act==='ready'){ await setPayrollStatus(id,'Ready'); render(); }
    else if(act==='draft'){ await setPayrollStatus(id,'Draft'); render(); }
    else if(act==='cancel'){ if(confirmAction('Cancel this payroll row? It will not create a finance transaction.')){ await setPayrollStatus(id,'Cancelled'); render(); } }
    else if(act==='override') openSalaryOverride(id, main);
    else if(act==='ot') openPayrollOvertimeBreakdown(id);
    else if(act==='exec'){ const pp=payrollPlanById(id); const t=payrollTxnOf(pp); if(t){ State.view='executioncenter'; State.execFilter='today'; render(); } else showWarning('No committed transaction yet.'); }
  }));
  bindHRActions(area); // wire the per-row Actions ▾ dropdowns (prow:*)
}
function applyPayrollFilter(area, monthKey, main){
  const tb=document.getElementById('pwRows'); if(!tb) return;
  const sel=payrollSelSet(monthKey);
  tb.innerHTML=payrollWorksheetBodyHTML(monthKey, sel, PAYROLL_STICKY);
  bindPayrollRows(area, monthKey, main, sel);
}
function renderPayrollWorksheet(area, monthKey, main){
  const f=State.payrollFilter;
  const depts=[...new Set(State.employees.map(e=>e.department).filter(Boolean))].sort();
  const sel=payrollSelSet(monthKey);
  const sticky=PAYROLL_STICKY;

  area.innerHTML = `<div class="card">
    <div class="form-grid" style="grid-template-columns:1.6fr 1fr 1fr 1fr;margin-bottom:12px;">
      <div class="field"><label>Search</label><input class="input" id="pfSearch" placeholder="employee, contract, notes" value="${escapeHtml(f.search)}"></div>
      <div class="field"><label>Department</label><select class="input" id="pfDept"><option value="all">All</option>${depts.map(d=>`<option ${f.department===d?'selected':''}>${escapeHtml(d)}</option>`).join('')}</select></div>
      <div class="field"><label>Payroll Status</label><select class="input" id="pfStatus"><option value="all">All</option>${PAYROLL_STATUSES.map(s=>`<option ${f.status===s?'selected':''}>${s}</option>`).join('')}</select></div>
      <div class="field"><label>Contract Status</label><select class="input" id="pfCt"><option value="all">All</option>${Object.keys(CONTRACT_STATUS_META).map(s=>`<option ${f.contractStatus===s?'selected':''}>${s}</option>`).join('')}</select></div>
    </div>
    <div class="small-btn-row" style="flex-wrap:wrap;gap:8px;margin-bottom:12px;">
      <button class="btn btn-sm" id="pbSelAll">Select All</button>
      <button class="btn btn-sm" id="pbReview">Review Selected</button>
      <button class="btn btn-sm" id="pbReady">Mark Ready</button>
      <button class="btn btn-sm" id="pbDraft">Return to Draft</button>
      <button class="btn btn-sm btn-danger" id="pbCancel">Cancel Rows</button>
      <button class="btn btn-accent" id="pbCommit">Commit Ready Payroll</button>
      <button class="btn btn-sm" id="pbCsv">Export CSV</button>
    </div>
    <div class="table-wrap" style="max-height:560px;overflow:auto;">
      <table style="min-width:1500px;">
        <thead><tr>
          <th style="${sticky}width:32px;"></th><th style="${sticky.replace('left:0','left:32px')}">Employee</th>
          <th>Contract</th><th>Progress</th><th>Dept</th><th class="num">h/day</th><th class="num">Base</th>
          <th class="num">OT Hrs</th><th class="num">OT Amt</th><th class="num">Allowance</th><th class="num">Bonus</th><th class="num">Benefits/BPJS</th><th class="num">Other +</th><th class="num">Deduction</th><th class="num">Other −</th>
          <th class="num">Planned</th><th>Status</th><th>Notes</th><th></th>
        </tr></thead>
        <tbody id="pwRows">${payrollWorksheetBodyHTML(monthKey, sel, sticky)}</tbody>
      </table>
    </div>
    <p class="hint" style="margin-top:10px;">Base salary comes from the active contract (read-only; use Override for this month only). Overtime comes from approved overtime records (read-only). Only Ready rows are committed. Committed rows are locked here — manage payment in the Execution Center.</p>
  </div>`;

  document.getElementById('pfSearch').addEventListener('input', e=>{ f.search=e.target.value; applyPayrollFilter(area, monthKey, main); });
  document.getElementById('pfDept').addEventListener('change', e=>{ f.department=e.target.value; applyPayrollFilter(area, monthKey, main); });
  document.getElementById('pfStatus').addEventListener('change', e=>{ f.status=e.target.value; applyPayrollFilter(area, monthKey, main); });
  document.getElementById('pfCt').addEventListener('change', e=>{ f.contractStatus=e.target.value; applyPayrollFilter(area, monthKey, main); });
  document.getElementById('pbSelAll').addEventListener('click', ()=>{ payrollRowsFiltered(monthKey).forEach(p=>sel.add(p.id)); applyPayrollFilter(area, monthKey, main); });
  // bulk
  const selIds=()=>[...sel];
  document.getElementById('pbReview').addEventListener('click', async ()=>{ const n=await bulkPayrollStatus(monthKey, selIds(),'Reviewed'); showSuccess(n+' row(s) reviewed.'); render(); });
  document.getElementById('pbReady').addEventListener('click', async ()=>{ const n=await bulkPayrollStatus(monthKey, selIds(),'Ready'); showSuccess(n+' row(s) marked Ready (rows with blockers were skipped).'); render(); });
  document.getElementById('pbDraft').addEventListener('click', async ()=>{ const n=await bulkPayrollStatus(monthKey, selIds(),'Draft'); showSuccess(n+' row(s) returned to Draft.'); render(); });
  document.getElementById('pbCancel').addEventListener('click', async ()=>{ if(!confirmAction('Cancel selected payroll rows? They will not create finance transactions.')) return; const n=await bulkPayrollStatus(monthKey, selIds(),'Cancelled'); sel.clear(); showSuccess(n+' row(s) cancelled.'); render(); });
  document.getElementById('pbCsv').addEventListener('click', ()=>exportPayrollCsv(monthKey));
  document.getElementById('pbCommit').addEventListener('click', ()=>openCommitPayrollModal(monthKey, main));
  bindPayrollRows(area, monthKey, main, sel); // selection, inline edits, row actions + Actions ▾
}
function payrollWorksheetRowHTML(p, sel, sticky){
  const csName = p.status;
  const disabled = p.status==='Committed'?'disabled':'';
  const sched = p.workScheduleSnapshot||{};
  const numCell=(field)=>`<td class="num"><input class="input" style="width:92px;text-align:right;padding:4px 6px;" type="number" step="any" data-pp="${p.id}" data-field="${field}" value="${num(p[field])}" ${disabled}></td>`;
  const flags = (p.missingSalary?'<span class="pill pill-status-cancelled">no salary</span> ':'')+(p.missingSchedule?'<span class="pill pill-status-partial">no schedule</span> ':'')+(p.salaryOverride?'<span class="pill pill-status-scheduled" title="Salary overridden">override</span> ':'')+(p.otChanged?'<span class="pill pill-status-partial">changed</span> ':'');
  return `<tr>
    <td style="${sticky}"><input type="checkbox" data-psel="${p.id}" ${sel.has(p.id)?'checked':''}></td>
    <td style="${sticky.replace('left:0','left:32px')}"><button class="linklike" data-pact="detail" data-pid="${p.id}"><b>${escapeHtml(p.employeeName||'—')}</b></button><div class="faint" style="font-size:10px;">${flags}</div></td>
    <td class="dim">${escapeHtml(p.contractNumber||'—')}</td>
    <td>${escapeHtml(p.contractProgress||'—')}</td>
    <td class="dim">${escapeHtml(p.department||'—')}</td>
    <td class="num">${sched.hoursPerDay||'—'}</td>
    <td class="num">${fmtIDR(payrollBaseSalary(p))}${p.status!=='Committed'?` <button class="btn btn-sm" data-pact="override" data-pid="${p.id}" style="padding:1px 5px;">✎</button>`:''}</td>
    <td class="num">${num(p.overtimeHours)}</td>
    <td class="num">${fmtIDR(p.overtimeAmount)}${(p.overtimeIds&&p.overtimeIds.length)?` <button class="btn btn-sm" data-pact="ot" data-pid="${p.id}" style="padding:1px 5px;">OT</button>`:''}</td>
    ${numCell('allowance')}${numCell('bonus')}${numCell('benefits')}${numCell('otherAddition')}${numCell('deduction')}${numCell('otherDeduction')}
    <td class="num" id="pl-${p.id}"><b style="${payrollIsNegative(p)?'color:var(--brick);':''}">${fmtIDR(computePayrollPlanned(p))}</b></td>
    <td>${hrStatusBadge(p.status, PAYROLL_STATUS_META)}</td>
    <td><input class="input" style="width:120px;padding:4px 6px;" data-pp="${p.id}" data-field="notes" value="${escapeHtml(p.notes||'')}" ${disabled}></td>
    <td>${hrActionsMenu('prow', p.id, [
      ['detail','View Detail'],
      p.status==='Draft'?['review','Mark Reviewed']:null,
      (p.status==='Reviewed'||p.status==='Draft')?['ready','Mark Ready']:null,
      (p.status==='Reviewed'||p.status==='Ready')?['draft','Return to Draft']:null,
      p.status==='Committed'?['exec','Open in Execution Center']:null,
      p.status!=='Committed'?['cancel','Cancel Row']:null,
    ])}</td>
  </tr>`;
}
function openPayrollOvertimeBreakdown(id){
  const pp=payrollPlanById(id); if(!pp) return;
  const recs=(pp.overtimeIds||[]).map(overtimeById).filter(Boolean);
  openModalHTML(`<h3>Overtime Breakdown — ${escapeHtml(pp.employeeName)}</h3>
    <div class="table-wrap"><table><thead><tr><th>Date</th><th class="num">Hours</th><th>Description</th><th class="num">Std Hrs</th><th class="num">Rate</th><th class="num">Calc</th><th class="num">Approved</th><th>Status</th></tr></thead>
    <tbody>${recs.map(o=>`<tr><td class="dim">${escapeHtml(o.overtimeDate||'—')}</td><td class="num">${num(o.overtimeHours)}</td><td>${escapeHtml(o.workDescription||'')}</td><td class="num">${o.monthlyStandardHours}</td><td class="num">${fmtIDRfull(o.hourlyRate)}</td><td class="num">${fmtIDR(o.calculatedAmount)}</td><td class="num">${o.approvedAmount!=null?fmtIDR(o.approvedAmount):'—'}</td><td>${hrStatusBadge(o.status,OVERTIME_STATUS_META)}</td></tr>`).join('')||'<tr><td colspan="8" class="empty">No approved overtime.</td></tr>'}</tbody></table></div>
    <div class="modal-actions"><button type="button" class="btn" id="obc">Close</button></div>`, {width:720, onMount:(r)=>r.querySelector('#obc').addEventListener('click', closeModal)});
}
function openCommitPayrollModal(monthKey, main){
  const sel=payrollSelSet(monthKey);
  let ids=[...sel]; if(!ids.length) ids=payrollPlansForMonth(monthKey).filter(p=>p.status==='Ready').map(p=>p.id);
  const readyIds=ids.filter(id=>{ const p=payrollPlanById(id); return p&&p.status==='Ready'; });
  if(!readyIds.length){ showWarning('No Ready payroll rows to commit. Mark rows Ready first.'); return; }
  const s=commitPayrollPreview(monthKey, readyIds);
  openModalHTML(`<h3>Commit Ready Payroll to Monthly Plan</h3>
    <div style="font-size:12.5px;line-height:1.95;">
      <div>Employees selected: <b>${s.employees}</b></div>
      <div>Base salary total: <b class="mono">${fmtIDR(s.base)}</b></div>
      <div>Overtime total: <b class="mono">${fmtIDR(s.overtime)}</b></div>
      <div>Additions total: <b class="mono">${fmtIDR(s.additions)}</b></div>
      <div>Deductions total: <b class="mono">${fmtIDR(s.deductions)}</b></div>
      <div>Final payroll total: <b class="mono" style="color:var(--accent);">${fmtIDR(s.planned)}</b></div>
      <div class="divider" style="margin:8px 0;"></div>
      <div>New transactions: <b>${s.newTxn}</b> · Existing: <b>${s.existingTxn}</b> · Changed: <b>${s.changedTxn}</b></div>
      <div>Conflicts: <b>${s.conflicts}</b> · Skipped (not Ready): <b>${s.skipped}</b></div>
    </div>
    <p class="hint" style="margin-top:8px;">Creates one Planned Gaji transaction per employee with structured links (status Planned, actual null). Nothing is executed automatically; duplicates are not created.</p>
    <div class="modal-actions"><button type="button" class="btn" id="cpCancel">Cancel</button><button type="button" class="btn btn-accent" id="cpGo">Commit ${readyIds.length} Row(s)</button></div>`,
    {width:560, onMount:(root)=>{
      root.querySelector('#cpCancel').addEventListener('click', closeModal);
      root.querySelector('#cpGo').addEventListener('click', async ()=>{
        const res=await commitReadyPayroll(monthKey, readyIds); sel.clear(); closeModal();
        showSuccess(`Committed: ${res.created} transaction(s) created, ${res.updated} updated${res.skipped?', '+res.skipped+' skipped':''}.`, 6000);
        render();
      });
    }});
}
function exportPayrollCsv(monthKey){
  const plans=payrollPlansForMonth(monthKey, true);
  const headers=['Employee','Contract','Progress','Department','Base Salary','Overtime Hours','Overtime Amount','Allowance','Bonus','Benefits/BPJS','Other Addition','Deduction','Other Deduction','Planned Payroll','Status','Salary Override','Notes'];
  const lines=[`# ${APP_NAME} v${APP_VERSION} — Payroll ${keyToMonthObj(monthKey).month} ${keyToMonthObj(monthKey).year}`, headers.join(',')];
  plans.forEach(p=>lines.push([p.employeeName,p.contractNumber,p.contractProgress,p.department,payrollBaseSalary(p),p.overtimeHours,p.overtimeAmount,p.allowance,p.bonus,p.benefits,p.otherAddition,p.deduction,p.otherDeduction,computePayrollPlanned(p),p.status,p.salaryOverride?('yes: '+p.salaryOverride.reason):'no',p.notes].map(csvSafe).join(',')));
  downloadBlob(lines.join('\n'), `${FILE_BASE}-payroll-${monthKey}.csv`, 'text/csv'); showSuccess('Payroll exported.');
}

/* ---------- payroll detail & history (Part 15) ---------- */
function renderPayrollDetail(main){
  const p = payrollPlanById(State.detailPayrollId);
  if(!p){ main.innerHTML=emptyState('Payroll row not found','It may have been cancelled or removed.'); return; }
  const emp=empById(p.employeeId), ct=contractById(p.contractId), txn=payrollTxnOf(p);
  const recs=(p.overtimeIds||[]).map(overtimeById).filter(Boolean);
  const sched=p.workScheduleSnapshot||{};
  main.innerHTML = pageHeader(p.employeeName||'Payroll', `${escapeHtml(p.month)} ${p.year} · ${escapeHtml(p.contractNumber||'—')} · ${escapeHtml(p.contractProgress||'')}`,
      `<button class="btn" id="pdBack">← Payroll Planning</button>${emp?`<button class="btn" id="pdEmp">Employee</button>`:''}${ct?`<button class="btn" id="pdCt">Contract</button>`:''}${txn?`<button class="btn" id="pdTxn">Transaction</button>`:''}`)
    + `<div class="grid grid-2" style="margin-bottom:14px;">
      <div class="card"><h3>Payroll Components</h3><div style="font-size:13px;line-height:1.95;">
        <div>Base Salary: <b class="mono">${fmtIDR(payrollBaseSalary(p))}</b> ${p.salaryOverride?`<span class="faint">(override of ${fmtIDR(p.salaryOverride.original)} — ${escapeHtml(p.salaryOverride.reason)})</span>`:'<span class="faint">from contract</span>'}</div>
        <div>Work Schedule: <b>${sched.hoursPerDay||'—'}h/day × ${sched.daysPerWeek||'—'} × ${sched.weeksPerMonth||'—'}</b> <span class="faint">(${escapeHtml(sched.source||'—')})</span></div>
        <div>Overtime: <b class="mono">${fmtIDR(p.overtimeAmount)}</b> <span class="faint">(${num(p.overtimeHours)} hrs, ${recs.length} record(s) — system-generated)</span></div>
        <div>Allowance: <b class="mono">${fmtIDR(p.allowance)}</b> · Bonus: <b class="mono">${fmtIDR(p.bonus)}</b> · Benefits/BPJS: <b class="mono">${fmtIDR(p.benefits)}</b></div>
        <div>Other Addition: <b class="mono">${fmtIDR(p.otherAddition)}</b> · Deduction: <b class="mono">${fmtIDR(p.deduction)}</b> · Other Deduction: <b class="mono">${fmtIDR(p.otherDeduction)}</b></div>
        ${(p.adjustmentsSnapshot&&p.adjustmentsSnapshot.length)?`<div class="faint">Recurring adjustments applied: ${p.adjustmentsSnapshot.map(a=>escapeHtml(a.name+' '+a.type+' '+fmtIDR(a.amount))).join(', ')}</div>`:''}
        <div class="divider" style="margin:8px 0;"></div>
        <div style="font-size:15px;">Planned Payroll: <b class="mono" style="color:var(--accent);">${fmtIDR(computePayrollPlanned(p))}</b> ${payrollIsNegative(p)?'<span class="pill pill-status-cancelled">negative</span>':''}</div>
        <div>Status: ${hrStatusBadge(p.status, PAYROLL_STATUS_META)}</div>
      </div></div>
      <div class="card"><h3>Execution</h3>${txn?`<div style="font-size:13px;line-height:1.95;">
        <div>Transaction Status: ${statusBadge(statusOf(txn))}</div>
        <div>Planned: <b class="mono">${fmtIDR(txn.planned)}</b> · Actual paid: <b class="mono">${txn.actual!=null?fmtIDR(txn.actual):'—'}</b></div>
        <div>Remaining: <b class="mono">${fmtIDR(num(txn.planned)-num(txn.actual))}</b></div>
        <div>Execution Date: <b>${escapeHtml((txn.execution&&txn.execution.executionDate)||txn.txnDate||'—')}</b></div>
        <div>Method: <b>${escapeHtml((txn.execution&&txn.execution.method)||'—')}</b> · Bank: <b>${escapeHtml((txn.execution&&txn.execution.bank)||'—')}</b></div>
        <div>Reference: <b>${escapeHtml((txn.execution&&txn.execution.reference)||'—')}</b></div>
        <div style="margin-top:8px;"><button class="btn btn-sm" id="pdExec">Open in Execution Center</button></div>
      </div>`:'<div class="empty">Not committed to a transaction yet.</div>'}</div>
    </div>
    <div class="card"><h3>Payroll History</h3><div class="hist-list">${(p.history||[]).map(h=>`<div class="hist-row"><span class="hist-event">${escapeHtml((h.event||'').charAt(0).toUpperCase()+(h.event||'').slice(1))}</span><span class="hist-note">${escapeHtml(h.note||'')}</span><span class="hist-ts faint">${h.ts?new Date(h.ts).toLocaleString('id-ID'):'—'}</span></div>`).join('')||'<div class="empty">No history.</div>'}</div></div>`;
  document.getElementById('pdBack').addEventListener('click', ()=>hrNavTo('payroll'));
  const ge=document.getElementById('pdEmp'); if(ge) ge.addEventListener('click', ()=>hrNavTo('employeeDetail',{detailEmpId:emp.id}));
  const gc=document.getElementById('pdCt'); if(gc) gc.addEventListener('click', ()=>hrNavTo('contractDetail',{detailContractId:ct.id}));
  const gt=document.getElementById('pdTxn'); if(gt) gt.addEventListener('click', ()=>openDetailModal(txn.id));
  const ge2=document.getElementById('pdExec'); if(ge2) ge2.addEventListener('click', ()=>{ State.view='executioncenter'; State.execFilter='today'; render(); });
}

/* ---------- recurring payroll adjustments UI (Part 14) ---------- */
function renderPayrollAdjustments(main){
  const list=State.payrollAdjustments.slice().sort((a,b)=>String(a.employeeName||'').localeCompare(String(b.employeeName||'')));
  main.innerHTML = pageHeader('Recurring Payroll Adjustments','Fixed monthly additions or deductions applied automatically when payroll is generated for months in their effective window.',
      `<button class="btn" id="paBack">← Payroll Planning</button><button class="btn btn-accent" id="paAdd">+ Add Adjustment</button>`)
    + `<div class="card"><div class="table-wrap"><table>
      <thead><tr><th>Employee</th><th>Name</th><th>Type</th><th class="num">Amount</th><th>Window</th><th>Status</th><th></th></tr></thead>
      <tbody>${list.map(a=>`<tr>
        <td><b>${escapeHtml(a.employeeName||'—')}</b></td><td>${escapeHtml(a.name||'—')}</td>
        <td>${a.type==='Deduction'?'<span class="pill pill-status-cancelled">Deduction</span>':'<span class="pill pill-status-completed">Addition</span>'}</td>
        <td class="num">${fmtIDR(a.amount)}</td><td class="dim">${escapeHtml(a.startMonth||'—')}${a.endMonth?' → '+escapeHtml(a.endMonth):' → ongoing'}</td>
        <td>${a.active===false?'<span class="pill pill-status-archived">Inactive</span>':'<span class="pill pill-status-completed">Active</span>'}</td>
        <td>${hrActionsMenu('padj', a.id, [['padj-edit','Edit'],['padj-toggle',a.active===false?'Activate':'Deactivate'],['padj-delete','Delete']])}</td>
      </tr>`).join('')||'<tr><td colspan="7" class="empty">No recurring adjustments yet.</td></tr>'}</tbody></table></div></div>`;
  document.getElementById('paBack').addEventListener('click', ()=>hrNavTo('payroll'));
  document.getElementById('paAdd').addEventListener('click', ()=>openAdjustmentModal(null));
  bindHRActions(main);
}
function openAdjustmentModal(id){
  const a=id?State.payrollAdjustments.find(x=>x.id===id):null; const isNew=!a;
  const emps=State.employees.slice().sort((x,y)=>String(x.fullName||'').localeCompare(String(y.fullName||'')));
  const v=a||{type:'Addition', startMonth:todayKey(), active:true};
  openModalHTML(`<h3>${isNew?'Add':'Edit'} Recurring Adjustment</h3>
    <form id="paForm"><div class="form-grid" style="grid-template-columns:1fr 1fr;">
      <div class="field" style="grid-column:span 2;"><label>Employee</label><select class="input" name="employeeId" required><option value="">— select —</option>${emps.map(e=>`<option value="${e.id}" ${v.employeeId===e.id?'selected':''}>${escapeHtml(e.fullName)}</option>`).join('')}</select></div>
      <div class="field"><label>Name</label><input class="input" name="name" value="${escapeHtml(v.name||'')}" required placeholder="e.g. Transport allowance"></div>
      <div class="field"><label>Type</label><select class="input" name="type"><option ${v.type==='Addition'?'selected':''}>Addition</option><option ${v.type==='Deduction'?'selected':''}>Deduction</option></select></div>
      <div class="field"><label>Amount (Rp)</label><input class="input" type="number" step="any" name="amount" value="${v.amount??''}" required></div>
      <div class="field"><label>Start Month (YYYY-MM)</label><input class="input" name="startMonth" value="${escapeHtml(v.startMonth||'')}" required></div>
      <div class="field"><label>End Month (optional)</label><input class="input" name="endMonth" value="${escapeHtml(v.endMonth||'')}" placeholder="blank = ongoing"></div>
      <div class="field" style="grid-column:span 2;"><label>Notes</label><input class="input" name="notes" value="${escapeHtml(v.notes||'')}"></div>
    </div><div class="modal-actions"><button type="button" class="btn" id="paCancel">Cancel</button><button type="submit" class="btn btn-accent">${isNew?'Create':'Save'}</button></div></form>`,
    {width:600, onMount:(root)=>{
      root.querySelector('#paCancel').addEventListener('click', closeModal);
      root.querySelector('#paForm').addEventListener('submit', async ev=>{
        ev.preventDefault(); const fd=new FormData(ev.target); const emp=empById(fd.get('employeeId'));
        if(!emp){ showWarning('Select an employee.'); return; }
        const rec=a||{id:uid('padj'), active:true, createdAt:new Date().toISOString()};
        rec.employeeId=emp.id; rec.employeeName=emp.fullName; rec.name=(fd.get('name')||'').trim(); rec.type=fd.get('type');
        rec.amount=Number(fd.get('amount'))||0; rec.startMonth=(fd.get('startMonth')||'').trim(); rec.endMonth=(fd.get('endMonth')||'').trim()||null; rec.notes=(fd.get('notes')||'').trim(); rec.updatedAt=new Date().toISOString();
        if(isNew) State.payrollAdjustments.push(rec);
        await persistPayrollAdjustments(); closeModal(); showSuccess('Adjustment saved. It applies to newly generated payroll in its effective window.'); render();
      });
    }});
}
async function toggleAdjustment(id){ const a=State.payrollAdjustments.find(x=>x.id===id); if(!a) return; a.active=a.active===false; a.updatedAt=new Date().toISOString(); await persistPayrollAdjustments(); render(); }
async function deleteAdjustment(id){ const a=State.payrollAdjustments.find(x=>x.id===id); if(!a) return; if(!confirmAction('Delete this recurring adjustment? Historical payroll snapshots are not changed.')) return; State.payrollAdjustments=State.payrollAdjustments.filter(x=>x.id!==id); await persistPayrollAdjustments(); render(); }