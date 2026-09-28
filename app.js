const H = (window.PARTNER_HEADERS || []).map(h => String(h ?? '').trim());
const RAW_ROWS = window.PARTNER_ROWS || [];
const META = window.PARTNER_META || {};
const NAV = window.PARTNER_NAV || [];
const normalizeValue = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const clean = value => normalizeValue(value).toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const headerIndex = name => H.findIndex(h => normalizeValue(h) === name);
const REQUIRED_HEADERS = ['NOMBRE','F_INGRESO','CECO','NOM_CCOSTO','TURNO','NOM_PUESTO','REGION','DM','CUMPLE_MMDD'];
const missingHeaders = REQUIRED_HEADERS.filter(name => headerIndex(name) < 0);
if(missingHeaders.length) throw new Error(`Encabezados no encontrados en Query.xlsx: ${missingHeaders.join(', ')}`);
const valueAt = (row, name) => normalizeValue(row[headerIndex(name)]);
const R = RAW_ROWS.map(row => ({
  nombre:valueAt(row,'NOMBRE'), ingreso:valueAt(row,'F_INGRESO'), ceco:valueAt(row,'CECO'),
  tienda:valueAt(row,'NOM_CCOSTO'), turno:valueAt(row,'TURNO'), puesto:valueAt(row,'NOM_PUESTO'),
  region:valueAt(row,'REGION'), nac:valueAt(row,'CUMPLE_MMDD'), dm:valueAt(row,'DM')
})).filter(x => x.nombre);
const rowIds = new Map(R.map((row,index) => [row,index]));

