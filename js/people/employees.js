/* ============================================================
   EMPLOYEES
   ============================================================ */
/* v2.6.1 — Employees incremental list: filtered set, row markup, and a refresh that
   swaps only the <tbody>. The search box and filter dropdowns call applyEmployeeFilter
   so the search input keeps focus/caret/selection and the table keeps its scroll. */
function employeesFiltered(){
  const f = State.empFilter;
  let rows = State.employees.slice();
  if(f.status!=='all') rows = rows.filter(e=>e.employmentStatus===f.status);
  if(f.department!=='all') rows = rows.filter(e=>e.department===f.department);
  if(f.active==='active') rows = rows.filter(e=>e.active!==false);
  if(f.active==='inactive') rows = rows.filter(e=>e.active===false);
  if(f.search.trim()){ const s=normStr(f.search); rows = rows.filter(e=>[e.fullName,e.employeeId,e.jobTitle,e.department,e.email,e.phone].some(x=>normStr(x||'').includes(s))); }
  rows.sort((a,b)=>String(a.fullName||'').localeCompare(String(b.fullName||'')));
  return rows;
}
function employeeRowsHTML(){
  return employeesFiltered().map(e=>{
    const ct = activeContractToday(e.id);
    const calc = ct ? contractCalc(ct, todayKey()) : null;
    return `<tr>
      <td><button class="linklike" data-emp-detail="${e.id}"><b>${escapeHtml(e.fullName||'—')}</b></button><div class="faint" style="font-size:10.5px;">${escapeHtml(e.employeeId||'')}</div></td>
      <td class="dim">${escapeHtml(e.jobTitle||'—')}</td>
      <td class="dim">${escapeHtml(e.department||'—')}</td>
      <td>${hrStatusBadge(e.employmentStatus||'Inactive', EMP_STATUS_META)}${e.active===false?' <span class="pill pill-status-archived">record off</span>':''}</td>
      <td>${ct?`<span class="dim">${escapeHtml(ct.contractNumber||'—')}</span> <span class="pill pill-status-scheduled">${calc.progress}</span>`:'<span class="faint">none</span>'}</td>
      <td class="num">${fmtIDR(e.monthlyBaseSalary)}</td>
      <td>${hrActionsMenu('emp', e.id, [
        ['emp-detail','View Detail'],
        ['emp-edit','Edit'],
        e.active===false?['emp-reactivate','Reactivate']:['emp-deactivate','Deactivate'],
        ['emp-delete','Delete']
      ])}</td>
    </tr>`;
  }).join('') || `<tr><td colspan="7" class="empty">No employees match. Click “+ Add Employee” to create the first record.</td></tr>`;
}
function applyEmployeeFilter(main){
  const tb = document.getElementById('empRows'); if(!tb) return;
  tb.innerHTML = employeeRowsHTML();
  bindHRActions(main);
}
function renderEmployees(main){
  const f = State.empFilter;
  const depts = [...new Set(State.employees.map(e=>e.department).filter(Boolean))].sort();
  const activeCount = State.employees.filter(empEligible).length;

  main.innerHTML = `
    <div class="page-head">
      <div><h1>Employees</h1><p class="desc">Master data — ${State.employees.length} employee${State.employees.length===1?'':'s'}, ${activeCount} active. This is the source of truth for payroll planning.</p></div>
      <div class="head-controls">
        <button class="btn btn-accent" id="addEmp">+ Add Employee</button>
        <button class="btn" id="dedupEmp">Duplicate Review${(function(){const g=findEmployeeDuplicateGroups();return g.length?` (${g.length})`:'';})()}</button>
        <button class="btn" id="expEmp">Export CSV</button>
      </div>
    </div>
    ${(function(){const g=findEmployeeDuplicateGroups();return g.length?`<div class="card" style="border-left:3px solid var(--brick);margin-bottom:14px;"><b style="color:var(--brick);">${g.length} duplicate employee group(s) detected</b> — the same person exists under multiple records. <button class="linklike" id="dedupEmp2">Open Employee Duplicate Review</button> to consolidate them safely (nothing is deleted, no amounts change).</div>`:'';})()}
    <div class="card">
      <div class="form-grid" style="grid-template-columns:1.6fr 1fr 1fr 1fr;margin-bottom:14px;">
        <div class="field"><label>Search (name, ID, title, contact)</label><input class="input" id="eSearch" placeholder="Search…" value="${escapeHtml(f.search)}"></div>
        <div class="field"><label>Employment Status</label>
          <select class="input" id="eStatus"><option value="all">All statuses</option>${EMPLOYMENT_STATUSES.map(s=>`<option ${f.status===s?'selected':''}>${s}</option>`).join('')}</select>
        </div>
        <div class="field"><label>Department</label>
          <select class="input" id="eDept"><option value="all">All departments</option>${depts.map(d=>`<option ${f.department===d?'selected':''}>${escapeHtml(d)}</option>`).join('')}</select>
        </div>
        <div class="field"><label>Record</label>
          <select class="input" id="eActive">
            <option value="all" ${f.active==='all'?'selected':''}>Active &amp; inactive</option>
            <option value="active" ${f.active==='active'?'selected':''}>Active records</option>
            <option value="inactive" ${f.active==='inactive'?'selected':''}>Inactive records</option>
          </select>
        </div>
      </div>
      <div class="table-wrap" style="max-height:620px;overflow-y:auto;">
        <table>
          <thead><tr><th>Employee</th><th>Job Title</th><th>Department</th><th>Status</th><th>Active Contract</th><th class="num">Base Salary</th><th></th></tr></thead>
          <tbody id="empRows">${employeeRowsHTML()}</tbody>
        </table>
      </div>
    </div>`;
  document.getElementById('eSearch').addEventListener('input', e=>{ State.empFilter.search=e.target.value; applyEmployeeFilter(main); });
  document.getElementById('eStatus').addEventListener('change', e=>{ State.empFilter.status=e.target.value; applyEmployeeFilter(main); });
  document.getElementById('eDept').addEventListener('change', e=>{ State.empFilter.department=e.target.value; applyEmployeeFilter(main); });
  document.getElementById('eActive').addEventListener('change', e=>{ State.empFilter.active=e.target.value; applyEmployeeFilter(main); });
  document.getElementById('addEmp').addEventListener('click', ()=>openEmployeeModal(null));
  document.getElementById('expEmp').addEventListener('click', exportEmployeesCsv);
  const goDedup=()=>{ State.view='employeeDedup'; render(); };
  const db1=document.getElementById('dedupEmp'); if(db1) db1.addEventListener('click', goDedup);
  const db2=document.getElementById('dedupEmp2'); if(db2) db2.addEventListener('click', goDedup);
  bindHRActions(main);
}

