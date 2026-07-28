function txnMatchesSearch(t, s){
  if(!s) return true;
  const hay = [t.uraian, t.category, t.execution&&t.execution.reference, t.execution&&t.execution.notes, t.vendor].map(x=>normStr(x||'')).join(' ');
  return hay.includes(s);
}

/* v2.6.1 — Transactions incremental list. applyTxnFilter updates only the <tbody> and
   the "N of M" count; the search box and every filter select call it so typing keeps
   focus/caret/selection and the ledger keeps its scroll position. */
function txnsFiltered(){
  const f = State.txFilter;
  let rows = State.txns.slice();
  if(f.month!=='all') rows = rows.filter(t=>t.monthKey===f.month);
  if(f.category!=='all') rows = rows.filter(t=>t.category===f.category);
  if(f.type!=='all') rows = rows.filter(t=>t.type===f.type);
  if(f.status!=='all') rows = rows.filter(t=>statusOf(t)===f.status);
  if(f.method!=='all') rows = rows.filter(t=>t.execution&&t.execution.method===f.method);
  if(f.bank!=='all') rows = rows.filter(t=>t.execution&&t.execution.bank===f.bank);
  if(f.budget==='over') rows = rows.filter(t=>t.actual!==null && t.actual!==undefined && t.actual>t.planned);
  if(f.budget==='under') rows = rows.filter(t=>t.actual!==null && t.actual!==undefined && t.actual<t.planned);
  if(f.budget==='pending') rows = rows.filter(t=>t.actual===null||t.actual===undefined);
  if(f.search.trim()){ const s = normStr(f.search); rows = rows.filter(t=>txnMatchesSearch(t, s)); }
  return rows.slice().sort((a,b)=> (b.year-a.year)||(b.monthNum-a.monthNum)|| (String(a.category).localeCompare(String(b.category))));
}
function applyTxnFilter(main){
  const tb = document.getElementById('txnRows'); if(!tb) return;
  const rows = txnsFiltered();
  tb.innerHTML = rows.map(rowToTr).join('') || '<tr><td colspan="8" class="empty">No transactions match these filters</td></tr>';
  const c = document.getElementById('txnCount'); if(c) c.textContent = rows.length;
  bindActionMenus(main);
}
function renderTransactions(main){
  if(!State.txns.length){
    main.innerHTML = pageHeader('Transactions','Financial ledger — browse, search, filter, review, and export.')
      + `<div class="card"><div class="empty">
          <div class="big">≡</div>
          <div style="color:var(--text);font-weight:600;margin-bottom:6px;">No transactions yet</div>
          <div style="margin-bottom:14px;">Create a monthly plan from payroll and recurring expenses, or import a legacy Excel workbook.</div>
          <div class="small-btn-row" style="justify-content:center;flex-wrap:wrap;">
            <button class="btn btn-accent" data-empty-nav="monthlyplan">Create Monthly Plan</button>
            <button class="btn" data-empty-nav="payroll">Generate Payroll</button>
            <button class="btn" data-empty-nav="add">Import Legacy Excel</button>
          </div>
        </div></div>`;
    bindActionEmptyState(main); return;
  }
  const f = State.txFilter;
  const rows = txnsFiltered();
  const allCats = [...new Set(State.txns.map(t=>t.category))];

  main.innerHTML = `
    <div class="page-head">
      <div>
        <h1>Transactions</h1>
        <p class="desc">Financial ledger — <span id="txnCount">${rows.length}</span> of ${State.txns.length} line items. Browse, search, filter, review, and export.</p>
        <p class="hint" style="margin-top:4px;">To schedule or execute a payment, open the Execution Center.</p>
      </div>
      <div class="head-controls">
        <button class="btn btn-accent" id="openExecCenter">Open Execution Center</button>
        <button class="btn" id="exportCsv">Export CSV</button>
      </div>
    </div>
    <div class="card">
      <div class="form-grid" style="grid-template-columns:1.4fr 1fr 1fr 1fr;margin-bottom:12px;">
        <div class="field"><label>Search (description, reference, notes, vendor)</label><input class="input" id="fSearch" placeholder="Search…" value="${escapeHtml(f.search)}"></div>
        <div class="field"><label>Month</label>${monthSelectHTML('fMonth', f.month, true)}</div>
        <div class="field"><label>Category</label>
          <select id="fCategory" class="input">
            <option value="all">All categories</option>
            ${allCats.map(c=>`<option value="${escapeHtml(c)}" ${f.category===c?'selected':''}>${escapeHtml(c)}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>Status</label>
          <select id="fStatus" class="input">
            <option value="all" ${f.status==='all'?'selected':''}>All statuses</option>
            ${Object.keys(STATUS_META).map(s=>`<option value="${s}" ${f.status===s?'selected':''}>${STATUS_META[s].label}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-grid" style="grid-template-columns:1fr 1fr 1fr 1fr;margin-bottom:16px;">
        <div class="field"><label>Type</label>
          <select id="fType" class="input">
            <option value="all" ${f.type==='all'?'selected':''}>Income &amp; expense</option>
            <option value="expense" ${f.type==='expense'?'selected':''}>Expense</option>
            <option value="income" ${f.type==='income'?'selected':''}>Income</option>
          </select>
        </div>
        <div class="field"><label>Payment Method</label>
          <select id="fMethod" class="input">
            <option value="all" ${f.method==='all'?'selected':''}>All methods</option>
            ${PAYMENT_METHODS.map(m=>`<option value="${m}" ${f.method===m?'selected':''}>${m}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>Bank Account</label>
          <select id="fBank" class="input">
            ${companyAccountOptionsHTML(f.bank, {allOption:true})}
          </select>
        </div>
        <div class="field"><label>Budget</label>
          <select id="fBudget" class="input">
            <option value="all" ${f.budget==='all'?'selected':''}>All</option>
            <option value="over" ${f.budget==='over'?'selected':''}>Over budget</option>
            <option value="under" ${f.budget==='under'?'selected':''}>Under budget</option>
            <option value="pending" ${f.budget==='pending'?'selected':''}>No actual yet</option>
          </select>
        </div>
      </div>
      <div class="table-wrap" style="max-height:640px;overflow-y:auto;">
        <table>
          <thead><tr>
            <th>Month</th><th>Category</th><th>Description</th>
            <th class="num">Planned</th><th class="num">Actual</th><th class="num">Variance</th><th>Status</th><th></th>
          </tr></thead>
          <tbody id="txnRows">
            ${rows.map(rowToTr).join('') || '<tr><td colspan="8" class="empty">No transactions match these filters</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
  // renderTransactions binds its own menus below — filter handlers must NOT
  // call bindActionMenus again (same double-binding bug as the Execution Center).
  document.getElementById('fSearch').addEventListener('input', e=>{ State.txFilter.search=e.target.value; applyTxnFilter(main); });
  document.getElementById('fMonth').addEventListener('change', e=>{ State.txFilter.month=e.target.value; applyTxnFilter(main); });
  document.getElementById('fCategory').addEventListener('change', e=>{ State.txFilter.category=e.target.value; applyTxnFilter(main); });
  document.getElementById('fStatus').addEventListener('change', e=>{ State.txFilter.status=e.target.value; applyTxnFilter(main); });
  document.getElementById('fType').addEventListener('change', e=>{ State.txFilter.type=e.target.value; applyTxnFilter(main); });
  document.getElementById('fMethod').addEventListener('change', e=>{ State.txFilter.method=e.target.value; applyTxnFilter(main); });
  document.getElementById('fBank').addEventListener('change', e=>{ State.txFilter.bank=e.target.value; applyTxnFilter(main); });
  document.getElementById('fBudget').addEventListener('change', e=>{ State.txFilter.budget=e.target.value; applyTxnFilter(main); });
  // Full render() (not just a main swap) so the sidebar active state updates;
  // render() captures and restores the sidebar scroll position itself.
  document.getElementById('openExecCenter').addEventListener('click', ()=>{ State.view='executioncenter'; render(); });
  document.getElementById('exportCsv').addEventListener('click', ()=>exportCsv(txnsFiltered()));
  bindActionMenus(main);
}
function rowToTr(t){
  const st = statusOf(t);
  const diff = (t.actual!==null&&t.actual!==undefined) ? t.actual-t.planned : null;
  let actualCell;
  if(st==='partial'){
    const usedPct = t.planned? Math.min(100,(t.actual/t.planned)*100):0;
    actualCell = `${fmtIDR(t.actual)}<div class="bar-track" style="margin-top:4px;"><div class="bar-fill" style="width:${usedPct}%;background:${STATUS_META.partial.color};"></div></div>`;
  } else {
    actualCell = (t.actual!==null&&t.actual!==undefined)?fmtIDR(t.actual):'<span class="faint">—</span>';
  }
  return `<tr>
    <td class="dim">${escapeHtml(t.month)} ${t.year}</td>
    <td>${categoryPill(t.category)}</td>
    <td><button class="linklike" data-open-detail="${t.id}">${escapeHtml(t.uraian)}</button>${t.unplanned?' <span class="pill pill-dup" style="margin-left:4px;">unplanned</span>':''}</td>
    <td class="num">${fmtIDR(t.planned)}</td>
    <td class="num">${actualCell}</td>
    <td class="num" style="color:${diff===null?'inherit':diff>0?'var(--brick)':diff<0?'var(--green)':'inherit'}">${diff===null?'—':(diff>0?'+':'')+fmtIDR(diff)}</td>
    <td>${statusBadge(st)}</td>
    <td>${actionsMenuHTML(t, 'ledger')}</td>
  </tr>`;
}
function exportCsv(rows){
  const headers = ['Month','Year','Category','No','Description','Planned','Actual','Variance','Status','Type','ExecutionDate','Method','Bank','Reference','Source'];
  const lines = [`# ${APP_NAME} v${APP_VERSION} — ${APP_TAGLINE}`, headers.join(',')];
  rows.forEach(t=>{
    const diff = (t.actual!==null&&t.actual!==undefined) ? t.actual-t.planned : '';
    const ex = t.execution||{};
    const vals = [t.month,t.year,t.category,t.no,csvSafe(t.uraian),t.planned||0,t.actual??'',diff,statusOf(t),t.type,ex.executionDate||'',csvSafe(ex.method||''),csvSafe(ex.bank||''),csvSafe(ex.reference||''),t.source];
    lines.push(vals.join(','));
  });
  downloadBlob(lines.join('\n'), `${FILE_BASE}-transactions.csv`, 'text/csv');
  toast('CSV exported.');
}
function csvSafe(s){ s=String(s??''); return /[",\n]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s; }
function downloadBlob(content, filename, mime){
  const blob = new Blob([content], {type:mime});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 2000);
}
