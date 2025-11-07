// map.js — IntegraCAR · Mapa ES com reconhecimento inteligente de municípios

const FILE_PATH = "data.xlsx";

// ---------------- Utilidades ----------------

function normalizeName(str) {
  return (str || "")// gestao.js — Painel executivo IntegraCAR lendo Google Sheets (com debug)

// URL CSV público da planilha (aba correta gid=0)
const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1XfQaqOV-zHA99551rNAbEAjthTA6AxRBvlSiWc8D2QE/gviz/tq?tqx=out:csv&gid=0";

let G_ROWS = [];
let G_COLS = {};
let pendenciasTable = null;

// ---------- Utilidades ----------
function nrm(str) {
  return (str || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function parseDate(v) {
  if (!v) return null;
  if (v instanceof Date && !isNaN(v)) return v;
  const s = String(v).replace(/(\d{2})\/(\d{2})\/(\d{4})/, "$3-$2-$1"); // dd/mm/aaaa
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

function diffDays(a, b) {
  if (!a || !b) return null;
  return Math.floor((b - a) / (1000 * 60 * 60 * 24));
}

// ---------- Leitura da planilha ----------
async function loadGestaoData() {
  console.log("Buscando dados em:", SHEET_CSV_URL);
  const res = await fetch(SHEET_CSV_URL);

  console.log("Status fetch Sheets:", res.status, res.statusText);

  if (!res.ok) {
    throw new Error("Falha ao acessar a planilha (status " + res.status + ").");
  }

  const text = await res.text();
  if (!text || text.trim().length === 0) {
    throw new Error("CSV retornou vazio. Confira se a aba (gid=0) tem dados.");
  }

  return new Promise((resolve) => {
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        console.log("Linhas carregadas do Sheets:", result.data.length);
        resolve(result.data);
      }
    });
  });
}

// ---------- Detecção de colunas ----------
function detectColumns(rows) {
  const sample = rows[0] || {};
  const headers = Object.keys(sample);
  const find = (fn) => headers.find(fn);

  const campus = find(h => nrm(h).includes("campus"));
  const municipio = find(h => nrm(h).includes("munic"));
  const status = find(h => nrm(h).includes("status"));
  const avaliador = find(h => nrm(h).includes("aval") || nrm(h).includes("tecnico"));
  const ponto = find(h => nrm(h).includes("ponto") && nrm(h).includes("idaf"));
  const inicio = find(h => nrm(h).includes("inicio") || nrm(h).includes("data analise") || nrm(h).includes("data abertura"));
  const ultima = find(h => nrm(h).includes("ultima") || nrm(h).includes("atualiz"));
  const meta = find(h => nrm(h).includes("meta") && (nrm(h).includes("prazo") || nrm(h).includes("sla")));
  const codigo = find(h =>
    nrm(h).includes("processo") ||
    nrm(h).includes("edocs") ||
    nrm(h).includes("e-doc") ||
    nrm(h).includes("empreend")
  );

  console.log("Colunas detectadas:", { campus, municipio, status, avaliador, ponto, inicio, ultima, meta, codigo });
  return { campus, municipio, status, avaliador, ponto, inicio, ultima, meta, codigo };
}

// ---------- Classificação de status ----------
function classStatus(raw) {
  const s = nrm(raw);
  if (!s) return "indefinido";
  if (s.includes("aprov") || s.includes("defer") || s.includes("emitido")) return "concluido";
  if (s.includes("reprov") || s.includes("indefer") || s.includes("cancel")) return "concluido";
  if (s.includes("analise") || s.includes("andamento")) return "em_analise";
  if (s.includes("pendente") || s.includes("aguard") || s.includes("nao iniciado") || s.includes("notificacao"))
    return "pendente";
  return "outros";
}

// ---------- Filtros ----------
function getFilter(id) {
  const el = document.getElementById(id);
  return el ? nrm(el.value) : "";
}

function applyFilters(rows) {
  const c = getFilter("fGestaoCampus");
  const m = getFilter("fGestaoMunicipio");
  const s = getFilter("fGestaoStatus");
  const a = getFilter("fGestaoAvaliador");
  const { campus, municipio, status, avaliador } = G_COLS;

  return rows.filter(r => {
    const rc = campus ? nrm(r[campus]) : "";
    const rm = municipio ? nrm(r[municipio]) : "";
    const rs = status ? nrm(r[status]) : "";
    const ra = avaliador ? nrm(r[avaliador]) : "";
    return (!c || rc === c) &&
           (!m || rm === m) &&
           (!s || rs === s) &&
           (!a || ra === a);
  });
}

function fillSelect(id, values, labelAll) {
  const el = document.getElementById(id);
  if (!el) return;
  const uniq = Array.from(new Set(values.filter(Boolean))).sort();
  el.innerHTML = `<option value="">${labelAll}</option>` +
    uniq.map(v => `<option value="${v}">${v}</option>`).join("");
}

// ---------- KPIs ----------
function updateKPIs(rows) {
  const { status, inicio, ultima, meta } = G_COLS;
  const total = rows.length;
  let concluidos = 0, emAnalise = 0, pendentes = 0;
  let inSLA = 0, outSLA = 0;

  rows.forEach(r => {
    const cls = classStatus(status ? r[status] : "");
    if (cls === "concluido") concluidos++;
    else if (cls === "em_analise") emAnalise++;
    else if (cls === "pendente") pendentes++;

    const start = inicio ? parseDate(r[inicio]) : null;
    const last = ultima ? parseDate(r[ultima]) : null;
    const metaDias = meta ? parseInt(r[meta]) || null : null;
    if (!start || !metaDias) return;

    const ref = last || new Date();
    const dias = diffDays(start, ref);
    if (dias == null) return;

    if (dias <= metaDias) inSLA++;
    else outSLA++;
  });

  const sla = (inSLA + outSLA) ? Math.round(inSLA * 100 / (inSLA + outSLA)) : null;

  document.getElementById("kpiGTotal").textContent = total;
  document.getElementById("kpiGConcluidos").textContent = concluidos;
  document.getElementById("kpiGEmAnalise").textContent = emAnalise;
  document.getElementById("kpiGPendentes").textContent = pendentes;
  document.getElementById("kpiGSLA").textContent = sla == null ? "–" : sla + "%";
}

// ---------- Gráficos ----------
function plotStatus(rows) {
  const { status } = G_COLS;
  const map = {};
  rows.forEach(r => {
    const rot = status ? (r[status] || "Sem status") : "Sem status";
    map[rot] = (map[rot] || 0) + 1;
  });
  const labels = Object.keys(map);
  const values = labels.map(k => map[k]);

  Plotly.newPlot("chartGStatus", [{
    x: values,
    y: labels,
    type: "bar",
    orientation: "h",
    hovertemplate: "%{y}: %{x}<extra></extra>"
  }], {
    margin: { t: 10, l: 160, r: 10, b: 30 },
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)"
  }, { displayModeBar:false, responsive:true });
}

