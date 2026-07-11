const H = window.PARTNER_HEADERS || [];
const normalizeValue = value => String(value ?? '').trim();
const R = (window.PARTNER_ROWS || [])
  .map(r => Object.fromEntries(H.map((h, i) => [h, normalizeValue(r[i])])))
  .filter(x => x.nombre);

const FILTER_IDS = ['pRegion','pDM','pStore','pRole','aRegion','aDM','aStore','aMonth','bRegion','bDM','bStore','bMonth'];
const STORAGE_KEY = 'partnerHub.filters.v2';

const MAX_REGISTROS = 30;
const months = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const today = new Date();
today.setHours(0,0,0,0);
const currentMonth = today.getMonth() + 1;
const currentYear = today.getFullYear();
const $ = id => document.getElementById(id);
const uniq = a => [...new Set(a.map(normalizeValue).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es',{sensitivity:'base'}));
const roleOrder = ['Gerente','Subgerente','Supervisor','Barista','Otros'];

const clean = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const roleName = p => /sub/i.test(p) ? 'Subgerente' : /super/i.test(p) ? 'Supervisor' : /bar/i.test(p) ? 'Barista' : /gerente/i.test(p) ? 'Gerente' : 'Otros';
const roleRank = p => { const i = roleOrder.indexOf(roleName(p)); return i >= 0 ? i : 9; };
const esc = s => String(s || '').replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));

function dateParts(s){ if(!s) return null; const d = new Date(s + 'T00:00:00'); return isNaN(d) ? null : {d, day:d.getDate(), month:d.getMonth()+1, year:d.getFullYear()}; }
function fillSelect(el, items, all='Todos'){
  if(!el) return;
  const previous = normalizeValue(el.value);
  el.innerHTML = `<option value="">${all}</option>` + uniq(items).map(x => `<option value="${esc(x)}">${esc(x)}</option>`).join('');
  el.value = [...el.options].some(o => o.value === previous) ? previous : '';
  refreshSlicer(el);
}
function fillDatalist(){ /* Compatibilidad con versiones anteriores. */ }
function monthOptions(el){ el.innerHTML = `<option value="">Todos</option>` + months.map((m,i)=>`<option value="${i+1}" ${i+1===currentMonth?'selected':''}>${m}</option>`).join(''); }

function enhanceSelect(select){
  if(!select || select.dataset.enhanced) return;
  select.dataset.enhanced = 'true';
  select.classList.add('native-slicer');
  const shell = document.createElement('div');
  shell.className = 'slicer';
  shell.innerHTML = `<button type="button" class="slicer-trigger" aria-expanded="false"><span>Todos</span><i>⌄</i></button><div class="slicer-menu"><div class="slicer-tools"><input type="search" placeholder="Buscar..." aria-label="Buscar opción"><button type="button" class="slicer-clear" title="Limpiar selección">Limpiar</button></div><div class="slicer-options"></div></div>`;
  select.after(shell);
  const trigger=shell.querySelector('.slicer-trigger'), menu=shell.querySelector('.slicer-menu'), search=shell.querySelector('input'), clear=shell.querySelector('.slicer-clear');
  trigger.addEventListener('click', e => { e.stopPropagation(); document.querySelectorAll('.slicer.open').forEach(x=>x!==shell&&x.classList.remove('open')); shell.classList.toggle('open'); trigger.setAttribute('aria-expanded', shell.classList.contains('open')); if(shell.classList.contains('open')) search.focus(); });
  search.addEventListener('input', () => refreshSlicer(select, search.value));
  clear.addEventListener('click', () => { select.value=''; select.dispatchEvent(new Event('input',{bubbles:true})); shell.classList.remove('open'); });
  shell._select = select;
  refreshSlicer(select);
}
function refreshSlicer(select, term=''){
  if(!select || !select.dataset.enhanced) return;
  const shell=select.nextElementSibling;
  if(!shell?.classList.contains('slicer')) return;
  const current=normalizeValue(select.value), q=clean(term), options=[...select.options].filter(o=>!q||clean(o.textContent).includes(q));
  shell.querySelector('.slicer-trigger span').textContent = select.selectedOptions[0]?.textContent || 'Todos';
  shell.querySelector('.slicer-options').innerHTML = options.map(o=>`<button type="button" class="slicer-option ${o.value===current?'active':''}" data-value="${esc(o.value)}"><span>${esc(o.textContent)}</span>${o.value===current?'<b>✓</b>':''}</button>`).join('') || '<small class="slicer-empty">Sin coincidencias</small>';
  shell.querySelectorAll('.slicer-option').forEach(btn=>btn.addEventListener('click',()=>{ select.value=btn.dataset.value; select.dispatchEvent(new Event('input',{bubbles:true})); shell.classList.remove('open'); }));
}
function persistFilters(){
  const state={}; FILTER_IDS.forEach(id=>{ if($(id)) state[id]=$(id).value; });
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }catch(_){ }
}
function restoreFilters(){
  let state={}; try{ state=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}'); }catch(_){ }
  ['pRegion','aRegion','bRegion','pRole','aMonth','bMonth'].forEach(id=>{ if($(id)&&[...$(id).options].some(o=>o.value===state[id])) $(id).value=state[id]; });
  ['p','a','b'].forEach(prefix=>{ cascade(prefix); const dm=$(prefix+'DM'), store=$(prefix+'Store'); if(dm&&[...dm.options].some(o=>o.value===state[prefix+'DM'])) dm.value=state[prefix+'DM']; cascade(prefix); if(store&&[...store.options].some(o=>o.value===state[prefix+'Store'])) store.value=state[prefix+'Store']; });
  FILTER_IDS.forEach(id=>refreshSlicer($(id)));
}
document.addEventListener('click',()=>document.querySelectorAll('.slicer.open').forEach(x=>x.classList.remove('open')));

