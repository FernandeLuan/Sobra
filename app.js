(() => {
  const STORAGE_KEY='sobra.transactions.v1';
  const THEME_KEY='sobra.theme.v1';
  const SOBRA_VERSION='0.2.0';
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

  const now=new Date();
  const initialMonth=new Date(now.getFullYear(),now.getMonth(),1);

  const state={
    page:'home',
    selectedMonth:initialMonth,
    filter:'all',
    search:'',
    calendarDate:null,
    entryType:'expense',
    transactions:loadTransactions()
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
  function persist(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state.transactions))}
  function selectedKey(){return `${state.selectedMonth.getFullYear()}-${pad(state.selectedMonth.getMonth()+1)}`}
  function monthTransactions(){const key=selectedKey();return state.transactions.filter(t=>String(t.dueDate||t.date||'').startsWith(key))}
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
    const mode=t.mode==='recurring'?'Recorrente':t.mode==='installment'?`${t.installmentNumber||1}/${t.installmentTotal||1}`:'Único';
    return `${escapeHtml(t.category)} · ${date} · ${mode}`;
  }
  function txItem(t){
    const sign=t.type==='income'?'+':'−';
    const tone=t.type==='income'?'income':'expense';
    return `<button class="transaction-item" data-open-tx="${t.id}">
      <span class="tx-icon ${tone}">${t.type==='income'?'↗':'↘'}</span>
      <span class="tx-title"><strong>${escapeHtml(t.description)}</strong><small>${txMeta(t)}</small></span>
      <span class="tx-value"><strong class="${tone}">${sign} ${money.format(t.amount)}</strong></span>
    </button>`;
  }
  function monthSwitcher(){
    return `<div class="month-switcher"><button data-month="-1" aria-label="Mês anterior">‹</button><div class="month-label">${monthFmt.format(state.selectedMonth)}</div><button data-month="1" aria-label="Próximo mês">›</button></div>`;
  }

  function renderHome(){
    const s=getSummary();
    const txs=monthTransactions().filter(t=>t.type==='expense').sort((a,b)=>a.dueDate.localeCompare(b.dueDate));
    const upcoming=txs.filter(t=>t.status!=='paid').slice(0,5);
    return `<section class="page">
      ${monthSwitcher()}
      <div class="balance-card">
        <p class="balance-label">Sobra prevista</p>
        <h2 class="balance-value">${money.format(s.sobra)}</h2>
        <span class="balance-caption">Depois de considerar todas as contas deste mês</span>
        <div class="balance-row">
          <div class="balance-mini"><small>Receitas</small><strong>${money.format(s.revenue)}</strong></div>
          <div class="balance-mini"><small>Despesas</small><strong>${money.format(s.expensesTotal)}</strong></div>
        </div>
      </div>
      <div class="section-card">
        <div class="section-head"><h2>Visão de ${monthFmt.format(state.selectedMonth).split(' de ')[0]}</h2><span></span></div>
        <div class="progress-track"><div class="progress-fill" style="width:${s.percentage}%"></div></div>
        <div class="progress-copy"><span>${s.percentage.toFixed(0)}% da renda comprometida</span><strong>Restam ${money.format(s.sobra)}</strong></div>
      </div>
      <div class="section-card">
        <div class="section-head"><h2>Contas do mês</h2><button data-nav="transactions">Ver todas</button></div>
        <div class="status-grid">
          <div class="status-card" data-tone="paid"><span class="status-dot"></span><small>Pagas</small><strong>${money.format(s.paid)}</strong></div>
          <div class="status-card" data-tone="scheduled"><span class="status-dot"></span><small>Agendadas</small><strong>${money.format(s.scheduled)}</strong></div>
          <div class="status-card" data-tone="launched"><span class="status-dot"></span><small>A pagar</small><strong>${money.format(s.launched)}</strong></div>
        </div>
      </div>
      <div class="section-card">
        <div class="section-head"><h2>Próximas contas</h2><button data-nav="calendar">Calendário</button></div>
        <div class="transaction-list">${upcoming.length?upcoming.map(txItem).join(''):'<div class="empty-state"><strong>Tudo certo por aqui</strong>Nenhuma conta pendente neste mês.</div>'}</div>
      </div>
    </section>`;
  }

  function filteredTransactions(){
    let txs=monthTransactions();
    if(state.filter==='income')txs=txs.filter(t=>t.type==='income');
    if(['launched','scheduled','paid'].includes(state.filter))txs=txs.filter(t=>t.type==='expense'&&t.status===state.filter);
    const q=state.search.trim().toLowerCase();
    if(q)txs=txs.filter(t=>`${t.description} ${t.category}`.toLowerCase().includes(q));
    return txs.sort((a,b)=>a.dueDate.localeCompare(b.dueDate));
  }
  function renderTransactions(){
    const filters=[['all','Todos'],['launched','Lançados'],['scheduled','Agendados'],['paid','Pagos'],['income','Receitas']];
    const txs=filteredTransactions();
    return `<section class="page">
      ${monthSwitcher()}
      <div class="search-box"><input id="searchInput" value="${escapeAttr(state.search)}" placeholder="Buscar lançamento ou categoria"></div>
      <div class="filters">${filters.map(([id,label])=>`<button class="filter-chip ${state.filter===id?'active':''}" data-filter="${id}">${label}</button>`).join('')}</div>
      <div class="section-card" style="margin-top:0"><div class="transaction-list">${txs.length?txs.map(txItem).join(''):'<div class="empty-state"><strong>Nenhum lançamento</strong>Tente outro filtro ou crie um novo lançamento.</div>'}</div></div>
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
    return `<section class="page">
      <div class="more-grid">
        <button class="more-item" id="themeMenu"><span><strong>Tema</strong><small>Alternar entre modo claro e escuro</small></span><span>›</span></button>
        <button class="more-item" id="resetData"><span><strong>Restaurar demonstração</strong><small>Voltar aos dados fictícios originais</small></span><span>›</span></button>
        <div class="more-item"><span><strong>Armazenamento local</strong><small>Nesta fase os dados ficam somente neste navegador</small></span><span>Local</span></div>
        <div class="more-item"><span><strong>Firebase</strong><small>Será conectado depois da validação visual</small></span><span>Em breve</span></div>
        <div class="more-item"><span><strong>Versão</strong><small>Atualizações verificadas automaticamente</small></span><span>${SOBRA_VERSION}</span></div>
      </div>
    </section>`;
  }

  function render(){
    const app=document.getElementById('app');
    if(!app)return;
    app.innerHTML=state.page==='transactions'?renderTransactions():state.page==='calendar'?renderCalendar():state.page==='more'?renderMore():renderHome();
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
  function openEntryModal(type='expense'){
    state.entryType=type;
    openModal('Novo lançamento','Adicione uma receita ou despesa ao mês.',
      `<div class="form-grid">
        <div class="segmented"><button data-entry-type="expense" class="${type==='expense'?'active':''}">Despesa</button><button data-entry-type="income" class="${type==='income'?'active':''}">Receita</button></div>
        <div class="field"><label>Descrição</label><input class="input" id="entryDescription" placeholder="Ex.: Internet" autocomplete="off"></div>
        <div class="field-row"><div class="field"><label>Valor</label><input class="input" id="entryAmount" inputmode="decimal" placeholder="0,00"></div><div class="field"><label>Data</label><input class="input" id="entryDate" type="date" value="${entryDate()}"></div></div>
        <div class="field-row"><div class="field"><label>Categoria</label><select class="select" id="entryCategory">${['Casa','Alimentação','Transporte','Saúde','Educação','Assinaturas','Lazer','Compras','Contas','Outros','Receitas'].map(c=>`<option>${c}</option>`).join('')}</select></div><div class="field"><label>Tipo</label><select class="select" id="entryMode"><option value="single">Único</option><option value="recurring">Recorrente</option><option value="installment">Parcelado</option></select></div></div>
        <div class="field"><label>Status</label><select class="select" id="entryStatus"></select></div>
        <div id="installmentFields"></div>
        <div class="field"><label>Observações</label><textarea class="textarea" id="entryNotes" placeholder="Opcional"></textarea></div>
        <p class="helper">Protótipo local: nada é enviado para a internet nesta fase.</p>
      </div>`,
      '<button class="btn btn-secondary" data-close-modal>Cancelar</button><button class="btn btn-primary" id="saveEntry">Salvar lançamento</button>');
    updateEntryFields();
  }
  function updateEntryFields(){
    const status=document.getElementById('entryStatus');
    const category=document.getElementById('entryCategory');
    if(!status)return;
    status.innerHTML=state.entryType==='expense'
      ?'<option value="launched">Lançada</option><option value="scheduled">Agendada</option><option value="paid">Paga</option>'
      :'<option value="expected">Prevista</option><option value="received">Recebida</option>';
    if(category&&state.entryType==='income')category.value='Receitas';
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
      notes:document.getElementById('entryNotes').value.trim()
    };
    if(mode==='installment'){
      tx.installmentNumber=Number(document.getElementById('installmentNumber')?.value||1);
      tx.installmentTotal=Number(document.getElementById('installmentTotal')?.value||2);
    }
    state.transactions.push(tx);
    persist();closeModal();render();showToast('Lançamento salvo.');
  }

  function openTransaction(id){
    const t=state.transactions.find(x=>x.id===id);if(!t)return;
    openModal(escapeHtml(t.description),txMeta(t),
      `<div class="detail-total"><small>${t.type==='income'?'Valor da receita':'Valor do lançamento'}</small><strong>${money.format(t.amount)}</strong></div>
      <div class="detail-grid">
        <div class="detail-card"><small>Status</small><strong>${labelStatus(t)}</strong></div>
        <div class="detail-card"><small>Categoria</small><strong>${escapeHtml(t.category)}</strong></div>
        <div class="detail-card"><small>Data</small><strong>${shortDateFmt.format(new Date(`${t.dueDate}T12:00:00`))}</strong></div>
        <div class="detail-card"><small>Tipo</small><strong>${t.mode==='recurring'?'Recorrente':t.mode==='installment'?'Parcelado':'Único'}</strong></div>
      </div>
      ${t.notes?`<div class="detail-card" style="margin-top:9px"><small>Observações</small><strong>${escapeHtml(t.notes)}</strong></div>`:''}
      <div class="detail-actions">
        ${t.type==='expense'&&t.status!=='paid'?`<button class="btn btn-primary" data-mark-paid="${t.id}">Marcar como paga</button>`:''}
        ${t.type==='expense'&&t.status==='launched'?`<button class="btn btn-secondary" data-mark-scheduled="${t.id}">Marcar como agendada</button>`:''}
        <button class="btn btn-secondary" data-delete-tx="${t.id}">Excluir lançamento</button>
      </div>`,
      `<button class="btn btn-secondary" data-close-modal>Fechar</button><button class="btn btn-primary" data-duplicate-tx="${t.id}">Duplicar</button>`);
  }
  function updateTxStatus(id,status){
    const t=state.transactions.find(x=>x.id===id);if(!t)return;
    t.status=status;persist();closeModal();render();showToast(status==='paid'?'Pagamento marcado como pago.':'Pagamento marcado como agendado.');
  }
  function deleteTx(id){
    state.transactions=state.transactions.filter(x=>x.id!==id);
    persist();closeModal();render();showToast('Lançamento excluído.');
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
  function toggleTheme(){
    document.body.classList.toggle('dark');
    const dark=document.body.classList.contains('dark');
    localStorage.setItem(THEME_KEY,dark?'dark':'light');
    document.getElementById('themeIcon').textContent=dark?'☀':'☾';
  }
  function restoreTheme(){
    if(localStorage.getItem(THEME_KEY)==='dark')document.body.classList.add('dark');
    document.getElementById('themeIcon').textContent=document.body.classList.contains('dark')?'☀':'☾';
  }
  function resetData(){
    localStorage.removeItem(STORAGE_KEY);
    state.transactions=seedTransactions();
    persist();render();showToast('Dados de demonstração restaurados.');
  }
  function escapeHtml(value=''){return String(value).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
  function escapeAttr(value=''){return escapeHtml(value)}

  document.addEventListener('click',e=>{
    const nav=e.target.closest('[data-nav]');if(nav){navigate(nav.dataset.nav);return}
    const month=e.target.closest('[data-month]');if(month){changeMonth(Number(month.dataset.month));return}
    const filter=e.target.closest('[data-filter]');if(filter){state.filter=filter.dataset.filter;render();return}
    const calendarDay=e.target.closest('[data-calendar-date]');if(calendarDay){state.calendarDate=calendarDay.dataset.calendarDate;render();return}
    const tx=e.target.closest('[data-open-tx]');if(tx){openTransaction(tx.dataset.openTx);return}
    if(e.target.closest('#newEntryBtn')){openEntryModal('expense');return}
    if(e.target.closest('[data-close-modal]')){closeModal();return}
    const backdrop=e.target.closest('[data-modal-backdrop]');if(backdrop&&e.target===backdrop){closeModal();return}
    const type=e.target.closest('[data-entry-type]');if(type){state.entryType=type.dataset.entryType;updateEntryFields();return}
    if(e.target.closest('#saveEntry')){saveEntry();return}
    const paid=e.target.closest('[data-mark-paid]');if(paid){updateTxStatus(paid.dataset.markPaid,'paid');return}
    const scheduled=e.target.closest('[data-mark-scheduled]');if(scheduled){updateTxStatus(scheduled.dataset.markScheduled,'scheduled');return}
    const del=e.target.closest('[data-delete-tx]');if(del){deleteTx(del.dataset.deleteTx);return}
    const dup=e.target.closest('[data-duplicate-tx]');if(dup){duplicateTx(dup.dataset.duplicateTx);return}
    if(e.target.closest('[data-apply-update]')){applyReleaseUpdate();return}
    if(e.target.closest('[data-dismiss-update]')){dismissReleaseUpdate();return}
    if(e.target.closest('#themeToggle')||e.target.closest('#themeMenu')){toggleTheme();return}
    if(e.target.closest('#resetData')){resetData();return}
  });
  document.addEventListener('input',e=>{
    if(e.target.id==='searchInput'){state.search=e.target.value;const list=document.querySelector('.transaction-list');if(list){const txs=filteredTransactions();list.innerHTML=txs.length?txs.map(txItem).join(''):'<div class="empty-state"><strong>Nenhum lançamento</strong>Tente outro termo.</div>'}}
  });
  document.addEventListener('change',e=>{if(e.target.id==='entryMode')updateInstallmentFields()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});

  restoreTheme();
  render();
  startReleaseMonitor();
})();