/* ============================================================
   CONTRACTS
   ============================================================ */
function allContractAlerts(){
  const alerts = [];
  const warn = Number(State.settings.contractExpiryWarningDays)||90;
  State.contracts.forEach(c=>{
    const es = contractEffectiveStatus(c);
    const cc = contractCalc(c);
    if(es==='Expired' && c.status==='Active') alerts.push({type:'warn', sev:0, text:`Contract ${escapeHtml(c.contractNumber||'')} (${escapeHtml(c.employeeName||'')}) has expired — renew or close it.`});
    else if(es==='Expiring Soon'){
      const d = cc.daysUntilEnd;
      const band = d<=30?30:d<=60?60:90;
      alerts.push({type:'warn', sev:band, text:`Contract ${escapeHtml(c.contractNumber||'')} (${escapeHtml(c.employeeName||'')}) expires within ${band} days — ${d} day${d===1?'':'s'} left (${fmtDateID(cc.endDate)}).`});
    }
  });
  // employees with no active contract / overlaps
  State.employees.filter(empEligible).forEach(e=>{
    if(!activeContractToday(e.id)) alerts.push({type:'warn', sev:200, text:`${escapeHtml(e.fullName)} is Active but has no active contract for this month.`});
    if(overlappingActiveContracts(e.id).length) alerts.push({type:'warn', sev:150, text:`${escapeHtml(e.fullName)} has overlapping active contracts — dates conflict.`});
  });
  return alerts.sort((a,b)=>a.sev-b.sev);
}
/* v2.6.1 — Contracts incremental list (see Employees). */
function contractsFiltered(){
  const f = State.contractFilter;
  let rows = State.contracts.slice();
  if(f.status!=='all') rows = rows.filter(c=>contractEffectiveStatus(c)===f.status);
  if(f.search.trim()){ const s=normStr(f.search); rows = rows.filter(c=>[c.contractNumber,c.employeeName].some(x=>normStr(x||'').includes(s))); }
  rows.sort((a,b)=>String(b.startDate||'').localeCompare(String(a.startDate||'')));
  return rows;
}
function contractRowsHTML(){
  return contractsFiltered().map(c=>{ const cc=contractCalc(c); const es=contractEffectiveStatus(c); return `<tr>
    <td><button class="linklike" data-ct-detail="${c.id}"><b>${escapeHtml(c.contractNumber||'—')}</b></button></td>
    <td><button class="linklike" data-emp-open="${c.employeeId}">${escapeHtml(c.employeeName||'—')}</button></td>
    <td class="dim">${fmtDateID(cc.startDate)}</td>
    <td class="dim">${fmtDateID(cc.endDate)}</td>
    <td style="min-width:120px;"><div style="display:flex;align-items:center;gap:8px;"><span class="mono">${cc.progress}</span><div style="flex:1;">${progressBar(cc.pct)}</div></div></td>
    <td class="num">${fmtIDR(c.monthlySalary)}</td>
    <td>${hrStatusBadge(es, CONTRACT_STATUS_META)}</td>
    <td>${hrActionsMenu('ct', c.id, [
      ['ct-detail','View Detail'],
      ['ct-edit','Edit'],
      ['ct-renew','Renew'],
      c.status==='Draft'?['ct-activate','Activate']:null,
      c.status!=='Cancelled'&&c.status!=='Renewed'?['ct-cancel','Cancel']:null,
      ['ct-delete','Delete']
    ])}</td>
  </tr>`; }).join('') || `<tr><td colspan="8" class="empty">No contracts yet. Create one from here or from an employee’s detail page.</td></tr>`;
}
function bindContractRows(main){
  main.querySelectorAll('[data-ct-detail]').forEach(b=>b.addEventListener('click', ()=>hrNavTo('contractDetail', {detailContractId:b.dataset.ctDetail})));
  main.querySelectorAll('[data-emp-open]').forEach(b=>b.addEventListener('click', ()=>hrNavTo('employeeDetail', {detailEmpId:b.dataset.empOpen})));
  bindHRActions(main);
}
function applyContractFilter(main){
  const tb = document.getElementById('ctRows'); if(!tb) return;
  tb.innerHTML = contractRowsHTML();
  bindContractRows(main);
}
function renderContracts(main){
  const f = State.contractFilter;
  const alerts = allContractAlerts();
  const activeN = State.contracts.filter(c=>contractEffectiveStatus(c)==='Active').length;
  const soonN = State.contracts.filter(c=>contractEffectiveStatus(c)==='Expiring Soon').length;

  main.innerHTML = `
    <div class="page-head">
      <div><h1>Contracts</h1><p class="desc">${State.contracts.length} contract${State.contracts.length===1?'':'s'} · ${activeN} active · ${soonN} expiring soon. Progress is calculated automatically from start date + duration.</p></div>
      <div class="head-controls">
        <button class="btn btn-accent" id="addCt">+ New Contract</button>
        <button class="btn" id="expCt">Export CSV</button>
      </div>
    </div>
    ${alerts.length?`<div class="card" style="margin-bottom:14px;"><h3>Contract Alerts</h3><div class="insight-list">${alerts.slice(0,12).map(a=>`<div class="insight-item ${a.type}">${a.text}</div>`).join('')}</div></div>`:''}
    <div class="card">
      <div class="form-grid" style="grid-template-columns:1.6fr 1fr;margin-bottom:14px;">
        <div class="field"><label>Search (contract #, employee)</label><input class="input" id="cSearch" placeholder="Search…" value="${escapeHtml(f.search)}"></div>
        <div class="field"><label>Status</label><select class="input" id="cStatus"><option value="all">All statuses</option>${Object.keys(CONTRACT_STATUS_META).map(s=>`<option ${f.status===s?'selected':''}>${s}</option>`).join('')}</select></div>
      </div>
      <div class="table-wrap" style="max-height:620px;overflow-y:auto;">
        <table>
          <thead><tr><th>Contract #</th><th>Employee</th><th>Start</th><th>End</th><th>Progress</th><th class="num">Monthly</th><th>Status</th><th></th></tr></thead>
          <tbody id="ctRows">${contractRowsHTML()}</tbody>
        </table>
      </div>
    </div>`;
  document.getElementById('cSearch').addEventListener('input', e=>{ State.contractFilter.search=e.target.value; applyContractFilter(main); });
  document.getElementById('cStatus').addEventListener('change', e=>{ State.contractFilter.status=e.target.value; applyContractFilter(main); });
  document.getElementById('addCt').addEventListener('click', ()=>openContractModal(null));
  document.getElementById('expCt').addEventListener('click', exportContractsCsv);
  bindContractRows(main);
}

