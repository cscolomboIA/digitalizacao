// ==================== CONFIG ====================
const DATA_URL = 'dados_car.json';

let rawData = [];
let filteredData = [];

// DataTable + gráficos
let dataTable;
let campusChartInitialized = false;
let municipioChartInitialized = false;

// ==================== HELPERS ====================
const $id = (id) => document.getElementById(id);

function normalizarRegistro(r) {
  return {
    numeroTitulo: r['Nº TÍTULO'] || '',
    situacaoTitulo: r['SITUAÇÃO TÍTULO'] || '',
    nomeSetor: r['NOME SETOR'] || '',
    nomeAutor: r['NOME AUTOR'] || '',
    nomeMunicipio: r['NOME MUNICÍPIO'] || '',
    numProcessoEDocs: r['Nº PROCESSO E-DOCS'] || '',
    numProcessoSimlam: r['Nº PROCESSO SIMLAM'] || '',
    codigoEmpreendimento: r['CÓDIGO EMPREENDIMENTO'] || '',
    dataEmissao: r['DATA DE EMISSÃO'] || ''
  };
}

function arrayUnica(lista) {
  return Array.from(new Set(lista.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, 'pt-BR')
  );
}

// ==================== CARREGAMENTO INICIAL ====================

$(document).ready(function () {
  carregarDados();

  // Botão limpar filtros
  $('#btnLimpar').on('click', () => {
    $('#fCampus').val('');
    $('#fMunicipio').val('');
    $('#fFuncao').val('');
    aplicarFiltros();
  });

  // Exportar CSV
  $('#btnDownloadCSV').on('click', exportarCSV);

  // Filtros
  $('#fCampus, #fMunicipio, #fFuncao').on('change', aplicarFiltros);
});

function carregarDados() {
  $.getJSON(DATA_URL)
    .done((json) => {
      rawData = json.map(normalizarRegistro);
      filteredData = [...rawData];

      popularFiltros();
      atualizarKPIs();
      inicializarTabela();
      atualizarTabela();
      desenharGraficos();
    })
    .fail((err) => {
      console.error('Erro ao carregar dados_car.json', err);
    });
}

// ==================== FILTROS ====================

function popularFiltros() {
  const campusLista = arrayUnica(rawData.map((d) => d.nomeSetor));
  const municipioLista = arrayUnica(rawData.map((d) => d.nomeMunicipio));
  const funcaoLista = arrayUnica(rawData.map((d) => d.nomeAutor));

  const fCampus = $('#fCampus');
  const fMunicipio = $('#fMunicipio');
  const fFuncao = $('#fFuncao');

  campusLista.forEach((c) => fCampus.append(`<option value="${c}">${c}</option>`));
  municipioLista.forEach((m) =>
    fMunicipio.append(`<option value="${m}">${m}</option>`)
  );
  funcaoLista.forEach((a) => fFuncao.append(`<option value="${a}">${a}</option>`));
}

function aplicarFiltros() {
  const campusSel = $('#fCampus').val();
  const municipioSel = $('#fMunicipio').val();
  const funcaoSel = $('#fFuncao').val();

  filteredData = rawData.filter((d) => {
    if (campusSel && d.nomeSetor !== campusSel) return false;
    if (municipioSel && d.nomeMunicipio !== municipioSel) return false;
    if (funcaoSel && d.nomeAutor !== funcaoSel) return false;
    return true;
  });

  atualizarKPIs();
  atualizarTabela();
  desenharGraficos();
}

// ==================== KPIs ====================

function atualizarKPIs() {
  $('#kpiTotal').text(filteredData.length);

  $('#kpiCampi').text(
    new Set(filteredData.map((d) => d.nomeSetor).filter(Boolean)).size
  );

  $('#kpiMunicipios').text(
    new Set(filteredData.map((d) => d.nomeMunicipio).filter(Boolean)).size
  );

  $('#kpiOrientadores').text(
    new Set(filteredData.map((d) => d.nomeAutor).filter(Boolean)).size
  );
}

// ==================== TABELA (DataTables) ====================

function inicializarTabela() {
  dataTable = $('#dataTable').DataTable({
    data: montarLinhasTabela(filteredData),
    columns: [
      { title: 'Nº Título' },
      { title: 'Situação' }, // status do processo
      { title: 'Campus/Setor' },
      { title: 'Município' },
      { title: 'Autor/Bolsista' },
      { title: 'Data de Emissão' },
      { title: 'Processo E-Docs' },
      { title: 'Processo SIMLAM' },
      { title: 'Cód. Empreendimento' }
    ],
    pageLength: 25,
    order: [[0, 'desc']],
    language: {
      url: 'https://cdn.datatables.net/plug-ins/1.13.6/i18n/pt-BR.json'
    }
  });
}

