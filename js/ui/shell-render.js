/* ============================================================
   RENDER — app shell
   ============================================================ */
const NAV_GROUPS = [
  {id:'executive', label:'Executive', items:[
    {id:'execDashboard', label:'Executive Dashboard', ic:'◆'},
  ]},
  {id:'finance', label:'Finance', items:[
    {id:'financeOverview', label:'Finance Overview', ic:'▣'},
    {id:'executioncenter', label:'Execution Center', ic:'⚡'},
    {id:'transactions', label:'Transactions', ic:'≡'},
    {id:'add', label:'Add / Upload', ic:'+'},
    {id:'cashflow', label:'Cash Flow', ic:'∼'},
    {id:'budgetcenter', label:'Budget Center', ic:'▥'},
  ]},
  {id:'people', label:'People & Contracts', items:[
    {id:'employees', label:'Employees', ic:'☺'},
    {id:'contracts', label:'Contracts', ic:'▦'},
    {id:'payroll', label:'Payroll Workspace', ic:'৳'},
    {id:'overtime', label:'Overtime', ic:'⏱'},
    {id:'monthlyplan', label:'Monthly Plan Generator', ic:'⊞'},
  ]},
  {id:'analytics', label:'Analytics', items:[
    {id:'planvsactual', label:'Planned vs Actual', ic:'⇄'},
    {id:'compare', label:'Compare Months', ic:'⧉'},
    {id:'trends', label:'Monthly Trends', ic:'∿'},
    {id:'execinsights', label:'Executive Insights', ic:'✦'},
  ]},
  {id:'operations', label:'Operations', items:[
    {id:'recurring', label:'Recurring Expenses', ic:'↻'},
    {id:'projects', label:'Projects', ic:'▢', placeholder:true},
    {id:'vendors', label:'Vendors', ic:'▢', placeholder:true},
  ]},
  {id:'management', label:'Management', items:[
    {id:'calendar', label:'Financial Calendar', ic:'▢', placeholder:true},
    {id:'reports', label:'Reports', ic:'▤'},
  ]},
  {id:'system', label:'System', items:[
    {id:'settings', label:'Settings', ic:'⚙'},
    {id:'about', label:'About', ic:'ℹ'},
    {id:'releasenotes', label:'Release Notes', ic:'▤'},
  ]},
];
const PAGE_TITLES = Object.fromEntries(NAV_GROUPS.flatMap(g=>g.items).map(i=>[i.id,i.label]));

