// script.js (versão ultra-segura)

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

function el(id){ return document.getElementById(id); }
function text(id, v){ const e = el(id); if(e) e.textContent = v; }
function normalize(x){ return (x===undefined||x===null) ? '' : String(x).trim(); }
function renameFuncaoToBolsista(v){ return (v||'').toLowerCase().includes('orientador') ? 'Bolsistas CAR' : (v||''); }
function hasColumn(rows, col){ return rows.length>0 && rows[0] && Object.prototype.hasOwnProperty.call(rows[0], col); }

function groupCount(rows, keySelector){
  const m = new Map();
  rows.forEach(r => { const k = keySelector(r); if(k) m.set(k, (m.get(k)||0)+1); });
  return Array.from(m, ([key, value]) => ({ key, value })).sort((a,b)=>b.value-a.value);
}

function plotBar(divId, labels, values, title){
  const div = el(divId); if(!div) return;
  Plotly.newPlot(div, [{ x: labels, y: values, type: 'bar', text: values.map(String), textposition: 'auto' }],
    { title, margin:{t:30,r:10,b:80,l:50}, paper_bgcolor:'rgba(0,0,0,0)', plot_bgcolor:'rgba(0,0,0,0)' },
    { displayModeBar:false, responsive:true });
}

function plotPie(divId, labels, values, title){
  const div = el(divId); if(!div) return;
  Plotly.newPlot(div, [{ labels, values, type:'pie', hole:.35 }],
    { title, margin:{t:30,r:10,b:10,l:10} },
    { displayModeBar:false, responsive:true });
}

async function loadXLSX(){
  const res = await fetch(FILE_PATH);
  if(!res.ok) throw new Error('Falha ao baixar ' + FILE_PATH);
  const buf = await res.arrayBuffer();
  const wb = XLSX.read(buf, { type:'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json(ws, { defval: '' });
  const info = el('fileInfo'); if (info) info.textContent = `Arquivo: ${FILE_PATH} • Planilha: ${wb.SheetNames[0] || '1'}`;
  return json;
}

async function main(){
  try{
    const rows = await loadXLSX();

    // KPIs
    const total = rows.length;
    const campi = new Set(rows.map(r => normalize(r[COLS.campus]))).size;
    const municipios = new Set(rows.map(r => normalize(r[COLS.municipio]))).size;
    const orientadores = rows.filter(r => normalize(r[COLS.funcao]).toLowerCase().includes('orientador')).length;

    text('kpiTotal', total || '—');
    text('kpiCampi', campi || '—');
    text('kpiMunicipios', municipios || '—');
    text('kpiOrientadores', orientadores || '—');

    // Gráficos principais (presentes em todas as variantes do HTML)
    const byCampus = groupCount(rows, r => normalize(r[COLS.campus]));
    plotBar('chartCampus', byCampus.map(x=>x.key), byCampus.map(x=>x.value), 'Registros por Campus');

    const byMun = groupCount(rows, r => normalize(r[COLS.municipio]));
    plotBar('chartMunicipio', byMun.map(x=>x.key), byMun.map(x=>x.value), 'Registros por Município');

    const byFunc = groupCount(rows, r => renameFuncaoToBolsista(normalize(r[COLS.funcao])));
    plotPie('chartFuncao', byFunc.map(x=>x.key), byFunc.map(x=>x.value), 'Distribuição por Função');

    // Painel de títulos/processos (se existir no HTML)
    const hasTitulo = hasColumn(rows, COLS.tituloEmitido) || hasColumn(rows, COLS.tituloValidado);
    const hasProc   = hasColumn(rows, COLS.processo);

    const emit = hasTitulo ? rows.filter(r => normalize(r[COLS.tituloEmitido]) === 'Sim').length : 0;
    const valid = hasTitulo ? rows.filter(r => normalize(r[COLS.tituloValidado]) === 'Sim').length : 0;

    // Se existir um painel único "chartTitulo", usa ele; senão, ignora silenciosamente
    if (el('chartTitulo')) {
      const labels = hasTitulo ? ['Emitidos','Validados'] : ['Sem dados'];
      const values = hasTitulo ? [emit, valid] : [0];
      plotBar('chartTitulo', labels, values, 'Títulos / Processos');
    }
    // Se existirem os antigos "badge..." e "chartProc"/"chartTitulo", também funcionará:
    if (el('chartProc') && hasProc){
      const byProc = groupCount(rows, r => normalize(r[COLS.processo]));
      plotBar('chartProc', byProc.map(x=>x.key || '—'), byProc.map(x=>x.value), 'Processos Autuados');
    }

    // DataTable (só inicializa se o elemento existe)
    if (el('dataTable') && rows.length){
      const cols = Object.keys(rows[0]).map(k => ({ title:k, data:k }));
      const t = $('#dataTable').DataTable({ data: rows, columns: cols, dom: 'Bfrtip', buttons: [{ extend:'csvHtml5', title:'dados_car' }], pageLength: 10 });
      const btn = el('btnDownloadCSV'); if (btn) btn.addEventListener('click', ()=> t.button('.buttons-csv').trigger());
    }

    // Botão Tema (só se existir)
    const toggle = el('themeToggle');
    if (toggle){
      toggle.addEventListener('click', ()=>{
        const root = document.documentElement;
        const current = root.getAttribute('data-theme');
        const next = current === 'dark' ? '' : 'dark';
        if (next) root.setAttribute('data-theme', next); else root.removeAttribute('data-theme');
      });
    }
  }catch(err){
    alert('Erro ao carregar o dashboard: ' + err.message);
    console.error(err);
  }
}

// Aguarda DOM pronto (e usa defer no script)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}
