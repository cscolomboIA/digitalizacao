
// Auto-adaptive script.js — supports both the original survey schema and the new "Título" schema.
const FILE_PATH = 'data.xlsx';

// Known schemas
const SCHEMAS = {
  survey: {
    label: 'Pesquisa IntegraCAR',
    cols: {
      municipio: '3) Município onde reside:',
      campus: 'Campus de Atuação',
      funcao: '6) Função exercida no Projeto IntegraCAR:',
      processo: 'Nº Processo Autuado',
      tituloEmitido: 'Título CAR Emitido',
      tituloValidado: 'Título CAR Validado',
      dataEmissao: 'Data Emissão Título'
    },
    bolsistaRule: (row, cols) => String(row[cols.funcao]||'').toLowerCase().includes('orientador')
  },
  titulo: {
    label: 'Base de Títulos',
    cols: {
      municipio: 'NOME MUNICÍPIO',
      campus: null, // not available
      funcao: 'NOME AUTOR', // usamos "autor" como bolsista/resp.
      processo: 'Nº PROCESSO E-DOCS',
      processo2: 'Nº PROCESSO SIMLAM',
      tituloSituacao: 'SITUAÇÃO TÍTULO',
      tituloNumero: 'Nº TÍTULO',
      empreendimento: 'CÓDIGO EMPREENDIMENTO',
      dataEmissao: 'DATA DE EMISSÃO'
    },
    bolsistaRule: (row, cols) => !!(row[cols.funcao]||'')
  }
};

function el(id){ return document.getElementById(id); }
function normalize(x){ return (x===undefined||x===null) ? '' : String(x).trim(); }

function detectSchema(rows){
  const has = (c)=> rows.length && rows[0] && Object.prototype.hasOwnProperty.call(rows[0], c);
  if (rows.length){
    // Prefer the "titulo" schema if it matches key columns
    const t = SCHEMAS.titulo.cols;
    if (has('NOME MUNICÍPIO') || has('NOME MUNICÍPIO ')) return {key:'titulo', def:SCHEMAS.titulo};
  }
  return {key:'survey', def:SCHEMAS.survey};
}

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

function animateCount(el, target){
  if(!el) return; const dur=600; const start=0; const t0=performance.now();
  function step(t){ const p=Math.min(1,(t-t0)/dur); el.textContent = Math.round(start + (target-start)*p); if(p<1) requestAnimationFrame(step); }
  requestAnimationFrame(step);
}

let ALL_ROWS=[], ACTIVE={}, SCHEMA_KEY='survey';

