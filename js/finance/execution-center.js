/* ---- TRANSACTIONS ---- */
/* ---- EXECUTION CENTER ---- */
function isoToday(){ return new Date().toISOString().slice(0,10); }
// A transaction's schedule date, ONLY if it is a real calendar date. Free-text
// values such as "Per minggu", "Akhir bulan", or "-" are treated as missing so
// they never mis-sort into Upcoming/Overdue via raw string comparison (v2.3.1).
function execScheduleDate(t){
  const raw = t.scheduledDate || t.txnDate;
  if(raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) && isValidDate(raw)) return raw;
  return null;
}
// Every pending transaction lands in exactly one bucket. Priority:
// Partial → Unscheduled → Today's Planned → Upcoming → Overdue.
function execBuckets(){
  const today = isoToday();
  const pending = State.txns.filter(t=>t.type!=='income' && ['planned','scheduled','partial'].includes(statusOf(t)));
  const partial = pending.filter(t=>statusOf(t)==='partial');
  const nonPartial = pending.filter(t=>statusOf(t)!=='partial'); // planned/scheduled, not fully executed
  const unscheduled = nonPartial.filter(t=>!execScheduleDate(t));
  const dated = nonPartial.filter(t=>execScheduleDate(t));
  const todaysPlanned = dated.filter(t=>execScheduleDate(t)===today);
  const upcoming = dated.filter(t=>execScheduleDate(t)>today);
  const overdue = dated.filter(t=>execScheduleDate(t)<today);
  const completedToday = State.txns.filter(t=>t.execution && t.execution.executionDate===today && ['completed','archived'].includes(statusOf(t)));
  const recent = State.txns.filter(t=>t.execution && t.execution.ts)
    .sort((a,b)=> new Date(b.execution.ts)-new Date(a.execution.ts)).slice(0,15);
  // Pending Execution = unique records across Unscheduled + Today + Upcoming +
  // Overdue + Partial. These are mutually exclusive partitions of `pending`,
  // so the sum equals pending.length with no double-counting.
  const pendingCount = partial.length + unscheduled.length + todaysPlanned.length + upcoming.length + overdue.length;
  return {todaysPlanned, upcoming, overdue, partial, unscheduled, completedToday, recent, planned:pending, pendingCount};
}
function renderExecutionCenter(main){
  if(!State.txns.length){ main.innerHTML = emptyState('No data yet','Add or upload monthly data first.'); return; }
  const b = execBuckets();
  const views = [
    ['today', "Today's Planned", b.todaysPlanned.length],
    ['upcoming', 'Upcoming', b.upcoming.length],
    ['overdue', 'Overdue', b.overdue.length],
    ['unscheduled', 'Unscheduled', b.unscheduled.length],
    ['partial', 'Partial', b.partial.length],
    ['completedToday', 'Completed Today', b.completedToday.length],
    ['recent', 'Recent Executions', b.recent.length],
  ];
  if(!views.find(v=>v[0]===State.execFilter)) State.execFilter='today';
  // Map the active tab key to its bucket array. 'today' → 'todaysPlanned'
  // (fixes a latent key mismatch where the Today tab always showed 0 rows).
  const bucketOf = {today:'todaysPlanned', upcoming:'upcoming', overdue:'overdue', unscheduled:'unscheduled', partial:'partial', completedToday:'completedToday', recent:'recent'};
  const activeRows = b[bucketOf[State.execFilter]] || [];
  const emptyMsg = State.execFilter==='unscheduled' ? 'No unscheduled transactions.' : 'Nothing in this view.';

  main.innerHTML = `
    <div class="page-head"><div><h1>Execution Center</h1><p class="desc">Process planned transactions and record real payments.</p></div></div>
    <div class="grid grid-3" style="margin-bottom:14px;">
      <div class="card stat-card"><div class="stat-label">Pending Execution</div><div class="stat-value">${b.pendingCount}</div><div class="stat-sub dim">unscheduled · today · upcoming · overdue · partial</div></div>
      <div class="card stat-card"><div class="stat-label">Overdue</div><div class="stat-value" style="color:${b.overdue.length?'var(--brick)':'inherit'}">${b.overdue.length}</div><div class="stat-sub dim">past planned date, not executed</div></div>
      <div class="card stat-card"><div class="stat-label">Completed Today</div><div class="stat-value" style="color:var(--green)">${b.completedToday.length}</div><div class="stat-sub dim">${fmtIDR(b.completedToday.reduce((s,t)=>s+(t.actual||0),0))}</div></div>
    </div>
    <div class="card">
      <div class="chart-range-chips" role="group" aria-label="Execution views" style="margin-bottom:14px;">
        ${views.map(([k,l,n])=>`<button type="button" class="btn btn-sm ${State.execFilter===k?'btn-accent':''}" data-execview="${k}">${l} (${n})</button>`).join('')}
      </div>
      <div class="table-wrap" style="max-height:560px;overflow-y:auto;">
        <table>
          <thead><tr><th>Description</th><th>Category</th><th>Month</th><th>Date</th><th class="num">Planned</th><th class="num">Actual</th><th>Status</th><th></th></tr></thead>
          <tbody>${activeRows.map(t=>{
            const d = execScheduleDate(t);
            const dateCell = d ? `<span class="dim">${escapeHtml(d)}</span>` : `<span class="pill pill-status-cancelled" title="No valid scheduled or transaction date">Missing schedule date</span>`;
            const canSchedule = statusOf(t)!=='partial'; // partial rows keep only the standard actions
            return `<tr>
            <td><button class="linklike" data-open-detail="${t.id}">${escapeHtml(t.uraian)}</button></td>
            <td>${categoryPill(t.category)}</td>
            <td class="dim">${escapeHtml(t.month)} ${t.year}</td>
            <td>${dateCell}</td>
            <td class="num">${fmtIDR(t.planned)}</td>
            <td class="num">${t.actual!=null?fmtIDR(t.actual):'<span class="faint">—</span>'}</td>
            <td>${statusBadge(statusOf(t))}</td>
            <td><div class="small-btn-row" style="justify-content:flex-end;">${(!d && canSchedule)?`<button class="btn btn-sm btn-accent" data-schedule-txn="${t.id}">Schedule</button>`:''}${actionsMenuHTML(t, 'exec')}</div></td>
          </tr>`;}).join('') || `<tr><td colspan="8" class="empty">${emptyMsg}</td></tr>`}</tbody>
        </table>
      </div>
    </div>
  `;
  // renderExecutionCenter binds its own menus below — the tab handler must NOT
  // call bindActionMenus again (double-binding made menus toggle open+closed
  // instantly and fire every action twice on all non-initial tabs).
  main.querySelectorAll('[data-execview]').forEach(btn=>btn.addEventListener('click', ()=>{ State.execFilter=btn.dataset.execview; renderExecutionCenter(main); }));
  main.querySelectorAll('[data-schedule-txn]').forEach(btn=>btn.addEventListener('click', async e=>{
    e.stopPropagation();
    const id = btn.dataset.scheduleTxn, t = findTxn(id); if(!t) return;
    const d = prompt('Schedule payment date (YYYY-MM-DD):', isoToday());
    if(d==null) return;
    const val = d.trim();
    if(!/^\d{4}-\d{2}-\d{2}$/.test(val) || !isValidDate(val)){ showWarning('Enter a valid date in YYYY-MM-DD format.'); return; }
    await scheduleTransaction(id, val); showSuccess('Transaction scheduled.'); render();
  }));
  bindActionMenus(main);
}

