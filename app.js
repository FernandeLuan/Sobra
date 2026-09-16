(() => {
  const STORAGE_KEY='sobra.transactions.v1';
  const OVERRIDES_KEY='sobra.occurrences.v1';
  const THEME_KEY='sobra.theme.v1';
  const SOBRA_VERSION='0.4.0';
  const SOBRA_RELEASE_ID=document.querySelector('meta[name="sobra-release"]')?.content||'development';
  const RELEASE_CHECK_MS=120000;
  const RELEASE_MIN_CHECK_MS=20000;
  let latestRelease=null;
  let lastReleaseCheck=0;
  let pendingReleaseNotice=false;
  const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
  const monthFmt=new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric'});
  const shortDateFmt=new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short'});
  const dayFmt=new Intl.DateTimeFormat('pt-BR',{weekday:'short'});
  const uid=()=>globalThis.crypto?.randomUUID?.()||`tx-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const pad=n=>String(n).padStart(2,'0');
  const iso=(y,m,d)=>`${y}-${pad(m+1)}-${pad(d)}`;

  function icon(name,size=20){
    const icons={
      arrowUp:'<path d="M7 17 17 7M9 7h8v8"/>',
      arrowDown:'<path d="m7 7 10 10M17 9v8H9"/>',
      filter:'<path d="M4 6h16M7 12h10M10 18h4"/>',
      tag:'<path d="M20 13 13 20 4 11V4h7l9 9Z"/><circle cx="8.5" cy="8.5" r="1.2"/>',
      palette:'<path d="M12 3a9 9 0 1 0 0 18h1.5a2.5 2.5 0 0 0 0-5H12a1 1 0 0 1 0-2h2a7 7 0 0 0-2-11Z"/><circle cx="7.5" cy="10" r="1"/><circle cx="9" cy="6.5" r="1"/><circle cx="14" cy="6.5" r="1"/><circle cx="17" cy="10" r="1"/>',
      data:'<ellipse cx="12" cy="5" rx="7" ry="3"/><path d="M5 5v6c0 1.7 3.1 3 7 3s7-1.3 7-3V5M5 11v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>',
      sliders:'<path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M8 14v6"/>',
      info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
      chevron:'<path d="m9 18 6-6-6-6"/>',
      sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>',
      moon:'<path d="M20 15.2A8.5 8.5 0 0 1 8.8 4 8.5 8.5 0 1 0 20 15.2Z"/>'
    };
    return `<svg class="app-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||''}</svg>`;
  }

  const now=new Date();
  const initialMonth=new Date(now.getFullYear(),now.getMonth(),1);

  const state={
    page:'home',
    selectedMonth:initialMonth,
    accountsTab:'expense',
    search:'',
    calendarDate:null,
    entryType:'expense',
    transactions:loadTransactions(),
    overrides:loadOverrides()
  };

  function seedTransactions(){
    const y=initialMonth.getFullYear(),m=initialMonth.getMonth();
    return [
      {id:uid(),type:'income',description:'Salário',amount:5400,category:'Receitas',dueDate:iso(y,m,5),status:'received',mode:'recurring'},
      {id:uid(),type:'income',description:'Adiantamento',amount:1400,category:'Receitas',dueDate:iso(y,m,15),status:'received',mode:'recurring'},
      {id:uid(),type:'expense',description:'Aluguel',amount:1600,category:'Casa',dueDate:iso(y,m,8),status:'paid',mode:'recurring'},
      {id:uid(),type:'expense',description:'Mercado',amount:1150,category:'Alimentação',dueDate:iso(y,m,9),status:'paid',mode:'single'},
      {id:uid(),type:'expense',description:'Internet',amount:153,category:'Contas',dueDate:iso(y,m,10),status:'paid',mode:'recurring'},
      {id:uid(),type:'expense',description:'Energia',amount:240,category:'Contas',dueDate:iso(y,m,18),status:'scheduled',mode:'recurring'},
      {id:uid(),type:'expense',description:'Academia',amount:119.90,category:'Saúde',dueDate:iso(y,m,12),status:'paid',mode:'recurring'},
      {id:uid(),type:'expense',description:'Cartão',amount:2175.20,category:'Compras',dueDate:iso(y,m,25),status:'launched',mode:'single'},
      {id:uid(),type:'expense',description:'Celular',amount:300,category:'Compras',dueDate:iso(y,m,20),status:'paid',mode:'installment',installmentNumber:3,installmentTotal:12},
      {id:uid(),type:'expense',description:'Transporte',amount:500,category:'Transporte',dueDate:iso(y,m,22),status:'scheduled',mode:'single'},
      {id:uid(),type:'expense',description:'Seguro',amount:166,category:'Contas',dueDate:iso(y,m,14),status:'paid',mode:'recurring'},
      {id:uid(),type:'expense',description:'Assinaturas',amount:200,category:'Assinaturas',dueDate:iso(y,m,28),status:'scheduled',mode:'recurring'}
    ];
  }

  function loadTransactions(){
    try{
      const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
      return Array.isArray(saved)&&saved.length?saved:seedTransactions();
    }catch{return seedTransactions()}
  }
  function loadOverrides(){
    try{
      const saved=JSON.parse(localStorage.getItem(OVERRIDES_KEY)||'{}');
      return saved&&typeof saved==='object'&&!Array.isArray(saved)?saved:{};
    }catch{return {}}
  }
  function persist(){
    localStorage.setItem(STORAGE_KEY,JSON.stringify(state.transactions));
    localStorage.setItem(OVERRIDES_KEY,JSON.stringify(state.overrides));
  }
  function selectedKey(){return `${state.selectedMonth.getFullYear()}-${pad(state.selectedMonth.getMonth()+1)}`}
  function monthKeyFromDate(value){return String(value||'').slice(0,7)}
  function compareMonthKeys(a,b){return String(a).localeCompare(String(b))}
  function occurrenceOverrideKey(id,key){return `${id}:${key}`}
  function previousMonthKey(key){
    const [y,m]=key.split('-').map(Number);
    const d=new Date(y,m-2,1);
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}`;
  }
  function projectedRecurring(t,key){
    const start=t.recurrenceStart||monthKeyFromDate(t.dueDate);
    const end=t.recurrenceEnd||null;
    if(compareMonthKeys(key,start)<0||(end&&compareMonthKeys(key,end)>0))return null;
    const override=state.overrides[occurrenceOverrideKey(t.id,key)]||{};
    if(override.skipped)return null;
    const [y,m]=key.split('-').map(Number);
    const sourceDay=Number(String(t.dueDate).slice(8,10))||1;
    const day=Math.min(sourceDay,new Date(y,m,0).getDate());
    const dueDate=`${key}-${pad(day)}`;
    const sourceKey=monthKeyFromDate(t.dueDate);
    const defaultStatus=key===sourceKey?t.status:(t.type==='expense'?'launched':'expected');
    return {...t,...override,id:`${t.id}@${key}`,dueDate,date:dueDate,status:override.status||defaultStatus,_sourceId:t.id,_occurrenceKey:key};
  }
  function monthTransactions(){
    const key=selectedKey();
    const rows=[];
    for(const t of state.transactions){
      if(t.mode==='recurring'){
        const projected=projectedRecurring(t,key);
        if(projected)rows.push(projected);
      }else if(monthKeyFromDate(t.dueDate||t.date)===key){
        rows.push(t);
      }
    }
    return rows;
  }
  function viewTransaction(id){
    return monthTransactions().find(t=>t.id===id)||state.transactions.find(t=>t.id===id)||null;
  }
  function sum(list){return list.reduce((a,t)=>a+Number(t.amount||0),0)}
  function getSummary(){
    const txs=monthTransactions();
    const incomes=txs.filter(t=>t.type==='income');
    const expenses=txs.filter(t=>t.type==='expense');
    const revenue=sum(incomes);
    const expensesTotal=sum(expenses);
    return {
      revenue,expensesTotal,sobra:revenue-expensesTotal,
      paid:sum(expenses.filter(t=>t.status==='paid')),
      scheduled:sum(expenses.filter(t=>t.status==='scheduled')),
      launched:sum(expenses.filter(t=>t.status==='launched')),
      remaining:sum(expenses.filter(t=>t.status!=='paid')),
      percentage:revenue>0?Math.min(100,(expensesTotal/revenue)*100):0
    };
  }
  function isOverdue(t){
    if(t.type!=='expense'||t.status==='paid')return false;
    const today=new Date(); today.setHours(0,0,0,0);
    return new Date(`${t.dueDate}T12:00:00`)<today;
  }
  function labelStatus(t){
    if(isOverdue(t))return'Vencida';
    return ({paid:'Paga',scheduled:'Agendada',launched:'Lançada',received:'Recebida',expected:'Prevista'})[t.status]||t.status;
  }
  function statusClass(t){
    if(isOverdue(t))return'status-overdue';
    return t.status==='paid'||t.status==='received'?'status-paid':t.status==='scheduled'?'status-scheduled':'';
  }
  function txMeta(t){
    const date=shortDateFmt.format(new Date(`${t.dueDate}T12:00:00`));
    const installment=t.mode==='installment'?` · ${t.installmentNumber||1}/${t.installmentTotal||1}`:'';
    return `${escapeHtml(t.category)} · ${date}${installment}`;
  }
  function txItem(t){
    const sign=t.type==='income'?'+':'−';
    const tone=t.type==='income'?'income':'expense';
    return `<button class="transaction-item" data-open-tx="${t.id}">
      <span class="tx-icon ${tone}">${icon(t.type==='income'?'arrowUp':'arrowDown',18)}</span>
      <span class="tx-title"><strong>${escapeHtml(t.description)}</strong><small>${txMeta(t)}</small></span>
      <span class="tx-value"><strong class="${tone}">${sign} ${money.format(t.amount)}</strong></span>
    </button>`;
  }
  function monthSwitcher(){
    return `<div class="month-switcher"><button data-month="-1" aria-label="Mês anterior">‹</button><div class="month-label">${monthFmt.format(state.selectedMonth)}</div><button data-month="1" aria-label="Próximo mês">›</button></div>`;
  }
  function homeMonthSelector(){
    return `<div class="balance-month"><button data-month="-1" aria-label="Mês anterior">‹</button><strong>${monthFmt.format(state.selectedMonth)}</strong><button data-month="1" aria-label="Próximo mês">›</button></div>`;
  }
  function dueContextLabel(t){
    const date=new Date(`${t.dueDate}T12:00:00`);
    const today=new Date();today.setHours(0,0,0,0);
    const tomorrow=new Date(today);tomorrow.setDate(tomorrow.getDate()+1);
    const clean=new Date(date);clean.setHours(0,0,0,0);
    if(clean.getTime()===today.getTime())return'Hoje';
    if(clean.getTime()===tomorrow.getTime())return'Amanhã';
    return date.toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}).replace('.','');
  }
  function upcomingItem(t){
    return `<button class="upcoming-item" data-open-tx="${t.id}">
      <span class="due-pill ${isOverdue(t)?'overdue':''}">${dueContextLabel(t)}</span>
      <span class="tx-title"><strong>${escapeHtml(t.description)}</strong><small>${escapeHtml(t.category)}</small></span>
      <span class="tx-value"><strong class="expense">− ${money.format(t.amount)}</strong></span>
    </button>`;
  }

  function renderHome(){
    const s=getSummary();
    const txs=monthTransactions().filter(t=>t.type==='expense').sort((a,b)=>a.dueDate.localeCompare(b.dueDate));
    const upcoming=txs.filter(t=>t.status!=='paid').slice(0,5);
    return `<section class="page home-page">
      <div class="balance-card">
        ${homeMonthSelector()}
        <div class="balance-main">
          <p class="balance-label">Vai sobrar</p>
          <h2 class="balance-value">${money.format(s.sobra)}</h2>
          <span class="balance-caption">depois de todas as contas deste mês</span>
        </div>

        <div class="balance-row">
          <div class="balance-mini"><small>Entradas</small><strong>${money.format(s.revenue)}</strong></div>
          <div class="balance-mini"><small>Contas</small><strong>${money.format(s.expensesTotal)}</strong></div>
        </div>

        <div class="balance-commitment">
          <div class="balance-progress"><span style="width:${s.percentage}%"></span></div>
          <div class="balance-commitment-copy">
            <span>${s.percentage.toFixed(0)}% da renda comprometida</span>
            <strong>${money.format(s.sobra)} livres</strong>
          </div>
        </div>
      </div>

      <section class="content-section payment-focus">
        <div class="payment-focus-main">
          <span>Ainda falta pagar</span>
          <strong>${money.format(s.remaining)}</strong>
        </div>
        <div class="payment-focus-meta">
          <span><i class="status-dot paid"></i>Pago ${money.format(s.paid)}</span>
          <span><i class="status-dot scheduled"></i>Agendado ${money.format(s.scheduled)}</span>
        </div>
        <button class="text-action" data-nav="accounts">Ver contas</button>
      </section>

      <section class="content-section upcoming-section">
        <div class="section-head"><h2>Próximas contas</h2><button data-nav="calendar">Calendário</button></div>
        <div class="list-surface upcoming-list">${upcoming.length?upcoming.map(upcomingItem).join(''):'<div class="empty-state"><strong>Tudo certo por aqui</strong>Nenhuma conta pendente neste mês.</div>'}</div>
      </section>
    </section>`;
  }

  function accountItem(t){
    const recurring=t.mode==='recurring';
    const tone=t.type==='income'?'income':'expense';
    const sign=t.type==='income'?'+':'−';
    const day=Number(String(t.dueDate).slice(8,10));
    return `<button class="account-item" data-open-tx="${t.id}">
      <span class="account-icon ${tone}">${icon(t.type==='income'?'arrowUp':'arrowDown',18)}</span>
      <span class="account-copy">
        <strong>${escapeHtml(t.description)}</strong>
        <small>${escapeHtml(t.category)} · dia ${day}</small>
      </span>
      <span class="account-side">
        <strong class="${tone}">${sign} ${money.format(t.amount)}</strong>
        <small>${recurring?'Todo mês':'Só este mês'}</small>
      </span>
    </button>`;
  }

  function renderAccountGroup(title,rows,empty){
    return `<section class="account-group">
      <div class="section-head"><h2>${title}</h2><span></span></div>
      <div class="list-surface account-list">${rows.length?rows.map(accountItem).join(''):`<div class="empty-state compact">${empty}</div>`}</div>
    </section>`;
  }

  function renderAccounts(){
    const txs=monthTransactions().filter(t=>t.type===state.accountsTab).sort((a,b)=>a.dueDate.localeCompare(b.dueDate));
    const recurring=txs.filter(t=>t.mode==='recurring');
    const monthly=txs.filter(t=>t.mode!=='recurring');
    const isExpense=state.accountsTab==='expense';
    return `<section class="page accounts-page">
      ${monthSwitcher()}
      <div class="account-tabs">
        <button class="${isExpense?'active':''}" data-account-tab="expense">Contas</button>
        <button class="${!isExpense?'active':''}" data-account-tab="income">Proventos</button>
      </div>
      <div class="accounts-intro">
        <strong>${isExpense?'O que você precisa pagar':'O que você espera receber'}</strong>
        <span>${isExpense?'Cadastre contas recorrentes ou somente deste mês.':'Organize salários, rendas recorrentes e valores avulsos.'}</span>
      </div>
      ${renderAccountGroup('Recorrentes',recurring,isExpense?'Nenhuma conta recorrente.':'Nenhum provento recorrente.')}
      ${renderAccountGroup(`Somente em ${monthFmt.format(state.selectedMonth).split(' de ')[0]}`,monthly,isExpense?'Nenhuma conta avulsa neste mês.':'Nenhum provento avulso neste mês.')}
    </section>`;
  }

  function renderCalendar(){
    const y=state.selectedMonth.getFullYear(),m=state.selectedMonth.getMonth();
    const txs=monthTransactions().sort((a,b)=>a.dueDate.localeCompare(b.dueDate));
    const groups=txs.reduce((acc,t)=>{(acc[t.dueDate] ||= []).push(t);return acc},{});
    const firstDay=new Date(y,m,1).getDay();
    const daysInMonth=new Date(y,m+1,0).getDate();
    const todayKey=iso(now.getFullYear(),now.getMonth(),now.getDate());

    if(!state.calendarDate||!state.calendarDate.startsWith(selectedKey())){
      const preferred=(now.getFullYear()===y&&now.getMonth()===m)?todayKey:Object.keys(groups)[0]||iso(y,m,1);
      state.calendarDate=preferred;
    }

    const cells=[];
    for(let i=0;i<firstDay;i++)cells.push('<span class="calendar-cell empty" aria-hidden="true"></span>');
    for(let day=1;day<=daysInMonth;day++){
      const date=iso(y,m,day);
      const list=groups[date]||[];
      const hasIncome=list.some(t=>t.type==='income');
      const hasExpense=list.some(t=>t.type==='expense');
      const selected=state.calendarDate===date;
      const today=date===todayKey;
      cells.push(`<button class="calendar-cell ${selected?'selected':''} ${today?'today':''}" data-calendar-date="${date}" aria-label="${day} de ${monthFmt.format(state.selectedMonth)}">
        <span class="calendar-number">${day}</span>
        <span class="calendar-dots">
          ${hasIncome?'<i class="calendar-dot income"></i>':''}
          ${hasExpense?'<i class="calendar-dot expense"></i>':''}
        </span>
      </button>`);
    }

    const selectedTxs=groups[state.calendarDate]||[];
    const selectedDate=new Date(`${state.calendarDate}T12:00:00`);
    const selectedLabel=selectedDate.toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long'});
    const selectedList=selectedTxs.length
      ? selectedTxs.map(txItem).join('')
      : '<div class="empty-state compact"><strong>Nenhum lançamento</strong>Não há movimentações neste dia.</div>';

    return `<section class="page">
      ${monthSwitcher()}
      <div class="calendar-card">
        <div class="calendar-weekdays">
          ${['D','S','T','Q','Q','S','S'].map(d=>`<span>${d}</span>`).join('')}
        </div>
        <div class="calendar-grid">${cells.join('')}</div>
        <div class="calendar-legend">
          <span><i class="calendar-dot income"></i> Entradas</span>
          <span><i class="calendar-dot expense"></i> Saídas</span>
        </div>
      </div>
      <div class="section-card calendar-selected">
        <div class="section-head"><h2>${selectedLabel}</h2><span></span></div>
        <div class="transaction-list">${selectedList}</div>
      </div>
    </section>`;
  }

  function renderMore(){
    const rows=[
      ['tag','Categorias','Organize seus lançamentos','categories'],
      ['palette','Aparência','Tema e preferências visuais','appearance'],
      ['data','Dados e backup','Gerencie os dados do aplicativo','data'],
      ['sliders','Preferências','Comportamento do Sobra','preferences'],
      ['info','Sobre o Sobra',`Versão ${SOBRA_VERSION}`,'about']
    ];
    return `<section class="page">
      <div class="settings-list">${rows.map(([ico,title,subtitle,action])=>`
        <button class="settings-row" data-more-action="${action}">
          <span class="settings-icon">${icon(ico,20)}</span>
          <span class="settings-copy"><strong>${title}</strong><small>${subtitle}</small></span>
          <span class="settings-chevron">${icon('chevron',18)}</span>
        </button>`).join('')}</div>
    </section>`;
  }

  function openMoreAction(action){
    if(action==='appearance'){
      openModal('Aparência','',
        `<div class="settings-modal-row"><span>Modo escuro</span><button class="btn btn-secondary" data-toggle-theme>${document.body.classList.contains('dark')?'Desativar':'Ativar'}</button></div>`,
        '<button class="btn btn-primary" data-close-modal>Concluir</button>');
      return;
    }
    if(action==='categories'){
      const cats=[...new Set(state.transactions.map(t=>t.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
      openModal('Categorias','',`<div class="category-list">${cats.map(c=>`<span>${escapeHtml(c)}</span>`).join('')}</div>`,'<button class="btn btn-primary" data-close-modal>Fechar</button>');
      return;
    }
    if(action==='data'){
      openModal('Dados e backup','',`<div class="info-stack"><p>Seus dados ainda ficam armazenados somente neste navegador enquanto validamos o protótipo.</p><button class="btn btn-secondary" id="resetData">Restaurar dados de demonstração</button></div>`,'<button class="btn btn-primary" data-close-modal>Fechar</button>');
      return;
    }
    if(action==='preferences'){
      openModal('Preferências','',`<div class="info-stack"><p>As preferências pessoais serão ampliadas quando conectarmos a conta e o Firebase.</p></div>`,'<button class="btn btn-primary" data-close-modal>Fechar</button>');
      return;
    }
    openModal('Sobre o Sobra','',`<div class="about-sobra"><div class="brand-mark large">S</div><strong>Sobra</strong><p>Organize o que entrou, o que saiu e saiba quanto vai sobrar.</p><span>Versão ${SOBRA_VERSION}</span></div>`,'<button class="btn btn-primary" data-close-modal>Fechar</button>');
  }

  function render(){
    const app=document.getElementById('app');
    if(!app)return;
    app.innerHTML=state.page==='accounts'?renderAccounts():state.page==='calendar'?renderCalendar():state.page==='more'?renderMore():renderHome();
    document.querySelectorAll('.nav-item[data-nav]').forEach(b=>b.classList.toggle('active',b.dataset.nav===state.page));
    window.scrollTo({top:0,behavior:'auto'});
  }
  function navigate(page){
    if(state.page===page)return;
    state.page=page;
    render();
  }
  function changeMonth(delta){
    state.selectedMonth=new Date(state.selectedMonth.getFullYear(),state.selectedMonth.getMonth()+delta,1);
    state.calendarDate=null;
    render();
  }

  function openModal(title,subtitle,body,footer=''){
    document.body.classList.add('modal-open');
    document.getElementById('modalRoot').innerHTML=`<div class="modal-backdrop" data-modal-backdrop>
      <div class="modal" role="dialog" aria-modal="true" aria-label="${escapeAttr(title)}">
        <div class="modal-head"><div><h2>${title}</h2>${subtitle?`<p>${subtitle}</p>`:''}</div><button class="modal-close" data-close-modal aria-label="Fechar">×</button></div>
        <div class="modal-body">${body}</div>
        ${footer?`<div class="modal-footer">${footer}</div>`:''}
      </div>
    </div>`;
  }
  function closeModal(){
    document.body.classList.remove('modal-open');
    document.getElementById('modalRoot').innerHTML='';
    if(pendingReleaseNotice) setTimeout(maybeShowReleaseUpdate,80);
  }

  async function fetchLatestRelease(){
    const url=new URL('release.json',location.href);
    url.searchParams.set('_',String(Date.now()));
    const response=await fetch(url.toString(),{cache:'no-store'});
    if(!response.ok)throw new Error(`release manifest ${response.status}`);
    const data=await response.json();
    if(!data?.release)return null;
    return data;
  }

  function maybeShowReleaseUpdate(){
    if(!latestRelease||latestRelease.release===SOBRA_RELEASE_ID)return;
    if(sessionStorage.getItem('sobra.dismissedRelease')===latestRelease.release)return;
    if(document.body.classList.contains('modal-open')){
      pendingReleaseNotice=true;
      return;
    }
    pendingReleaseNotice=false;
    openModal(
      'Nova versão disponível',
      `Sobra ${escapeHtml(latestRelease.version||'')}`,
      `<div class="update-notice">
        <div class="update-notice-icon">↻</div>
        <p><strong>O Sobra recebeu uma atualização.</strong></p>
        <p>Atualize para carregar as melhorias mais recentes. Seus lançamentos salvos neste navegador serão mantidos.</p>
        <div class="update-version-row">
          <span>Versão atual <strong>${escapeHtml(SOBRA_VERSION)}</strong></span>
          <span>Nova versão <strong>${escapeHtml(latestRelease.version||latestRelease.release)}</strong></span>
        </div>
      </div>`,
      '<button class="btn btn-secondary" data-dismiss-update>Depois</button><button class="btn btn-primary" data-apply-update>Atualizar agora</button>'
    );
  }

  async function checkForRelease(force=false){
    const time=Date.now();
    if(!force&&time-lastReleaseCheck<RELEASE_MIN_CHECK_MS)return;
    lastReleaseCheck=time;
    try{
      const release=await fetchLatestRelease();
      if(!release)return;
      latestRelease=release;
      if(release.release!==SOBRA_RELEASE_ID)maybeShowReleaseUpdate();
    }catch(error){
      console.debug('Verificação de versão indisponível:',error?.message||error);
    }
  }

  function applyReleaseUpdate(){
    if(!latestRelease)return;
    const url=new URL(location.href);
    url.searchParams.set('_build',latestRelease.release);
    location.assign(url.toString());
  }

  function dismissReleaseUpdate(){
    if(latestRelease)sessionStorage.setItem('sobra.dismissedRelease',latestRelease.release);
    pendingReleaseNotice=false;
    closeModal();
  }

  function startReleaseMonitor(){
    checkForRelease(true);
    setInterval(()=>checkForRelease(false),RELEASE_CHECK_MS);
    window.addEventListener('focus',()=>checkForRelease(false),{passive:true});
    document.addEventListener('visibilitychange',()=>{
      if(document.visibilityState==='visible')checkForRelease(false);
    });
  }
  function entryDate(){
    const y=state.selectedMonth.getFullYear(),m=state.selectedMonth.getMonth();
    const today=(now.getFullYear()===y&&now.getMonth()===m)?Math.min(now.getDate(),28):10;
    return iso(y,m,today);
  }
  function openAddChoice(){
    openModal('Adicionar','',
      `<div class="add-choice-grid">
        <button class="add-choice expense" data-add-kind="expense">
          <span class="add-choice-icon">${icon('arrowDown',22)}</span>
          <strong>Conta</strong>
          <small>Algo que você precisa pagar</small>
        </button>
        <button class="add-choice income" data-add-kind="income">
          <span class="add-choice-icon">${icon('arrowUp',22)}</span>
          <strong>Provento</strong>
          <small>Dinheiro que você espera receber</small>
        </button>
      </div>`
    );
  }

  function openEntryModal(type='expense'){
    state.entryType=type;
    const expense=type==='expense';
    openModal(expense?'Nova conta':'Novo provento','',
      `<div class="form-grid quick-entry-form">
        <div class="entry-amount-field">
          <label>Valor</label>
          <div class="entry-amount-input"><span>R$</span><input id="entryAmount" inputmode="decimal" placeholder="0,00" autocomplete="off"></div>
        </div>
        <div class="field"><label>${expense?'Nome da conta':'Nome do provento'}</label><input class="input" id="entryDescription" placeholder="${expense?'Ex.: Internet':'Ex.: Salário'}" autocomplete="off"></div>
        <div class="field"><label>${expense?'Vencimento':'Data prevista'}</label><input class="input" id="entryDate" type="date" value="${entryDate()}"></div>
        <div class="field"><label>Repetição</label><select class="select" id="entryMode">
          <option value="single">Somente este mês</option>
          <option value="recurring">Todo mês</option>
          <option value="installment">${expense?'Parcelado':'Parcelado'}</option>
        </select></div>

        <details class="advanced-options">
          <summary>Mais opções <span>Categoria, status e observações</span></summary>
          <div class="advanced-options-body">
            <div class="field"><label>Categoria</label><select class="select" id="entryCategory">${['Casa','Alimentação','Transporte','Saúde','Educação','Assinaturas','Lazer','Compras','Contas','Outros','Receitas'].map(c=>`<option>${c}</option>`).join('')}</select></div>
            <div class="field"><label>Status</label><select class="select" id="entryStatus"></select></div>
            <div id="installmentFields"></div>
            <div class="field"><label>Observações</label><textarea class="textarea" id="entryNotes" placeholder="Opcional"></textarea></div>
          </div>
        </details>
      </div>`,
      '<button class="btn btn-secondary" data-close-modal>Cancelar</button><button class="btn btn-primary" id="saveEntry">Salvar</button>');
    updateEntryFields();
    setTimeout(()=>document.getElementById('entryAmount')?.focus(),80);
  }

  function updateEntryFields(){
    const status=document.getElementById('entryStatus');
    const category=document.getElementById('entryCategory');
    if(!status)return;
    status.innerHTML=state.entryType==='expense'
      ?'<option value="launched">Lançada</option><option value="scheduled">Agendada</option><option value="paid">Paga</option>'
      :'<option value="expected">Prevista</option><option value="received">Recebida</option>';
    if(category&&state.entryType==='income')category.value='Receitas';
    if(category&&state.entryType==='expense'&&category.value==='Receitas')category.value='Casa';
    document.querySelectorAll('[data-entry-type]').forEach(b=>b.classList.toggle('active',b.dataset.entryType===state.entryType));
  }
  function updateInstallmentFields(){
    const root=document.getElementById('installmentFields');
    if(!root)return;
    root.innerHTML=document.getElementById('entryMode')?.value==='installment'
      ?'<div class="field-row"><div class="field"><label>Parcela atual</label><input class="input" id="installmentNumber" type="number" min="1" value="1"></div><div class="field"><label>Total de parcelas</label><input class="input" id="installmentTotal" type="number" min="2" value="2"></div></div>'
      :'';
  }
  function parseAmount(raw){return Number(String(raw).replace(/\./g,'').replace(',','.'))||0}
  function saveEntry(){
    const description=document.getElementById('entryDescription')?.value.trim();
    const amount=parseAmount(document.getElementById('entryAmount')?.value);
    const dueDate=document.getElementById('entryDate')?.value;
    if(!description||amount<=0||!dueDate){showToast('Preencha descrição, valor e data.');return}
    const mode=document.getElementById('entryMode').value;
    const tx={
      id:uid(),type:state.entryType,description,amount,dueDate,date:dueDate,
      category:document.getElementById('entryCategory').value,
      mode,status:document.getElementById('entryStatus').value,
      notes:document.getElementById('entryNotes').value.trim(),
      recurrenceStart:mode==='recurring'?monthKeyFromDate(dueDate):null
    };
    if(mode==='installment'){
      tx.installmentNumber=Number(document.getElementById('installmentNumber')?.value||1);
      tx.installmentTotal=Number(document.getElementById('installmentTotal')?.value||2);
    }
    state.transactions.push(tx);
    persist();closeModal();render();showToast(state.entryType==='expense'?'Conta salva.':'Provento salvo.');
  }

  function openTransaction(id){
    const t=viewTransaction(id);if(!t)return;
    openModal(escapeHtml(t.description),txMeta(t),
      `<div class="detail-total"><small>${t.type==='income'?'Valor da receita':'Valor do lançamento'}</small><strong>${money.format(t.amount)}</strong></div>
      <div class="detail-grid">
        <div class="detail-card"><small>Status</small><strong>${labelStatus(t)}</strong></div>
        <div class="detail-card"><small>Categoria</small><strong>${escapeHtml(t.category)}</strong></div>
        <div class="detail-card"><small>Data</small><strong>${shortDateFmt.format(new Date(`${t.dueDate}T12:00:00`))}</strong></div>
        <div class="detail-card"><small>Repetição</small><strong>${t.mode==='recurring'?'Todo mês':t.mode==='installment'?'Parcelado':'Somente este mês'}</strong></div>
      </div>
      ${t.notes?`<div class="detail-card" style="margin-top:9px"><small>Observações</small><strong>${escapeHtml(t.notes)}</strong></div>`:''}
      <div class="detail-actions">
        ${t.type==='expense'&&t.status!=='paid'?`<button class="btn btn-primary" data-mark-paid="${t.id}">Marcar como paga</button>`:''}
        ${t.type==='expense'&&t.status==='launched'?`<button class="btn btn-secondary" data-mark-scheduled="${t.id}">Marcar como agendada</button>`:''}
        <button class="btn btn-secondary" data-delete-tx="${t.id}">Excluir ${t.type==='expense'?'conta':'provento'}</button>
      </div>`,
      '<button class="btn btn-primary" data-close-modal>Fechar</button>');
  }
  function updateTxStatus(id,status){
    const t=viewTransaction(id);if(!t)return;
    if(t._sourceId){
      const key=occurrenceOverrideKey(t._sourceId,t._occurrenceKey);
      state.overrides[key]={...(state.overrides[key]||{}),status};
    }else{
      const base=state.transactions.find(x=>x.id===id);
      if(base)base.status=status;
    }
    persist();closeModal();render();showToast(status==='paid'?'Conta marcada como paga.':'Conta marcada como agendada.');
  }
  function deleteTx(id){
    const t=viewTransaction(id);if(!t)return;
    if(t._sourceId){
      openModal(
        `Excluir ${t.type==='expense'?'conta':'provento'} recorrente`,
        escapeHtml(t.description),
        '<div class="info-stack"><p>Escolha se deseja remover apenas este mês ou encerrar a recorrência a partir deste mês.</p></div>',
        `<button class="btn btn-secondary" data-skip-occurrence="${t.id}">Só este mês</button><button class="btn btn-primary" data-end-recurrence="${t.id}">Deste mês em diante</button>`
      );
      return;
    }
    state.transactions=state.transactions.filter(x=>x.id!==id);
    persist();closeModal();render();showToast(t.type==='expense'?'Conta excluída.':'Provento excluído.');
  }
  function skipOccurrence(id){
    const t=viewTransaction(id);if(!t?._sourceId)return;
    const key=occurrenceOverrideKey(t._sourceId,t._occurrenceKey);
    state.overrides[key]={...(state.overrides[key]||{}),skipped:true};
    persist();closeModal();render();showToast('Removido somente deste mês.');
  }
  function endRecurrence(id){
    const t=viewTransaction(id);if(!t?._sourceId)return;
    const base=state.transactions.find(x=>x.id===t._sourceId);if(!base)return;
    const start=base.recurrenceStart||monthKeyFromDate(base.dueDate);
    if(t._occurrenceKey===start){
      state.transactions=state.transactions.filter(x=>x.id!==base.id);
    }else{
      base.recurrenceEnd=previousMonthKey(t._occurrenceKey);
    }
    persist();closeModal();render();showToast('Recorrência encerrada.');
  }

  function duplicateTx(id){
    const t=state.transactions.find(x=>x.id===id);if(!t)return;
    state.transactions.push({...t,id:uid(),description:`${t.description} — cópia`});
    persist();closeModal();render();showToast('Lançamento duplicado.');
  }
  function showToast(message){
    const root=document.getElementById('toastRoot');
    const el=document.createElement('div');el.className='toast';el.textContent=message;root.appendChild(el);
    setTimeout(()=>el.remove(),2600);
  }
  function setThemeIcon(){
    const el=document.getElementById('themeIcon');
    if(el)el.innerHTML=icon(document.body.classList.contains('dark')?'sun':'moon',19);
  }
  function toggleTheme(){
    document.body.classList.toggle('dark');
    const dark=document.body.classList.contains('dark');
    localStorage.setItem(THEME_KEY,dark?'dark':'light');
    setThemeIcon();
  }
  function restoreTheme(){
    if(localStorage.getItem(THEME_KEY)==='dark')document.body.classList.add('dark');
    setThemeIcon();
  }
  function resetData(){
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(OVERRIDES_KEY);
    state.transactions=seedTransactions();
    state.overrides={};
    persist();render();showToast('Dados de demonstração restaurados.');
  }
  function escapeHtml(value=''){return String(value).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
  function escapeAttr(value=''){return escapeHtml(value)}

  document.addEventListener('click',e=>{
    const nav=e.target.closest('[data-nav]');if(nav){navigate(nav.dataset.nav);return}
    const month=e.target.closest('[data-month]');if(month){changeMonth(Number(month.dataset.month));return}
    const accountTab=e.target.closest('[data-account-tab]');if(accountTab){state.accountsTab=accountTab.dataset.accountTab;render();return}
    const calendarDay=e.target.closest('[data-calendar-date]');if(calendarDay){state.calendarDate=calendarDay.dataset.calendarDate;render();return}
    const tx=e.target.closest('[data-open-tx]');if(tx){openTransaction(tx.dataset.openTx);return}
    if(e.target.closest('#newEntryBtn')){openAddChoice();return}
    const addKind=e.target.closest('[data-add-kind]');if(addKind){closeModal();openEntryModal(addKind.dataset.addKind);return}
    if(e.target.closest('[data-close-modal]')){closeModal();return}
    const backdrop=e.target.closest('[data-modal-backdrop]');if(backdrop&&e.target===backdrop){closeModal();return}
    const type=e.target.closest('[data-entry-type]');if(type){state.entryType=type.dataset.entryType;updateEntryFields();return}
    if(e.target.closest('#saveEntry')){saveEntry();return}
    const paid=e.target.closest('[data-mark-paid]');if(paid){updateTxStatus(paid.dataset.markPaid,'paid');return}
    const scheduled=e.target.closest('[data-mark-scheduled]');if(scheduled){updateTxStatus(scheduled.dataset.markScheduled,'scheduled');return}
    const del=e.target.closest('[data-delete-tx]');if(del){deleteTx(del.dataset.deleteTx);return}
    const skip=e.target.closest('[data-skip-occurrence]');if(skip){skipOccurrence(skip.dataset.skipOccurrence);return}
    const endRec=e.target.closest('[data-end-recurrence]');if(endRec){endRecurrence(endRec.dataset.endRecurrence);return}
    const dup=e.target.closest('[data-duplicate-tx]');if(dup){duplicateTx(dup.dataset.duplicateTx);return}
    if(e.target.closest('[data-apply-update]')){applyReleaseUpdate();return}
    if(e.target.closest('[data-dismiss-update]')){dismissReleaseUpdate();return}
    const moreAction=e.target.closest('[data-more-action]');if(moreAction){openMoreAction(moreAction.dataset.moreAction);return}
    if(e.target.closest('[data-toggle-theme]')){toggleTheme();closeModal();openMoreAction('appearance');return}
    if(e.target.closest('#themeToggle')){toggleTheme();return}
    if(e.target.closest('#resetData')){resetData();closeModal();return}
  });
  document.addEventListener('input',e=>{});
  document.addEventListener('change',e=>{if(e.target.id==='entryMode')updateInstallmentFields()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});

  restoreTheme();
  render();
  startReleaseMonitor();
})();