function layoutClass(count){ if(count <= 8) return 'premium'; if(count <= 16) return 'sixteen'; if(count <= 24) return 'medium'; return 'compact'; }
function chunk(arr, size){ return Array.from({length: Math.ceil(arr.length / size)}, (_, i) => arr.slice(i*size, i*size + size)); }
function monthShort(n){ return months[n-1].slice(0,3).toUpperCase(); }

function init(){
  document.querySelectorAll('.tab').forEach(b => b.onclick = () => {
    document.querySelectorAll('.tab,.panel').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    $(b.dataset.tab).classList.add('active');
  });
  ['pRegion','aRegion','bRegion'].forEach(id => fillSelect($(id), R.map(x=>x.region), 'Todos'));
  ['aMonth','bMonth'].forEach(id => monthOptions($(id)));
  fillSelect($('pRole'), roleOrder.filter(x=>x!=='Otros'), 'Todos');
  FILTER_IDS.forEach(id => enhanceSelect($(id)));
  restoreFilters();
  ['pRegion','pDM','pStore','pRole','pSearch','aRegion','aDM','aStore','aMonth','aSearch','bRegion','bDM','bStore','bMonth','bSearch']
    .forEach(id => $(id)?.addEventListener('input', () => { persistFilters(); renderAll(); }));
  renderAll();
  if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js?v=region-filters-v2');
}

function cascade(prefix){
  const region = $(prefix+'Region')?.value || '';
  const oldDM = $(prefix+'DM')?.value || '';
  const storeEl = $(prefix+'Store');
  const oldStore = storeEl?.value || '';
  let list = R.filter(x => !region || x.region === region);
  const dms = uniq(list.map(x=>x.dm));
  fillSelect($(prefix+'DM'), dms, 'Todos');
  if(dms.includes(oldDM)) $(prefix+'DM').value = oldDM;
  list = list.filter(x => !$(prefix+'DM')?.value || x.dm === $(prefix+'DM').value);
  const stores = uniq(list.map(x=>x.tienda));
  fillSelect(storeEl, stores, 'Todos');
  if(storeEl) storeEl.value = stores.includes(oldStore) ? oldStore : '';
  refreshSlicer(storeEl);
}
function filterBase(prefix){
  const region = $(prefix+'Region')?.value || '', dm = $(prefix+'DM')?.value || '', store = $(prefix+'Store')?.value || '';
  return R.filter(x => (!region || x.region === region) && (!dm || x.dm === dm) && (!store || x.tienda === store));
}
function roleCounts(data){ return Object.fromEntries(roleOrder.map(r => [r, data.filter(x => roleName(x.puesto) === r).length])); }
function barRows(counts){ const max = Math.max(1, ...Object.values(counts)); return Object.entries(counts).filter(([k])=>k!=='Otros'||counts[k]>0).map(([r,c])=>`<div class="barRow"><b>${esc(r)}</b><span>${c}</span><div><i style="width:${c/max*100}%"></i></div></div>`).join(''); }
function ageCounts(data){
  const labels = ['De 18 a 20 años','De 21 a 29 años','De 30 a 39 años','De 40 a 49 años','De 50 a 59 años','Mas de 60 años'];
  const counts = Object.fromEntries(labels.map(l => [l,0]));
  data.forEach(x => { const r = clean((x.rango||'').replace(/\.$/,'')); const key = labels.find(l => r.includes(clean(l))); if(key) counts[key]++; });
  return counts;
}

