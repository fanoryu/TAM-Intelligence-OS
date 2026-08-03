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
      contractIsRenewable(c)?['ct-renew','Renew']:null,
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

/* ============================================================
   PR-5K "The Ledger" — Contract status transition HANDLER.
   The IMPLEMENTATION AUTHORITY for the contract.status.transition command.
   The business authority is ContractStatusAggregate (js/domain); this handler
   keeps its own defense-in-depth transition check and owns mutation, updatedAt,
   Contract history, persistence, and rollback. It receives the sanitized
   { from, to } decision from the aggregate (via Domain.command), mutates ONLY
   Contract.status, and never touches dates, salary, renewal, the employee, or
   sibling contracts. Atomic: on a failed persist it reverts status, updatedAt,
   and the history entry and returns PersistFailed. It replaces the former
   setContractStatus procedural mutator. The history event preserves the existing
   convention (status.toLowerCase() + "Status set to <status>"); the former call
   wrote no audit entry, so none is added here.
   ============================================================ */
async function transitionContractStatus(id, transition){
  const c = contractById(id);
  if(!c) return { success:false, error:'ContractNotFound' };
  transition = transition || {};
  const to = transition.to;
  const from = c.status;
  // Defense-in-depth (the aggregate validated first): legal transition per the graph.
  const allowed = (typeof CONTRACT_STATUS_TRANSITIONS !== 'undefined' && CONTRACT_STATUS_TRANSITIONS[from]) || [];
  if(!to || allowed.indexOf(to)===-1) return { success:false, error:'IllegalContractStatusTransition' };
  const prevStatus = c.status, prevUpdatedAt = c.updatedAt;
  c.status = to;
  c.updatedAt = new Date().toISOString();
  (c.history=c.history||[]).push({event:to.toLowerCase(), ts:c.updatedAt, note:`Status set to ${to}`});
  // PR-10B "The Contract Status Slice" — persistence mechanics now go through the
  // Repository boundary (ContractRepository.save() -> persistContracts() ->
  // StorageAdapter), completing Repository adoption for the Contract aggregate. The
  // handler still owns transition validation, mutation, updatedAt, history, the
  // single persistence invocation, and rollback; the Repository only normalizes the
  // write result. Strict persisted.ok handling — no truthy/falsy ambiguity.
  const persisted = await ContractRepository.save();
  if(persisted.ok !== true){
    // Atomic rollback — restore status, timestamp, and drop the history entry.
    c.status = prevStatus;
    c.history.pop();
    c.updatedAt = prevUpdatedAt;
    return { success:false, error:'PersistFailed' };
  }
  return { success:true, data:c };
}

// The ONE official UI seam for a Contract status transition. The row-menu dispatch
// (ct-activate / ct-cancel) routes through here; no UI calls the handler directly.
// It preserves the existing committed-payroll cancellation confirmation and the
// success toast/re-render exactly as the former setContractStatus did, and surfaces
// typed business failures. Returns true only on success.
async function requestContractStatusTransition(id, targetStatus){
  const c = contractById(id); if(!c) return false;
  // Preserve the existing committed-payroll cancellation behavior. SPR-078: the
  // former lowercase-only comparison is replaced by the shared canonical predicate,
  // so this guard now fires for canonical 'Committed' rows too — previously it only
  // saw rows written by the retired planning path, which means the warning did NOT
  // fire for payroll posted through the live workspace path.
  if(targetStatus==='Cancelled' && payrollPlansForContract(id).some(isPayrollCommitted)){
    if(!confirm('This contract has committed payroll. Cancelling it will NOT modify historical payroll or transactions. Continue?')) return false;
  }
  const outcome = await uiExecute('command', 'contract.status.transition', [id, targetStatus]);
  if(outcome && outcome.success){ toast(`Contract ${targetStatus.toLowerCase()}.`); render(); return true; }
  toast('Could not change contract status'+(outcome && outcome.error && outcome.error!=='ContractNotFound' ? ': '+outcome.error : '')+'.', 5000);
  return false;
}
async function deleteContract(id){
  const c = contractById(id); if(!c) return;
  if(payrollPlansForContract(id).length || txnsForContract(id).length){
    toast('This contract has linked payroll or transactions and cannot be deleted. Cancel it instead.', 6000);
    return;
  }
  if(c.status!=='Draft' && !confirm('Permanently delete this contract? Only unused records should be deleted.')) return;
  State.contracts = State.contracts.filter(x=>x.id!==id);
  await persistContracts();
  logActivity({type:'contract.delete', module:'Contracts', entity:c.contractNumber||c.employeeName||'Contract', entityId:c.id, desc:`Contract "${c.contractNumber||'—'}"${c.employeeName?' ('+c.employeeName+')':''} deleted`, refs:{contractId:c.id, employeeId:c.employeeId||null}});
  toast('Contract deleted.'); render();
}

