/* ============================================================
   PAYROLL PLANNING
   ============================================================ */
function num(x){ const n=Number(x); return isFinite(n)?n:0; }
function payrollAmount(r){ return num(r.baseSalary)+num(r.overtime)+num(r.allowance)+num(r.bonus)+num(r.benefits)+num(r.otherAdjustment)-num(r.deduction); }
function samePayrollComponents(a,b){
  return ['baseSalary','overtime','allowance','deduction','bonus','benefits','otherAdjustment'].every(k=>num(a[k])===num(b[k])) && (a.notes||'')===(b.notes||'');
}
// Build editable draft rows for every eligible employee with a covering
// contract; collect exclusion reasons for everyone else.
function generatePayrollRows(monthKey){
  const rows=[], excluded=[];
  State.employees.forEach(e=>{
    if(!empEligible(e)){ excluded.push({name:e.fullName, reason:`Not an active employee (status: ${e.employmentStatus}${e.active===false?', record deactivated':''})`}); return; }
    const ct = coveringContract(e.id, monthKey);
    if(!ct){ excluded.push({name:e.fullName, reason:'No active contract covering this month'}); return; }
    const cc = contractCalc(ct, monthKey);
    const base = (ct.monthlySalary!=null?ct.monthlySalary:e.monthlyBaseSalary)||0;
    const existing = State.payrollPlans.find(p=>p.monthKey===monthKey && p.employeeId===e.id && p.contractId===ct.id);
    const src = existing || {baseSalary:base, overtime:0, allowance:0, deduction:0, bonus:0, benefits:0, otherAdjustment:0, notes:''};
    // Auto-populate overtime from Approved (and already-committed) overtime for
    // this employee + month — the user never re-types the overtime total (Part 9).
    const ot = approvedOvertimeForMonth(e.id, monthKey);
    const overtime = ot.ids.length ? ot.amount : num(src.overtime);
    let otDup = 'none';
    if(ot.ids.length){
      const anyCommitted = ot.records.some(o=>o.status==='Committed to Payroll');
      if(anyCommitted && existing) otDup='committed';
      else if(existing && num(existing.overtime)===overtime) otDup='existing';
      else if(existing) otDup='changed';
      else otDup='new';
    }
    const src2 = {...src, overtime};
    let dup='new';
    if(existing){ dup = samePayrollComponents(existing, src2)?'existing':'changed'; }
    rows.push({
      _existingId: existing?existing.id:null, dup,
      employeeId:e.id, employeeName:e.fullName, contractId:ct.id, contractNumber:ct.contractNumber, contractProgress:cc.progress,
      baseSalary:num(src.baseSalary), overtime:num(overtime), allowance:num(src.allowance), deduction:num(src.deduction),
      bonus:num(src.bonus), benefits:num(src.benefits), otherAdjustment:num(src.otherAdjustment),
      notes:src.notes||'', missingSalary: base<=0,
      otIds: ot.ids, otAmount: ot.amount, otDup, otRecords: ot.records,
    });
  });
  return {monthKey, rows, excluded};
}
function ensureMonthlyPlan(monthKey){
  let plan = monthlyPlanFor(monthKey);
  if(!plan){ const mo=keyToMonthObj(monthKey); plan={id:uid('mp'), monthKey, month:mo.month, year:mo.year, monthNum:mo.monthNum, status:'Draft', committedTxnIds:[], createdAt:new Date().toISOString()}; State.monthlyPlans.push(plan); }
  if(!Array.isArray(plan.committedTxnIds)) plan.committedTxnIds=[];
  return plan;
}
// Planned Gaji transaction generated from a payroll plan. Carries structured
// links (never description text alone) so it round-trips to employee/contract.
function buildPayrollTxn(pp, mo, uraian){
  const ts = new Date().toISOString();
  return {
    id: uid('pay'), monthKey:pp.monthKey, month:mo.month, year:mo.year, monthNum:mo.monthNum,
    category: State.settings.defaultPayrollCategory||'Gaji', categoryCode:'A', no:null,
    uraian, vol:1, satuan:'bulan', hargaSatuan:pp.plannedAmount,
    planned:pp.plannedAmount, actual:null, type:'expense', txnDate:null,
    source:'payroll', unplanned:false,
    scheduledDate:null, paymentMethod:null, bankAccount:null, referenceNumber:null, notes:pp.notes||null, vendor:null,
    executionId:null, executionTimestamp:null, execution:null, status:'planned',
    employeeId:pp.employeeId, contractId:pp.contractId, payrollPlanId:pp.id, monthlyPlanId:pp.monthlyPlanId||null,
    overtimeIds: Array.isArray(pp.overtimeIds)?pp.overtimeIds.slice():[], overtimeAmount: num(pp.overtime),
    payrollMeta:{employeeName:pp.employeeName, contractNumber:pp.contractNumber, contractProgress:pp.contractProgress},
    history:[{event:'created', ts, note:'Generated from Payroll Planning'}],
  };
}
async function commitPayroll(monthKey, rows){
  const mo = keyToMonthObj(monthKey);
  const plan = ensureMonthlyPlan(monthKey);
  let created=0, updated=0;
  for(const r of rows){
    const amount = payrollAmount(r);
    const now = new Date().toISOString();
    let pp = r._existingId ? payrollPlanById(r._existingId) : null;
    if(!pp){ pp={id:uid('pp'), createdAt:now}; State.payrollPlans.push(pp); }
    const otIds = Array.isArray(r.otIds)?r.otIds.slice():[];
    Object.assign(pp, {
      monthKey, month:mo.month, year:mo.year, monthNum:mo.monthNum,
      employeeId:r.employeeId, employeeName:r.employeeName, contractId:r.contractId,
      contractNumber:r.contractNumber, contractProgress:r.contractProgress,
      baseSalary:num(r.baseSalary), overtime:num(r.overtime), allowance:num(r.allowance), deduction:num(r.deduction),
      bonus:num(r.bonus), benefits:num(r.benefits), otherAdjustment:num(r.otherAdjustment),
      overtimeIds: otIds,
      plannedAmount:amount, notes:r.notes||'', status:'committed', monthlyPlanId:plan.id, updatedAt:now,
    });
    const uraian = `${r.employeeName} · ${r.contractNumber} · ${r.contractProgress}`;
    let txn = pp.committedTxnId ? findTxn(pp.committedTxnId) : null;
    if(!txn){
      txn = buildPayrollTxn(pp, mo, uraian); State.txns.push(txn); pp.committedTxnId=txn.id; created++;
    } else if(txn.actual==null){
      txn.planned=amount; txn.hargaSatuan=amount; txn.uraian=uraian;
      txn.overtimeIds = otIds; txn.overtimeAmount = num(r.overtime);
      txn.payrollMeta={employeeName:r.employeeName, contractNumber:r.contractNumber, contractProgress:r.contractProgress};
      pushHistory(txn,'edited','Payroll plan re-committed'); updated++;
    }
    // Flip the included Approved overtime to Committed to Payroll and link it.
    // Records already Committed stay put — this prevents committing the same
    // overtime twice (Part 9).
    otIds.forEach(oid=>{ const o=overtimeById(oid); if(o && o.status==='Approved'){ o.status='Committed to Payroll'; o.payrollPlanId=pp.id; o.committedTxnId=pp.committedTxnId; o.updatedAt=now; (o.history=o.history||[]).push({event:'committed', ts:now, note:'Committed to payroll '+uraian}); } });
    if(pp.committedTxnId && !plan.committedTxnIds.includes(pp.committedTxnId)) plan.committedTxnIds.push(pp.committedTxnId);
  }
  if(plan.status==='Draft'||plan.status==='Reviewed') plan.status='Committed';
  plan.committedAt=new Date().toISOString(); plan.updatedAt=plan.committedAt;
  await persistPayrollPlans(); await persistMonthlyPlans(); await persistOvertime(); await persist();
  return {created, updated};
}

