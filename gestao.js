// gestao.js — Painel executivo IntegraCAR

// ----------------------------------------------
// CONFIGURAÇÃO DO CSV LOCAL
// ----------------------------------------------
const SHEET_CSV_URL = "acompanhamento.csv";

let G_ROWS = [];
let G_COLS = {};
let pendenciasTable = null;

// ----------------------------------------------
// UTILIDADES
// ----------------------------------------------
function nrm(str) {
  return (str || "")
    .toString()
    .trim()
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

// ----------------------------------------------
// LEITURA DO CSV
// ----------------------------------------------
async function loadGestaoData() {
  const urlComVersao = `${SHEET_CSV_URL}?v=${Date.now()}`;

  const res = await fetch(urlComVersao, { cache: "no-store" });
  if (!res.ok) throw new Error("Falha ao carregar acompanhamento.csv");

  const text = await res.text();
  if (!text || text.trim().length === 0) {
    throw new Error("CSV retornou vazio.");
  }

  return new Promise((resolve) => {
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const cleaned = result.data.map(row => {
          const obj = {};
          for (const k in row) {
            const newKey = k ? k.toString().trim() : k;
            const val = row[k];
            obj[newKey] = typeof val === "string" ? val.trim() : val;
          }
          return obj;
        });
        console.log("Linhas carregadas:", cleaned.length);
        resolve(cleaned);
      }
    });
  });
}

// ----------------------------------------------
// DETECÇÃO DE COLUNAS — AJUSTADO PARA SUA PLANILHA
// ----------------------------------------------
function detectColumns(rows) {
  const headers = Object.keys(rows[0] || {});
  const find = fn => headers.find(fn);

  const campus = find(h => nrm(h).includes("campus"));
  const municipio = find(h => nrm(h).includes("munic"));
  const status = find(h => nrm(h).includes("status"));
  const avaliador = find(h => nrm(h).includes("aval") || nrm(h).includes("tecnico"));
  const codigo = find(h => nrm(h).includes("processo") || nrm(h).includes("edoc"));

  // *** ATUALIZADO PARA SUA PLANILHA ***
  const inicio = find(h =>
    nrm(h).includes("criacao") ||
    nrm(h).includes("criação") ||
    nrm(h).includes("abertura") ||
    nrm(h).includes("inicio") ||
    nrm(h).includes("analise")
  );

  const ultima = find(h =>
    nrm(h).includes("ultima") ||
    nrm(h).includes("atualiz")
  );

  // META – sua planilha não tinha essa coluna antes
  const meta = find(h =>
    nrm(h).includes("meta") ||
    nrm(h).includes("prazo") ||
    nrm(h).includes("sla")
  );

  console.log("Colunas detectadas:", { campus, municipio, status, avaliador, inicio, ultima, meta, codigo });

  return { campus, municipio, status, avaliador, inicio, ultima, meta, codigo };
}

// ----------------------------------------------
// CLASSIFICAÇÃO DE STATUS
// ----------------------------------------------
function classStatus(raw) {
  const s = nrm(raw);
  if (!s) return "indefinido";
  if (s.includes("aprov") || s.includes("defer") || s.includes("emitido")) return "concluido";
  if (s.includes("reprov") || s.includes("indefer") || s.includes("cancel")) return "concluido";
  if (s.includes("analise") || s.includes("andamento")) return "em_analise";
  if (s.includes("pend") || s.includes("aguard") || s.includes("nao iniciado") || s.includes("notificacao"))
    return "pendente";
  return "outros";
}

// ----------------------------------------------
// FILTROS
// ----------------------------------------------
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
  const uniq = Array.from(new Set(values.filter(Boolean).map(v => v.toString().trim()))).sort();
  el.innerHTML = `<option value="">${labelAll}</option>` +
    uniq.map(v => `<option value="${v}">${v}</option>`).join("");
}

