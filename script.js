// ==================== CONFIGURAÇÕES BÁSICAS ====================
const DATA_URL = 'dados_car.json';

const PAGE_SIZE = 20;

// Elementos de UI (ajuste os IDs se forem diferentes)
const $ = (sel) => document.querySelector(sel);

const elCampus = $('#filter-campus');
const elAutor = $('#filter-autor');
const elMunicipio = $('#filter-municipio');
const elStatus = $('#filter-status');
const elBusca = $('#filter-search');

const elTabelaBody = $('#table-body');
const elPaginacao = $('#pagination');

const cardTotalTitulos = $('#card-total-titulos');
const cardTotalMunicipios = $('#card-total-municipios');
const cardTotalAutores = $('#card-total-autores');
const cardTotalConcluidos = $('#card-total-concluidos'); // ou outro status que quiser destacar

// Canvas dos gráficos
const ctxStatus = $('#chart-status');
const ctxCampus = $('#chart-campus');

// Mapa
let map;
let layerMunicipios;

// Estado global
let originalData = [];
let filteredData = [];
let currentPage = 1;

// Charts (para poder atualizar)
let chartStatus;
let chartCampus;

// ==================== CARREGAMENTO INICIAL ====================

document.addEventListener('DOMContentLoaded', () => {
  carregarDados();
  registrarEventosFiltro();
});

// ==================== BUSCA E NORMALIZAÇÃO ====================

async function carregarDados() {
  try {
    const resp = await fetch(DATA_URL);
    if (!resp.ok) throw new Error('Erro ao buscar dados_car.json');

    const json = await resp.json();

    // json deve ser um array de objetos
    originalData = json.map(normalizarRegistro);
    filteredData = [...originalData];

    popularFiltros();
    atualizarTudo();

    inicializarMapa(); // só chama depois de ter os dados
  } catch (err) {
    console.error('Erro ao carregar dados:', err);
  }
}

function normalizarRegistro(r) {
  // Ajuste os nomes exatamente como estão no JSON
  return {
    numeroTitulo: r['Nº TÍTULO'] || r['NUMERO_TITULO'] || '',
    situacaoTitulo: r['SITUAÇÃO TÍTULO'] || r['SITUACAO_TITULO'] || '',
    idSetor: r['ID SETOR'] || '',
    nomeSetor: r['NOME SETOR'] || '',
    idAutor: r['ID AUTOR'] || '',
    nomeAutor: r['NOME AUTOR'] || '',
    idMunicipio: r['ID MUNICÍPIO'] || '',
    nomeMunicipio: r['NOME MUNICÍPIO'] || '',
    numProcessoEDocs: r['Nº PROCESSO E-DOCS'] || '',
    numProcessoSimlam: r['Nº PROCESSO SIMLAM'] || '',
    codigoEmpreendimento: r['CÓDIGO EMPREENDIMENTO'] || '',
    dataEmissao: r['DATA DE EMISSÃO'] || ''
  };
}

// ==================== FILTROS ====================

function popularFiltros() {
  preencherSelectUnico(elCampus, originalData.map(d => d.nomeSetor));
  preencherSelectUnico(elAutor, originalData.map(d => d.nomeAutor));
  preencherSelectUnico(elMunicipio, originalData.map(d => d.nomeMunicipio));
  preencherSelectUnico(elStatus, originalData.map(d => d.situacaoTitulo));
}

function preencherSelectUnico(selectEl, lista) {
  if (!selectEl) return;
  const valores = Array.from(new Set(lista.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, 'pt-BR')
  );

  selectEl.innerHTML = '<option value="">Todos</option>';
  for (const v of valores) {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = v;
    selectEl.appendChild(opt);
  }
}

function registrarEventosFiltro() {
  const filtros = [elCampus, elAutor, elMunicipio, elStatus, elBusca];
  filtros.forEach(f => {
    if (f) f.addEventListener('input', () => {
      currentPage = 1;
      aplicarFiltros();
    });
  });
}