function renderPayrollPlanning(main){
  if(!State.employees.length){
    main.innerHTML = pageHeader('Payroll Planning','Generate monthly payroll from active employees and their contracts — no Excel required.')
      + actionEmptyState('No payroll plans yet','Add employees and give them active contracts first, then generate payroll for a month.','Add Employee','employees');
    bindActionEmptyState(main); return;
  }
  const months = getMonths();
  // Offer existing finance months plus the current calendar month so payroll
  // can be planned ahead even before any transaction exists for it.
  const keys = [...new Set([...months.map(m=>m.key), todayKey()])].sort();
  if(!State.payrollMonth) State.payrollMonth = keys[keys.length-1];
  const monthKey = State.payrollMonth;
  const mo = keyToMonthObj(monthKey);
  const draft = (State.payrollDraft && State.payrollDraft.monthKey===monthKey) ? State.payrollDraft : null;

  const eligibleNow = State.employees.filter(empEligible).length;
  const committedPlans = State.payrollPlans.filter(p=>p.monthKey===monthKey && p.status==='committed');

  main.innerHTML = `
    <div class="page-head">
      <div><h1>Payroll Planning</h1><p class="desc">Generate a payroll plan for a month from active employees and their contracts — no Excel required. Commit it to create planned Gaji transactions.</p></div>
      <div class="head-controls">
        <select class="input" id="payMonth">${keys.map(k=>{const o=keyToMonthObj(k); return `<option value="${k}" ${k===monthKey?'selected':''}>${o.month} ${o.year}</option>`;}).join('')}</select>
        <button class="btn btn-accent" id="genPay">Generate Payroll</button>
        <button class="btn" id="legacyMapBtn">Legacy Payroll Mapping</button>
      </div>
    </div>
    <div class="grid grid-3" style="margin-bottom:14px;">
      <div class="card stat-card"><div class="stat-label">Eligible Employees</div><div class="stat-value">${eligibleNow}</div><div class="stat-sub dim">active with a covering contract check on generate</div></div>
      <div class="card stat-card"><div class="stat-label">Committed Payroll (${escapeHtml(mo.month)})</div><div class="stat-value">${committedPlans.length}</div><div class="stat-sub dim">${fmtIDR(committedPlans.reduce((s,p)=>s+(p.plannedAmount||0),0))}</div></div>
      <div class="card stat-card"><div class="stat-label">Monthly Plan Status</div><div class="stat-value" style="font-size:16px;">${(()=>{const p=monthlyPlanFor(monthKey); return p?hrStatusBadge(p.status,PLAN_STATUS_META):'<span class="faint">Not started</span>';})()}</div><div class="stat-sub dim">${escapeHtml(mo.month)} ${mo.year}</div></div>
    </div>
    <div id="payArea"></div>`;

  document.getElementById('payMonth').addEventListener('change', e=>{ State.payrollMonth=e.target.value; State.payrollDraft=null; renderPayrollPlanning(main); });
  document.getElementById('genPay').addEventListener('click', ()=>{ State.payrollDraft = generatePayrollRows(monthKey); renderPayrollPlanning(main); });
  document.getElementById('legacyMapBtn').addEventListener('click', ()=>hrNavTo('legacyMap'));

  const area = document.getElementById('payArea');
  if(!draft){
    area.innerHTML = `<div class="card"><div class="empty">Select a month and click <b>Generate Payroll</b>. The system will create an editable payroll row for every active employee whose contract covers ${escapeHtml(mo.month)} ${mo.year}, and list anyone excluded with the reason.</div></div>`;
    return;
  }
  renderPayrollDraft(area, draft);
}

