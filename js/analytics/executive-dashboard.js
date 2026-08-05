/* ---- EXECUTIVE DASHBOARD ---- */
function sparklineSVG(values, color, w, h){
  w=w||100; h=h||28;
  const has = values.some(v=>v!==null&&v!==undefined);
  if(!has) return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display:block;overflow:hidden;"></svg>`;
  const known = values.filter(v=>v!==null&&v!==undefined);
  let max=Math.max(...known), min=Math.min(...known);
  if(max===min){ max+=1; }
  const step = values.length>1 ? w/(values.length-1) : 0;
  let d=''; let started=false;
  values.forEach((v,i)=>{
    if(v===null||v===undefined){ started=false; return; }
    const x=i*step, y=h-2-((v-min)/(max-min))*(h-4);
    d += (started?'L':'M')+x.toFixed(1)+' '+y.toFixed(1)+' ';
    started=true;
  });
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display:block;overflow:hidden;" role="img" aria-label="Recent trend sparkline"><path d="${d.trim()}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
function kpiCard(label, value, opts){
  opts = opts||{};
  let subHtml = '';
  if(opts.deltaAbs!==undefined && opts.deltaAbs!==null){
    const up = opts.deltaAbs>0;
    subHtml = `<div class="stat-sub" style="color:${up?'var(--brick)':'var(--green)'};">${up?'▲':'▼'} ${fmtIDR(Math.abs(opts.deltaAbs))}${opts.deltaPct!=null?` (${pct(opts.deltaPct)})`:''} vs prior month</div>`;
  } else if(opts.sub){
    subHtml = `<div class="stat-sub dim">${opts.sub}</div>`;
  }
  return `<div class="card stat-card">
    <div class="stat-label">${escapeHtml(label)}${opts.incomplete?'<span class="pill pill-dup" style="margin-left:6px;">incomplete</span>':''}</div>
    <div class="stat-value">${value}</div>
    ${subHtml}
    ${opts.sparkline?`<div style="margin-top:8px;">${opts.sparkline}</div>`:''}
  </div>`;
}
function computeExecutiveAlerts(key, months){
  const alerts = [];
  const tot = monthTotals(key), info = monthActualInfo(key);
  if(info.hasData && tot.actual>tot.planned) alerts.push({type:'warn', text:`Current month is over budget by ${fmtIDR(tot.actual-tot.planned)}.`});
  if(info.hasData && !info.complete) alerts.push({type:'warn', text:`Current month has ${info.pending} line item${info.pending!==1?'s':''} still missing an actual amount — figures may change.`});
  const unplanned = txnsForMonth(key).filter(t=>t.unplanned && t.actual);
  if(unplanned.length) alerts.push({type:'warn', text:`${unplanned.length} unplanned expense${unplanned.length>1?'s':''} recorded this month with no matching plan line, totaling ${fmtIDR(unplanned.reduce((s,t)=>s+(t.actual||0),0))}.`});
  const idx = months.findIndex(m=>m.key===key);
  if(idx>0){
    const prevTot = monthTotals(months[idx-1].key), prevInfo = monthActualInfo(months[idx-1].key);
    if(info.hasData && prevInfo.hasData && prevTot.actual){
      const change = (tot.actual-prevTot.actual)/prevTot.actual;
      if(change>0.2) alerts.push({type:'warn', text:`Actual spending rose ${pct(change)} versus the prior month — a major increase.`});
    }
  }
  const gajiSeries = categorySeries('Gaji', months).filter(x=>x.hasActual);
  let streak=0;
  for(let i=gajiSeries.length-1;i>0;i--){ if(gajiSeries[i].actual>gajiSeries[i-1].actual) streak++; else break; }
  if(streak>=2) alerts.push({type:'warn', text:`Gaji (payroll) spending has increased for ${streak+1} consecutive months — a recurring cost increase.`});
  const missingMonths = months.slice(-6).filter(m=>!monthActualInfo(m.key).hasData);
  if(missingMonths.length) alerts.push({type:'info', text:`${missingMonths.length} of the last 6 months have no realization data recorded at all: ${missingMonths.map(m=>monthLabel(m)).join(', ')}.`});
  // execution-specific alerts
  const today = isoToday();
  const executedToday = State.txns.filter(t=>t.execution && t.execution.executionDate===today);
  const bigToday = executedToday.filter(t=>(t.actual||0)>=50000000);
  if(bigToday.length) alerts.push({type:'warn', text:`${bigToday.length} large payment${bigToday.length>1?'s':''} executed today (≥${fmtIDR(50000000)} each): ${bigToday.slice(0,3).map(t=>escapeHtml(t.uraian)).join(', ')}.`});
  const highVar = txnsForMonth(key).filter(t=>t.actual!=null && t.planned>0 && (t.actual-t.planned)/t.planned>0.5);
  if(highVar.length) alerts.push({type:'warn', text:`${highVar.length} executed item${highVar.length>1?'s':''} this month exceeded plan by more than 50%.`});
  const cancelledPayroll = txnsForMonth(key).filter(t=>t.category==='Gaji' && statusOf(t)==='cancelled');
  if(cancelledPayroll.length) alerts.push({type:'warn', text:`${cancelledPayroll.length} payroll (Gaji) transaction${cancelledPayroll.length>1?'s were':' was'} cancelled this month.`});
  const overduePlanned = State.txns.filter(t=>t.type!=='income' && ['planned','scheduled'].includes(statusOf(t)) && (t.scheduledDate||t.txnDate) && (t.scheduledDate||t.txnDate)<today);
  if(overduePlanned.length) alerts.push({type:'warn', text:`${overduePlanned.length} planned payment${overduePlanned.length>1?'s are':' is'} overdue (planned date passed, not yet executed).`});
  const partialCount = txnsForMonth(key).filter(t=>statusOf(t)==='partial').length;
  if(partialCount>=2) alerts.push({type:'info', text:`${partialCount} transactions this month are partially paid and awaiting completion.`});
  return alerts;
}
/* ---- Executive Alerts: deterministic order + capped initial list (UX-002B Phase 3) ----
   Severity uses the repository's existing alert vocabulary — warn (needs action)
   before info (context) before good (positive outcome). The sort is STABLE on the
   generators' original emission order, so the same inputs always produce the same
   sequence. Nothing is ever dropped: alerts beyond the cap are rendered and hidden,
   the total is always shown, and one click reveals every one of them. */
const EXEC_ALERT_SEVERITY = {warn:0, info:1, good:2};
const EXEC_ALERT_VISIBLE = 6;
function sortExecutiveAlerts(list){
  const rank = (a)=> (EXEC_ALERT_SEVERITY[a && a.type] !== undefined ? EXEC_ALERT_SEVERITY[a.type] : EXEC_ALERT_SEVERITY.info);
  return list.map((a,i)=>({a,i}))
    .sort((x,y)=> rank(x.a)-rank(y.a) || x.i-y.i)
    .map(x=>x.a);
}
function executiveAlertsCardHTML(list){
  const all = sortExecutiveAlerts(list);
  const hiddenCount = Math.max(0, all.length - EXEC_ALERT_VISIBLE);
  const items = all.map((a,i)=>{
    const hide = i >= EXEC_ALERT_VISIBLE ? ' data-exec-alert-extra style="display:none;"' : '';
    return `<div class="insight-item ${a.type}"${hide}>${a.text}</div>`;
  }).join('');
  return `<div class="card" style="margin-bottom:14px;">
    <h3>Executive Alerts<span class="tag">${all.length} total</span></h3>
    <div class="insight-list">${all.length ? items : '<div class="empty">No alerts for this period.</div>'}</div>
    ${hiddenCount ? `<button class="btn btn-sm" id="execAlertsToggle" style="margin-top:var(--space-2);">Show all ${all.length} alerts</button>` : ''}
  </div>`;
}
function bindExecutiveAlerts(main){
  const btn = main.querySelector('#execAlertsToggle'); if(!btn) return;
  btn.addEventListener('click', ()=>{
    const extras = main.querySelectorAll('[data-exec-alert-extra]');
    const expanded = btn.dataset.expanded === '1';
    extras.forEach(el=>{ el.style.display = expanded ? 'none' : ''; });
    btn.dataset.expanded = expanded ? '' : '1';
    btn.textContent = expanded ? ('Show all ' + (extras.length + EXEC_ALERT_VISIBLE) + ' alerts') : 'Show fewer alerts';
  });
}
function renderExecutiveDashboard(main){
  const months = getMonths();
  if(!months.length){
    // Clean/empty install (Part 16): guidance + onboarding, NOT misleading zeros.
    main.innerHTML = pageHeader('Executive Dashboard', escapeHtml(APP_POSITIONING))
      + onboardingChecklistHTML()
      + `<div class="card"><div class="empty">
          <div class="big">◆</div>
          <div style="color:var(--text);font-weight:600;margin-bottom:6px;">No financial data yet</div>
          <div style="margin-bottom:14px;">This is a clean install. Add employees and contracts, generate payroll, and create a monthly plan — or import a legacy Excel file. Financial figures appear here once real data exists (nothing is shown as a zero-based conclusion).</div>
          <div class="small-btn-row" style="justify-content:center;flex-wrap:wrap;">
            <button class="btn btn-accent" data-empty-nav="employees">Add Employees</button>
            <button class="btn" data-empty-nav="add">Import Legacy Excel</button>
            <button class="btn" data-empty-nav="settings">Company Settings</button>
          </div>
        </div></div>`;
    bindOnboarding(main); bindActionEmptyState(main); return;
  }
  if(!State.selectedMonth) State.selectedMonth = months[months.length-1].key;
  const key = State.selectedMonth;
  const idx = months.findIndex(m=>m.key===key);
  const tot = monthTotals(key);
  const info = monthActualInfo(key);
  const prev = idx>0 ? months[idx-1] : null;
  const prevTot = prev ? monthTotals(prev.key) : null;
  const prevInfo = prev ? monthActualInfo(prev.key) : null;
  // Average Monthly Actual and Highest-Spending Month moved to Monthly Trends, which
  // renders both as dedicated stat cards over the same computation. Their inputs
  // (trendRows/withData) had no other consumer here and are gone with them.
  const budgetUsedPct = (info.hasData && tot.planned) ? (tot.actual/tot.planned*100) : null;

  const recent = months.slice(-6);
  const recentRows = trendRows(recent);
  const sparkActual = sparklineSVG(recentRows.map(r=>r.info.hasData?r.tot.actual:null), themeVar('--chart-actual','#C9A15C'));

  const dPlanned = prev ? {abs: tot.planned-prevTot.planned, pctv: prevTot.planned?(tot.planned-prevTot.planned)/prevTot.planned:null} : {abs:null,pctv:null};
  const dActual = (prev && info.hasData && prevInfo.hasData) ? {abs: tot.actual-prevTot.actual, pctv: prevTot.actual?(tot.actual-prevTot.actual)/prevTot.actual:null} : {abs:null,pctv:null};
  const dVariance = (prev && info.hasData && prevInfo.hasData) ? {abs: tot.variance-prevTot.variance, pctv:null} : {abs:null,pctv:null};
  const incomeInfo = monthIncomeInfo(key);
  const netCashFlowVal = incomeInfo.status==='none' ? null : (info.hasData ? (incomeInfo.sum||0)-tot.actual : null);

  const alerts = computeExecutiveAlerts(key, months);

  main.innerHTML = `
    <div class="page-head">
      <div><h1>Executive Dashboard</h1><p class="desc">${escapeHtml(APP_POSITIONING)}</p></div>
      <div class="head-controls">${monthSelectHTML('execMonth', key, false)}</div>
    </div>

    ${onboardingChecklistHTML()}

    <div class="grid grid-4" style="margin-bottom:14px;">
      ${(()=>{
        // MERGED (Phase 3): Current Month Planned + Current Month Actual + Budget Used.
        // All three values, both prior-month deltas and the incomplete flag survive —
        // one card instead of three.
        const actualTxt = info.hasData ? fmtIDRShort(tot.actual) : '<span class="faint">no data</span>';
        const dPlannedTxt = dPlanned.abs!==null ? ` <span class="faint">(${dPlanned.abs>0?'▲':'▼'} ${fmtIDR(Math.abs(dPlanned.abs))}${dPlanned.pctv!=null?' '+pct(dPlanned.pctv):''})</span>` : '';
        const usedTxt = budgetUsedPct!==null
          ? `<b class="mono">${budgetUsedPct.toFixed(0)}%</b> used · ${budgetUsedPct>100?'over planned budget':'within planned budget'}`
          : '<span class="faint">no actual data yet</span>';
        const dActualTxt = dActual.abs!==null
          ? `<div class="stat-sub" style="color:${dActual.abs>0?'var(--brick)':'var(--green)'};">${dActual.abs>0?'▲':'▼'} ${fmtIDR(Math.abs(dActual.abs))}${dActual.pctv!=null?` (${pct(dActual.pctv)})`:''} vs prior month</div>`
          : '';
        return `<div class="card stat-card">
          <div class="stat-label">Plan vs Actual${info.hasData && !info.complete?'<span class="pill pill-dup" style="margin-left:6px;">incomplete</span>':''}</div>
          <div class="stat-value">${actualTxt}</div>
          <div class="stat-sub dim">planned <b class="mono">${fmtIDRShort(tot.planned)}</b>${dPlannedTxt}</div>
          <div class="stat-sub dim">${usedTxt}</div>
          ${dActualTxt}
          <div style="margin-top:8px;">${sparkActual}</div>
        </div>`;
      })()}
      ${kpiCard('Budget Variance', info.hasData?fmtIDRShort(tot.variance):'<span class="faint">—</span>', {deltaAbs:dVariance.abs, sub: !info.hasData?'no actual data yet':undefined})}
      ${kpiCard('Net Cash Flow', incomeInfo.status==='none'?'<span class="faint">no income data</span>':(netCashFlowVal!==null?fmtIDRShort(netCashFlowVal):'<span class="faint">—</span>'), {sub:'income − actual expense'})}
      ${payrollCycleTileHTML(key)}
    </div>

    <div class="grid grid-4" style="margin-bottom:14px;">
      ${hrStatStripHTML(key)}
      ${payrollStripHTML(key)}
      ${overtimeStripHTML(key)}
    </div>

    ${executiveAlertsCardHTML(alerts.concat(hrDashboardAlerts(key)).concat(overtimeDashboardAlerts(key)).concat(payrollDashboardAlerts(key)))}

    <div class="card">
      <h3>Executive Trend — Planned vs. Actual</h3>
      <p class="hint">Click a point to open that month's Finance Overview.</p>
      <div class="chart-wrap tall" id="execTrendChart"></div>
    </div>
  `;
  document.getElementById('execMonth').addEventListener('change', e=>{ State.selectedMonth=e.target.value; render(); });
  bindOnboarding(main);
  bindExecutiveAlerts(main);
  const chartMonths = months.slice(-12);
  const cRows = trendRows(chartMonths);
  const el = document.getElementById('execTrendChart');
  if(el){
    drawLineChart(el, {
      labels: chartMonths.map(mm=>mm.month.slice(0,3)+" '"+String(mm.year).slice(2)),
      series: [
        {key:'planned', label:'Planned', color:themeVar('--chart-planned','#96A1BA'), data: cRows.map(r=>r.tot.planned)},
        {key:'actual', label:'Actual', color:themeVar('--chart-actual','#C9A15C'), fill:true, data: cRows.map(r=>r.info.hasData?r.tot.actual:null),
          pointColor: cRows.map(r=>actualPointColor(r)), pointHollow: cRows.map(r=>r.info.hasData && !r.info.complete)},
      ],
      formatY: fmtIDRShort, height:320,
      emptyMessage:'No data yet.',
      ariaLabel:'Executive planned versus actual spending trend',
      tooltipHTML:(i)=>trendTooltip(cRows[i]),
      onIndexClick:(i)=>goToMonthOverview(cRows[i].m.key),
    });
  }
}