function openContractModal(id, presetEmpId){
  const c = id ? contractById(id) : null;
  const isNew = !c;
  const v = c || {status:'Draft', durationMonths:Number(State.settings.defaultContractDuration)||12, employeeId:presetEmpId||''};
  const emps = State.employees.slice().sort((a,b)=>String(a.fullName||'').localeCompare(String(b.fullName||'')));
  openModalHTML(`
    <h3>${isNew?'New Contract':'Edit Contract'}</h3>
    <form id="ctForm">
      <div class="form-grid" style="grid-template-columns:1fr 1fr;">
        <div class="field" style="grid-column:span 2;"><label>Employee</label>
          <select class="input" name="employeeId" required><option value="">— select employee —</option>${emps.map(e=>`<option value="${e.id}" ${v.employeeId===e.id?'selected':''}>${escapeHtml(e.fullName)} (${escapeHtml(e.employeeId||'')})</option>`).join('')}</select>
        </div>
        <div class="field"><label>Contract Number</label><input class="input" name="contractNumber" value="${escapeHtml(v.contractNumber||'')}" placeholder="e.g. 1/AIMO-DT/XI/2025" required></div>
        <div class="field"><label>Monthly Salary (Rp)</label><input class="input" type="number" step="any" name="monthlySalary" value="${v.monthlySalary??''}"></div>
        <div class="field"><label>Start Date</label><input class="input" type="date" name="startDate" value="${escapeHtml(v.startDate||'')}" required></div>
        <div class="field"><label>Duration (months)</label><input class="input" type="number" min="1" step="1" name="durationMonths" value="${v.durationMonths??12}" required></div>
        <div class="field"><label>Status</label><select class="input" name="status">${CONTRACT_STORED_STATUSES.map(s=>`<option ${v.status===s?'selected':''}>${s}</option>`).join('')}</select></div>
        <div class="field"><label>Auto End Date</label><input class="input" id="ctEndPreview" value="—" disabled></div>
        <div class="field" style="grid-column:span 2;"><label>Notes</label><textarea class="input" name="notes">${escapeHtml(v.notes||'')}</textarea></div>
        ${scheduleFieldsHTML(v, 'contract-specific, overrides employee')}
      </div>
      <div class="hint" id="ctProgPreview"></div>
      <div class="modal-actions">
        <button type="button" class="btn" id="ctCancel">Cancel</button>
        <button type="submit" class="btn btn-accent">${isNew?'Create Contract':'Save Changes'}</button>
      </div>
    </form>`, {width:600, onMount:(root)=>{
      const form = root.querySelector('#ctForm');
      const upd = ()=>{
        const sd = form.startDate.value, dur = +form.durationMonths.value||0;
        if(sd && dur>0){
          const cc = contractCalc({startDate:sd, durationMonths:dur, status:'Active'});
          root.querySelector('#ctEndPreview').value = fmtDateID(cc.endDate);
          root.querySelector('#ctProgPreview').textContent = `This month this contract would read ${cc.progress} (${cc.remaining} months remaining). Progress updates automatically each month — you never edit it manually.`;
        } else { root.querySelector('#ctEndPreview').value='—'; root.querySelector('#ctProgPreview').textContent=''; }
      };
      form.startDate.addEventListener('input', upd); form.durationMonths.addEventListener('input', upd); upd();
      root.querySelector('#ctCancel').addEventListener('click', closeModal);
      form.addEventListener('submit', async ev=>{
        ev.preventDefault();
        const fd = new FormData(ev.target);
        const emp = empById(fd.get('employeeId'));
        if(!emp){ toast('Please select an employee.'); return; }
        const rec = c || {id:uid('ct'), createdAt:new Date().toISOString(), history:[]};
        rec.employeeId = emp.id;
        rec.employeeName = emp.fullName;
        rec.contractNumber = (fd.get('contractNumber')||'').trim();
        rec.startDate = fd.get('startDate');
        rec.durationMonths = Number(fd.get('durationMonths'))||0;
        const sal = fd.get('monthlySalary'); rec.monthlySalary = (sal===''||sal==null)?null:Number(sal);
        rec.status = fd.get('status');
        rec.notes = (fd.get('notes')||'').trim();
        applyScheduleFromForm(fd, rec);
        rec.updatedAt = new Date().toISOString();
        (rec.history=rec.history||[]).push({event:isNew?'created':'edited', ts:rec.updatedAt, note:isNew?`Contract created (${rec.durationMonths} months from ${rec.startDate})`:'Contract edited'});
        if(isNew) State.contracts.push(rec);
        await persistContracts();
        closeModal(); toast(isNew?'Contract created.':'Contract updated.'); render();
      });
    }});
}