// Read-only UI eligibility mirror for renewal. Consults the SAME source of truth
// the aggregate uses (CONTRACT_RENEWABLE_STATUSES — the non-terminal stored
// statuses) so the menu/detail affordance and the business rule cannot drift.
// Purely presentational: the aggregate remains the authority and re-checks.
function contractIsRenewable(c){
  if(!c) return false;
  if(c.renewedToId) return false;
  const renewable = (typeof CONTRACT_RENEWABLE_STATUSES !== 'undefined' && CONTRACT_RENEWABLE_STATUSES) || ['Draft','Active'];
  return renewable.indexOf(c.status) !== -1;
}

/* ============================================================
   SPR-077 "The Successor" — Contract renewal HANDLER.
   The IMPLEMENTATION AUTHORITY for the contract.renewal.execute command. The
   business authority is ContractRenewalAggregate (js/domain); this handler keeps
   its own defense-in-depth eligibility check and owns id generation, timestamps,
   the history APPEND, the single persistence invocation, rollback, and the typed
   result. It receives the authored { predecessorStatus, predecessorNote,
   successorNote, successor } decision from the aggregate (via Domain.command).

   Before SPR-077 this workflow lived inline in the renewal form's submit handler:
   it mutated the predecessor, pushed the successor, called persistContracts()
   directly, DISCARDED the result, and then reported success and navigated — so a
   failed write was shown to the user as a completed renewal. That is the defect
   this slice closes (ATR-011 §4).

   NOT a compound-persistence operation: the predecessor and the successor both
   live in State.contracts, so ONE ContractRepository.save() -> persistContracts()
   -> StorageAdapter.set() write covers both. Rollback is therefore strictly
   IN-MEMORY — no coordinator, no unit of work, no compensation across keys.

   AUDIT: the pre-SPR-077 renewal wrote no activity entry, so none is added here —
   the same preservation rule PR-5K applied to transitionContractStatus. Adding
   one would be a behavior change outside this slice's authority.
   ============================================================ */
async function renewContract(id, renewal){
  const c = contractById(id);
  if(!c) return { success:false, error:'ContractNotFound' };
  renewal = renewal || {};
  const successor = renewal.successor;
  if(!successor) return { success:false, error:'RenewalNotAllowed' };
  // Defense-in-depth (the aggregate decided first): the predecessor must still be
  // in a renewable stored status and must not already point at a successor.
  const renewable = (typeof CONTRACT_RENEWABLE_STATUSES !== 'undefined' && CONTRACT_RENEWABLE_STATUSES) || ['Draft','Active'];
  if(renewable.indexOf(c.status) === -1) return { success:false, error:'RenewalNotAllowed' };
  if(c.renewedToId) return { success:false, error:'ContractAlreadyRenewed' };

  const now = new Date().toISOString();
  // Successor: the aggregate-authored business shape plus handler-owned identity,
  // timestamps, back-link, and the history entry built from the authored note.
  const nc = {
    id: uid('ct'),
    employeeId: successor.employeeId, employeeName: successor.employeeName,
    contractNumber: successor.contractNumber,
    startDate: successor.startDate, durationMonths: successor.durationMonths,
    monthlySalary: successor.monthlySalary,
    status: successor.status, notes: successor.notes,
    createdAt: now, updatedAt: now, renewedFromId: c.id,
    history: [{event:'created', ts:now, note: renewal.successorNote}],
  };
  // Predecessor: snapshot exactly what changes, then apply the authored decision.
  const prevStatus = c.status, prevRenewedToId = c.renewedToId, prevUpdatedAt = c.updatedAt;
  c.status = renewal.predecessorStatus;
  c.renewedToId = nc.id;
  c.updatedAt = now;
  (c.history=c.history||[]).push({event:'renewed', ts:now, note: renewal.predecessorNote});
  State.contracts.push(nc);

  // Persistence mechanics go through the Repository boundary (ContractRepository
  // .save() -> persistContracts() -> StorageAdapter). ONE write covers both
  // contracts. Strict persisted.ok handling — no truthy/falsy ambiguity.
  const persisted = await ContractRepository.save();
  if(persisted.ok !== true){
    // In-memory rollback — drop the successor and restore every predecessor field
    // so State.contracts matches the last successfully persisted state.
    State.contracts = State.contracts.filter(x=>x.id!==nc.id);
    c.status = prevStatus;
    if(prevRenewedToId===undefined) delete c.renewedToId; else c.renewedToId = prevRenewedToId;
    c.history.pop();
    c.updatedAt = prevUpdatedAt;
    return { success:false, error:'PersistFailed' };
  }
  return { success:true, data:{ predecessor:c, successor:nc } };
}