function openEmployeeModal(id){
  const e = id ? empById(id) : null;
  const isNew = !e;
  const v = e || {employeeId: nextEmployeeCode(), employmentStatus:'Active', contractType:'Fixed-Term (PKWT)', active:true};
  openModalHTML(`
    <h3>${isNew?'Add Employee':'Edit Employee'}</h3>
    <form id="empForm">
      <div class="form-grid" style="grid-template-columns:1fr 1fr;">
        <div class="field"><label>Employee ID</label><input class="input" name="employeeId" value="${escapeHtml(v.employeeId||'')}" required></div>
        <div class="field"><label>Full Name</label><input class="input" name="fullName" value="${escapeHtml(v.fullName||'')}" required></div>
        <div class="field"><label>Job Title</label><input class="input" name="jobTitle" value="${escapeHtml(v.jobTitle||'')}"></div>
        <div class="field"><label>Department</label><input class="input" name="department" value="${escapeHtml(v.department||'')}"></div>
        <div class="field"><label>Employment Status</label><select class="input" name="employmentStatus">${EMPLOYMENT_STATUSES.map(s=>`<option ${v.employmentStatus===s?'selected':''}>${s}</option>`).join('')}</select></div>
        <div class="field"><label>Join Date</label><input class="input" type="date" name="joinDate" value="${escapeHtml(v.joinDate||'')}"></div>
        <div class="field"><label>Contract Type</label><select class="input" name="contractType">${CONTRACT_TYPES.map(s=>`<option ${v.contractType===s?'selected':''}>${s}</option>`).join('')}</select></div>
        <div class="field"><label>Monthly Base Salary (Rp)</label><input class="input" type="number" step="any" name="monthlyBaseSalary" value="${v.monthlyBaseSalary??''}"></div>
        <div class="field"><label>Bank Name</label><input class="input" name="bankName" value="${escapeHtml(v.bankName||'')}"></div>
        <div class="field"><label>Bank Account Number</label><input class="input" name="bankAccountNumber" value="${escapeHtml(v.bankAccountNumber||'')}"></div>
        <div class="field"><label>Email</label><input class="input" type="email" name="email" value="${escapeHtml(v.email||'')}"></div>
        <div class="field"><label>Phone</label><input class="input" name="phone" value="${escapeHtml(v.phone||'')}"></div>
        <div class="field" style="grid-column:span 2;"><label>Notes</label><textarea class="input" name="notes">${escapeHtml(v.notes||'')}</textarea></div>
        ${scheduleFieldsHTML(v, 'employee default')}
      </div>
      <div class="modal-actions">
        <button type="button" class="btn" id="empCancel">Cancel</button>
        <button type="submit" class="btn btn-accent">${isNew?'Create Employee':'Save Changes'}</button>
      </div>
    </form>`, {width:640, onMount:(root)=>{
      root.querySelector('#empCancel').addEventListener('click', closeModal);
      root.querySelector('#empForm').addEventListener('submit', async ev=>{
        ev.preventDefault();
        const fd = new FormData(ev.target);
        const rec = e || {id:uid('emp'), createdAt:new Date().toISOString(), active:true, history:[]};
        rec.employeeId=(fd.get('employeeId')||'').trim();
        rec.fullName=(fd.get('fullName')||'').trim();
        rec.jobTitle=(fd.get('jobTitle')||'').trim();
        rec.department=(fd.get('department')||'').trim();
        rec.employmentStatus=fd.get('employmentStatus');
        rec.joinDate=fd.get('joinDate')||null;
        rec.contractType=fd.get('contractType');
        const sal=fd.get('monthlyBaseSalary'); rec.monthlyBaseSalary=(sal===''||sal==null)?null:Number(sal);
        rec.bankName=(fd.get('bankName')||'').trim();
        rec.bankAccountNumber=(fd.get('bankAccountNumber')||'').trim();
        rec.email=(fd.get('email')||'').trim();
        rec.phone=(fd.get('phone')||'').trim();
        rec.notes=(fd.get('notes')||'').trim();
        applyScheduleFromForm(fd, rec);
        rec.updatedAt=new Date().toISOString();
        if(!rec.history) rec.history=[];
        rec.history.push({event:isNew?'created':'edited', ts:rec.updatedAt, note:isNew?'Employee record created':'Employee record edited'});
        if(isNew) State.employees.push(rec);
        await persistEmployees();
        closeModal(); toast(isNew?'Employee added.':'Employee updated.'); render();
      });
    }});
}

