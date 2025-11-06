
// script.js — left labels only + hide "Distribuição por Função" title
const FILE_PATH = 'data.xlsx';

function el(id){ return document.getElementById(id); }
function normalize(x){ return (x===undefined||x===null) ? '' : String(x).trim(); }

// Adaptive schemas (same as before, trimmed for brevity)
const SCHEMAS = {
  survey: {
    cols: {
      municipio: '3) Município onde reside:',
      campus: 'Campus de Atuação',
      funcao: '6) Função exercida no Projeto IntegraCAR:'
    },
    bolsistaRule: (row, cols) => String(row[cols.funcao]||'').toLowerCase().includes('orientador')
  },
  titulo: {
    cols: {
      municipio: 'NOME MUNICÍPIO',
      campus: null,
      funcao: 'NOME AUTOR',
      tituloSituacao: 'SITUAÇÃO TÍTULO'
    },
    bolsistaRule: (row, cols) => !!(row[cols.funcao]||'')
  }
};

function detectSchema(rows){
  const has = (c)=> rows.length && rows[0] && Object.prototype.hasOwnProperty.call(rows[0], c);
  if (has('NOME MUNICÍPIO') || has('NOME MUNICÍPIO ')) return {key:'titulo', def:SCHEMAS.titulo};
  return {key:'survey', def:SCHEMAS.survey};
}

function groupCount(rows, keySelector){
  const m = new Map();
  rows.forEach(r=>{ const k=keySelector(r); if(k) m.set(k, (m.get(k)||0)+1); });
  return Array.from(m, ([key,value])=>({key,value})).sort((a,b)=>b.value-a.value);
}

// Horizontal bars with ONLY left tick labels (no text on bars)
function plotBarLeftLabels(divId, labels, values, title){
  const div = el(divId); if(!div) return;
  const maxLen = Math.max(0, ...labels.map(l => String(l||'').length));
  const h = Math.max(320, Math.min(1400, 26*labels.length + 80));
  Plotly.newPlot(div, [{
    y: labels,
    x: values,
    type: 'bar',
    orientation: 'h',
    hovertemplate: '%{y}: %{x}<extra></extra>',
    cliponaxis: false
  }], {
    title,   // título só para os gráficos principais
    height: h,
    margin: {t: 30, l: Math.min(340, 10*maxLen), r: 10},
    xaxis: {automargin: true},
    yaxis: {automargin: true, tickfont: {size: 11}},
    paper_bgcolor:'rgba(0,0,0,0)',
    plot_bgcolor:'rgba(0,0,0,0)'
  }, {displayModeBar:false, responsive:true});
}

let ALL_ROWS=[], ACTIVE={};