function renderPayrollDraft(area, draft){
  const counts = {new:0, existing:0, changed:0};
  draft.rows.forEach(r=>{ counts[r.dup]=(counts[r.dup]||0)+1; });
  const total = draft.rows.reduce((s,r)=>s+payrollAmount(r),0);
  area.innerHTML = `
    <div class="card" style="margin-bottom:14px;">
      <h3>Generated Payroll — ${escapeHtml(keyToMonthObj(draft.monthKey).month)} ${keyToMonthObj(draft.monthKey).year}
        <span class="tag">${draft.rows.length} row${draft.rows.length===1?'':'s'} · ${counts.new} new · ${counts.changed} changed · ${counts.existing} existing · ${draft.excluded.length} skipped</span></h3>
      <p class="hint" style="margin-bottom:12px;">Edit any component below before committing. Planned Payroll = Base + Overtime + Allowance + Bonus + Benefits + Other − Deduction.</p>
      <div class="table-wrap" style="max-height:520px;overflow-y:auto;">
        <table>
          <thead><tr><th>Employee</th><th>Progress</th><th class="num">Base</th><th class="num">Overtime</th><th class="num">Allowance</th><th class="num">Bonus</th><th class="num">Benefits</th><th class="num">Other</th><th class="num">Deduction</th><th class="num">Planned</th><th></th></tr></thead>
          <tbody>${draft.rows.map((r,i)=>payrollRowHTML(r,i)).join('') || '<tr><td colspan="11" class="empty">No eligible employees for this month. Check employee status and contract coverage.</td></tr>'}</tbody>
          <tfoot><tr><td colspan="9" style="text-align:right;font-weight:600;">Total Planned Payroll</td><td class="num" id="payTotal"><b>${fmtIDR(total)}</b></td><td></td></tr></tfoot>
        </table>
      </div>
      ${draft.rows.length?`<div class="modal-actions" style="justify-content:flex-start;margin-top:14px;"><button class="btn btn-accent" id="commitPay">Commit Payroll to Monthly Plan</button><span class="hint" style="align-self:center;">Creates planned Gaji transactions (status: Planned). They will NOT be executed automatically.</span></div>`:''}
    </div>
    ${draft.excluded.length?`<div class="card"><h3>Excluded Employees <span class="tag">${draft.excluded.length} skipped</span></h3><div class="insight-list">${draft.excluded.map(x=>`<div class="insight-item warn"><b>${escapeHtml(x.name)}</b> — ${escapeHtml(x.reason)}</div>`).join('')}</div></div>`:''}`;

  area.querySelectorAll('input[data-field]').forEach(inp=>inp.addEventListener('input', e=>{
    const i=+e.target.dataset.row, field=e.target.dataset.field;
    draft.rows[i][field] = e.target.value;
    const amt = payrollAmount(draft.rows[i]);
    const cell = area.querySelector(`#planned-${i}`); if(cell) cell.textContent = fmtIDR(amt);
    const tot = draft.rows.reduce((s,r)=>s+payrollAmount(r),0);
    const tc = area.querySelector('#payTotal'); if(tc) tc.innerHTML=`<b>${fmtIDR(tot)}</b>`;
  }));
  area.querySelectorAll('[data-ot-break]').forEach(b=>b.addEventListener('click', ()=>{
    const r = draft.rows[+b.dataset.otBreak];
    const recs = (r.otRecords||[]);
    openModalHTML(`<h3>Overtime Breakdown — ${escapeHtml(r.employeeName)}</h3>
      <div class="table-wrap"><table><thead><tr><th>Date</th><th class="num">Hours</th><th class="num">Hourly Rate</th><th class="num">Amount</th><th>Description</th><th>Status</th></tr></thead>
      <tbody>${recs.map(o=>`<tr><td class="dim">${escapeHtml(o.overtimeDate||'—')}</td><td class="num">${num(o.overtimeHours)}</td><td class="num">${fmtIDRfull(o.hourlyRate)}</td><td class="num">${fmtIDR(o.approvedAmount!=null?o.approvedAmount:o.calculatedAmount)}</td><td>${escapeHtml(o.workDescription||'')}</td><td>${hrStatusBadge(o.status,OVERTIME_STATUS_META)}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td style="text-align:right;font-weight:600;">Total</td><td class="num"><b>${recs.reduce((s,o)=>s+num(o.overtimeHours),0)}</b></td><td></td><td class="num"><b>${fmtIDR(r.otAmount)}</b></td><td colspan="2"></td></tr></tfoot></table></div>
      <div class="modal-actions"><button type="button" class="btn" id="obClose">Close</button></div>`, {width:640, onMount:(root)=>root.querySelector('#obClose').addEventListener('click', closeModal)});
  }));
  const cp = area.querySelector('#commitPay');
  if(cp) cp.addEventListener('click', async ()=>{
    const zero = draft.rows.filter(r=>payrollAmount(r)<=0).length;
    let msg = `Commit ${draft.rows.length} payroll row(s) for ${keyToMonthObj(draft.monthKey).month} ${keyToMonthObj(draft.monthKey).year}?\n\nThis creates/updates planned Gaji transactions (status: Planned). Nothing is executed automatically.`;
    if(zero) msg += `\n\nNote: ${zero} row(s) have a zero or negative planned amount.`;
    if(!confirm(msg)) return;
    const res = await commitPayroll(draft.monthKey, draft.rows);
    State.payrollDraft=null;
    toast(`Payroll committed: ${res.created} transaction(s) created, ${res.updated} updated.`, 5000);
    render();
  });
}
function payrollRowHTML(r,i){
  const cls = r.dup==='new'?'pill-status-planned':r.dup==='changed'?'pill-status-partial':'pill-status-archived';
  const otBadge = (r.otIds && r.otIds.length) ? ` <span class="pill pill-status-scheduled" title="Auto-filled from ${r.otIds.length} approved overtime record(s)">OT ${fmtIDRShort(r.otAmount)} · ${r.otDup}</span>` : '';
  return `<tr>
    <td><b>${escapeHtml(r.employeeName)}</b><div class="faint" style="font-size:10px;">${escapeHtml(r.contractNumber||'')} <span class="pill ${cls}">${r.dup}</span>${r.missingSalary?' <span class="pill pill-status-cancelled">no salary</span>':''}${otBadge}</div></td>
    <td>${escapeHtml(r.contractProgress||'')}</td>
    ${['baseSalary','overtime','allowance','bonus','benefits','otherAdjustment','deduction'].map(f=>`<td class="num"><input class="input" style="width:96px;text-align:right;padding:4px 6px;" type="number" step="any" data-row="${i}" data-field="${f}" value="${num(r[f])}"></td>`).join('')}
    <td class="num" id="planned-${i}"><b>${fmtIDR(payrollAmount(r))}</b></td>
    <td>${(r.otIds&&r.otIds.length)?`<button class="btn btn-sm" data-ot-break="${i}">OT</button>`:''}</td>
  </tr>`;
}
