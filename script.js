
const FILE_PATH = 'data.xlsx';
const COLS = {
  email: 'Endereço de e-mail',
  nome: '1) Nome completo:',
  cpf: '2) Número de CPF:',
  municipio: '3) Município onde reside:',
  orgao: '4) Órgão de lotação:',
  funcao: '6) Função exercida no Projeto IntegraCAR:',
  campus: 'Campus de Atuação',
  emailInst: 'E-mail Institucional',
  tituloEmitido: 'Título CAR Emitido',
  tituloValidado: 'Título CAR Validado',
  processo: 'Nº Processo Autuado'
};
const ES_CENTROIDS = {
  "Vitória": [-40.3089, -20.3155],
  "Vila Velha": [-40.2922, -20.3297],
  "Serra": [-40.3072, -20.1211],
  "Cariacica": [-40.4165, -20.2642],
  "Guarapari": [-40.5057, -20.6734],
  "Linhares": [-39.8558, -19.3946],
  "Colatina": [-40.6269, -19.5393],
  "Cachoeiro de Itapemirim": [-41.1121, -20.8467],
  "São Mateus": [-39.8647, -18.7201],
  "Aracruz": [-40.2734, -19.8198]
};
function el(id){ return document.getElementById(id); }
function normalize(x){ return (x===undefined||x===null) ? '' : String(x).trim(); }
function renameFuncaoToBolsista(v){ return (v||'').toLowerCase().includes('orientador') ? 'Bolsistas CAR' : (v||''); }
function groupCount(rows, keySelector){
  const m = new Map();
  rows.forEach(r=>{ const k=keySelector(r); if(k) m.set(k, (m.get(k)||0)+1); });
  return Array.from(m, ([key,value])=>({key,value})).sort((a,b)=>b.value-a.value);
}
function plotBar(divId, labels, values, title){
  const div = el(divId); if(!div) return;
  Plotly.newPlot(div,[{x:labels,y:values,type:'bar'}],
    {title, margin:{t:30}, paper_bgcolor:'rgba(0,0,0,0)', plot_bgcolor:'rgba(0,0,0,0)'},
    {displayModeBar:false, responsive:true});
}
function plotPie(divId, labels, values, title){
  const div = el(divId); if(!div) return;
  Plotly.newPlot(div,[{labels,values,type:'pie',hole:.35}],{title},{displayModeBar:false, responsive:true});
}
function plotMap(divId, rows){
  const div = el(divId); if(!div) return;
  const byMun = groupCount(rows, r=> normalize(r[COLS.municipio]));
  const lats = [], lons = [], sizes=[], texts=[];
  byMun.forEach(item=>{
    const name=item.key; const count=item.value;
    const coords = ES_CENTROIDS[name];
    if(!coords) return;
    lons.push(coords[0]); lats.push(coords[1]);
    sizes.push(8 + Math.min(30, count*3));
    texts.push(`${name}: ${count}`);
  });
  const data=[{ type:'scattergeo', lon:lons, lat:lats, text:texts, mode:'markers+text', textposition:'top center',
    marker:{ size:sizes, line:{width:1,color:'#333'} } }];
  const layout = { geo:{ scope:'south america', projection:{type:'mercator'}, showcountries:true, countrycolor:'#bbb', showland:true, landcolor:'#f5f5f5' },
                   margin:{t:10,r:10,b:10,l:10}, paper_bgcolor:'rgba(0,0,0,0)'};
  Plotly.newPlot(div, data, layout, {displayModeBar:false, responsive:true});
}
function animateCount(el, target){
  if(!el) return; const dur=600; const start=0; const t0=performance.now();
  function step(t){ const p=Math.min(1,(t-t0)/dur); el.textContent = Math.round(start + (target-start)*p); if(p<1) requestAnimationFrame(step); }
  requestAnimationFrame(step);
}
let ALL_ROWS=[], table;
async function loadXLSX(){
  const res = await fetch(FILE_PATH);
  if(!res.ok) throw new Error('Falha ao baixar ' + FILE_PATH);
  const buf = await res.arrayBuffer();
  const wb = XLSX.read(buf, { type:'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json(ws, { defval: '' });
  const info = el('fileInfo'); if (info) info.textContent = `Arquivo: data.xlsx • Planilha: ${wb.SheetNames[0] || '1'}`;
  return json;
}
function populateFilters(rows){
  function fill(selId, values){
    const sel = el(selId); if(!sel) return;
    const uniq = Array.from(new Set(values.filter(Boolean))).sort();
    sel.innerHTML = '<option value=\"\">Todos</option>' + uniq.map(v=>`<option value=\"${v}\">${v}</option>`).join('');
  }
  fill('fCampus', rows.map(r=> normalize(r[COLS.campus])));
  fill('fMunicipio', rows.map(r=> normalize(r[COLS.municipio])));
  fill('fFuncao', rows.map(r=> renameFuncaoToBolsista(normalize(r[COLS.funcao]))));
}
function getFiltered(){
  const c = normalize(el('fCampus')?.value);
  const m = normalize(el('fMunicipio')?.value);
  const f = normalize(el('fFuncao')?.value);
  return ALL_ROWS.filter(r=>{
    const rc = normalize(r[COLS.campus]);
    const rm = normalize(r[COLS.municipio]);
    const rf = renameFuncaoToBolsista(normalize(r[COLS.funcao]));
    return (c? rc===c : true) && (m? rm===m : true) && (f? rf===f : true);
  });
}
function refresh(){
  const rows = getFiltered();
  animateCount(el('kpiTotal'), rows.length);
  animateCount(el('kpiCampi'), new Set(rows.map(r=> normalize(r[COLS.campus]))).size);
  animateCount(el('kpiMunicipios'), new Set(rows.map(r=> normalize(r[COLS.municipio]))).size);
  animateCount(el('kpiOrientadores'), rows.filter(r=> normalize(r[COLS.funcao]).toLowerCase().includes('orientador')).length);
  const byCampus = groupCount(rows, r=> normalize(r[COLS.campus]));
  plotBar('chartCampus', byCampus.map(x=>x.key), byCampus.map(x=>x.value), 'Registros por Campus');
  const byMun = groupCount(rows, r=> normalize(r[COLS.municipio]));
  plotBar('chartMunicipio', byMun.map(x=>x.key), byMun.map(x=>x.value), 'Registros por Município');
  const byFunc = groupCount(rows, r=> renameFuncaoToBolsista(normalize(r[COLS.funcao])));
  plotPie('chartFuncao', byFunc.map(x=>x.key), byFunc.map(x=>x.value), 'Distribuição por Função');
  plotMap('chartMapa', rows);
  if (el('dataTable')){
    if (!table){
      table = $('#dataTable').DataTable({
        data: rows,
        columns: Object.keys(rows[0] || {}).map(k=>({title:k,data:k})),
        dom: 'Bfrtip',
        buttons:[{extend:'csvHtml5',title:'dados_car'}],
        pageLength:10
      });
      el('btnDownloadCSV')?.addEventListener('click', ()=> table.button('.buttons-csv').trigger());
    } else {
      table.clear(); table.rows.add(rows); table.draw();
    }
  }
}
async function main(){
  ALL_ROWS = await loadXLSX();
  populateFilters(ALL_ROWS);
  ['fCampus','fMunicipio','fFuncao'].forEach(id=> el(id)?.addEventListener('change', refresh));
  el('btnLimpar')?.addEventListener('click', ()=>{ ['fCampus','fMunicipio','fFuncao'].forEach(id=>{ const s=el(id); if(s) s.value=''; }); refresh(); });
  el('themeToggle')?.addEventListener('click', ()=>{
    const root = document.documentElement;
    const current = root.getAttribute('data-theme');
    const next = current === 'dark' ? '' : 'dark';
    if (next) root.setAttribute('data-theme', next); else root.removeAttribute('data-theme');
  });
  refresh();
}
if (document.readyState === 'loading'){ document.addEventListener('DOMContentLoaded', main); } else { main(); }