async function setContractStatus(id, status){
  const c = contractById(id); if(!c) return;
  if(status==='Cancelled' && payrollPlansForContract(id).some(p=>p.status==='committed')){
    if(!confirm('This contract has committed payroll. Cancelling it will NOT modify historical payroll or transactions. Continue?')) return;
  }
  c.status = status; c.updatedAt = new Date().toISOString();
  (c.history=c.history||[]).push({event:status.toLowerCase(), ts:c.updatedAt, note:`Status set to ${status}`});
  await persistContracts(); toast(`Contract ${status.toLowerCase()}.`); render();
}
async function deleteContract(id){
  const c = contractById(id); if(!c) return;
  if(payrollPlansForContract(id).length || txnsForContract(id).length){
    toast('This contract has linked payroll or transactions and cannot be deleted. Cancel it instead.', 6000);
    return;
  }
  if(c.status!=='Draft' && !confirm('Permanently delete this contract? Only unused records should be deleted.')) return;
  State.contracts = State.contracts.filter(x=>x.id!==id);
  await persistContracts(); toast('Contract deleted.'); render();
}

// Renewal: old → Renewed, new → Active (or Draft), history preserved, no
// historical payroll/transactions touched.
function openRenewModal(id){
  const c = contractById(id); if(!c){ toast('Contract not found.'); return; }
  const prevEnd = contractCalc(c).endDate;
  const suggestedStart = prevEnd ? (()=>{ const d=new Date(prevEnd+'T00:00:00'); d.setDate(d.getDate()+1); return d.toISOString().slice(0,10); })() : isoToday();
  openModalHTML(`
    <h3>Renew Contract</h3>
    <p class="dim" style="font-size:12.5px;">Renewing <b>${escapeHtml(c.contractNumber||'')}</b> for ${escapeHtml(c.employeeName||'')}. The existing contract becomes <b>Renewed</b>; a new contract is created. Historical payroll and transactions stay linked to the old contract.</p>
    <form id="renewForm">
      <div class="form-grid" style="grid-template-columns:1fr 1fr;">
        <div class="field"><label>New Contract Number</label><input class="input" name="contractNumber" required></div>
        <div class="field"><label>New Monthly Salary (Rp)</label><input class="input" type="number" step="any" name="monthlySalary" value="${c.monthlySalary??''}"></div>
        <div class="field"><label>New Start Date</label><input class="input" type="date" name="startDate" value="${suggestedStart}" required></div>
        <div class="field"><label>New Duration (months)</label><input class="input" type="number" min="1" name="durationMonths" value="${c.durationMonths||12}" required></div>
        <div class="field"><label>Initial Status</label><select class="input" name="status"><option>Active</option><option>Draft</option></select></div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn" id="renewCancel">Cancel</button>
        <button type="submit" class="btn btn-accent">Confirm Renewal</button>
      </div>
    </form>`, {width:560, onMount:(root)=>{
      root.querySelector('#renewCancel').addEventListener('click', closeModal);
      root.querySelector('#renewForm').addEventListener('submit', async ev=>{
        ev.preventDefault();
        const fd = new FormData(ev.target);
        const now = new Date().toISOString();
        const nc = {
          id:uid('ct'), employeeId:c.employeeId, employeeName:c.employeeName,
          contractNumber:(fd.get('contractNumber')||'').trim(),
          startDate:fd.get('startDate'), durationMonths:Number(fd.get('durationMonths'))||0,
          monthlySalary: fd.get('monthlySalary')===''?null:Number(fd.get('monthlySalary')),
          status: fd.get('status'), notes:`Renewal of ${c.contractNumber||''}`,
          createdAt:now, updatedAt:now, renewedFromId:c.id,
          history:[{event:'created', ts:now, note:`Renewed from ${c.contractNumber||''}`}],
        };
        c.status='Renewed'; c.renewedToId=nc.id; c.updatedAt=now;
        (c.history=c.history||[]).push({event:'renewed', ts:now, note:`Renewed into ${nc.contractNumber}`});
        State.contracts.push(nc);
        await persistContracts();
        closeModal(); toast('Contract renewed. Old contract marked Renewed; history preserved.');
        State.detailContractId = nc.id; render();
      });
    }});
}