// The ONE official UI seam for a Contract renewal. The renewal modal routes
// through here; no UI calls the handler directly. Success actions (toast, modal
// close, successor navigation, re-render) run ONLY after the Repository has
// confirmed the write, and typed business failures are surfaced to the user.
// Returns true only on success.
async function requestContractRenewal(id, patch){
  const outcome = await uiExecute('command', 'contract.renewal.execute', [id, patch]);
  if(outcome && outcome.success){
    const nc = outcome.data && outcome.data.successor;
    closeModal();
    toast('Contract renewed. Old contract marked Renewed; history preserved.');
    if(nc) State.detailContractId = nc.id;
    render();
    return true;
  }
  const err = outcome && outcome.error;
  toast(err==='PersistFailed'
    ? 'Contract renewal could not be saved — nothing was changed. Free up storage and try again.'
    : 'Could not renew this contract'+(err && err!=='ContractNotFound' ? ': '+err : '')+'.', 6000);
  return false;
}

// Renewal: old → Renewed, new → Active (or Draft), history preserved, no
// historical payroll/transactions touched.
function openRenewModal(id){
  const c = contractById(id); if(!c){ toast('Contract not found.'); return; }
  // Terminal statuses (Renewed/Cancelled) and contracts that already have a
  // successor are not renewable — the aggregate rejects them; don't open the form.
  if(!contractIsRenewable(c)){ toast(c.renewedToId||c.status==='Renewed' ? 'This contract has already been renewed.' : 'A '+String(c.status||'').toLowerCase()+' contract cannot be renewed.', 5000); return; }
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
        // UI owns ONLY input collection. Business authority (eligibility, the
        // successor's shape, the predecessor's renewed status, both history notes)
        // belongs to ContractRenewalAggregate; mutation, persistence, rollback and
        // the success actions belong to the handler/seam. On failure the modal is
        // deliberately left open so the user can retry or cancel.
        const fd = new FormData(ev.target);
        await requestContractRenewal(id, {
          contractNumber: fd.get('contractNumber'),
          startDate: fd.get('startDate'),
          durationMonths: fd.get('durationMonths'),
          monthlySalary: fd.get('monthlySalary'),
          status: fd.get('status'),
        });
      });
    }});
}

/* ============================================================
   PR-5I — narrow Contract DATE-EXTENT update command.
   Mutates ONLY the stored date facts startDate + durationMonths (endDate stays
   DERIVED by contractCalc and is never stored). It never touches salary, number,
   type, status, notes, schedule, the employee, sibling contracts, payroll, or
   finance. Reuses contractById + persistContracts + the existing `history` audit
   style, and returns a typed command outcome. Atomic: on a failed persist it
   reverts the changed fields, updatedAt, and the audit entry. The business
   authority is ContractDateAggregate (PR-5I); this handler keeps its own
   defense-in-depth validation and remains the implementation authority.
   ============================================================ */
async function updateContractDates(id, patch){
  const c = contractById(id);
  if(!c) return { success:false, error:'ContractNotFound' };
  patch = patch || {};
  const hasStart = Object.prototype.hasOwnProperty.call(patch, 'startDate');
  const hasDur = Object.prototype.hasOwnProperty.call(patch, 'durationMonths');
  if(!hasStart && !hasDur) return { success:false, error:'NoContractDateFieldsProvided' };
  // Defense-in-depth validation (the aggregate validates first), reusing the
  // same canonical/extent rules so there is one source of truth for the math.
  const applied = {}, before = {};
  let effStart = c.startDate ? String(c.startDate).slice(0,10) : null;
  let effDur = Number(c.durationMonths)||0;
  if(hasStart){
    const s = (patch.startDate==null?'':String(patch.startDate)).trim();
    if(!isCanonicalContractDate(s)) return { success:false, error:'InvalidStartDate' };
    applied.startDate = s; effStart = s;
  }
  if(hasDur){
    const raw = (patch.durationMonths==null?'':String(patch.durationMonths)).trim();
    const n = Number(raw);
    if(raw==='' || !isFinite(n) || !Number.isInteger(n) || n <= 0) return { success:false, error:'InvalidDurationMonths' };
    applied.durationMonths = n; effDur = n;
  }
  if(!contractExtentIsValid(effStart, effDur)) return { success:false, error:'InvalidContractDateRange' };
  const changed = Object.keys(applied);
  const prevUpdatedAt = c.updatedAt;
  changed.forEach(k=>{ before[k] = c[k]; c[k] = applied[k]; });
  c.updatedAt = new Date().toISOString();
  (c.history=c.history||[]).push({ event:'contract-dates-edited', ts:c.updatedAt, note:'Contract dates updated ('+changed.join(', ')+')' });
  // PR-10A "The Contract Foundation" — persistence mechanics now go through the
  // Repository boundary (ContractRepository.save() -> persistContracts() ->
  // StorageAdapter), the second entity Repository. The handler still owns
  // validation, mutation, updatedAt, history, the single persistence invocation,
  // and rollback; the Repository only normalizes the write result.
  const persisted = await ContractRepository.save();
  if(persisted.ok !== true){
    // Atomic rollback — restore the changed fields, timestamp, and drop the entry.
    changed.forEach(k=> c[k] = before[k]);
    c.history.pop();
    c.updatedAt = prevUpdatedAt;
    return { success:false, error:'PersistFailed' };
  }
  return { success:true, data:c };
}