/* ---------- execution engine actions ---------- */
function findTxn(id){ return State.txns.find(t=>t.id===id); }

// Build a fully execution-compatible transaction from an import row.
// Status is derived from planned/actual so historical realized rows are never
// reset to Planned, and missing actuals stay missing (null, not zero).
function buildImportedTxn(it, batch){
  const planned = it.planned||0;
  const actual = (it.actual===undefined) ? null : it.actual; // preserve missing as null
  const unplanned = !!it.unplanned;
  const t = {
    id: uid('import'), monthKey:batch.key, month:batch.monthName, year:batch.year, monthNum:batch.monthNum,
    category: it.category, categoryCode: it.categoryCode, no: it.no,
    uraian: it.uraian, vol: it.vol, satuan: it.satuan, hargaSatuan: it.hargaSatuan,
    planned, actual, type: it.type||'expense', txnDate: it.txnDate||null,
    source:'import', unplanned,
    scheduledDate: null,
    paymentMethod: null, bankAccount: null, referenceNumber: null, notes: null, vendor: null,
    executionId: null, executionTimestamp: null,
    execution: null,
    history: [{event:'created', ts:new Date().toISOString(), note:'Imported from Excel/CSV'}],
  };
  // Derive lifecycle status. planned===0 && actual>0 -> Completed (and stays unplanned).
  if(actual===null || actual===undefined){
    t.status = 'planned';
  } else if(actual > 0 && actual < planned){
    t.status = 'partial';
  } else if(actual >= planned && (planned > 0 || actual > 0)){
    t.status = 'completed';
  } else { // actual <= 0
    t.status = 'planned';
  }
  // For rows that arrive already realized, record the execution + history so the
  // detail timeline and Execution Center reflect that they were executed.
  if(actual!==null && actual!==undefined && actual>0){
    const execId = uid('exec');
    const ts = new Date().toISOString();
    t.execution = {
      executionDate: it.txnDate||null, actualAmount: actual, method:null, bank:null,
      reference:null, notes:'Imported as already realized', executedBy:'—', executionId:execId, ts,
    };
    t.executionId = execId; t.executionTimestamp = ts;
    t.history.push({event:'executed', ts, note:`Imported realized amount ${fmtIDR(actual)}`, amount:actual});
  }
  return t;
}
function pushHistory(t, event, note, extra){
  if(!t.history) t.history = [];
  t.history.push(Object.assign({event, ts:new Date().toISOString(), note:note||null}, extra||{}));
}
async function executeTransaction(id, data){
  const t = findTxn(id); if(!t) return;
  t.actual = data.actualAmount;
  t.execution = {
    executionDate: data.executionDate||null,
    actualAmount: data.actualAmount,
    method: data.method||null,
    bank: data.bank||null,
    reference: data.reference||null,
    notes: data.notes||null,
    executedBy: '—',
    executionId: uid('exec'),
    ts: new Date().toISOString(),
  };
  if(data.executionDate) t.txnDate = data.executionDate;
  // status logic
  let newStatus;
  if(data.actualAmount<=0) newStatus = 'planned';
  else if(data.actualAmount < (t.planned||0)) newStatus = 'partial';
  else newStatus = 'completed';
  if(newStatus==='completed' && State.settings.autoArchiveCompleted) newStatus='archived';
  t.status = newStatus;
  pushHistory(t, 'executed', `Executed ${fmtIDR(data.actualAmount)}${data.method?' via '+data.method:''}`, {amount:data.actualAmount});
  await persist();
  logActivity({type:'finance.execute', module:'Finance', entity:t.uraian||t.category||'Transaction', entityId:t.id,
    desc:`Executed ${fmtIDR(data.actualAmount)}${data.method?' via '+data.method:''} — status ${newStatus}`,
    refs:{transactionId:t.id, employeeId:t.employeeId||null, payrollPlanId:t.payrollPlanId||null, monthKey:t.monthKey||null}});
  // v2.7.0 — if this transaction settles a supplemental payment, close the supplemental
  // (Executed). Idempotent; base payroll transactions have no supplementalId so are unaffected.
  if(typeof linkSupplementalExecution==='function') await linkSupplementalExecution(t);
}
async function scheduleTransaction(id, date){
  const t = findTxn(id); if(!t) return;
  t.status = 'scheduled'; t.scheduledDate = date||null;
  if(date) t.txnDate = date;
  pushHistory(t, 'scheduled', date?`Scheduled for ${date}`:'Scheduled');
  await persist();
}
async function cancelTransaction(id){
  const t = findTxn(id); if(!t) return;
  t.status = 'cancelled';
  pushHistory(t, 'cancelled', 'Transaction cancelled');
  await persist();
}
async function archiveTransaction(id){
  const t = findTxn(id); if(!t) return;
  t.status = 'archived';
  pushHistory(t, 'archived', 'Transaction archived');
  await persist();
}
async function duplicateTransaction(id){
  const t = findTxn(id); if(!t) return;
  const copy = JSON.parse(JSON.stringify(t));
  copy.id = uid('txn');
  copy.actual = null; copy.execution = null; copy.status='planned';
  copy.uraian = t.uraian + ' (copy)';
  copy.source = 'manual';
  copy.history = [{event:'created', ts:new Date().toISOString(), note:'Duplicated from '+t.uraian}];
  State.txns.push(copy);
  await persist();
}
async function saveEditedTransaction(id, fields){
  const t = findTxn(id); if(!t) return;
  Object.assign(t, fields);
  if(!t.status) t.status = computeStatus(t);
  pushHistory(t, 'edited', 'Transaction edited');
  await persist();
}