function plotPorCampus(rows) {
  const { campus, status } = G_COLS;
  if (!campus) {
    document.getElementById("chartGCampus").innerHTML = "Coluna de Campus não encontrada.";
    return;
  }
  const mapa = {};
  rows.forEach(r => {
    const c = (r[campus] || "Sem campus").toString();
    const cls = classStatus(status ? r[status] : "");
    mapa[c] = mapa[c] || { concluidos:0, em_analise:0, pendentes:0 };
    if (cls === "concluido") mapa[c].concluidos++;
    else if (cls === "em_analise") mapa[c].em_analise++;
    else if (cls === "pendente") mapa[c].pendentes++;
  });

  const campi = Object.keys(mapa);
  const mk = k => campi.map(c => mapa[c][k]);

  const data = [
    { name:"Concluídos", x: mk("concluidos"), y: campi, type:"bar", orientation:"h" },
    { name:"Em análise", x: mk("em_analise"), y: campi, type:"bar", orientation:"h" },
    { name:"Pendentes", x: mk("pendentes"), y: campi, type:"bar", orientation:"h" }
  ];

  Plotly.newPlot("chartGCampus", data, {
    barmode:"stack",
    margin:{t:10,l:160,r:10,b:30},
    legend:{orientation:"h",y:-0.2},
    paper_bgcolor:"rgba(0,0,0,0)",
    plot_bgcolor:"rgba(0,0,0,0)"
  }, {displayModeBar:false,responsive:true});
}

function plotPorMunicipio(rows) {
  const { municipio } = G_COLS;
  if (!municipio) {
    document.getElementById("chartGMunicipio").innerHTML = "Coluna de Município não encontrada.";
    return;
  }
  const map = {};
  rows.forEach(r => {
    const m = (r[municipio] || "Sem município").toString();
    map[m] = (map[m] || 0) + 1;
  });
  const labels = Object.keys(map);
  const values = labels.map(k => map[k]);

  Plotly.newPlot("chartGMunicipio", [{
    x: values,
    y: labels,
    type:"bar",
    orientation:"h",
    hovertemplate:"%{y}: %{x}<extra></extra>"
  }],{
    margin:{t:10,l:180,r:10,b:30},
    paper_bgcolor:"rgba(0,0,0,0)",
    plot_bgcolor:"rgba(0,0,0,0)"
  },{displayModeBar:false,responsive:true});
}