function aplicarFiltros() {
  const campus = elCampus?.value || '';
  const autor = elAutor?.value || '';
  const municipio = elMunicipio?.value || '';
  const status = elStatus?.value || '';
  const busca = (elBusca?.value || '').toLowerCase();

  filteredData = originalData.filter(d => {
    if (campus && d.nomeSetor !== campus) return false;
    if (autor && d.nomeAutor !== autor) return false;
    if (municipio && d.nomeMunicipio !== municipio) return false;
    if (status && d.situacaoTitulo !== status) return false;

    if (busca) {
      const texto =
        `${d.numeroTitulo} ${d.nomeAutor} ${d.nomeMunicipio} ${d.nomeSetor} ${d.situacaoTitulo}`.toLowerCase();
      if (!texto.includes(busca)) return false;
    }

    return true;
  });

  atualizarTudo();
}

// ==================== ATUALIZAÇÃO GERAL ====================

function atualizarTudo() {
  atualizarCards();
  atualizarTabela();
  atualizarPaginacao();
  atualizarGraficos();
  atualizarMapa(); // repinta o mapa com os filtros
}

// ==================== CARDS RESUMO ====================

function atualizarCards() {
  if (cardTotalTitulos)
    cardTotalTitulos.textContent = filteredData.length.toString();

  if (cardTotalMunicipios) {
    const qtd = new Set(filteredData.map(d => d.nomeMunicipio)).size;
    cardTotalMunicipios.textContent = qtd.toString();
  }

  if (cardTotalAutores) {
    const qtd = new Set(filteredData.map(d => d.nomeAutor)).size;
    cardTotalAutores.textContent = qtd.toString();
  }

  if (cardTotalConcluidos) {
    const concluidos = filteredData.filter(
      d => d.situacaoTitulo.toLowerCase().includes('conclu')
    ).length;
    cardTotalConcluidos.textContent = concluidos.toString();
  }
}

// ==================== TABELA + PAGINAÇÃO ====================

function atualizarTabela() {
  if (!elTabelaBody) return;

  elTabelaBody.innerHTML = '';

  const inicio = (currentPage - 1) * PAGE_SIZE;
  const fim = inicio + PAGE_SIZE;
  const pageData = filteredData.slice(inicio, fim);

  for (const d of pageData) {
    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td>${d.numeroTitulo}</td>
      <td>${d.situacaoTitulo}</td>
      <td>${d.nomeMunicipio}</td>
      <td>${d.nomeAutor}</td>
      <td>${d.nomeSetor}</td>
      <td>${d.dataEmissao}</td>
      <td>${d.numProcessoSimlam}</td>
    `;

    elTabelaBody.appendChild(tr);
  }

  if (pageData.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="7" class="text-center">Nenhum registro encontrado</td>`;
    elTabelaBody.appendChild(tr);
  }
}

function atualizarPaginacao() {
  if (!elPaginacao) return;

  elPaginacao.innerHTML = '';

  const totalPages = Math.ceil(filteredData.length / PAGE_SIZE) || 1;

  const criarBotao = (label, page, disabled = false, active = false) => {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.disabled = disabled;
    btn.className = 'page-btn' + (active ? ' active' : '');
    btn.addEventListener('click', () => {
      currentPage = page;
      atualizarTabela();
      atualizarPaginacao();
    });
    return btn;
  };

  // Anterior
  elPaginacao.appendChild(
    criarBotao('«', Math.max(1, currentPage - 1), currentPage === 1)
  );

  // Páginas (limita a 7 botões, por exemplo)
  const maxButtons = 7;
  let start = Math.max(1, currentPage - Math.floor(maxButtons / 2));
  let end = Math.min(totalPages, start + maxButtons - 1);
  if (end - start < maxButtons - 1) {
    start = Math.max(1, end - maxButtons + 1);
  }

  for (let p = start; p <= end; p++) {
    elPaginacao.appendChild(
      criarBotao(p.toString(), p, false, p === currentPage)
    );
  }

  // Próxima
  elPaginacao.appendChild(
    criarBotao('»', Math.min(totalPages, currentPage + 1), currentPage === totalPages)
  );
}

// ==================== GRÁFICOS (STATUS E CAMPUS) ====================

function atualizarGraficos() {
  atualizarGraficoStatus();
  atualizarGraficoCampus();
}