// ----------------------------------------------
// KPIs + SLA
// ----------------------------------------------
function updateKPIs(rows) {
  const { status, inicio, ultima, meta } = G_COLS;

  let total = 0, concluidos = 0, emAnalise = 0, pendentes = 0;
  let inSLA = 0, outSLA = 0;

  let semMetaTotal = 0;
  let semMetaDentro = 0;
  let semMetaFora = 0;

  let concluidosForaPrazo = 0;

  rows.forEach(r => {
    total++;

    const rawStatus = status ? r[status] : "";
    const cls = classStatus(rawStatus);

    if (cls === "concluido") concluidos++;
    if (cls === "em_analise") emAnalise++;
    if (cls === "pendente") pendentes++;

    const start = inicio ? parseDate(r[inicio]) : null;
    const last  = ultima ? parseDate(r[ultima]) : null;

    if (!start) return; 

    const ref  = last || new Date();
    const dias = diffDays(start, ref);

    if (dias == null) return;

    const rawMetaVal = meta ? r[meta] : null;
    let metaDias = Number.parseInt(rawMetaVal);

    const sNorm = nrm(rawStatus);
    const isFinalizadoAutuado = sNorm.includes("finaliz") || sNorm.includes("autuad");

    const metaVazia = Number.isNaN(metaDias);

    if (metaVazia) {
      semMetaTotal++;

      if (isFinalizadoAutuado) {
        inSLA++;
        semMetaDentro++;
        return;
      } else {
        metaDias = 30;
      }
    }

    if (dias <= metaDias) {
      inSLA++;
      if (metaVazia) semMetaDentro++;
    } else {
      outSLA++;
      if (metaVazia) semMetaFora++;
      if (cls === "concluido") concluidosForaPrazo++;
    }
  });

  const sla = (inSLA + outSLA) > 0
    ? Math.round((inSLA * 100) / (inSLA + outSLA))
    : null;

  document.getElementById("kpiGTotal").textContent = total;
  document.getElementById("kpiGConcluidos").textContent = concluidos;
  document.getElementById("kpiGEmAnalise").textContent = emAnalise;
  document.getElementById("kpiGPendentes").textContent = pendentes;
  document.getElementById("kpiGSLA").textContent = sla == null ? "–" : sla + "%";

  const semMetaEl = document.getElementById("kpiGSemMeta");
  if (semMetaEl) {
    semMetaEl.textContent =
      `Processos sem meta explícita: ${semMetaTotal} (${semMetaDentro} dentro / ${semMetaFora} fora do prazo, meta padrão 30 dias)`;
  }

  const conclForaEl = document.getElementById("kpiGConcluidosForaPrazo");
  if (conclForaEl) conclForaEl.textContent = `Concluídos fora do prazo: ${concluidosForaPrazo}`;

  console.log("SLA DEBUG:", { total, inSLA, outSLA });
}

// ----------------------------------------------
// GRÁFICOS
// ----------------------------------------------
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
    orientation: "h"
  }], {
    margin: { t: 10, l: 140 }
  });
}

function plotPorCampus(rows) {
  const { campus, status } = G_COLS;
  if (!campus) return;

  const mapa = {};

  rows.forEach(r => {
    const c = (r[campus] || "Sem campus").toString().trim();
    const cls = classStatus(r[status]);

    if (!mapa[c]) mapa[c] = { concluidos:0, analise:0, pendentes:0 };
    if (cls === "concluido") mapa[c].concluidos++;
    if (cls === "em_analise") mapa[c].analise++;
    if (cls === "pendente") mapa[c].pendentes++;
  });

  const campi = Object.keys(mapa);

  Plotly.newPlot("chartGCampus", [
    { name:"Concluídos", x: campi.map(c=>mapa[c].concluidos), y:campi, type:"bar", orientation:"h" },
    { name:"Em análise", x: campi.map(c=>mapa[c].analise),    y:campi, type:"bar", orientation:"h" },
    { name:"Pendentes",  x: campi.map(c=>mapa[c].pendentes),  y:campi, type:"bar", orientation:"h" }
  ], {
    barmode:"stack",
    margin:{ t:10, l:180 }
  });
}