async function loadXLSX(){
  const res = await fetch(FILE_PATH);
  if(!res.ok) throw new Error('Falha ao baixar ' + FILE_PATH);
  const buf = await res.arrayBuffer();
  const wb = XLSX.read(buf, { type:'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { defval: '' });
}

function normalizeTituloColumns(rows){
  // Some files come with "ID MUNICÍPIO " (trailing space). Normalize to "ID MUNICÍPIO" & "NOME MUNICÍPIO"
  return rows.map(r=>{
    const obj = {...r};
    if (Object.prototype.hasOwnProperty.call(obj, 'NOME MUNICÍPIO ')) {
      obj['NOME MUNICÍPIO'] = obj['NOME MUNICÍPIO '];
      delete obj['NOME MUNICÍPIO '];
    }
    if (Object.prototype.hasOwnProperty.call(obj, 'ID MUNICÍPIO ')) {
      obj['ID MUNICÍPIO'] = obj['ID MUNICÍPIO '];
      delete obj['ID MUNICÍPIO '];
    }
    return obj;
  });
}

function setupFilters(rows, defs){
  const cols = defs.cols;
  const selCampus = el('fCampus');
  const selMunicipio = el('fMunicipio');
  const selFuncao = el('fFuncao');
  const btnLimpar = el('btnLimpar');

  function fill(sel, values, labelAll){
    if(!sel) return;
    const uniq = Array.from(new Set(values.filter(Boolean).map(v=>normalize(v)))).sort();
    sel.innerHTML = `<option value="">${labelAll}</option>` + uniq.map(v=>`<option value="${v}">${v}</option>`).join('');
  }

  if (cols.campus && rows[0] && Object.prototype.hasOwnProperty.call(rows[0], cols.campus)) {
    fill(selCampus, rows.map(r=> r[cols.campus]), 'Todos');
    selCampus.parentElement.style.display = '';
  } else if (selCampus) {
    selCampus.parentElement.style.display = 'none'; // hide Campus filter if not present
  }

  const muniKey = cols.municipio;
  fill(selMunicipio, rows.map(r=> r[muniKey]), 'Todos');

  const funcKey = cols.funcao;
  fill(selFuncao, rows.map(r=> r[funcKey]), defs===SCHEMAS.titulo ? 'Todos os autores' : 'Todas');
  
  ['change'].forEach(evt=>{
    selCampus && selCampus.addEventListener(evt, refresh);
    selMunicipio && selMunicipio.addEventListener(evt, refresh);
    selFuncao && selFuncao.addEventListener(evt, refresh);
  });
  btnLimpar && btnLimpar.addEventListener('click', ()=>{
    if (selCampus) selCampus.value='';
    if (selMunicipio) selMunicipio.value='';
    if (selFuncao) selFuncao.value='';
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

function refresh(){
  const defs = ACTIVE.def;
  const cols = defs.cols;
  const rows = getFiltered(ALL_ROWS, defs);

  // KPIs
  animateCount(el('kpiTotal'), rows.length);
  const kpiCampi = el('kpiCampi')?.closest('.kpi');
  if (cols.campus && rows[0] && Object.prototype.hasOwnProperty.call(rows[0], cols.campus)){
    animateCount(el('kpiCampi'), new Set(rows.map(r=> normalize(r[cols.campus]))).size);
    if (kpiCampi) kpiCampi.style.display = '';
  } else { if (kpiCampi) kpiCampi.style.display = 'none'; }
  animateCount(el('kpiMunicipios'), new Set(rows.map(r=> normalize(r[cols.municipio]))).size);
  // bolsistas: rule per schema
  const bolsistasVal = defs===SCHEMAS.titulo
      ? new Set(rows.map(r=> normalize(r[cols.funcao]))).size  // distintos autores
      : rows.filter(r=> defs.bolsistaRule(r, cols)).length;    // linhas marcadas como orientador
  animateCount(el('kpiOrientadores'), bolsistasVal);

  // Charts
  const byMunicipio = groupCount(rows, r=> normalize(r[cols.municipio]));
  plotBar('chartMunicipio', byMunicipio.map(x=>x.key), byMunicipio.map(x=>x.value),
          defs===SCHEMAS.titulo ? 'Registros por Município (Títulos)' : 'Registros por Município');

  // Left chart
  const leftTitleDiv = document.querySelector('[data-panel-left-title]');
  if (defs===SCHEMAS.titulo){
    // usar autores no lugar de campus
    const byAutor = groupCount(rows, r=> normalize(r[cols.funcao]));
    plotBar('chartCampus', byAutor.map(x=>x.key), byAutor.map(x=>x.value), 'Registros por Autor');
    if (leftTitleDiv) leftTitleDiv.textContent = 'Registros por Autor';
  } else {
    const byCampus = groupCount(rows, r=> normalize(r[cols.campus]));
    plotBar('chartCampus', byCampus.map(x=>x.key), byCampus.map(x=>x.value), 'Registros por Campus');
    if (leftTitleDiv) leftTitleDiv.textContent = 'Registros por Campus';
  }

  // Pie chart: situação do título (se existir) ou função
  const hasSit = rows.length && Object.prototype.hasOwnProperty.call(rows[0], (cols.tituloSituacao||''));
  if (hasSit){
    const bySit = groupCount(rows, r=> normalize(r[cols.tituloSituacao]));
    plotPie('chartFuncao', bySit.map(x=>x.key||'—'), bySit.map(x=>x.value), 'Situação do Título');
  } else {
    const byFunc = groupCount(rows, r=> normalize(r[cols.funcao]));
    plotPie('chartFuncao', byFunc.map(x=>x.key||'—'), byFunc.map(x=>x.value),
      defs===SCHEMAS.titulo ? 'Distribuição por Autor' : 'Distribuição por Função');
  }

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
  // normalize special cases
  rows = normalizeTituloColumns(rows);
  ACTIVE = detectSchema(rows);
  SCHEMA_KEY = ACTIVE.key;
  ALL_ROWS = rows;
  // Prepare filters and UI text
  setupFilters(ALL_ROWS, ACTIVE.def);
  // Update left panel title marker to be dynamic
  const leftPanelHdr = document.querySelector('.panel h2');
  if (leftPanelHdr) leftPanelHdr.setAttribute('data-panel-left-title', '1');
  refresh();
}

if (document.readyState === 'loading'){ document.addEventListener('DOMContentLoaded', main); } else { main(); }