function renderPartner(){
  cascade('p');
  let data = filterBase('p');
  const role = $('pRole').value, search = clean($('pSearch').value);
  data = data.filter(x => (!role || roleName(x.puesto) === role) && (!search || clean(`${x.nombre} ${x.num} ${x.tienda} ${x.puesto}`).includes(search)));
  const stores = uniq(data.map(x=>x.tienda)), dms = uniq(data.map(x=>x.dm)), rc = roleCounts(data);
  $('kPartners').textContent = data.length; $('kStores').textContent = stores.length; $('kDMs').textContent = dms.length;
  $('kGerentes').textContent = rc.Gerente; $('kSup').textContent = rc.Supervisor; $('kBar').textContent = rc.Barista;
  $('storeTitle').textContent = $('pStore').value || 'Resumen Partner';
  $('storeMeta').textContent = [$('pRegion').value || 'Todas las regiones', $('pDM').value || 'Todos los DM', $('pRole').value || 'Todas las posiciones'].join(' · ');
  const f = data.filter(x=>x.sexo==='F').length, m = data.filter(x=>x.sexo==='M').length, pct = data.length ? Math.round(f/data.length*100) : 0;
  $('donut').style.setProperty('--pct', pct); $('donutPct').textContent = pct + '%'; $('womenPct').textContent = pct + '% Mujeres'; $('menPct').textContent = (data.length ? Math.round(m/data.length*100) : 0) + '% Hombres';
  $('roleBars').innerHTML = barRows(rc); $('ageBars').innerHTML = barRows(ageCounts(data));
  const grouped = {};
  data.sort((a,b)=>roleRank(a.puesto)-roleRank(b.puesto)||a.nombre.localeCompare(b.nombre,'es')).forEach(x => (grouped[roleName(x.puesto)] ??= []).push(x));
  $('hierarchy').innerHTML = roleOrder.filter(r => r!=='Otros' || (grouped[r]||[]).length).map(r => { const arr = grouped[r] || []; return `<article class="role"><h2>${r==='Barista'?'Baristas':r}<span class="badge">${arr.length}</span></h2>${arr.map(personCard).join('') || '<small>Sin partners</small>'}</article>`; }).join('');
}
function personCard(x){ return `<div class="person" onclick='showDetail(${JSON.stringify(x).replaceAll("'","&#39;")})'><div><b>${esc(x.nombre)}</b><small>${esc(x.num)} · ${esc(x.puesto)} · ${esc(x.tienda)}</small></div><span class="badge">${esc(x.turno)}</span></div>`; }
function yearsAt(s){ const p = dateParts(s); if(!p) return 0; let y = currentYear - p.year; const anniv = new Date(currentYear, p.month-1, p.day); if(today < anniv) y--; return Math.max(0, y); }
function anniversaryYears(s){ const p = dateParts(s); if(!p) return 0; const y = currentYear - p.year; return y >= 1 ? y : 0; }
function birthdayAge(s){ const p = dateParts(s); if(!p) return ''; const a = currentYear - p.year; return Math.max(0, a); }
function ageAt(s){ const p = dateParts(s); if(!p) return ''; let a = currentYear - p.year; const bd = new Date(currentYear, p.month-1, p.day); if(today < bd) a--; return Math.max(0, a); }
function filteredCelebrations(type){
  const pre = type === 'a' ? 'a' : 'b'; cascade(pre);
  const month = $(pre+'Month').value, search = clean($(pre+'Search').value);
  return filterBase(pre).filter(x => {
    const p = dateParts(type === 'a' ? x.ingreso : x.nac);
    return p && (!month || p.month === +month) && (type !== 'a' || anniversaryYears(x.ingreso) >= 1) && (!search || clean(`${x.nombre} ${x.tienda} ${x.puesto} ${x.num}`).includes(search));
  }).sort((x,y) => { const px = dateParts(type==='a'?x.ingreso:x.nac), py = dateParts(type==='a'?y.ingreso:y.nac); return px.month-py.month || px.day-py.day || x.nombre.localeCompare(y.nombre,'es'); });
}
function summaryCards(data, type){
  const stores = uniq(data.map(x=>x.tienda)).length;
  const partners = data.length;
  const dms = uniq(data.map(x=>x.dm)).length;
  const avg = data.length ? Math.round(data.reduce((s,x)=>s+(type==='a'?anniversaryYears(x.ingreso):Number(birthdayAge(x.nac)||0)),0)/data.length) : 0;
  return `<div class="summary-cards"><div><b>${type==='a'?'🏆':'🎂'}</b><span>${partners}</span><small>${type==='a'?'Aniversarios':'Cumpleaños'}</small></div><div><b>🏪</b><span>${stores}</span><small>Tiendas</small></div><div><b>👥</b><span>${dms}</span><small>DM</small></div><div><b>${type==='a'?'⭐':'🎈'}</b><span>${avg}</span><small>${type==='a'?'Años prom.':'Edad prom.'}</small></div></div>`;
}
function celebrationCard(x, type){
  const p = dateParts(type === 'a' ? x.ingreso : x.nac), val = type === 'a' ? anniversaryYears(x.ingreso) : birthdayAge(x.nac);
  return `<div class="celebration"><div class="day"><b>${String(p.day).padStart(2,'0')}</b><span>${monthShort(p.month)}</span></div><div class="who"><b title="${esc(x.nombre)}">${esc(x.nombre)}</b><small>${esc(x.puesto)}</small><small>${esc(x.tienda)}</small></div><div class="years"><b>${val} ${val==1?'año':'años'}</b><small>${type==='a'?'en la marca':'edad'}</small></div></div>`;
}
function renderCeleb(type){
  const pre = type === 'a' ? 'a' : 'b';
  const monthVal = $(pre+'Month').value, data = filteredCelebrations(type);
  const totalPages = Math.max(1, Math.ceil(data.length / MAX_REGISTROS));
  $(pre+'Count').textContent = `${data.length} ${type==='a'?'aniversarios':'cumpleaños'} · ${totalPages} página${totalPages===1?'':'s'}`;
  const pages = data.length ? chunk(data, MAX_REGISTROS) : [[]];
  const monthTitle = monthVal ? months[+monthVal-1] : 'Todo el año';
  const title = type === 'a' ? 'Celebramos tu Trayectoria' : 'Que tengas un día extraordinario';
  const subtitle = type === 'a' ? 'Gracias por crecer con nosotros' : 'Gracias por inspirarnos cada día';
  $(pre+'Slides').innerHTML = summaryCards(data, type).replace('summary-cards','capture-insights') + pages.map((arr, i) => {
    const pageClass = layoutClass(arr.length);
    const empty = `<div class="celebration empty"><div class="who"><b>Sin registros para este filtro</b><small>Ajusta Región, DM, Tienda o Mes.</small></div></div>`;
    return `<div class="slide ${type==='a'?'anniv':'birth'} ${pageClass}">
      <img class="templateImg" src="assets/${type==='a'?'anniversary':'birthday'}-template.png" alt="Plantilla">
      <h3>${esc(monthTitle)}</h3><div class="slideMessage"><b>${title}</b><span>${subtitle}</span></div>
      <div class="celebrationList">${arr.map(x=>celebrationCard(x,type)).join('') || empty}</div>
      <div class="miniSeal ${type==='a'?'annivSeal':'birthdaySeal'}"><span>${type==='a'?'🏆':'🎂'}</span><b>${type==='a'?'Celebramos tu Trayectoria':'Cumpleaños'}</b></div>
      <div class="pageNumber">Página ${i+1} de ${totalPages}</div>
    </div>`;
  }).join('');
}
function printPanel(id){ document.body.dataset.printPanel = id; setTimeout(()=>window.print(), 50); }
function renderAll(){ renderPartner(); renderCeleb('a'); renderCeleb('b'); }
function showDetail(x){
  $('detailBody').innerHTML = `<h2>${esc(x.nombre)}</h2><p><b># Empleado:</b> ${esc(x.num)}</p><p><b>Puesto:</b> ${esc(x.puesto)}</p><p><b>Tienda:</b> ${esc(x.tienda)}</p><p><b>Centro de costos:</b> ${esc(x.cc)}</p><p><b>DM:</b> ${esc(x.dm)}</p><p><b>Región:</b> ${esc(x.region)}</p><p><b>Jornada:</b> ${esc(x.turno)}</p><p><b>Sexo:</b> ${x.sexo==='F'?'Femenino':x.sexo==='M'?'Masculino':esc(x.sexo)}</p><p><b>Edad:</b> ${esc(x.edad || ageAt(x.nac))} años · ${esc(x.rango || '')}</p><p><b>Ingreso:</b> ${esc(x.ingreso)} · ${yearsAt(x.ingreso)} años en la marca</p>`;
  $('detail').showModal();
}
init();