function renderContractDetail(main){
  const c = contractById(State.detailContractId);
  if(!c){ main.innerHTML = emptyState('Contract not found','It may have been deleted.'); return; }
  const cc = contractCalc(c);
  const es = contractEffectiveStatus(c);
  const emp = empById(c.employeeId);
  const plans = payrollPlansForContract(c.id).slice().sort((a,b)=>String(b.monthKey).localeCompare(String(a.monthKey)));
  const txns = txnsForContract(c.id).slice().sort((a,b)=>String(b.monthKey).localeCompare(String(a.monthKey)));
  const alerts = [];
  if(es==='Expired') alerts.push({type:'warn', text:'This contract has expired.'});
  else if(es==='Expiring Soon') alerts.push({type:'warn', text:`Expiring soon — ${cc.daysUntilEnd} days remaining (ends ${fmtDateID(cc.endDate)}).`});
  if(c.renewedFromId){ const from=contractById(c.renewedFromId); if(from) alerts.push({type:'info', text:`Renewed from contract ${escapeHtml(from.contractNumber||'')}.`}); }
  if(c.renewedToId){ const to=contractById(c.renewedToId); if(to) alerts.push({type:'info', text:`Renewed into contract ${escapeHtml(to.contractNumber||'')}.`}); }

  main.innerHTML = `
    <div class="page-head">
      <div><h1>${escapeHtml(c.contractNumber||'Contract')}</h1><p class="desc">${escapeHtml(c.employeeName||'—')} · ${hrStatusBadge(es, CONTRACT_STATUS_META)}</p></div>
      <div class="head-controls">
        <button class="btn" id="backCt">← Contracts</button>
        <button class="btn" id="editCtD">Edit</button>
        <button class="btn btn-accent" id="renewCtD">Renew Contract</button>
      </div>
    </div>
    ${alerts.length?`<div class="insight-list" style="margin-bottom:14px;">${alerts.map(a=>`<div class="insight-item ${a.type}">${a.text}</div>`).join('')}</div>`:''}
    <div class="grid grid-2" style="margin-bottom:14px;">
      <div class="card">
        <h3>Contract</h3>
        <div style="font-size:13px;line-height:2;">
          <div>Employee: <button class="linklike" id="ctEmpLink"><b>${escapeHtml(c.employeeName||'—')}</b></button></div>
          <div>Start: <b>${fmtDateID(cc.startDate)}</b></div>
          <div>End: <b>${fmtDateID(cc.endDate)}</b></div>
          <div>Duration: <b>${cc.total} months</b></div>
          <div>Monthly Salary: <b class="mono">${fmtIDR(c.monthlySalary)}</b></div>
          <div>Stored Status: <b>${escapeHtml(c.status)}</b></div>
          ${c.notes?`<div class="dim" style="margin-top:6px;">${escapeHtml(c.notes)}</div>`:''}
        </div>
      </div>
      <div class="card">
        <h3>Progress</h3>
        <div style="font-size:26px;font-family:var(--mono);font-weight:600;margin-bottom:6px;">${cc.progress}</div>
        <div class="dim" style="font-size:13px;margin-bottom:10px;">Month ${cc.current} of ${cc.total} · ${cc.remaining} remaining · ${cc.pct}% complete</div>
        ${progressBar(cc.pct)}
        <div class="hint" style="margin-top:10px;">Calculated automatically from the start date and duration using calendar months. Before the start it reads 0/${cc.total}; after the end, ${cc.total}/${cc.total} and Expired.</div>
      </div>
    </div>
    <div class="card" style="margin-bottom:14px;">
      <h3>Linked Payroll Plans</h3>
      <div class="table-wrap"><table>
        <thead><tr><th>Month</th><th>Progress</th><th class="num">Planned Payroll</th><th>Status</th></tr></thead>
        <tbody>${plans.map(p=>`<tr><td class="dim">${escapeHtml(p.month)} ${p.year}</td><td>${escapeHtml(p.contractProgress||'')}</td><td class="num">${fmtIDR(p.plannedAmount)}</td><td>${p.status==='committed'?'<span class="pill pill-status-completed">Committed</span>':'<span class="pill pill-status-planned">Draft</span>'}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">No payroll plans yet.</td></tr>'}</tbody>
      </table></div>
    </div>
    <div class="card" style="margin-bottom:14px;">
      <h3>Linked Financial Transactions</h3>
      <div class="table-wrap"><table>
        <thead><tr><th>Month</th><th>Description</th><th class="num">Planned</th><th class="num">Actual</th><th>Status</th></tr></thead>
        <tbody>${txns.map(t=>`<tr><td class="dim">${escapeHtml(t.month)} ${t.year}</td><td><button class="linklike" data-open-detail="${t.id}">${escapeHtml(t.uraian)}</button></td><td class="num">${fmtIDR(t.planned)}</td><td class="num">${t.actual!=null?fmtIDR(t.actual):'<span class="faint">—</span>'}</td><td>${statusBadge(statusOf(t))}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">No linked transactions yet.</td></tr>'}</tbody>
      </table></div>
    </div>
    <div class="card">
      <h3>Contract History</h3>
      <div class="hist-list">${(c.history||[]).map(h=>`<div class="hist-row"><span class="hist-event">${escapeHtml((h.event||'').charAt(0).toUpperCase()+(h.event||'').slice(1))}</span><span class="hist-note">${escapeHtml(h.note||'')}</span><span class="hist-ts faint">${h.ts?new Date(h.ts).toLocaleString('id-ID'):'—'}</span></div>`).join('') || '<div class="empty">No history recorded.</div>'}</div>
    </div>`;
  document.getElementById('backCt').addEventListener('click', ()=>hrNavTo('contracts'));
  document.getElementById('editCtD').addEventListener('click', ()=>openContractModal(c.id));
  document.getElementById('renewCtD').addEventListener('click', ()=>openRenewModal(c.id));
  const el = document.getElementById('ctEmpLink'); if(el && emp) el.addEventListener('click', ()=>hrNavTo('employeeDetail', {detailEmpId:emp.id}));
  main.querySelectorAll('[data-open-detail]').forEach(b=>b.addEventListener('click', ()=>openDetailModal(b.dataset.openDetail)));
}

function exportContractsCsv(){
  const headers = ['Contract Number','Employee','Start Date','End Date','Duration Months','Current Month','Progress','Remaining Months','Percent Complete','Monthly Salary','Effective Status','Stored Status','Notes'];
  const lines = [`# ${APP_NAME} v${APP_VERSION} — Contracts`, headers.join(',')];
  State.contracts.forEach(c=>{ const cc=contractCalc(c);
    lines.push([c.contractNumber,c.employeeName,cc.startDate||'',cc.endDate||'',cc.total,cc.current,cc.progress,cc.remaining,cc.pct+'%',c.monthlySalary??'',contractEffectiveStatus(c),c.status,c.notes].map(csvSafe).join(','));
  });
  downloadBlob(lines.join('\n'), `${FILE_BASE}-contracts.csv`, 'text/csv');
  toast('Contracts exported.');
}