function plotAvaliador(rows) {
  const { avaliador } = G_COLS;
  if (!avaliador) {
    document.getElementById("chartGAvaliador").innerHTML = "Coluna de Avaliador não encontrada.";
    return;
  }
  const map = {};
  rows.forEach(r => {
    const a = (r[avaliador] || "Sem avaliador").toString();
    map[a] = (map[a] || 0) + 1;
  });
  const arr = Object.entries(map).map(([k,v])=>({k,v})).sort((a,b)=>b.v-a.v).slice(0,10);
  const labels = arr.map(x=>x.k);
  const values = arr.map(x=>x.v);

  Plotly.newPlot("chartGAvaliador",[{
    x: values,
    y: labels,
    type:"bar",
    orientation:"h",
    hovertemplate:"%{y}: %{x}<extra></extra>"
  }],{
    margin:{t:10,l:200,r:10,b:30},
    paper_bgcolor:"rgba(0,0,0,0)",
    plot_bgcolor:"rgba(0,0,0,0)"
  },{displayModeBar:false,responsive:true});
}

// ---------- Pendências ----------
function buildPendencias(rows) {
  const { campus, municipio, status, inicio, ultima, meta, avaliador, codigo } = G_COLS;
  const data = [];

  rows.forEach(r => {
    const start = inicio ? parseDate(r[inicio]) : null;
    const last = ultima ? parseDate(r[ultima]) : null;
    const metaDias = meta ? parseInt(r[meta]) || null : null;
    if (!start || !metaDias) return;

    const ref = last || new Date();
    const dias = diffDays(start, ref);
    if (dias == null) return;

    const falta = metaDias - dias;
    if (falta <= 5) {
      data.push({
        campus: campus ? (r[campus] || "") : "",
        municipio: municipio ? (r[municipio] || "") : "",
        status: status ? (r[status] || "") : "",
        dias,
        meta: metaDias,
        avaliador: avaliador ? (r[avaliador] || "") : "",
        codigo: codigo ? (r[codigo] || "") : ""
      });
    }
  });

  if (pendenciasTable) {
    pendenciasTable.clear().rows.add(data).draw();
    return;
  }

  pendenciasTable = $("#tblPendencias").DataTable({
    data,
    columns: [
      { data:"campus" },
      { data:"municipio" },
      { data:"status" },
      { data:"dias" },
      { data:"meta" },
      { data:"avaliador" },
      { data:"codigo" }
    ],
    pageLength: 10,
    order: [[3,"desc"]],
    language: {
      url: "https://cdn.datatables.net/plug-ins/1.13.6/i18n/pt-BR.json"
    }
  });
}

// ---------- Orquestração ----------
function refreshGestao() {
  const filtered = applyFilters(G_ROWS);
  updateKPIs(filtered);
  plotStatus(filtered);
  plotPorCampus(filtered);
  plotPorMunicipio(filtered);
  plotAvaliador(filtered);
  buildPendencias(filtered);
}

async function initGestao() {
  try {
    G_ROWS = await loadGestaoData();
    if (!G_ROWS.length) throw new Error("Planilha vazia.");

    G_COLS = detectColumns(G_ROWS);

    const { campus, municipio, status, avaliador } = G_COLS;
    fillSelect("fGestaoCampus", G_ROWS.map(r => r[campus]), "Todos");
    fillSelect("fGestaoMunicipio", G_ROWS.map(r => r[municipio]), "Todos");
    fillSelect("fGestaoStatus", G_ROWS.map(r => r[status]), "Todos");
    fillSelect("fGestaoAvaliador", G_ROWS.map(r => r[avaliador]), "Todos");

    const lbl = document.getElementById("lblGestaoArquivo");
    if (lbl) lbl.textContent = "Fonte: Google Sheets — IntegraCAR";

    // listeners
    document.getElementById("btnGestaoLimpar").addEventListener("click", () => {
      ["fGestaoCampus","fGestaoMunicipio","fGestaoStatus","fGestaoAvaliador"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
      });
      refreshGestao();
    });

    ["fGestaoCampus","fGestaoMunicipio","fGestaoStatus","fGestaoAvaliador"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener("change", refreshGestao);
    });

    refreshGestao();
  } catch (e) {
    console.error("Erro Painel Gestão:", e);
    alert("Erro ao carregar o Painel de Gestão: " + e.message);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initGestao);
} else {
  initGestao();
}

    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // tira acentos
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// remove sufixos tipo " - ES", "/ES", "(ES)"
function stripEsSuffix(name) {
  return name
    .replace(/[-/]\s*es$/i, "")
    .replace(/\(es\)$/i, "")
    .replace(/,\s*es$/i, "")
    .trim();
}