// --- Gráfico por Status (Situação do Título) ---
function atualizarGraficoStatus() {
  if (!ctxStatus) return;

  const contagem = agruparEContar(filteredData, d => d.situacaoTitulo || 'Sem situação');

  const labels = Object.keys(contagem).sort((a, b) =>
    a.localeCompare(b, 'pt-BR')
  );
  const dados = labels.map(l => contagem[l]);

  const config = {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Títulos por situação',
          data: dados
        }
      ]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: 'Status dos processos (Situação do título)'
        }
      }
    }
  };

  if (chartStatus) {
    chartStatus.data = config.data;
    chartStatus.options = config.options;
    chartStatus.update();
  } else {
    chartStatus = new Chart(ctxStatus, config);
  }
}

// --- Gráfico por Campus/Setor (top 10) ---
function atualizarGraficoCampus() {
  if (!ctxCampus) return;

  const contagem = agruparEContar(filteredData, d => d.nomeSetor || 'Sem setor');

  // ordenar por maior quantidade e pegar top 10
  const entries = Object.entries(contagem).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const labels = entries.map(([nome]) => nome);
  const dados = entries.map(([, qtd]) => qtd);

  const config = {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Títulos por campus/setor',
          data: dados
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: 'Distribuição por Campus/Setor (Top 10)'
        }
      },
      scales: {
        x: {
          ticks: { autoSkip: false, maxRotation: 45, minRotation: 0 }
        }
      }
    }
  };

  if (chartCampus) {
    chartCampus.data = config.data;
    chartCampus.options = config.options;
    chartCampus.update();
  } else {
    chartCampus = new Chart(ctxCampus, config);
  }
}

function agruparEContar(lista, chaveFn) {
  const mapa = {};
  for (const item of lista) {
    const chave = chaveFn(item);
    if (!chave) continue;
    mapa[chave] = (mapa[chave] || 0) + 1;
  }
  return mapa;
}

// ==================== MAPA DO ES ====================

function inicializarMapa() {
  const mapEl = $('#map-es');
  if (!mapEl || typeof L === 'undefined') {
    console.warn('Mapa não inicializado: verifique se o Leaflet foi incluído e se existe #map-es.');
    return;
  }

  // Centro aproximado do ES
  map = L.map('map-es').setView([-19.5, -40.5], 7);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);

  // Carrega o GeoJSON dos municípios do ES
  // Você precisa ter esse arquivo no repositório:
  // ex: es_municipios.geojson na raiz ou em /data/es_municipios.geojson
  fetch('es_municipios.geojson')
    .then(r => r.json())
    .then(geojson => {
      layerMunicipios = L.geoJSON(geojson, {
        style: estiloMunicipio,
        onEachFeature: onEachMunicipio
      }).addTo(map);
    })
    .catch(err => console.error('Erro ao carregar es_municipios.geojson', err));
}

function obterContagemPorMunicipio() {
  const counts = {};
  for (const d of filteredData) {
    const nome = (d.nomeMunicipio || '').toUpperCase();
    if (!nome) continue;
    counts[nome] = (counts[nome] || 0) + 1;
  }
  return counts;
}

function estiloMunicipio(feature) {
  const counts = obterContagemPorMunicipio();
  const nome = (feature.properties.NM_MUN || feature.properties.NOME || '').toUpperCase();

  const qtd = counts[nome] || 0;

  // simples "choropleth" por faixas
  let fillOpacity = 0.2;
  let weight = 0.5;

  if (qtd > 0) fillOpacity = 0.4;
  if (qtd >= 5) fillOpacity = 0.6;
  if (qtd >= 15) fillOpacity = 0.8;

  return {
    fillColor: '#3182bd',
    color: '#555',
    weight,
    fillOpacity
  };
}

function onEachMunicipio(feature, layer) {
  const counts = obterContagemPorMunicipio();
  const nome = (feature.properties.NM_MUN || feature.properties.NOME || '').toUpperCase();
  const qtd = counts[nome] || 0;

  const textoPopup = `<strong>${nome}</strong><br>
    Títulos IntegraCAR: <strong>${qtd}</strong>`;

  layer.bindPopup(textoPopup);
}

function atualizarMapa() {
  if (!layerMunicipios) return;
  // Para atualizar estilo com novos filtros, precisamos resetar o estilo
  layerMunicipios.setStyle(estiloMunicipio);
}