function plotPorMunicipio(rows) {
  const { municipio } = G_COLS;
  if (!municipio) return;

  const map = {};
  rows.forEach(r => {
    const m = (r[municipio] || "Sem município").toString().trim();
    map[m] = (map[m] || 0) + 1;
  });

  const labels = Object.keys(map);
  const values = labels.map(k => map[k]);

  Plotly.newPlot("chartGMunicipio", [{
    x: values,
    y: labels,
    type: "bar",
    orientation: "h"
  }], {
    margin:{ t:10, l:160 }
  });
}

function plotAvaliador(rows) {
  const { avaliador } = G_COLS;
  if (!avaliador) return;

  const map = {};
  rows.forEach(r => {
    const a = (r[avaliador] || "Sem avaliador").toString().trim();
    map[a] = (map[a] || 0) + 1;
  });

  const arr = Object.entries(map)
    .map(([k,v]) => ({k,v}))
    .sort((a,b) => b.v - a.v)
    .slice(0,10);

  Plotly.newPlot("chartGAvaliador", [{
    x: arr.map(x=>x.v),
    y: arr.map(x=>x.k),
    type: "bar",
    orientation: "h"
  }], {
    margin:{ t:10, l:200 }
  });
}

// ----------------------------------------------
// PENDÊNCIAS CRÍTICAS
// ----------------------------------------------
function buildPendencias(rows) {
  const { campus, municipio, status, inicio, ultima, meta, avaliador, codigo } = G_COLS;

  const data = [];

  rows.forEach(r => {
    const cls = classStatus(r[status]);
    if (cls === "concluido") return;

    const start = inicio ? parseDate(r[inicio]) : null;
    if (!start) return;

    const last = ultima ? parseDate(r[ultima]) : null;
    const ref = last || new Date();
    const dias = diffDays(start, ref);

    const rawMetaVal = meta ? r[meta] : null;
    let metaDias = Number.parseInt(rawMetaVal);

    const metaVazia = Number.isNaN(metaDias);

    if (metaVazia) metaDias = 30;

    if (dias == null || !metaDias) return;

    const falta = metaDias - dias;

    if (falta <= 5) {
      data.push({
        campus: campus ? r[campus] : "",
        municipio: municipio ? r[municipio] : "",
        status: r[status],
        dias,
        meta: metaDias,
        avaliador: r[avaliador] || "",
        codigo: r[codigo] || ""
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
    pageLength: 10
  });
}

// ----------------------------------------------
// INICIALIZAÇÃO
// ----------------------------------------------
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
    G_COLS = detectColumns(G_ROWS);

    fillSelect("fGestaoCampus", G_ROWS.map(r => r[G_COLS.campus]), "Todos");
    fillSelect("fGestaoMunicipio", G_ROWS.map(r => r[G_COLS.municipio]), "Todos");
    fillSelect("fGestaoStatus", G_ROWS.map(r => r[G_COLS.status]), "Todos");
    fillSelect("fGestaoAvaliador", G_ROWS.map(r => r[G_COLS.avaliador]), "Todos");

    document.getElementById("btnGestaoLimpar")
      ?.addEventListener("click", () => {
        ["fGestaoCampus","fGestaoMunicipio","fGestaoStatus","fGestaoAvaliador"]
          .forEach(id => document.getElementById(id).value = "");
        refreshGestao();
      });

    ["fGestaoCampus","fGestaoMunicipio","fGestaoStatus","fGestaoAvaliador"]
      .forEach(id => document.getElementById(id)?.addEventListener("change", refreshGestao));

    refreshGestao();
  } catch (err) {
    console.error("Erro ao iniciar painel:", err);
    alert("Erro ao carregar os dados.");
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initGestao);
} else {
  initGestao();
}
