/* ============================================================
   PAYROLL INTELLIGENCE WORKSPACE UI (v2.6.3)
   Operational, workflow-oriented payroll: one active period,
   KPI cards, deterministic health, summary, a read-only worksheet,
   bulk lifecycle actions with confirmations, and a period lock.
   Payroll = Base Salary + Approved Overtime (single source of truth):
   salary is edited on the Contract, overtime in Overtime, and both
   flow into the read-only Total here. Lifecycle stages, health, lock
   and summary helpers live in payroll-ops-engine.js.
   ============================================================ */
function payrollSelSet(monthKey){ if(!State.payrollSel[monthKey]) State.payrollSel[monthKey]=new Set(); return State.payrollSel[monthKey]; }
// Cycle-status pill (used by the dashboard payroll strip).
function cycleStatusPill(cs){
  const map={'Not Generated':'pill-status-archived','Draft':'pill-status-planned','In Review':'pill-status-scheduled','Ready to Commit':'pill-status-partial','Committed':'pill-status-completed','Partially Executed':'pill-status-partial','Fully Executed':'pill-status-completed'};
  return `<span class="pill ${map[cs]||'pill-other'}">${escapeHtml(cs)}</span>`;
}

function renderPayrollWorkspace(main){
  // Empty-state onboarding
  if(!State.employees.length || !State.contracts.length){
    main.innerHTML = pageHeader('Payroll Workspace','Operational payroll — run the full monthly cycle inside TAM Intelligence OS.')
      + `<div class="card"><div class="empty">
        <div class="big">৳</div>
        <div style="color:var(--text);font-weight:600;margin-bottom:6px;">No employees and contracts are available yet</div>
        <div style="margin-bottom:14px;">Add employees and active contracts, then generate payroll — payroll is Base Salary + Approved Overtime.</div>
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
  const locked = isPayrollLocked(monthKey);
  const plans = payrollPlansForMonth(monthKey);
  const counts = payrollStageCounts(monthKey);
  const summary = payrollSummary(monthKey);
  const otHours = plans.reduce((s,p)=>s+num(p.overtimeHours),0);
  const eligible = State.employees.filter(e=>!payrollExclusionReason(e, monthKey));
  const excludedNow = State.employees.map(e=>({e, reason:payrollExclusionReason(e, monthKey)}))
    .filter(x=>x.reason && x.e.active!==false && x.e.employmentStatus==='Active');
  const health = payrollHealth(monthKey);
  const hasRows = plans.length>0;

  const kpi = (label, value, sub) => `<div class="card stat-card"><div class="stat-label">${label}</div><div class="stat-value">${value}</div>${sub?`<div class="stat-sub dim">${sub}</div>`:''}</div>`;

  main.innerHTML = `
    <div class="page-head">
      <div>
        <h1>Payroll Workspace</h1>
        <p class="desc">One active period — Employee → Contract → Approved Overtime → Generate → Review → Approve → Post to Finance → Execution.</p>
      </div>
      <div class="head-controls">
        <select class="input" id="payMonth" title="Current payroll period">${keys.map(k=>{const o=keyToMonthObj(k);return `<option value="${k}" ${k===monthKey?'selected':''}>${o.month} ${o.year}${isPayrollLocked(k)?' 🔒':''}</option>`;}).join('')}</select>
        <button class="btn ${locked?'':'btn-danger'}" id="lockBtn">${locked?'🔓 Unlock Period':'🔒 Lock Period'}</button>
      </div>
    </div>

    <div class="card" style="margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;border-left:3px solid ${locked?'var(--brick)':'var(--accent)'};">
      <div>
        <div class="stat-label">Current Payroll Period</div>
        <div style="font-family:var(--serif);font-size:22px;font-weight:600;">${escapeHtml(mo.month)} ${mo.year} ${locked?'<span class="pill pill-status-cancelled">LOCKED</span>':''}</div>
      </div>
      <div class="small-btn-row" style="flex-wrap:wrap;gap:8px;">
        <button class="btn btn-accent" id="genPay" ${locked?'disabled':''}>Generate Payroll</button>
        <button class="btn" id="actReview" ${locked?'disabled':''}>Review Selected</button>
        <button class="btn" id="actApprove" ${locked?'disabled':''}>Approve Selected</button>
        <button class="btn btn-accent" id="actPost" ${locked?'disabled':''}>Post to Finance</button>
      </div>
    </div>

    <div class="grid grid-4" style="margin-bottom:12px;">
      ${kpi('Employees', plans.length, `${eligible.length} eligible · ${excludedNow.length} excluded`)}
      ${kpi('Draft', counts.Draft, 'awaiting review')}
      ${kpi('Review', counts.Review, 'in review')}
      ${kpi('Approved', counts.Approved, 'ready to post')}
    </div>
    <div class="grid grid-4" style="margin-bottom:14px;">
      ${kpi('Posted', counts.Posted, 'planned in finance')}
      ${kpi('Executed', counts.Executed, 'paid via Execution Center')}
      ${kpi('Total Payroll', fmtIDRShort(summary.total), 'base + approved overtime')}
      ${kpi('Total Overtime', fmtIDRShort(summary.overtime), `${otHours} hrs`)}
    </div>

    ${health.length?`<div class="card" style="margin-bottom:14px;">
      <h3>Payroll Health <span class="tag">${health.length}</span></h3>
      <div class="insight-list">${health.slice(0,24).map(h=>`<div class="insight-item ${h.sev==='warn'?'warn':''}"><b>${escapeHtml(h.title)}</b> — ${escapeHtml(h.detail)}</div>`).join('')}</div>
    </div>`:''}

    ${hasRows?`<div class="grid grid-4" style="margin-bottom:14px;">
      <div class="chart-mini-stat"><div class="lbl">Employees</div><div class="val">${summary.count}</div></div>
      <div class="chart-mini-stat"><div class="lbl">Average Payroll</div><div class="val">${fmtIDRShort(summary.average)}</div></div>
      <div class="chart-mini-stat"><div class="lbl">Highest</div><div class="val">${fmtIDRShort(summary.highest)}</div></div>
      <div class="chart-mini-stat"><div class="lbl">Lowest</div><div class="val">${fmtIDRShort(summary.lowest)}</div></div>
    </div>`:''}

    <div id="payArea"></div>

    ${excludedNow.length?`<div class="card" style="margin-top:14px;"><h3>Excluded Employees <span class="tag">${excludedNow.length}</span></h3><div class="insight-list">${excludedNow.map(x=>`<div class="insight-item warn"><b>${escapeHtml(x.e.fullName)}</b> — ${escapeHtml(x.reason)}</div>`).join('')}</div></div>`:''}`;

  document.getElementById('payMonth').addEventListener('change', e=>{ State.payrollMonth=e.target.value; renderPayrollWorkspace(main); });
  document.getElementById('lockBtn').addEventListener('click', async ()=>{
    if(locked){ if(!confirmAction(`Unlock payroll for ${mo.month} ${mo.year}? This re-enables generation, edits, overtime changes, and finance posting for this period.`)) return; await setPayrollLock(monthKey,false); showSuccess('Period unlocked.'); }
    else { if(!confirmAction(`Lock payroll for ${mo.month} ${mo.year}? While locked: payroll cannot be regenerated or edited, its overtime cannot be modified, and finance posting cannot run again.`)) return; await setPayrollLock(monthKey,true); showSuccess('Period locked.'); }
    renderPayrollWorkspace(main);
  });
  const genBtn=document.getElementById('genPay');
  if(genBtn) genBtn.addEventListener('click', async ()=>{
    if(isPayrollLocked(monthKey)){ showWarning('This period is locked.'); return; }
    const res = generatePayrollForMonth(monthKey); await persistPayrollPlans();
    let msg=`Generated ${res.generated}, refreshed ${res.refreshed}, ${res.excluded.length} excluded.`;
    if(res.skippedCommitted) msg+=` ${res.skippedCommitted} posted row(s) left unchanged.`;
    if(res.changed) msg+=` ${res.changed} row(s) flagged (overtime updated).`;
    showSuccess(msg, 6000); renderPayrollWorkspace(main);
  });

  const sel = payrollSelSet(monthKey);
  const selIds=()=>[...sel];
  const ar=document.getElementById('actReview'); if(ar) ar.addEventListener('click', async ()=>{
    const ids=selIds(); if(!ids.length){ showWarning('Select one or more rows first.'); return; }
    if(!confirmAction(`Mark ${ids.length} selected row(s) as Reviewed?`)) return;
    const n=await bulkPayrollStatus(monthKey, ids, 'Reviewed'); if(n) showSuccess(n+' row(s) moved to Review.'); renderPayrollWorkspace(main);
  });
  const aa=document.getElementById('actApprove'); if(aa) aa.addEventListener('click', async ()=>{
    const ids=selIds(); if(!ids.length){ showWarning('Select one or more rows first.'); return; }
    if(!confirmAction(`Approve ${ids.length} selected row(s)? Approved payroll can then be posted to finance.`)) return;
    const n=await bulkPayrollStatus(monthKey, ids, 'Ready'); showSuccess(n+' row(s) approved.'); renderPayrollWorkspace(main);
  });
  const ap=document.getElementById('actPost'); if(ap) ap.addEventListener('click', ()=>openCommitPayrollModal(monthKey, main));

  const area=document.getElementById('payArea');
  if(!hasRows){
    area.innerHTML = `<div class="card"><div class="empty">
      <div class="big">৳</div>
      <div style="color:var(--text);font-weight:600;margin-bottom:6px;">Payroll has not been generated for ${escapeHtml(mo.month)} ${mo.year}.</div>
      <div style="margin-bottom:12px;">Generate the worksheet from active contracts and approved overtime. Payroll = Base Salary + Approved Overtime; nothing else is added.</div>
      ${locked?'<span class="pill pill-status-cancelled">Period locked</span>':'<button class="btn btn-accent" id="genPay2">Generate Payroll</button>'}
    </div></div>`;
    const g2=document.getElementById('genPay2'); if(g2) g2.addEventListener('click', ()=>document.getElementById('genPay').click());
    return;
  }
  renderPayrollWorksheet(area, monthKey, main);
}

/* ---------- read-only worksheet (incremental search preserved from v2.6.1) ---------- */
function payrollRowsFiltered(monthKey){
  const f=State.payrollFilter;
  let rows = payrollPlansForMonth(monthKey, true).filter(p=>p.status!=='Cancelled');
  if(f.search.trim()){ const s=normStr(f.search); rows=rows.filter(p=>[p.employeeName,p.contractNumber,p.department].some(x=>normStr(x||'').includes(s))); }
  if(f.department!=='all') rows=rows.filter(p=>(p.department||'')===f.department);
  if(f.status!=='all') rows=rows.filter(p=>payrollStage(p)===f.status);
  rows.sort((a,b)=>String(a.employeeName||'').localeCompare(String(b.employeeName||'')));
  return rows;
}
function payrollWorksheetBodyHTML(monthKey, sel){
  return payrollRowsFiltered(monthKey).map(p=>payrollWorksheetRowHTML(p, sel)).join('') || '<tr><td colspan="9" class="empty">No payroll rows match.</td></tr>';
}
function bindPayrollRows(area, monthKey, main, sel){
  const updCount=()=>{ const el=document.getElementById('pbSelCount'); if(el) el.textContent = sel.size?`${sel.size} selected`:''; };
  area.querySelectorAll('[data-psel]').forEach(cb=>cb.addEventListener('change', e=>{ const id=e.target.dataset.psel; if(e.target.checked) sel.add(id); else sel.delete(id); updCount(); }));
  area.querySelectorAll('[data-pact]').forEach(b=>b.addEventListener('click', async ()=>{
    const id=b.dataset.pid, act=b.dataset.pact;
    if(act==='detail') hrNavTo('payrollDetail',{detailPayrollId:id});
    else if(act==='review'){ await setPayrollStatus(id,'Reviewed'); render(); }
    else if(act==='ready'){ await setPayrollStatus(id,'Ready'); render(); }
    else if(act==='draft'){ await setPayrollStatus(id,'Draft'); render(); }
    else if(act==='cancel'){ if(confirmAction('Cancel this payroll row? It will not be posted to finance.')){ await setPayrollStatus(id,'Cancelled'); render(); } }
    else if(act==='exec'){ const pp=payrollPlanById(id); const t=payrollTxnOf(pp); if(t){ State.view='executioncenter'; State.execFilter='today'; render(); } else showWarning('Not posted to a transaction yet.'); }
  }));
  bindHRActions(area);
  updCount();
}
function applyPayrollFilter(area, monthKey, main){
  const tb=document.getElementById('pwRows'); if(!tb) return;
  const sel=payrollSelSet(monthKey);
  tb.innerHTML=payrollWorksheetBodyHTML(monthKey, sel);
  bindPayrollRows(area, monthKey, main, sel);
}
function renderPayrollWorksheet(area, monthKey, main){
  const f=State.payrollFilter;
  const depts=[...new Set(State.employees.map(e=>e.department).filter(Boolean))].sort();
  const sel=payrollSelSet(monthKey);
  const locked=isPayrollLocked(monthKey);

  area.innerHTML = `<div class="card">
    <div class="form-grid" style="grid-template-columns:1.6fr 1fr 1fr;margin-bottom:12px;">
      <div class="field"><label>Search</label><input class="input" id="pfSearch" placeholder="employee, contract" value="${escapeHtml(f.search)}"></div>
      <div class="field"><label>Department</label><select class="input" id="pfDept"><option value="all">All</option>${depts.map(d=>`<option ${f.department===d?'selected':''}>${escapeHtml(d)}</option>`).join('')}</select></div>
      <div class="field"><label>Stage</label><select class="input" id="pfStatus"><option value="all">All stages</option>${PAYROLL_STAGES.map(s=>`<option ${f.status===s?'selected':''}>${s}</option>`).join('')}</select></div>
    </div>
    <div class="small-btn-row" style="flex-wrap:wrap;gap:8px;margin-bottom:12px;align-items:center;">
      <button class="btn btn-sm" id="pbSelAll">Select All</button>
      <span class="dim" id="pbSelCount" style="font-size:12px;"></span>
      <button class="btn btn-sm" id="pbCsv" style="margin-left:auto;">Export CSV</button>
    </div>
    <div class="table-wrap" style="max-height:600px;overflow:auto;">
      <table>
        <thead><tr>
          <th style="width:32px;"><input type="checkbox" id="pfAll" title="Select all shown"></th>
          <th>Employee</th><th>Contract</th><th>Progress</th>
          <th class="num">Base Salary</th><th class="num">Approved OT</th><th class="num">Total Payroll</th><th>Stage</th><th></th>
        </tr></thead>
        <tbody id="pwRows">${payrollWorksheetBodyHTML(monthKey, sel)}</tbody>
      </table>
    </div>
    <p class="hint" style="margin-top:10px;">Read-only. Base salary comes from the active contract; overtime comes from Approved overtime records. Edit salary in Employee/Contract, overtime in Overtime. Only Approved rows can be posted; posting creates Planned transactions — execute them in the Execution Center.${locked?' <b>This period is locked.</b>':''}</p>
  </div>`;

  document.getElementById('pfSearch').addEventListener('input', e=>{ f.search=e.target.value; applyPayrollFilter(area, monthKey, main); });
  document.getElementById('pfDept').addEventListener('change', e=>{ f.department=e.target.value; applyPayrollFilter(area, monthKey, main); });
  document.getElementById('pfStatus').addEventListener('change', e=>{ f.status=e.target.value; applyPayrollFilter(area, monthKey, main); });
  document.getElementById('pbSelAll').addEventListener('click', ()=>{ payrollRowsFiltered(monthKey).forEach(p=>sel.add(p.id)); applyPayrollFilter(area, monthKey, main); });
  const allCb=document.getElementById('pfAll'); if(allCb) allCb.addEventListener('change', e=>{ const rows=payrollRowsFiltered(monthKey); if(e.target.checked) rows.forEach(p=>sel.add(p.id)); else rows.forEach(p=>sel.delete(p.id)); applyPayrollFilter(area, monthKey, main); });
  document.getElementById('pbCsv').addEventListener('click', ()=>exportPayrollCsv(monthKey));
  bindPayrollRows(area, monthKey, main, sel);
}
function payrollWorksheetRowHTML(p, sel){
  const stage=payrollStage(p);
  const posted=(stage==='Posted'||stage==='Executed');
  const canReview=stage==='Draft', canApprove=(stage==='Draft'||stage==='Review'), canDraft=(stage==='Review'||stage==='Approved');
  const flags=(p.missingSalary?'<span class="pill pill-status-cancelled">no salary</span> ':'')+(p.missingSchedule?'<span class="pill pill-status-partial">no schedule</span> ':'')+(p.otChanged?'<span class="pill pill-status-partial" title="Approved overtime changed since generation">OT changed</span> ':'');
  const otCell = `${fmtIDR(p.overtimeAmount)}${num(p.overtimeHours)?` <span class="faint">(${num(p.overtimeHours)}h)</span>`:''}`;
  return `<tr>
    <td><input type="checkbox" data-psel="${p.id}" ${sel.has(p.id)?'checked':''} ${posted?'disabled':''}></td>
    <td><button class="linklike" data-pact="detail" data-pid="${p.id}"><b>${escapeHtml(p.employeeName||'—')}</b></button>${flags?`<div class="faint" style="font-size:10px;">${flags}</div>`:''}</td>
    <td class="dim">${escapeHtml(p.contractNumber||'—')}</td>
    <td>${escapeHtml(p.contractProgress||'—')}</td>
    <td class="num">${fmtIDR(payrollBaseSalary(p))}</td>
    <td class="num">${otCell}</td>
    <td class="num"><b${payrollIsNegative(p)?' style="color:var(--brick);"':''}>${fmtIDR(computePayrollPlanned(p))}</b></td>
    <td>${payrollStagePill(p)}</td>
    <td>${hrActionsMenu('prow', p.id, [
      ['detail','View Detail'],
      canReview?['review','Mark Reviewed']:null,
      canApprove?['ready','Approve']:null,
      canDraft?['draft','Return to Draft']:null,
      posted?['exec','Open in Execution Center']:null,
      !posted?['cancel','Cancel Row']:null,
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
  if(isPayrollLocked(monthKey)){ showWarning('This period is locked — finance posting cannot run again.'); return; }
  const sel=payrollSelSet(monthKey);
  let ids=[...sel]; if(!ids.length) ids=payrollPlansForMonth(monthKey).filter(p=>p.status==='Ready').map(p=>p.id);
  const readyIds=ids.filter(id=>{ const p=payrollPlanById(id); return p&&p.status==='Ready'; });
  if(!readyIds.length){ showWarning('No Approved payroll to post. Only Approved rows can be posted — approve rows first.'); return; }
  const s=commitPayrollPreview(monthKey, readyIds);
  openModalHTML(`<h3>Post Approved Payroll to Finance</h3>
    <div style="font-size:12.5px;line-height:1.95;">
      <div>Employees: <b>${s.employees}</b></div>
      <div>Base salary total: <b class="mono">${fmtIDR(s.base)}</b></div>
      <div>Approved overtime total: <b class="mono">${fmtIDR(s.overtime)}</b></div>
      <div>Total payroll: <b class="mono" style="color:var(--accent);">${fmtIDR(s.planned)}</b></div>
      <div class="divider" style="margin:8px 0;"></div>
      <div>New transactions: <b>${s.newTxn}</b> · Existing: <b>${s.existingTxn}</b> · Changed: <b>${s.changedTxn}</b> · Skipped: <b>${s.skipped}</b></div>
    </div>
    <p class="hint" style="margin-top:8px;">Creates one Planned Gaji transaction per employee (status Planned, actual empty). Nothing is executed automatically — pay them in the Execution Center. Duplicates are never created.</p>
    <div class="modal-actions"><button type="button" class="btn" id="cpCancel">Cancel</button><button type="button" class="btn btn-accent" id="cpGo">Post ${readyIds.length} Row(s)</button></div>`,
    {width:560, onMount:(root)=>{
      root.querySelector('#cpCancel').addEventListener('click', closeModal);
      root.querySelector('#cpGo').addEventListener('click', async ()=>{
        const res=await commitReadyPayroll(monthKey, readyIds); sel.clear(); closeModal();
        if(res.locked) return;
        showSuccess(`Posted to finance: ${res.created} transaction(s) created, ${res.updated} updated${res.skipped?', '+res.skipped+' skipped':''}.`, 6000);
        render();
      });
    }});
}
function exportPayrollCsv(monthKey){
  const plans=payrollPlansForMonth(monthKey, true);
  const headers=['Employee','Contract','Progress','Department','Base Salary','Approved Overtime','Total Payroll','Stage'];
  const lines=[`# ${APP_NAME} v${APP_VERSION} — Payroll ${keyToMonthObj(monthKey).month} ${keyToMonthObj(monthKey).year}`, headers.join(',')];
  plans.forEach(p=>lines.push([p.employeeName,p.contractNumber,p.contractProgress,p.department,payrollBaseSalary(p),num(p.overtimeAmount),computePayrollPlanned(p),payrollStage(p)].map(csvSafe).join(',')));
  downloadBlob(lines.join('\n'), `${FILE_BASE}-payroll-${monthKey}.csv`, 'text/csv'); showSuccess('Payroll exported.');
}

/* ---------- payroll preview (read-only) & history ---------- */
function renderPayrollDetail(main){
  const p = payrollPlanById(State.detailPayrollId);
  if(!p){ main.innerHTML=emptyState('Payroll row not found','It may have been cancelled or removed.'); return; }
  const emp=empById(p.employeeId), ct=contractById(p.contractId), txn=payrollTxnOf(p);
  const recs=(p.overtimeIds||[]).map(overtimeById).filter(Boolean);
  main.innerHTML = pageHeader(p.employeeName||'Payroll', `${escapeHtml(p.month)} ${p.year} · ${escapeHtml(p.contractNumber||'—')} · ${escapeHtml(p.contractProgress||'')}`,
      `<button class="btn" id="pdBack">← Payroll Workspace</button>${emp?`<button class="btn" id="pdEmp">Employee</button>`:''}${ct?`<button class="btn" id="pdCt">Contract</button>`:''}${txn?`<button class="btn" id="pdTxn">Transaction</button>`:''}`)
    + `<div class="grid grid-2" style="margin-bottom:14px;">
      <div class="card"><h3>Payroll <span class="tag">read-only</span></h3><div style="font-size:13px;line-height:1.95;">
        <div>Employee: <b>${escapeHtml(p.employeeName||'—')}</b></div>
        <div>Contract: <b>${escapeHtml(p.contractNumber||'—')}</b></div>
        <div>Current Contract Progress: <b>${escapeHtml(p.contractProgress||'—')}</b></div>
        <div class="divider" style="margin:8px 0;"></div>
        <div>Base Salary: <b class="mono">${fmtIDR(payrollBaseSalary(p))}</b> <span class="faint">from contract</span></div>
        <div>Approved Overtime: <b class="mono">${fmtIDR(p.overtimeAmount)}</b> <span class="faint">(${num(p.overtimeHours)} hrs · ${recs.length} record(s))</span>${(p.overtimeIds&&p.overtimeIds.length)?` · <button class="linklike" id="pdOt">breakdown</button>`:''}</div>
        <div class="divider" style="margin:8px 0;"></div>
        <div style="font-size:15px;">Total Payroll: <b class="mono" style="color:var(--accent);">${fmtIDR(computePayrollPlanned(p))}</b> ${payrollIsNegative(p)?'<span class="pill pill-status-cancelled">negative</span>':''}</div>
        <div>Stage: ${payrollStagePill(p)}</div>
        <p class="hint" style="margin-top:8px;">Payroll = Base Salary + Approved Overtime. Edit salary via the Contract; edit overtime via Overtime. Generated finance transaction is shown at right.</p>
      </div></div>
      <div class="card"><h3>Generated Finance Transaction</h3>${txn?`<div style="font-size:13px;line-height:1.95;">
        <div>Transaction Status: ${statusBadge(statusOf(txn))}</div>
        <div>Planned: <b class="mono">${fmtIDR(txn.planned)}</b> · Actual paid: <b class="mono">${txn.actual!=null?fmtIDR(txn.actual):'—'}</b></div>
        <div>Remaining: <b class="mono">${fmtIDR(num(txn.planned)-num(txn.actual))}</b></div>
        <div>Execution Date: <b>${escapeHtml((txn.execution&&txn.execution.executionDate)||txn.txnDate||'—')}</b></div>
        <div>Method: <b>${escapeHtml((txn.execution&&txn.execution.method)||'—')}</b> · Bank: <b>${escapeHtml((txn.execution&&txn.execution.bank)||'—')}</b></div>
        <div style="margin-top:8px;"><button class="btn btn-sm" id="pdExec">Open in Execution Center</button></div>
      </div>`:'<div class="empty">Not posted to finance yet. Approve then Post to Finance to create a Planned transaction.</div>'}</div>
    </div>
    <div class="card"><h3>Payroll History</h3><div class="hist-list">${(p.history||[]).map(h=>`<div class="hist-row"><span class="hist-event">${escapeHtml((h.event||'').charAt(0).toUpperCase()+(h.event||'').slice(1))}</span><span class="hist-note">${escapeHtml(h.note||'')}</span><span class="hist-ts faint">${h.ts?new Date(h.ts).toLocaleString('id-ID'):'—'}</span></div>`).join('')||'<div class="empty">No history.</div>'}</div></div>`;
  document.getElementById('pdBack').addEventListener('click', ()=>hrNavTo('payroll'));
  const ge=document.getElementById('pdEmp'); if(ge) ge.addEventListener('click', ()=>hrNavTo('employeeDetail',{detailEmpId:emp.id}));
  const gc=document.getElementById('pdCt'); if(gc) gc.addEventListener('click', ()=>hrNavTo('contractDetail',{detailContractId:ct.id}));
  const gt=document.getElementById('pdTxn'); if(gt) gt.addEventListener('click', ()=>openDetailModal(txn.id));
  const go=document.getElementById('pdOt'); if(go) go.addEventListener('click', ()=>openPayrollOvertimeBreakdown(p.id));
  const ge2=document.getElementById('pdExec'); if(ge2) ge2.addEventListener('click', ()=>{ State.view='executioncenter'; State.execFilter='today'; render(); });
}

/* ---------- recurring payroll adjustments UI (retained; not featured in the simplified workspace) ---------- */
function renderPayrollAdjustments(main){
  const list=State.payrollAdjustments.slice().sort((a,b)=>String(a.employeeName||'').localeCompare(String(b.employeeName||'')));
  main.innerHTML = pageHeader('Recurring Payroll Adjustments','Retained for backward compatibility. TAM payroll is Base Salary + Approved Overtime; adjustments are not part of the standard workflow.',
      `<button class="btn" id="paBack">← Payroll Workspace</button><button class="btn btn-accent" id="paAdd">+ Add Adjustment</button>`)
    + `<div class="card"><div class="table-wrap"><table>
      <thead><tr><th>Employee</th><th>Name</th><th>Type</th><th class="num">Amount</th><th>Window</th><th>Status</th><th></th></tr></thead>
      <tbody>${list.map(a=>`<tr>
        <td><b>${escapeHtml(a.employeeName||'—')}</b></td><td>${escapeHtml(a.name||'—')}</td>
        <td>${a.type==='Deduction'?'<span class="pill pill-status-cancelled">Deduction</span>':'<span class="pill pill-status-completed">Addition</span>'}</td>
        <td class="num">${fmtIDR(a.amount)}</td><td class="dim">${escapeHtml(a.startMonth||'—')}${a.endMonth?' → '+escapeHtml(a.endMonth):' → ongoing'}</td>
        <td>${a.active===false?'<span class="pill pill-status-archived">Inactive</span>':'<span class="pill pill-status-completed">Active</span>'}</td>
        <td>${hrActionsMenu('padj', a.id, [['padj-edit','Edit'],['padj-toggle',a.active===false?'Activate':'Deactivate'],['padj-delete','Delete']])}</td>
      </tr>`).join('')||'<tr><td colspan="7" class="empty">No recurring adjustments.</td></tr>'}</tbody></table></div></div>`;
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
        await persistPayrollAdjustments(); closeModal(); showSuccess('Adjustment saved.'); render();
      });
    }});
}
async function toggleAdjustment(id){ const a=State.payrollAdjustments.find(x=>x.id===id); if(!a) return; a.active=a.active===false; a.updatedAt=new Date().toISOString(); await persistPayrollAdjustments(); render(); }
async function deleteAdjustment(id){ const a=State.payrollAdjustments.find(x=>x.id===id); if(!a) return; if(!confirmAction('Delete this recurring adjustment? Historical payroll snapshots are not changed.')) return; State.payrollAdjustments=State.payrollAdjustments.filter(x=>x.id!==id); await persistPayrollAdjustments(); render(); }