async function setEmployeeActive(id, active){
  const e = empById(id); if(!e) return;
  e.active = active;
  if(!active && e.employmentStatus==='Active') e.employmentStatus='Inactive';
  e.updatedAt = new Date().toISOString();
  (e.history=e.history||[]).push({event:active?'reactivated':'deactivated', ts:e.updatedAt, note:active?'Record reactivated':'Record deactivated'});
  await persistEmployees(); toast(active?'Employee reactivated.':'Employee deactivated.'); render();
}
async function deleteEmployee(id){
  const e = empById(id); if(!e) return;
  if(empHasHistory(id)){
    toast('This employee has linked payroll or transactions and cannot be deleted. Deactivate instead.', 6000);
    return;
  }
  if(!confirm(`Permanently delete ${e.fullName}? This is only allowed because the record has no linked payroll or transactions.`)) return;
  State.employees = State.employees.filter(x=>x.id!==id);
  await persistEmployees(); toast('Employee deleted.'); render();
}

function renderEmployeeDetail(main){
  const e = empById(State.detailEmpId);
  if(!e){ main.innerHTML = emptyState('Employee not found','It may have been deleted.'); return; }
  const cts = contractsForEmployee(e.id).slice().sort((a,b)=>String(b.startDate||'').localeCompare(String(a.startDate||'')));
  const ct = activeContractToday(e.id);
  const calc = ct?contractCalc(ct, todayKey()):null;
  const txns = txnsForEmployee(e.id).slice().sort((a,b)=>String(b.monthKey).localeCompare(String(a.monthKey)));
  const empPlans = payrollPlansForEmployee(e.id).slice().sort((a,b)=>String(b.monthKey).localeCompare(String(a.monthKey)));
  const empOt = State.overtimeRecords.filter(o=>o.employeeId===e.id).slice().sort((a,b)=>String(b.monthKey).localeCompare(String(a.monthKey)) || String(b.overtimeDate||'').localeCompare(String(a.overtimeDate||'')));
  const overlaps = overlappingActiveContracts(e.id);
  const alerts = [];
  if(!ct) alerts.push({type:'warn', text:'This employee has no active contract for the current month.'});
  if(overlaps.length) alerts.push({type:'warn', text:`${overlaps.length} overlapping active contract${overlaps.length>1?'s':''} detected — review contract dates.`});
  cts.forEach(c=>{ const es=contractEffectiveStatus(c); const cc=contractCalc(c); if(es==='Expiring Soon') alerts.push({type:'warn', text:`Contract ${escapeHtml(c.contractNumber||'')} is expiring soon (${cc.daysUntilEnd} days left).`}); });

  main.innerHTML = `
    <div class="page-head">
      <div><h1>${escapeHtml(e.fullName||'Employee')}</h1><p class="desc">${escapeHtml(e.jobTitle||'—')} · ${escapeHtml(e.department||'—')} · ${escapeHtml(e.employeeId||'')}</p></div>
      <div class="head-controls">
        <button class="btn" id="backEmp">← Employees</button>
        <button class="btn" id="editEmpD">Edit</button>
        <button class="btn btn-accent" id="newCtForEmp">+ New Contract</button>
      </div>
    </div>
    ${alerts.length?`<div class="insight-list" style="margin-bottom:14px;">${alerts.map(a=>`<div class="insight-item ${a.type}">${a.text}</div>`).join('')}</div>`:''}
    <div class="grid grid-2" style="margin-bottom:14px;">
      <div class="card">
        <h3>Profile</h3>
        <div style="font-size:13px;line-height:2;">
          <div>Status: ${hrStatusBadge(e.employmentStatus||'Inactive', EMP_STATUS_META)} ${e.active===false?'<span class="pill pill-status-archived">record off</span>':''}</div>
          <div>Contract Type: <b>${escapeHtml(e.contractType||'—')}</b></div>
          <div>Join Date: <b>${fmtDateID(e.joinDate)}</b></div>
          <div>Monthly Base Salary: <b class="mono">${fmtIDR(e.monthlyBaseSalary)}</b></div>
          <div>Bank: <b>${escapeHtml(e.bankName||'—')}</b> ${escapeHtml(e.bankAccountNumber||'')}</div>
          <div>Email: <b>${escapeHtml(e.email||'—')}</b></div>
          <div>Phone: <b>${escapeHtml(e.phone||'—')}</b></div>
          ${e.notes?`<div class="dim" style="margin-top:6px;">${escapeHtml(e.notes)}</div>`:''}
        </div>
      </div>
      <div class="card">
        <h3>Active Contract</h3>
        ${ct?`
          <div style="font-size:13px;line-height:1.9;">
            <div><b>${escapeHtml(ct.contractNumber||'—')}</b> ${hrStatusBadge(contractEffectiveStatus(ct), CONTRACT_STATUS_META)}</div>
            <div class="dim">${fmtDateID(calc.startDate)} → ${fmtDateID(calc.endDate)}</div>
            <div style="margin:8px 0 4px;">Progress <b>${calc.progress}</b> · ${calc.remaining} month${calc.remaining===1?'':'s'} remaining</div>
            ${progressBar(calc.pct)}
            <div style="margin-top:8px;">Monthly Salary: <b class="mono">${fmtIDR(ct.monthlySalary)}</b></div>
            <div style="margin-top:10px;"><button class="btn btn-sm" data-ct-detail="${ct.id}">Open Contract</button></div>
          </div>`:'<div class="empty">No active contract for the current month.</div>'}
      </div>
    </div>
    <div class="card" style="margin-bottom:14px;">
      <h3>Contract History</h3>
      <div class="table-wrap"><table>
        <thead><tr><th>Contract #</th><th>Start</th><th>End</th><th>Progress</th><th class="num">Monthly</th><th>Status</th><th></th></tr></thead>
        <tbody>${cts.map(c=>{ const cc=contractCalc(c); return `<tr>
          <td><button class="linklike" data-ct-detail="${c.id}">${escapeHtml(c.contractNumber||'—')}</button></td>
          <td class="dim">${fmtDateID(cc.startDate)}</td><td class="dim">${fmtDateID(cc.endDate)}</td>
          <td>${cc.progress}</td><td class="num">${fmtIDR(c.monthlySalary)}</td>
          <td>${hrStatusBadge(contractEffectiveStatus(c), CONTRACT_STATUS_META)}</td>
          <td><button class="btn btn-sm" data-ct-renew="${c.id}">Renew</button></td>
        </tr>`; }).join('') || '<tr><td colspan="7" class="empty">No contracts yet.</td></tr>'}</tbody>
      </table></div>
    </div>
    <div class="card" style="margin-bottom:14px;">
      <h3>Payroll History</h3>
      <div class="table-wrap"><table>
        <thead><tr><th>Period</th><th>Contract</th><th class="num">Base</th><th class="num">Overtime</th><th class="num">Total</th><th>Stage</th></tr></thead>
        <tbody>${empPlans.map(p=>`<tr>
          <td class="dim">${escapeHtml(p.month||'')} ${p.year||''}</td>
          <td class="dim">${escapeHtml(p.contractNumber||'—')}</td>
          <td class="num">${fmtIDR(payrollBaseSalary(p))}</td>
          <td class="num">${fmtIDR(p.overtimeAmount)}</td>
          <td class="num"><b>${fmtIDR(computePayrollPlanned(p))}</b></td>
          <td>${payrollStagePill(p)}</td>
        </tr>`).join('') || '<tr><td colspan="6" class="empty">No payroll generated for this employee yet.</td></tr>'}</tbody>
      </table></div>
    </div>
    <div class="card" style="margin-bottom:14px;">
      <h3>Overtime History</h3>
      <div class="table-wrap"><table>
        <thead><tr><th>Period</th><th>Date</th><th class="num">Hours</th><th class="num">Amount</th><th>Status</th></tr></thead>
        <tbody>${empOt.map(o=>`<tr>
          <td class="dim">${escapeHtml(o.month||'')} ${o.year||''}</td>
          <td class="dim">${escapeHtml(o.overtimeDate||'—')}</td>
          <td class="num">${num(o.overtimeHours)}</td>
          <td class="num">${fmtIDR(o.approvedAmount!=null?o.approvedAmount:o.calculatedAmount)}</td>
          <td>${hrStatusBadge(o.status, OVERTIME_STATUS_META)}</td>
        </tr>`).join('') || '<tr><td colspan="5" class="empty">No overtime records for this employee.</td></tr>'}</tbody>
      </table></div>
    </div>
    <div class="card">
      <h3>Finance Transactions</h3>
      <div class="table-wrap"><table>
        <thead><tr><th>Month</th><th>Description</th><th class="num">Planned</th><th class="num">Actual</th><th>Status</th></tr></thead>
        <tbody>${txns.map(t=>`<tr>
          <td class="dim">${escapeHtml(t.month)} ${t.year}</td>
          <td><button class="linklike" data-open-detail="${t.id}">${escapeHtml(t.uraian)}</button></td>
          <td class="num">${fmtIDR(t.planned)}</td>
          <td class="num">${t.actual!=null?fmtIDR(t.actual):'<span class="faint">—</span>'}</td>
          <td>${statusBadge(statusOf(t))}</td>
        </tr>`).join('') || '<tr><td colspan="5" class="empty">No finance transactions yet. Post approved payroll to create them.</td></tr>'}</tbody>
      </table></div>
    </div>`;
  document.getElementById('backEmp').addEventListener('click', ()=>hrNavTo('employees'));
  document.getElementById('editEmpD').addEventListener('click', ()=>openEmployeeModal(e.id));
  document.getElementById('newCtForEmp').addEventListener('click', ()=>openContractModal(null, e.id));
  main.querySelectorAll('[data-ct-detail]').forEach(b=>b.addEventListener('click', ()=>hrNavTo('contractDetail', {detailContractId:b.dataset.ctDetail})));
  main.querySelectorAll('[data-ct-renew]').forEach(b=>b.addEventListener('click', ()=>openRenewModal(b.dataset.ctRenew)));
  main.querySelectorAll('[data-open-detail]').forEach(b=>b.addEventListener('click', ()=>openDetailModal(b.dataset.openDetail)));
  bindHRActions(main);
}