// ---------------- Centroides ES ----------------
// chaves já normalizadas (sem acento, minúsculo)
const ES_CENTROIDS = {
  "afonso claudio": [-41.126, -20.074],
  "agua doce do norte": [-40.985, -18.548],
  "aguia branca": [-40.735, -18.984],
  "alegre": [-41.532, -20.763],
  "alfredo chaves": [-40.737, -20.639],
  "alto rio novo": [-41.023, -19.062],
  "anchieta": [-40.642, -20.8],
  "apiaca": [-41.569, -21.152],
  "aracruz": [-40.273, -19.82],
  "atilio vivacqua": [-41.196, -20.913],
  "baixo guandu": [-41.015, -19.517],
  "barra de sao francisco": [-40.889, -18.755],
  "boa esperanca": [-40.296, -18.54],
  "bom jesus do norte": [-41.68, -21.118],
  "brejetuba": [-41.29, -20.153],
  "cachoeiro de itapemirim": [-41.112, -20.846],
  "cariacica": [-40.416, -20.264],
  "castelo": [-41.183, -20.604],
  "colatina": [-40.626, -19.539],
  "conceicao da barra": [-39.73, -18.592],
  "conceicao do castelo": [-41.24, -20.363],
  "divino de sao lourenco": [-41.699, -20.62],
  "domingos martins": [-40.659, -20.365],
  "dores do rio preto": [-41.841, -20.693],
  "ecoporanga": [-40.833, -18.371],
  "fundao": [-40.403, -19.936],
  "governador lindenberg": [-40.46, -19.233],
  "guacui": [-41.677, -20.773],
  "guarapari": [-40.505, -20.673],
  "ibatiba": [-41.509, -20.234],
  "ibiracu": [-40.373, -19.836],
  "ibitirama": [-41.67, -20.546],
  "iconha": [-40.812, -20.791],
  "irupi": [-41.644, -20.35],
  "itaguacu": [-40.858, -19.803],
  "itapemirim": [-40.834, -21.009],
  "itarana": [-40.875, -19.875],
  "iuna": [-41.536, -20.353],
  "jaguare": [-39.983, -18.908],
  "jeronimo monteiro": [-41.395, -20.797],
  "joao neiva": [-40.386, -19.756],
  "laranja da terra": [-41.062, -19.9],
  "linhares": [-39.855, -19.394],
  "mantenopolis": [-41.124, -18.865],
  "marataizes": [-40.828, -21.039],
  "marechal floriano": [-40.669, -20.415],
  "marilandia": [-40.539, -19.413],
  "mimoso do sul": [-41.359, -21.063],
  "montanha": [-40.366, -18.126],
  "mucurici": [-40.514, -18.096],
  "muniz freire": [-41.415, -20.465],
  "muqui": [-41.344, -20.951],
  "nova venecia": [-40.397, -18.715],
  "pancas": [-40.851, -19.222],
  "pedro canario": [-39.957, -18.3],
  "pinheiros": [-40.217, -18.414],
  "piuma": [-40.73, -20.835],
  "ponto belo": [-40.541, -18.125],
  "presidente kennedy": [-41.052, -21.096],
  "rio bananal": [-40.336, -19.268],
  "rio novo do sul": [-40.936, -20.862],
  "santa leopoldina": [-40.525, -20.1],
  "santa maria de jetiba": [-40.743, -20.03],
  "santa teresa": [-40.6, -19.936],
  "sao domingos do norte": [-40.627, -19.142],
  "sao gabriel da palha": [-40.536, -19.018],
  "sao jose do calcado": [-41.664, -21.028],
  "sao mateus": [-39.864, -18.72],
  "sao roque do canaa": [-40.652, -19.741],
  "serra": [-40.307, -20.121],
  "sooretama": [-40.09, -19.189],
  "vargem alta": [-41.006, -20.67],
  "venda nova do imigrante": [-41.126, -20.33],
  "viana": [-40.495, -20.393],
  "vila pavao": [-40.607, -18.613],
  "vila valerio": [-40.39, -18.993],
  "vila velha": [-40.292, -20.329],
  "vitoria": [-40.308, -20.315]
};