// Narrow date-extent editor. Routes through the Domain command seam and never
// calls updateContractDates directly. Start Date + Duration only; the End Date
// is a READ-ONLY derived preview using the existing contractCalc semantics.
function openContractDatesModal(id){
  const c = contractById(id); if(!c) return;
  openModalHTML(`
    <h3>Edit Contract Dates</h3>
    <form id="ctDatesForm">
      <div class="form-grid" style="grid-template-columns:1fr 1fr;">
        <div class="field"><label>Start Date</label><input class="input" type="date" name="startDate" value="${escapeHtml(c.startDate?String(c.startDate).slice(0,10):'')}"></div>
        <div class="field"><label>Duration (Months)</label><input class="input" type="number" min="1" step="1" name="durationMonths" value="${escapeHtml(c.durationMonths!=null?String(c.durationMonths):'')}"></div>
        <div class="field" style="grid-column:span 2;"><label>End Date (derived)</label><input class="input" id="ctDatesEndPreview" value="" disabled></div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn" id="ctDatesCancel">Cancel</button>
        <button type="submit" class="btn btn-accent">Save Dates</button>
      </div>
    </form>`, {width:520, onMount:(root)=>{
      const form = root.querySelector('#ctDatesForm');
      const upd = ()=>{
        const preview = contractCalc({startDate: form.startDate.value, durationMonths: Number(form.durationMonths.value)||0});
        root.querySelector('#ctDatesEndPreview').value = preview.valid ? fmtDateID(preview.endDate) : '—';
      };
      form.startDate.addEventListener('input', upd); form.durationMonths.addEventListener('input', upd); upd();
      root.querySelector('#ctDatesCancel').addEventListener('click', closeModal);
      form.addEventListener('submit', async ev=>{
        ev.preventDefault();
        const fd = new FormData(ev.target);
        const outcome = await uiExecute('command', 'contract.dates.update', [id, {
          startDate: fd.get('startDate'), durationMonths: fd.get('durationMonths')
        }]);
        if(outcome && outcome.success){ closeModal(); toast('Contract dates updated.'); render(); }
        else { toast('Could not update contract dates'+(outcome && outcome.error ? ': '+outcome.error : '')+'.', 5000); }
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
        <button class="btn" id="editDatesCtD">Dates</button>
        ${contractIsRenewable(c)?'<button class="btn btn-accent" id="renewCtD">Renew Contract</button>':''}
      </div>
    </div>
    ${alerts.length?`<div class="insight-list" style="margin-bottom:14px;">${alerts.map(a=>`<div class="insight-item ${a.type}">${a.text}</div>`).join('')}</div>`:''}
    <div class="grid grid-2" style="margin-bottom:14px;align-items:start;">
      <div class="card">
        <h3>Contract</h3>
        <div style="font-size:13px;line-height:1.75;">
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
        <tbody>${plans.map(p=>`<tr><td class="dim">${escapeHtml(p.month)} ${p.year}</td><td>${escapeHtml(p.contractProgress||'')}</td><td class="num">${fmtIDR(p.plannedAmount)}</td><td>${isPayrollCommitted(p)?'<span class="pill pill-status-completed">Committed</span>':'<span class="pill pill-status-planned">Draft</span>'}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">No payroll plans yet.</td></tr>'}</tbody>
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
  document.getElementById('editDatesCtD').addEventListener('click', ()=>openContractDatesModal(c.id));
  { const rb=document.getElementById('renewCtD'); if(rb) rb.addEventListener('click', ()=>openRenewModal(c.id)); }
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