/* ---------- generic HR actions menu (mirrors the finance actions menu) ---------- */
function hrActionsMenu(kind, id, items){
  return `<div class="actions-menu">
    <button class="btn btn-sm actions-toggle" data-hr-actions="${kind}:${id}">Actions ▾</button>
    <div class="actions-dropdown" data-hr-menu="${kind}:${id}" style="display:none;">
      ${items.filter(Boolean).map(([a,l])=>`<button class="actions-item ${a.endsWith('delete')?'danger':''}" data-hr-action="${a}" data-hr-id="${id}">${l}</button>`).join('')}
    </div></div>`;
}
function bindHRActions(main){
  main.querySelectorAll('[data-hr-actions]').forEach(btn=>btn.addEventListener('click', e=>{
    e.stopPropagation();
    const menu = main.querySelector(`[data-hr-menu="${btn.dataset.hrActions}"]`);
    const open = menu.style.display==='block';
    main.querySelectorAll('.actions-dropdown').forEach(m=>m.style.display='none');
    menu.style.display = open?'none':'block';
    if(!open) document.addEventListener('click', ()=>{ main.querySelectorAll('.actions-dropdown').forEach(m=>m.style.display='none'); }, {once:true});
  }));
  main.querySelectorAll('[data-hr-action]').forEach(btn=>btn.addEventListener('click', async e=>{
    e.stopPropagation();
    main.querySelectorAll('.actions-dropdown').forEach(m=>m.style.display='none');
    const id = btn.dataset.hrId, a = btn.dataset.hrAction;
    if(a==='emp-detail') hrNavTo('employeeDetail', {detailEmpId:id});
    else if(a==='emp-edit') openEmployeeModal(id);
    else if(a==='emp-deactivate') setEmployeeActive(id, false);
    else if(a==='emp-reactivate') setEmployeeActive(id, true);
    else if(a==='emp-delete') deleteEmployee(id);
    else if(a==='ct-detail') hrNavTo('contractDetail', {detailContractId:id});
    else if(a==='ct-edit') openContractModal(id);
    else if(a==='ct-renew') openRenewModal(id);
    else if(a==='ct-activate') setContractStatus(id, 'Active');
    else if(a==='ct-cancel') setContractStatus(id, 'Cancelled');
    else if(a==='ct-delete') deleteContract(id);
    else if(a==='re-edit') openRecurringModal(id);
    else if(a==='re-toggle') toggleRecurring(id);
    else if(a==='re-delete') deleteRecurring(id);
    else if(a==='padj-edit') openAdjustmentModal(id);
    else if(a==='padj-toggle') toggleAdjustment(id);
    else if(a==='padj-delete') deleteAdjustment(id);
    else if(a==='prow-detail') hrNavTo('payrollDetail',{detailPayrollId:id});
    else if(a==='prow-review') { await setPayrollStatus(id,'Reviewed'); render(); }
    else if(a==='prow-ready') { await setPayrollStatus(id,'Ready'); render(); }
    else if(a==='prow-draft') { await setPayrollStatus(id,'Draft'); render(); }
    else if(a==='prow-cancel') { if(confirmAction('Cancel this payroll row? It will not create a finance transaction.')){ await setPayrollStatus(id,'Cancelled'); render(); } }
    else if(a==='prow-exec') { State.view='executioncenter'; State.execFilter='today'; render(); }
    else if(a==='ot-view') openOvertimeBreakdown(id);
    else if(a==='ot-edit') openOvertimeModal(id);
    else if(a==='ot-duplicate') duplicateOvertimeRecord(id);
    else if(a==='ot-review') setOvertimeStatus(id, 'Reviewed');
    else if(a==='ot-approve') setOvertimeStatus(id, 'Approved');
    else if(a==='ot-reject') setOvertimeStatus(id, 'Rejected');
    else if(a==='ot-delete') deleteOvertimeRecord(id);
  }));
}

function exportEmployeesCsv(){
  const headers = ['Employee ID','Full Name','Job Title','Department','Employment Status','Record Active','Join Date','Contract Type','Active Contract','Monthly Base Salary','Bank Name','Bank Account','Email','Phone','Notes'];
  const lines = [`# ${APP_NAME} v${APP_VERSION} — Employees`, headers.join(',')];
  State.employees.forEach(e=>{
    const ct = activeContractToday(e.id);
    lines.push([e.employeeId,e.fullName,e.jobTitle,e.department,e.employmentStatus,e.active===false?'No':'Yes',e.joinDate||'',e.contractType,ct?ct.contractNumber:'',e.monthlyBaseSalary??'',e.bankName,e.bankAccountNumber,e.email,e.phone,e.notes].map(csvSafe).join(','));
  });
  downloadBlob(lines.join('\n'), `${FILE_BASE}-employees.csv`, 'text/csv');
  toast('Employees exported.');
}