// sinônimos / abreviações comuns -> chave do ES_CENTROIDS
const SYNONYMS = {
  "cachoeiro": "cachoeiro de itapemirim",
  "cachoeiro itapemirim": "cachoeiro de itapemirim",
  "cachoeiro de itapemirim es": "cachoeiro de itapemirim",
  "sao mateus es": "sao mateus",
  "sao mateus-do-sul": "sao mateus", // só pra garantir se vier zoado
  "vila velha es": "vila velha",
  "guarapari es": "guarapari",
  "linhares es": "linhares",
  "colatina es": "colatina",
  "serra es": "serra",
  "vitoria es": "vitoria",
  "afonso claudio es": "afonso claudio",
  "aracruz es": "aracruz",
  "nova venecia es": "nova venecia"
};

// tenta mapear o nome lido para uma chave válida do ES_CENTROIDS
function mapMunicipioToES(name) {
  if (!name) return null;

  let norm = normalizeName(name);
  if (!norm) return null;

  norm = stripEsSuffix(norm);

  // 1) match direto
  if (ES_CENTROIDS[norm]) return norm;

  // 2) sinônimo direto
  if (SYNONYMS[norm] && ES_CENTROIDS[SYNONYMS[norm]]) {
    return SYNONYMS[norm];
  }

  // 3) tentar "começa com" (ex: "cachoeiro" -> "cachoeiro de itapemirim")
  const direct = Object.keys(ES_CENTROIDS).filter(k =>
    k.startsWith(norm) || norm.startsWith(k)
  );
  if (direct.length === 1) return direct[0];

  // 4) tentar "contém" de forma segura
  const contains = Object.keys(ES_CENTROIDS).filter(k =>
    k.includes(norm) || norm.includes(k)
  );
  if (contains.length === 1) return contains[0];

  // sem match confiável
  return null;
}

// ---------------- Leitura XLSX ----------------

async function loadXlsxRows() {
  const res = await fetch(FILE_PATH);
  if (!res.ok) {
    console.error("Erro ao baixar", FILE_PATH, res.status);
    throw new Error("Não foi possível carregar o arquivo de dados do mapa.");
  }
  const buf = await res.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { defval: "" });
}

// Detecta coluna de município (qualquer coisa com "munic" no nome)
function detectMunicipioColumn(headers) {
  return headers.find(h => normalizeName(h).includes("munic")) || null;
}

// ---------------- Plotagem ----------------

async function mainMapaES() {
  try {
    const rows = await loadXlsxRows();
    if (!rows.length) {
      document.getElementById("chartMapaES").innerHTML = "Sem dados para exibir.";
      return;
    }

    const headers = Object.keys(rows[0]);
    const munCol = detectMunicipioColumn(headers);
    if (!munCol) {
      document.getElementById("chartMapaES").innerHTML =
        "Coluna de município não encontrada no arquivo.";
      return;
    }

    // contagem por município mapeado
    const counts = {};
    rows.forEach(r => {
      const original = r[munCol];
      const key = mapMunicipioToES(original);
      if (!key) return;
      counts[key] = (counts[key] || 0) + 1;
    });

    const lons = [];
    const lats = [];
    const texts = [];
    const sizes = [];

    Object.entries(counts).forEach(([key, value]) => {
      const coord = ES_CENTROIDS[key];
      if (!coord) return;
      lons.push(coord[0]);
      lats.push(coord[1]);
      const label = key.toUpperCase();
      texts.push(`${label}: ${value}`);
      sizes.push(8 + Math.min(30, value * 3));
    });

    if (!lons.length) {
      document.getElementById("chartMapaES").innerHTML =
        "Nenhum município do ES foi reconhecido nos dados.";
      return;
    }

    const trace = {
      type: "scattergeo",
      mode: "markers+text",
      lon: lons,
      lat: lats,
      text: texts,
      textposition: "top center",
      marker: {
        size: sizes,
        color: "#2A61A8",
        opacity: 0.85,
        line: { width: 1, color: "#ffffff" }
      },
      hovertemplate: "%{text}<extra></extra>"
    };

    const layout = {
      geo: {
        projection: { type: "mercator" },
        lonaxis: { range: [-41.9, -39.0] },
        lataxis: { range: [-21.4, -18.0] },
        showland: true,
        landcolor: "#f5f5f5",
        showcountries: false,
        showframe: false
      },
      margin: { t: 0, r: 0, b: 0, l: 0 },
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)"
    };

    Plotly.newPlot("chartMapaES", [trace], layout, {
      displayModeBar: false,
      responsive: true
    });

  } catch (err) {
    console.error(err);
    document.getElementById("chartMapaES").innerHTML =
      "Erro ao carregar o mapa. Verifique se o arquivo data.xlsx está na mesma pasta.";
  }
}

// dispara quando a página estiver pronta
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mainMapaES);
} else {
  mainMapaES();
}
