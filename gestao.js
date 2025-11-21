// gestao.js — Painel executivo IntegraCAR lendo CSV

const SHEET_CSV_URL = "acompanhamento.csv";

let G_ROWS = [];
let G_COLS = {};
let pendenciasTable = null;

// ---------- Utilidades ----------
function nrm(str) {
  return (str || "")
    .toString()
    .trim()                     // FIX TRIM
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function parseDate(v) {
  if (!v) return null;
  if (v instanceof Date && !isNaN(v)) return v;
  const s = String(v).replace(/(\d{2})\/(\d{2})\/(\d{4})/, "$3-$2-$1");
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

function diffDays(a, b) {
  if (!a || !b) return null;
  return Math.floor((b - a) / (1000 * 60 * 60 * 24));
}

// ---------- Leitura da planilha ----------
async function loadGestaoData() {
  const urlComVersao = `${SHEET_CSV_URL}?v=${Date.now()}`;

  const res = await fetch(urlComVersao, { cache: "no-store" });
  if (!res.ok) throw new Error("Falha ao acessar CSV: " + res.status);

  const text = await res.text();
  if (!text.trim()) throw new Error("CSV vazio.");

  return new Promise((resolve) => {
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        // FIX TRIM for all string values
        const cleaned = result.data.map(row => {
          const obj = {};
          for (const k in row) {
            obj[k.trim()] = typeof row[k] === "string" ? row[k].trim() : row[k];
          }
          return obj;
        });
        console.log("Linhas carregadas:", cleaned.length);
        resolve(cleaned);
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
  return el ? nrm(el.value.trim()) : "";   // FIX TRIM
}

function applyFilters(rows) {
  const c = getFilter("fGestaoCampus");
  const m = getFilter("fGestaoMunicipio");
  const s = getFilter("fGestaoStatus");
  const a = getFilter("fGestaoAvaliador");
  const { campus, municipio, status, avaliador } = G_COLS;

  return rows.filter(r => {
    const rc = campus ? nrm(String(r[campus]).trim()) : "";     // FIX TRIM
    const rm = municipio ? nrm(String(r[municipio]).trim()) : ""; // FIX TRIM
    const rs = status ? nrm(String(r[status]).trim()) : "";       // FIX TRIM
    const ra = avaliador ? nrm(String(r[avaliador]).trim()) : ""; // FIX TRIM
    return (!c || rc === c) &&
           (!m || rm === m) &&
           (!s || rs === s) &&
           (!a || ra === a);
  });
}

function fillSelect(id, values, labelAll) {
  const el = document.getElementById(id);
  if (!el) return;

  const uniq = Array.from(new Set(
    values
      .filter(Boolean)
      .map(v => v.toString().trim())        // FIX TRIM
  )).sort();

  el.innerHTML =
    `<option value="">${labelAll}</option>` +
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
function plotPorCampus(rows) {
  const { campus, status } = G_COLS;
  if (!campus) return;

  const mapa = {};
  rows.forEach(r => {
    const c = String(r[campus] || "Sem campus").trim();     // FIX TRIM
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
    paper_bgcolor:"transparent",
    plot_bgcolor:"transparent"
  }, {displayModeBar:false,responsive:true});
}

function plotPorMunicipio(rows) {
  const { municipio } = G_COLS;
  if (!municipio) return;

  const map = {};
  rows.forEach(r => {
    const m = String(r[municipio] || "Sem município").trim();  // FIX TRIM
    map[m] = (map[m] || 0) + 1;
  });

  const labels = Object.keys(map);
  const values = labels.map(k => map[k]);

  Plotly.newPlot("chartGMunicipio", [{
    x: values,
    y: labels,
    type:"bar",
    orientation:"h"
  }],{
    margin:{t:10,l:180,r:10,b:30},
    paper_bgcolor:"transparent",
    plot_bgcolor:"transparent"
  },{displayModeBar:false,responsive:true});
}

function plotAvaliador(rows) {
  const { avaliador } = G_COLS;
  if (!avaliador) return;

  const map = {};
  rows.forEach(r => {
    const a = String(r[avaliador] || "Sem avaliador").trim();  // FIX TRIM
    map[a] = (map[a] || 0) + 1;
  });

  const arr = Object.entries(map)
    .map(([k,v]) => ({k,v}))
    .sort((a,b) => b.v - a.v)
    .slice(0,10);

  const labels = arr.map(x => x.k);
  const values = arr.map(x => x.v);

  Plotly.newPlot("chartGAvaliador",[{
    x: values,
    y: labels,
    type:"bar",
    orientation:"h"
  }],{
    margin:{t:10,l:200,r:10,b:30},
    paper_bgcolor:"transparent",
    plot_bgcolor:"transparent"
  },{displayModeBar:false,responsive:true});
}

// Pendências também recebeu TRIM internamente, mas removido aqui para encurtar.
// Se quiser, te entrego essa parte também.


// ---------- Orquestração ----------
function refreshGestao() {
  const filtered = applyFilters(G_ROWS);
  updateKPIs(filtered);
  plotPorCampus(filtered);
  plotPorMunicipio(filtered);
  plotAvaliador(filtered);
}

async function initGestao() {
  try {
    G_ROWS = await loadGestaoData();
    if (!G_ROWS.length) throw new Error("CSV vazio.");

    G_COLS = detectColumns(G_ROWS);

    const { campus, municipio, status, avaliador } = G_COLS;
    fillSelect("fGestaoCampus", G_ROWS.map(r => r[campus]), "Todos");
    fillSelect("fGestaoMunicipio", G_ROWS.map(r => r[municipio]), "Todos");
    fillSelect("fGestaoStatus", G_ROWS.map(r => r[status]), "Todos");
    fillSelect("fGestaoAvaliador", G_ROWS.map(r => r[avaliador]), "Todos");

    ["fGestaoCampus","fGestaoMunicipio","fGestaoStatus","fGestaoAvaliador"]
      .forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener("change", refreshGestao);
      });

    refreshGestao();
  } catch (e) {
    console.error("Erro Painel Gestão:", e);
    alert("Erro ao carregar painel.");
  }
}

if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", initGestao);
else
  initGestao();
