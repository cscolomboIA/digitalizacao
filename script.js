
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
  tituloEmitido: 'Título CAR Emitido',    // opcional
  tituloValidado: 'Título CAR Validado',  // opcional
  processo: 'Nº Processo Autuado'         // opcional
};

function normalize(x){
  if (x === undefined || x === null) return '';
  return String(x).trim();
}

function renameFuncaoToBolsista(v){
  const s = (v||'').toLowerCase();
  if (s.includes('orientador')) return 'Bolsistas CAR';
  return v || '';
}

async function loadXLSX(){
  const res = await fetch(FILE_PATH);
  if(!res.ok){ throw new Error('Falha ao baixar ' + FILE_PATH); }
  const buf = await res.arrayBuffer();
  const wb = XLSX.read(buf, { type:'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json(ws, { defval: '' });
  return { rows: json, sheetNames: wb.SheetNames };
}

function groupCount(rows, keySelector){
  const m = new Map();
  rows.forEach(r => {
    const k = keySelector(r);
    if(!k) return;
    m.set(k, (m.get(k) || 0) + 1);
  });
  return Array.from(m, ([k,v]) => ({key:k, value:v})).sort((a,b)=> b.value - a.value);
}

function setKPI(id, val){ document.getElementById(id).innerText = val; }

function hasColumn(rows, col){ return rows.length>0 && Object.prototype.hasOwnProperty.call(rows[0], col); }

function plotBar(divId, labels, values, title){
  const data = [{
    x: labels, y: values, type: 'bar', text: values.map(String), textposition: 'auto', hovertemplate: '%{x}<br>%{y} registros<extra></extra>'
  }];
  const layout = {
    margin: { t: 30, r: 10, b: 80, l: 50 },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { color: '#e9f1f3' },
    xaxis: { tickangle: -30 },
    yaxis: { gridcolor: '#1f2a30' },
    title: { text: title, font: { size: 14 } }
  };
  Plotly.newPlot(divId, data, layout, {displayModeBar:false, responsive:true});
}

function plotPie(divId, labels, values, title){
  const data = [{
    labels, values, type: 'pie', hole: .35, hovertemplate: '%{label}: %{value}<extra></extra>'
  }];
  const layout = {
    margin: { t: 30, r: 10, b: 10, l: 10 },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { color: '#e9f1f3' },
    title: { text: title, font: { size: 14 } }
  };
  Plotly.newPlot(divId, data, layout, {displayModeBar:false, responsive:true});
}

function initTable(rows){
  const cols = Object.keys(rows[0] || {}).map(k => ({ title: k, data: k }));
  const table = $('#dataTable').DataTable({
    data: rows,
    columns: cols,
    dom: 'Bfrtip',
    buttons: [
      { extend: 'csvHtml5', title: 'dados_car' }
    ],
    pageLength: 10
  });
  document.getElementById('btnDownloadCSV').addEventListener('click', ()=>{
    table.button('.buttons-csv').trigger();
  });
}

(async function(){
  try{
    const {rows, sheetNames} = await loadXLSX();
    document.getElementById('fileInfo').innerText = `Arquivo: data.xlsx • Planilha: ${sheetNames[0] || '1'}`;

    // KPIs
    const total = rows.length;
    const campi = new Set(rows.map(r => normalize(r[COLS.campus]))).size;
    const municipios = new Set(rows.map(r => normalize(r[COLS.municipio]))).size;
    const orientadoresCount = rows.filter(r => normalize(r[COLS.funcao]).toLowerCase().includes('orientador')).length;

    setKPI('kpiTotal', total);
    setKPI('kpiCampi', campi || '—');
    setKPI('kpiMunicipios', municipios || '—');
    setKPI('kpiOrientadores', orientadoresCount || '—');

    // Charts
    // By Campus
    const byCampus = groupCount(rows, r => normalize(r[COLS.campus]));
    plotBar('chartCampus', byCampus.map(x=>x.key), byCampus.map(x=>x.value), 'Registros por Campus');

    // By Município
    const byMun = groupCount(rows, r => normalize(r[COLS.municipio]));
    plotBar('chartMunicipio', byMun.map(x=>x.key), byMun.map(x=>x.value), 'Registros por Município');

    // By Função (with rename of Orientador -> Bolsistas CAR)
    const byFunc = groupCount(rows, r => renameFuncaoToBolsista(normalize(r[COLS.funcao])));
    plotPie('chartFuncao', byFunc.map(x=>x.key), byFunc.map(x=>x.value), 'Distribuição por Função');

    // Optional panels (Título CAR e Processo Autuado)
    const hasTitulo = hasColumn(rows, COLS.tituloEmitido) || hasColumn(rows, COLS.tituloValidado);
    const hasProc   = hasColumn(rows, COLS.processo);

    if(hasTitulo){
      document.getElementById('badgeTitulo').classList.remove('warn');
      document.getElementById('badgeTitulo').innerText = 'ok';
      // If present, build a small bar chart combining emitido/validado counts
      const emit = rows.filter(r => normalize(r[COLS.tituloEmitido])).length;
      const val  = rows.filter(r => normalize(r[COLS.tituloValidado])).length;
      const labels = ['Emitidos','Validados'];
      const values = [emit, val];
      const container = document.getElementById('badgeTitulo').parentElement.nextElementSibling;
      container.innerHTML = '<div id="chartTitulo" class="chart"></div>';
      plotBar('chartTitulo', labels, values, 'Títulos CAR — Emitidos x Validados');
    }

    if(hasProc){
      document.getElementById('badgeProcesso').classList.remove('warn');
      document.getElementById('badgeProcesso').innerText = 'ok';
      const byProc = groupCount(rows, r => normalize(r[COLS.processo]));
      const container = document.getElementById('badgeProcesso').parentElement.nextElementSibling;
      container.innerHTML = '<div id="chartProc" class="chart"></div>';
      plotBar('chartProc', byProc.map(x=>x.key || '—'), byProc.map(x=>x.value), 'Processos Autuados (contagem por número)');
    }

    // Data table
    initTable(rows);

  }catch(err){
    console.error(err);
    alert('Erro ao carregar o dashboard: ' + err.message);
  }
})();