async function loadXLSX(){
  const res = await fetch(FILE_PATH);
  if(!res.ok) throw new Error('Falha ao baixar ' + FILE_PATH);
  const buf = await res.arrayBuffer();
  const wb = XLSX.read(buf, { type:'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { defval: '' });
}

function setupFilters(rows, defs){
  const cols = defs.cols;
  const selCampus = el('fCampus');
  const selMunicipio = el('fMunicipio');
  const selFuncao = el('fFuncao');

  function fill(sel, values, labelAll){
    if(!sel) return;
    const uniq = Array.from(new Set(values.filter(Boolean).map(v=>normalize(v)))).sort();
    sel.innerHTML = `<option value="">${labelAll}</option>` + uniq.map(v=>`<option value="${v}">${v}</option>`).join('');
  }

  if (cols.campus && rows[0] && Object.prototype.hasOwnProperty.call(rows[0], cols.campus)) {
    fill(selCampus, rows.map(r=> r[cols.campus]), 'Todos');
    selCampus.parentElement.style.display = '';
  } else if (selCampus) {
    selCampus.parentElement.style.display = 'none';
  }

  fill(selMunicipio, rows.map(r=> r[cols.municipio]), 'Todos');
  fill(selFuncao, rows.map(r=> r[cols.funcao]), defs===SCHEMAS.titulo ? 'Todos os autores' : 'Todas');

  ['fCampus','fMunicipio','fFuncao'].forEach(id=> el(id)?.addEventListener('change', refresh));
  el('btnLimpar')?.addEventListener('click', ()=>{
    ['fCampus','fMunicipio','fFuncao'].forEach(id=>{ const s=el(id); if(s) s.value=''; });
    refresh();
  });
}

function getFiltered(rows, defs){
  const cols = defs.cols;
  const c = normalize(el('fCampus')?.value);
  const m = normalize(el('fMunicipio')?.value);
  const f = normalize(el('fFuncao')?.value);
  return rows.filter(r=>{
    const rc = cols.campus ? normalize(r[cols.campus]) : '';
    const rm = normalize(r[cols.municipio]);
    const rf = normalize(r[cols.funcao]);
    return (cols.campus ? (c? rc===c : true) : true) && (m? rm===m : true) && (f? rf===f : true);
  });
}

let table;
function animateCount(elm, target){
  if(!elm) return; const dur=500; const start=Number(elm.textContent)||0; const t0=performance.now();
  function step(t){ const p=Math.min(1,(t-t0)/dur); elm.textContent = Math.round(start + (target-start)*p); if(p<1) requestAnimationFrame(step); }
  requestAnimationFrame(step);
}

function refresh(){
  const defs = ACTIVE.def;
  const cols = defs.cols;
  const rows = getFiltered(ALL_ROWS, defs);

  animateCount(el('kpiTotal'), rows.length);
  const kpiCampiWrap = el('kpiCampi')?.closest('.kpi');
  if (cols.campus && rows[0] && Object.prototype.hasOwnProperty.call(rows[0], cols.campus)){
    animateCount(el('kpiCampi'), new Set(rows.map(r=> normalize(r[cols.campus]))).size);
    if (kpiCampiWrap) kpiCampiWrap.style.display = '';
  } else { if (kpiCampiWrap) kpiCampiWrap.style.display = 'none'; }
  animateCount(el('kpiMunicipios'), new Set(rows.map(r=> normalize(r[cols.municipio]))).size);
  const bolsistasVal = defs===SCHEMAS.titulo
      ? new Set(rows.map(r=> normalize(r[cols.funcao]))).size
      : rows.filter(r=> defs.bolsistaRule(r, cols)).length;
  animateCount(el('kpiOrientadores'), bolsistasVal);

  // Charts with left-only labels
  const byMun = groupCount(rows, r=> normalize(r[cols.municipio]));
  plotBarLeftLabels('chartMunicipio', byMun.map(x=>x.key), byMun.map(x=>x.value),
    defs===SCHEMAS.titulo ? 'Registros por Município (Títulos)' : 'Registros por Município');

  if (defs===SCHEMAS.titulo){
    const byAutor = groupCount(rows, r=> normalize(r[cols.funcao]));
    plotBarLeftLabels('chartCampus', byAutor.map(x=>x.key), byAutor.map(x=>x.value), 'Registros por Autor');
  } else {
    const byCampus = groupCount(rows, r=> normalize(r[cols.campus]));
    plotBarLeftLabels('chartCampus', byCampus.map(x=>x.key), byCampus.map(x=>x.value), 'Registros por Campus');
  }

  // Hide the panel header/title for the third panel (chartFuncao) and remove plot title
  const funcPanelHeader = document.querySelector('#chartFuncao')?.closest('.panel')?.querySelector('.panel-header');
  if (funcPanelHeader) funcPanelHeader.style.display = 'none';
  Plotly.newPlot('chartFuncao', [], {margin:{t:0}}, {displayModeBar:false, responsive:true});

  // DataTable
  if (el('dataTable')){
    if (!table){
      table = $('#dataTable').DataTable({
        data: rows,
        columns: Object.keys(rows[0] || {}).map(k=>({title:k,data:k})),
        dom: 'Bfrtip', buttons:[{extend:'csvHtml5',title:'dados_car'}],
        pageLength: 10
      });
      el('btnDownloadCSV')?.addEventListener('click', ()=> table.button('.buttons-csv').trigger());
    } else {
      table.clear(); table.rows.add(rows); table.draw();
    }
  }
}

async function main(){
  let rows = await loadXLSX();
  rows = rows.map(r=>{
    if ('NOME MUNICÍPIO ' in r && !('NOME MUNICÍPIO' in r)) r['NOME MUNICÍPIO'] = r['NOME MUNICÍPIO '];
    if ('ID MUNICÍPIO ' in r && !('ID MUNICÍPIO' in r)) r['ID MUNICÍPIO'] = r['ID MUNICÍPIO '];
    return r;
  });
  ACTIVE = detectSchema(rows);
  ALL_ROWS = rows;
  // Tag header for dynamic left chart title (kept from previous versions)
  const leftPanelHdr = document.querySelector('.panel h2');
  if (leftPanelHdr) leftPanelHdr.setAttribute('data-panel-left-title', '1');
  setupFilters(ALL_ROWS, ACTIVE.def);
  refresh();
}
if (document.readyState === 'loading'){ document.addEventListener('DOMContentLoaded', main); } else { main(); }