const FILTER_IDS = ['pRegion','pDM','pStore','pRole','pShift','aRegion','aDM','aStore','aMonth','bRegion','bDM','bStore','bMonth'];
const STORAGE_KEY = 'partnerHub.filters.v5';
const MAX_REGISTROS = 30;
const months = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const today = new Date(); today.setHours(0,0,0,0);
const currentMonth = today.getMonth() + 1, currentYear = today.getFullYear();
const dataMonth = Number(META.month) || currentMonth;
const $ = id => document.getElementById(id);
const same = (a,b) => clean(a) === clean(b);
const uniq = values => {
  const map = new Map();
  values.map(normalizeValue).filter(Boolean).forEach(value => { const key=clean(value); if(!map.has(key)) map.set(key,value); });
  return [...map.values()].sort((a,b)=>a.localeCompare(b,'es',{sensitivity:'base'}));
};
const navRegions = () => NAV.length ? NAV.map(region=>region.name) : uniq(R.map(x=>x.region));
const navDMs = region => {
  if(!NAV.length)return uniq(R.filter(x=>!region||same(x.region,region)).map(x=>x.dm));
  const regions=region?NAV.filter(item=>same(item.name,region)):NAV;
  return uniq(regions.flatMap(item=>item.dms.map(dm=>dm.name)));
};
const navStores = (region,dm) => {
  if(!NAV.length)return uniq(R.filter(x=>(!region||same(x.region,region))&&(!dm||same(x.dm,dm))).map(x=>x.tienda));
  const regions=region?NAV.filter(item=>same(item.name,region)):NAV;
  return uniq(regions.flatMap(item=>item.dms.filter(item=>!dm||same(item.name,dm)).flatMap(item=>item.stores)));
};
const roleOrder = ['Gerente','Subgerente','Supervisor','Barista','Otros'];
const roleName = p => /sub/i.test(p) ? 'Subgerente' : /super/i.test(p) ? 'Supervisor' : /bar/i.test(p) ? 'Barista' : /gerente/i.test(p) ? 'Gerente' : 'Otros';
const roleRank = p => { const i=roleOrder.indexOf(roleName(p)); return i>=0?i:9; };
const esc = s => String(s || '').replace(/[&<>\"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[m]));
function dateParts(s){ if(!s)return null; const d=new Date((s.startsWith('--')?'2000-'+s.slice(2):s)+'T00:00:00'); return isNaN(d)?null:{d,day:d.getDate(),month:d.getMonth()+1,year:d.getFullYear()}; }
function fillSelect(el,items,all='Todos'){
  if(!el)return; const previous=normalizeValue(el.value), values=uniq(items);
  el.innerHTML=`<option value="">${all}</option>`+values.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
  const match=values.find(x=>same(x,previous)); el.value=match||''; refreshSlicer(el);
}
function fillDatalist(){ }
function monthOptions(el){ el.innerHTML=`<option value="">Todos</option>`+months.map((m,i)=>`<option value="${i+1}" ${i+1===dataMonth?'selected':''}>${m}</option>`).join(''); }
function enhanceSelect(select){
  if(!select||select.dataset.enhanced)return; select.dataset.enhanced='true'; select.classList.add('native-slicer');
  const shell=document.createElement('div'); shell.className='slicer';
  shell.innerHTML='<button type="button" class="slicer-trigger" aria-expanded="false"><span>Todos</span><i>⌄</i></button><div class="slicer-menu"><div class="slicer-tools"><input type="search" placeholder="Buscar..." aria-label="Buscar opción"><button type="button" class="slicer-clear" title="Limpiar selección">Limpiar</button></div><div class="slicer-options"></div></div>';
  select.after(shell); const trigger=shell.querySelector('.slicer-trigger'), search=shell.querySelector('input'), clear=shell.querySelector('.slicer-clear');
  trigger.addEventListener('click',e=>{e.stopPropagation();document.querySelectorAll('.slicer.open').forEach(x=>x!==shell&&x.classList.remove('open'));shell.classList.toggle('open');trigger.setAttribute('aria-expanded',shell.classList.contains('open'));if(shell.classList.contains('open'))search.focus();});
  search.addEventListener('input',()=>refreshSlicer(select,search.value));
  clear.addEventListener('click',()=>{select.value='';select.dispatchEvent(new Event('input',{bubbles:true}));shell.classList.remove('open');});
  refreshSlicer(select);
}
function refreshSlicer(select,term=''){
  if(!select||!select.dataset.enhanced)return; const shell=select.nextElementSibling; if(!shell?.classList.contains('slicer'))return;
  const current=normalizeValue(select.value),q=clean(term),options=[...select.options].filter(o=>!q||clean(o.textContent).includes(q));
  shell.querySelector('.slicer-trigger span').textContent=select.selectedOptions[0]?.textContent||'Todos';
  shell.querySelector('.slicer-options').innerHTML=options.map(o=>`<button type="button" class="slicer-option ${same(o.value,current)?'active':''}" data-value="${esc(o.value)}"><span>${esc(o.textContent)}</span>${same(o.value,current)?'<b>✓</b>':''}</button>`).join('')||'<small class="slicer-empty">Sin coincidencias</small>';
  shell.querySelectorAll('.slicer-option').forEach(btn=>btn.addEventListener('click',()=>{select.value=btn.dataset.value;select.dispatchEvent(new Event('input',{bubbles:true}));shell.classList.remove('open');}));
}
function persistFilters(){const state={};FILTER_IDS.forEach(id=>{if($(id))state[id]=$(id).value;});try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}catch(_){}}
function restoreFilters(){
  let state={};try{state=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');}catch(_){}
  ['pRegion','aRegion','bRegion','aMonth','bMonth'].forEach(id=>{if($(id)&&[...$(id).options].some(o=>same(o.value,state[id])))$(id).value=[...$(id).options].find(o=>same(o.value,state[id]))?.value||'';});
  ['p','a','b'].forEach(prefix=>{cascade(prefix);const dm=$(prefix+'DM'),store=$(prefix+'Store');if(dm&&[...dm.options].some(o=>same(o.value,state[prefix+'DM'])))dm.value=[...dm.options].find(o=>same(o.value,state[prefix+'DM']))?.value||'';cascade(prefix);if(store&&[...store.options].some(o=>same(o.value,state[prefix+'Store'])))store.value=[...store.options].find(o=>same(o.value,state[prefix+'Store']))?.value||'';});
  if($('pRole')&&[...$('pRole').options].some(o=>same(o.value,state.pRole)))$('pRole').value=[...$('pRole').options].find(o=>same(o.value,state.pRole))?.value||'';
  if($('pShift')&&[...$('pShift').options].some(o=>same(o.value,state.pShift)))$('pShift').value=[...$('pShift').options].find(o=>same(o.value,state.pShift))?.value||'';
  cascade('p'); FILTER_IDS.forEach(id=>refreshSlicer($(id)));
}
document.addEventListener('click',()=>document.querySelectorAll('.slicer.open').forEach(x=>x.classList.remove('open')));
function layoutClass(count){return count<=8?'premium':count<=16?'sixteen':count<=24?'medium':'compact';}
function chunk(arr,size){return Array.from({length:Math.ceil(arr.length/size)},(_,i)=>arr.slice(i*size,i*size+size));}
function monthShort(n){return months[n-1].slice(0,3).toUpperCase();}
let activePanel = 'partner';
let renderTimer = 0;
function activateTab(panelId,{focus=false,updateHash=true}={}){
  if(!['partner','anniv','birth'].includes(panelId))panelId='partner';
  activePanel=panelId;
  document.querySelectorAll('.tab').forEach(button=>{
    const selected=button.dataset.tab===panelId;
    button.classList.toggle('active',selected);button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;
  });
  document.querySelectorAll('.panel').forEach(panel=>panel.classList.toggle('active',panel.id===panelId));
  if(updateHash)history.replaceState(null,'',`#${panelId}`);
  renderActive();
  if(focus)$(panelId)?.focus({preventScroll:true});
}
function renderActive(){
  if(activePanel==='partner'){renderPartner();renderWeeklyBirthdays();}
  else if(activePanel==='anniv')renderCeleb('a');
  else renderCeleb('b');
}
function scheduleRender(id){
  clearTimeout(renderTimer);
  const isSearch=['pSearch','aSearch','bSearch'].includes(id);
  if(isSearch)renderTimer=setTimeout(renderActive,120);else renderActive();
}
function init(){
  const status=$('dataStatus');if(status)status.textContent=META.generatedOn?`Carga validada ${new Date(META.generatedOn+'T00:00:00').toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'}).replace(/\./g,'')}`:'Datos no disponibles';
  const scope=$('dataScope');if(scope)scope.textContent=META.publishedRows?`${META.publishedRows.toLocaleString('es-MX')} partners · ${META.stores} tiendas · ${META.regions} región${META.regions===1?'':'es'}`:'Sin datos validados';
  $('hierarchy').addEventListener('click',event=>{const button=event.target.closest('[data-partner-index]');if(button){const person=R[Number(button.dataset.partnerIndex)];if(person)showDetail(person);}});
  const tabs=[...document.querySelectorAll('.tab')];
  tabs.forEach((button,index)=>{
    button.onclick=()=>activateTab(button.dataset.tab,{focus:true});
    button.onkeydown=event=>{let target=index;if(event.key==='ArrowRight')target=(index+1)%tabs.length;else if(event.key==='ArrowLeft')target=(index-1+tabs.length)%tabs.length;else if(event.key==='Home')target=0;else if(event.key==='End')target=tabs.length-1;else return;event.preventDefault();tabs[target].focus();activateTab(tabs[target].dataset.tab);};
  });
  ['pRegion','aRegion','bRegion'].forEach(id=>fillSelect($(id),navRegions(),'Todos'));
  ['aMonth','bMonth'].forEach(id=>monthOptions($(id)));
  fillSelect($('pRole'),R.map(x=>x.puesto),'Todos'); fillSelect($('pShift'),R.map(x=>x.turno),'Todos');
  FILTER_IDS.forEach(id=>enhanceSelect($(id))); restoreFilters();
  ['pRegion','pDM','pStore','pRole','pShift','pSearch','aRegion','aDM','aStore','aMonth','aSearch','bRegion','bDM','bStore','bMonth','bSearch'].forEach(id=>$(id)?.addEventListener('input',()=>{persistFilters();scheduleRender(id);}));
  const initial=location.hash.slice(1);activateTab(['partner','anniv','birth'].includes(initial)?initial:'partner',{updateHash:false});
  window.addEventListener('hashchange',()=>activateTab(location.hash.slice(1),{updateHash:false}));
  if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js?v=partner-hub-v6');
}
function geographicBase(prefix){
  const region=$(prefix+'Region')?.value||'',dm=$(prefix+'DM')?.value||'',store=$(prefix+'Store')?.value||'';
  return R.filter(x=>(!region||same(x.region,region))&&(!dm||same(x.dm,dm))&&(!store||same(x.tienda,store)));
}
function cascade(prefix){
  const region=$(prefix+'Region')?.value||'',oldDM=$(prefix+'DM')?.value||'',storeEl=$(prefix+'Store'),oldStore=storeEl?.value||'';
  const dms=navDMs(region); fillSelect($(prefix+'DM'),dms,'Todos');
  const dmMatch=dms.find(x=>same(x,oldDM)); if(dmMatch)$(prefix+'DM').value=dmMatch;
  const stores=navStores(region,$(prefix+'DM')?.value||''); fillSelect(storeEl,stores,'Todos');
  const storeMatch=stores.find(x=>same(x,oldStore)); if(storeEl)storeEl.value=storeMatch||''; refreshSlicer(storeEl);
  if(prefix==='p'){
    const roleEl=$('pRole'),shiftEl=$('pShift'),oldRole=roleEl?.value||'',oldShift=shiftEl?.value||'',geo=geographicBase('p');
    const positions=uniq(geo.filter(x=>!oldShift||same(x.turno,oldShift)).map(x=>x.puesto)); fillSelect(roleEl,positions,'Todos');
    const roleMatch=positions.find(x=>same(x,oldRole)); if(roleMatch)roleEl.value=roleMatch;
    const shifts=uniq(geo.filter(x=>!roleEl?.value||same(x.puesto,roleEl.value)).map(x=>x.turno)); fillSelect(shiftEl,shifts,'Todos');
    const shiftMatch=shifts.find(x=>same(x,oldShift)); if(shiftMatch)shiftEl.value=shiftMatch;
    refreshSlicer(roleEl);refreshSlicer(shiftEl);
  }
}
function filterBase(prefix){const region=$(prefix+'Region')?.value||'',dm=$(prefix+'DM')?.value||'',store=$(prefix+'Store')?.value||'';return R.filter(x=>(!region||same(x.region,region))&&(!dm||same(x.dm,dm))&&(!store||same(x.tienda,store)));}
function roleCounts(data){return Object.fromEntries(roleOrder.map(r=>[r,data.filter(x=>roleName(x.puesto)===r).length]));}
function barRows(counts){const max=Math.max(1,...Object.values(counts));return Object.entries(counts).filter(([k])=>k!=='Otros'||counts[k]>0).map(([r,c])=>`<div class="barRow"><b>${esc(r)}</b><span>${c}</span><div><i style="width:${c/max*100}%"></i></div></div>`).join('');}
function renderPartner(){
  cascade('p'); const data=filteredPartnerData();
  const stores=uniq(data.map(x=>x.tienda)),dms=uniq(data.map(x=>x.dm)),rc=roleCounts(data);
  $('kPartners').textContent=data.length;$('kStores').textContent=stores.length;$('kDMs').textContent=dms.length;$('kGerentes').textContent=rc.Gerente;$('kSup').textContent=rc.Supervisor;$('kBar').textContent=rc.Barista;
  $('storeTitle').textContent=$('pStore').value||'Resumen Partner';$('storeMeta').textContent=[$('pRegion').value||'Todas las regiones',$('pDM').value||'Todos los DM',$('pRole').value||'Todas las posiciones',$('pShift').value||'Todos los turnos'].join(' · ');
  $('roleBars').innerHTML=barRows(rc);const grouped={};
  data.sort((a,b)=>roleRank(a.puesto)-roleRank(b.puesto)||a.nombre.localeCompare(b.nombre,'es')).forEach(x=>(grouped[roleName(x.puesto)]??=[]).push(x));
  $('hierarchy').innerHTML=roleOrder.filter(r=>r!=='Otros'||(grouped[r]||[]).length).map(r=>{const arr=grouped[r]||[];return `<article class="role"><h2>${r==='Barista'?'Baristas':r}<span class="badge">${arr.length}</span></h2>${arr.map(personCard).join('')||'<small>Sin partners</small>'}</article>`;}).join('');
}
function filteredPartnerData(){
  const role=$('pRole').value,shift=$('pShift').value,search=clean($('pSearch').value);
  return filterBase('p').filter(x=>(!role||same(x.puesto,role))&&(!shift||same(x.turno,shift))&&(!search||clean(`${x.nombre} ${x.ceco} ${x.tienda} ${x.puesto} ${x.turno}`).includes(search)));
}
function mondayOfWeek(value){const d=new Date(value);d.setHours(0,0,0,0);d.setDate(d.getDate()-((d.getDay()+6)%7));return d;}
function addCalendarDays(value,days){const d=new Date(value);d.setDate(d.getDate()+days);return d;}
function birthdayInWeek(value,start,end){
  const p=dateParts(value);if(!p)return null;
  for(let year=start.getFullYear();year<=end.getFullYear();year++){
    const occurrence=new Date(year,p.month-1,p.day);
    if(occurrence.getMonth()!==p.month-1||occurrence.getDate()!==p.day)continue;
    if(occurrence>=start&&occurrence<=end)return occurrence;
  }
  return null;
}
function shortLocalDate(value){return value.toLocaleDateString('es-MX',{weekday:'short',day:'numeric',month:'short'}).replace(/\./g,'');}
function renderWeeklyBirthdays(referenceDate=new Date()){
  const current=new Date(referenceDate);current.setHours(0,0,0,0);
  const start=mondayOfWeek(current),end=addCalendarDays(start,6);
  const birthdays=filteredPartnerData().map(partner=>({partner,date:birthdayInWeek(partner.nac,start,end)})).filter(item=>item.date).sort((a,b)=>a.date-b.date||a.partner.nombre.localeCompare(b.partner.nombre,'es'));
  $('weeklyBirthdaysRange').textContent=`Semana del ${shortLocalDate(start)} al ${shortLocalDate(end)}`;
  $('weeklyBirthdaysMessage').textContent=birthdays.length?'Celebremos y hagamos sentir especial a cada partner.':'Esta semana no hay cumpleaños en los filtros seleccionados.';
  $('weeklyBirthdaysList').innerHTML=birthdays.map(({partner,date})=>`<article class="weekly-birthday-card"><div class="weekly-birthday-date"><b>${date.getDate()}</b><span>${date.toLocaleDateString('es-MX',{month:'short'}).replace(/\./g,'')}</span></div><div><h3>${esc(partner.nombre)}</h3><p>${esc(partner.tienda)}</p><span>${esc(partner.puesto)}</span></div>${date.getTime()===current.getTime()?'<strong class="today-badge">Hoy</strong>':''}</article>`).join('');
}
function personCard(x){return `<button type="button" class="person" data-partner-index="${rowIds.get(x)}"><span><b>${esc(x.nombre)}</b><small>${esc(x.ceco)} · ${esc(x.puesto)} · ${esc(x.tienda)}</small></span><span class="badge">${esc(x.turno)}</span></button>`;}
function yearsAt(s){const p=dateParts(s);if(!p)return 0;let y=currentYear-p.year;const anniv=new Date(currentYear,p.month-1,p.day);if(today<anniv)y--;return Math.max(0,y);}
function anniversaryYears(s){const p=dateParts(s);if(!p)return 0;const y=currentYear-p.year;return y>=1?y:0;}
function filteredCelebrations(type){const pre=type==='a'?'a':'b';cascade(pre);const month=$(pre+'Month').value,search=clean($(pre+'Search').value);return filterBase(pre).filter(x=>{const p=dateParts(type==='a'?x.ingreso:x.nac);return p&&(!month||p.month===+month)&&(type!=='a'||anniversaryYears(x.ingreso)>=1)&&(!search||clean(`${x.nombre} ${x.ceco} ${x.tienda} ${x.puesto}`).includes(search));}).sort((x,y)=>{const px=dateParts(type==='a'?x.ingreso:x.nac),py=dateParts(type==='a'?y.ingreso:y.nac);return px.month-py.month||px.day-py.day||x.nombre.localeCompare(y.nombre,'es');});}
function summaryCards(data,type){const stores=uniq(data.map(x=>x.tienda)).length,partners=data.length,dms=uniq(data.map(x=>x.dm)).length,measure=type==='a'?(data.length?Math.round(data.reduce((s,x)=>s+anniversaryYears(x.ingreso),0)/data.length):0):new Set(data.map(x=>x.nac)).size;return `<div class="summary-cards"><div><b>${type==='a'?'🏆':'🎂'}</b><span>${partners}</span><small>${type==='a'?'Aniversarios':'Cumpleaños'}</small></div><div><b>🏪</b><span>${stores}</span><small>Tiendas</small></div><div><b>👥</b><span>${dms}</span><small>DM</small></div><div><b>${type==='a'?'⭐':'🎈'}</b><span>${measure}</span><small>${type==='a'?'Años prom.':'Días a celebrar'}</small></div></div>`;}
function celebrationCard(x,type){const p=dateParts(type==='a'?x.ingreso:x.nac),val=anniversaryYears(x.ingreso);return `<div class="celebration"><div class="day"><b>${String(p.day).padStart(2,'0')}</b><span>${monthShort(p.month)}</span></div><div class="who"><b title="${esc(x.nombre)}">${esc(x.nombre)}</b><small>${esc(x.puesto)}</small><small>${esc(x.tienda)}</small></div><div class="years"><b>${type==='a'?`${val} ${val==1?'año':'años'}`:'🎉'}</b><small>${type==='a'?'en la marca':'felicidades'}</small></div></div>`;}
function renderCeleb(type){const pre=type==='a'?'a':'b',monthVal=$(pre+'Month').value,data=filteredCelebrations(type),totalPages=Math.max(1,Math.ceil(data.length/MAX_REGISTROS));$(pre+'Count').textContent=`${data.length} ${type==='a'?'aniversarios':'cumpleaños'} · ${totalPages} página${totalPages===1?'':'s'}`;const pages=data.length?chunk(data,MAX_REGISTROS):[[]],monthTitle=monthVal?months[+monthVal-1]:'Todo el año',title=type==='a'?'Celebramos tu Trayectoria':'Que tengas un día extraordinario',subtitle=type==='a'?'Gracias por crecer con nosotros':'Gracias por inspirarnos cada día';$(pre+'Slides').innerHTML=summaryCards(data,type).replace('summary-cards','capture-insights')+pages.map((arr,i)=>{const pageClass=layoutClass(arr.length),empty='<div class="celebration empty"><div class="who"><b>Sin registros para este filtro</b><small>Ajusta Región, DM, Tienda o Mes.</small></div></div>';return `<div class="slide ${type==='a'?'anniv':'birth'} ${pageClass}"><img class="templateImg" src="assets/${type==='a'?'anniversary':'birthday'}-template.png" alt="Plantilla"><h3>${esc(monthTitle)}</h3><div class="slideMessage"><b>${title}</b><span>${subtitle}</span></div><div class="celebrationList">${arr.map(x=>celebrationCard(x,type)).join('')||empty}</div><div class="miniSeal ${type==='a'?'annivSeal':'birthdaySeal'}"><span>${type==='a'?'🏆':'🎂'}</span><b>${type==='a'?'Celebramos tu Trayectoria':'Cumpleaños'}</b></div><div class="pageNumber">Página ${i+1} de ${totalPages}</div></div>`;}).join('');}
function printPanel(id){document.body.dataset.printPanel=id;setTimeout(()=>window.print(),50);}
function renderAll(){renderPartner();renderWeeklyBirthdays();renderCeleb('a');renderCeleb('b');}
function showDetail(x){$('detailBody').innerHTML=`<h2>${esc(x.nombre)}</h2><p><b>Puesto:</b> ${esc(x.puesto)}</p><p><b>Tienda:</b> ${esc(x.tienda)} · CeCo ${esc(x.ceco)}</p><p><b>DM:</b> ${esc(x.dm)}</p><p><b>Región:</b> ${esc(x.region)}</p><p><b>Jornada:</b> ${esc(x.turno)}</p><p><b>Ingreso:</b> ${esc(x.ingreso)} · ${yearsAt(x.ingreso)} años en la marca</p>`;$('detail').showModal();}
init();