function montarLinhasTabela(dados) {
  return dados.map((d) => [
    d.numeroTitulo,
    d.situacaoTitulo,
    d.nomeSetor,
    d.nomeMunicipio,
    d.nomeAutor,
    d.dataEmissao,
    d.numProcessoEDocs,
    d.numProcessoSimlam,
    d.codigoEmpreendimento
  ]);
}

function atualizarTabela() {
  if (!dataTable) return;
  dataTable.clear();
  dataTable.rows.add(montarLinhasTabela(filteredData));
  dataTable.draw();
}

// ==================== EXPORTAR CSV ====================

function exportarCSV() {
  if (!filteredData.length) return;

  const cabecalho = [
    'Nº Título',
    'Situação Título',
    'Campus/Setor',
    'Município',
    'Autor/Bolsista',
    'Data de Emissão',
    'Nº Processo E-Docs',
    'Nº Processo SIMLAM',
    'Código Empreendimento'
  ];

  const linhas = filteredData.map((d) => [
    d.numeroTitulo,
    d.situacaoTitulo,
    d.nomeSetor,
    d.nomeMunicipio,
    d.nomeAutor,
    d.dataEmissao,
    d.numProcessoEDocs,
    d.numProcessoSimlam,
    d.codigoEmpreendimento
  ]);

  const csv = [
    cabecalho.join(';'),
    ...linhas.map((linha) =>
      linha
        .map((valor) => {
          const v = (valor || '').toString().replace(/"/g, '""');
          return `"${v}"`;
        })
        .join(';')
    )
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'integraCAR_dashboard_car.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ==================== GRÁFICOS (Plotly) ====================

function desenharGraficos() {
  desenharGraficoCampusStatus();   // Campus x Status (stacked) → mostra o status dos processos
  desenharGraficoMunicipio();      // Municípios (top N)
}

// --- Gráfico 1: Registros por Campus + Status (stack) ---
function desenharGraficoCampusStatus() {
  const divId = 'chartCampus';

  // Mapa: campus -> status -> contagem
  const mapa = {};
  const statusSet = new Set();

  filteredData.forEach((d) => {
    const campus = d.nomeSetor || 'Sem campus';
    const status = d.situacaoTitulo || 'Sem situação';

    statusSet.add(status);
    if (!mapa[campus]) mapa[campus] = {};
    mapa[campus][status] = (mapa[campus][status] || 0) + 1;
  });

  const campi = Object.keys(mapa).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const statusLista = Array.from(statusSet).sort((a, b) => a.localeCompare(b, 'pt-BR'));

  const traces = statusLista.map((status) => {
    const y = campi.map((campus) => mapa[campus][status] || 0);
    return {
      x: y,
      y: campi,
      type: 'bar',
      name: status,
      orientation: 'h'
    };
  });

  const layout = {
    title: 'Registros por Campus (empilhado por situação do título)',
    barmode: 'stack',
    margin: { l: 140, r: 20, t: 40, b: 40 },
    xaxis: { title: 'Quantidade' },
    yaxis: { automargin: true },
    legend: { orientation: 'h', x: 0, y: 1.1 }
  };

  const config = { responsive: true };

  if (campusChartInitialized) {
    Plotly.react(divId, traces, layout, config);
  } else {
    Plotly.newPlot(divId, traces, layout, config);
    campusChartInitialized = true;
  }
}

// --- Gráfico 2: Registros por Município (top 15) ---
function desenharGraficoMunicipio() {
  const divId = 'chartMunicipio';

  const contagem = {};
  filteredData.forEach((d) => {
    const mun = d.nomeMunicipio || 'Sem município';
    contagem[mun] = (contagem[mun] || 0) + 1;
  });

  let lista = Object.entries(contagem); // [ [nome, qtd], ... ]
  lista.sort((a, b) => b[1] - a[1]); // ordem decrescente por quantidade

  // Limita aos 15 mais frequentes
  lista = lista.slice(0, 15);

  const municipios = lista.map((p) => p[0]);
  const valores = lista.map((p) => p[1]);

  const trace = {
    x: valores,
    y: municipios,
    type: 'bar',
    orientation: 'h',
    name: 'Registros'
  };

  const layout = {
    title: 'Registros por Município (Top 15)',
    margin: { l: 180, r: 20, t: 40, b: 40 },
    xaxis: { title: 'Quantidade' },
    yaxis: { automargin: true }
  };

  const config = { responsive: true };

  if (municipioChartInitialized) {
    Plotly.react(divId, [trace], layout, config);
  } else {
    Plotly.newPlot(divId, [trace], layout, config);
    municipioChartInitialized = true;
  }
}