function captureSidebarScroll(){
  const nav = document.querySelector('.nav');
  if(nav) State.sidebarScrollTop = nav.scrollTop;
}
function restoreSidebarScroll(){
  const raf = (typeof requestAnimationFrame === 'function') ? requestAnimationFrame : (fn)=>setTimeout(fn, 0);
  raf(()=>{
    const nav = document.querySelector('.nav');
    if(nav) nav.scrollTop = State.sidebarScrollTop || 0;
  });
}
function render(){
  captureSidebarScroll(); // read the outgoing .nav's scroll position before it's torn down
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="sidebar">
      <div class="brand">
        <div class="mark"><span class="mfull">TAM <span>Intelligence&nbsp;OS</span></span><span class="mshort">TAM <span>OS</span></span></div>
        <div class="sub">${escapeHtml(State.settings.companyName||COMPANY_NAME_DEFAULT)}</div>
      </div>
      <div class="nav">
        ${NAV_GROUPS.map(g=>{
          const collapsed = !!State.navCollapsed[g.id];
          return `<div class="nav-group">
            <button class="nav-group-head" data-group="${g.id}" aria-expanded="${!collapsed}">
              <span>${escapeHtml(g.label)}</span><span class="chev">${collapsed?'▸':'▾'}</span>
            </button>
            <div class="nav-group-items" style="${collapsed?'display:none;':''}">
              ${g.items.map(n=>`<button class="nav-item ${State.view===n.id?'active':''}" data-nav="${n.id}">
                <span class="ic">${n.ic}</span>${escapeHtml(n.label)}${n.placeholder?'<span class="nav-preview-tag">Preview</span>':''}
              </button>`).join('')}
            </div>
          </div>`;
        }).join('')}
      </div>
      <div class="sidebar-foot">${escapeHtml(APP_NAME)} v${APP_VERSION}<br>${escapeHtml(APP_TAGLINE)}<br>Data stored privately in your browser.</div>
    </div>
    <div class="main" id="main"></div>
  `;
  app.querySelectorAll('[data-nav]').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      e.preventDefault();
      captureSidebarScroll();
      State.view = btn.dataset.nav; State.pendingImport=null;
      render();
      btn.blur(); // click already re-renders the shell; drop focus so the browser doesn't auto-scroll toward it
    });
  });
  app.querySelectorAll('[data-group]').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      e.preventDefault();
      captureSidebarScroll();
      const g=btn.dataset.group; State.navCollapsed[g]=!State.navCollapsed[g];
      render();
      btn.blur();
    });
  });
  const navEl = app.querySelector('.nav');
  if(navEl) navEl.addEventListener('scroll', ()=>{ State.sidebarScrollTop = navEl.scrollTop; });
  restoreSidebarScroll(); // reapply the captured position now that the new .nav exists
  renderView(document.getElementById('main'));
}

const PLACEHOLDER_IDS = new Set(NAV_GROUPS.flatMap(g=>g.items).filter(i=>i.placeholder).map(i=>i.id));

function renderView(main){
  if(PLACEHOLDER_IDS.has(State.view)) return renderPlaceholderPage(main, State.view);
  if(State.view==='execDashboard') return renderExecutiveDashboard(main);
  if(State.view==='financeOverview') return renderDashboard(main);
  if(State.view==='executioncenter') return renderExecutionCenter(main);
  if(State.view==='transactions') return renderTransactions(main);
  if(State.view==='add') return renderAdd(main);
  if(State.view==='smartImport') return renderSmartImport(main);
  if(State.view==='importResults') return renderImportResults(main);
  if(State.view==='cashflow') return renderCashFlow(main);
  if(State.view==='budgetcenter') return renderBudgetCenter(main);
  if(State.view==='planvsactual') return renderPlanVsActual(main);
  if(State.view==='compare') return renderCompare(main);
  if(State.view==='trends') return renderTrends(main);
  if(State.view==='execinsights') return renderExecutiveInsights(main);
  if(State.view==='employees') return renderEmployees(main);
  if(State.view==='employeeDedup') return renderEmployeeDedup(main);
  if(State.view==='employeeDetail') return renderEmployeeDetail(main);
  if(State.view==='contracts') return renderContracts(main);
  if(State.view==='contractDetail') return renderContractDetail(main);
  if(State.view==='payroll') return renderPayrollWorkspace(main);
  if(State.view==='payrollDetail') return renderPayrollDetail(main);
  if(State.view==='payrollAdjustments') return renderPayrollAdjustments(main);
  if(State.view==='overtime') return renderOvertime(main);
  if(State.view==='overtimeSheet') return renderOvertimeWorksheet(main);
  if(State.view==='monthlyplan') return renderMonthlyPlanGenerator(main);
  if(State.view==='recurring') return renderRecurringExpenses(main);
  if(State.view==='legacyMap') return renderLegacyPayrollMapping(main);
  if(State.view==='reports') return renderReports(main);
  if(State.view==='settings') return renderSettings(main);
  if(State.view==='about') return renderAbout(main);
  if(State.view==='releasenotes') return renderReleaseNotes(main);
  return renderExecutiveDashboard(main);
}
function goToMonthOverview(monthKey){ State.selectedMonth = monthKey; State.view = 'financeOverview'; render(); }
function renderPlaceholderPage(main, id){
  const item = NAV_GROUPS.flatMap(g=>g.items).find(i=>i.id===id);
  main.innerHTML = `
    <div class="page-head"><div><h1>${escapeHtml(item?item.label:id)}</h1><p class="desc">Planned module — not yet implemented.</p></div></div>
    <div class="card" style="max-width:640px;">
      <div class="empty">
        <div class="big">▢</div>
        <div style="color:var(--text);font-weight:600;margin-bottom:6px;">Coming in a future release</div>
        <div>This module is planned for a future version of ${escapeHtml(APP_NAME)} and has not been built yet. No data is shown here because none has been collected — nothing on this page is placeholder or sample data.</div>
      </div>
    </div>
  `;
}

function monthSelectHTML(id, selected, includeAll){
  const months = getMonths();
  let opts = includeAll ? `<option value="all" ${selected==='all'?'selected':''}>All months</option>` : '';
  opts += months.map(m=>`<option value="${m.key}" ${m.key===selected?'selected':''}>${monthLabel(m)}</option>`).join('');
  return `<select id="${id}" class="input">${opts || '<option>No data</option>'}</select>`;
}
