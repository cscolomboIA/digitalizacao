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

// Normaliza nomes de municípios para forma canônica
function normalizarMunicipio(nome) {
  if (!nome) return "Sem município";
  const original = nome.toString().trim();
  const base = nrm(original); // sem acento/minúsculo

  // Corrige variações de Cachoeiro de Itapemirim
  if (base.includes("cachoeiro") && base.includes("itapem")) {
    return "Cachoeiro de Itapemirim";
  }

  return original;
}

// Normaliza nomes de campus para forma canônica
function normalizarCampus(nome) {
  if (!nome) return "Sem campus";
  const original = nome.toString().trim();
  const base = nrm(original);

  if (base === "alegre") return "Alegre";
  if (base === "barra de sao francisco") return "Barra de São Francisco";
  if (base === "cachoeiro de itapemirim" || base === "cachoeiro de itapemerim")
    return "Cachoeiro de Itapemirim";
  if (base === "colatina") return "Colatina";
  if (base === "itapina") return "Itapina";
  if (base === "linhares") return "Linhares";
  if (base === "montanha") return "Montanha";
  if (base === "nova venecia" || base === "nova veneccia")
    return "Nova Venécia";
  if (base === "piuma") return "Piúma";
  if (base === "santa teresa") return "Santa Teresa";
  if (base === "vitoria") return "Vitória";
  if (base === "idaf") return "Idaf";

  return original || "Sem campus";
}

// Normaliza nomes de avaliadores (para agrupamento/filtro)
function normalizarAvaliador(nome) {
  if (!nome) return "Sem avaliador";
  const original = nome.toString().trim();
  const base = nrm(original);

  // Unifica Lyndemberg / Lyndenberg em um único nome
  if (base.startsWith("lyndemberg") || base.startsWith("lyndenberg")) {
    return "Lyndemberg";
  }

  // aqui podemos adicionar outros ajustes no futuro
  return original;
}

// gera chave canônica *bem* tolerante a pequenas diferenças
function canonicalAvaliadorKey(nome) {
  const normFull = nrm(normalizarAvaliador(nome)); // ex: "patricia borges dias"
  if (!normFull) return "sem avaliador";

  let partes = normFull.split(" ").filter(Boolean);
  if (partes.length === 0) return "sem avaliador";

  const colapsa = s => s.replace(/(.)\1+/g, "$1"); // remove letras duplicadas

  let first = colapsa(partes[0]);
  let last  = colapsa(partes[partes.length - 1]);

  // usa só prefixo pra ser mais tolerante a erro interno
  first = first.slice(0, 4);
  last  = last.slice(0, 4);

  return `${first} ${last}`; // ex: "pati dias"
}

// Mostra apenas primeiro + último nome (para label no gráfico)
function resumirNomeAvaliador(nome) {
  if (!nome) return "";
  const partes = nome.toString().trim().split(/\s+/).filter(Boolean);
  if (partes.length === 1) return partes[0];
  const primeiro = partes[0];
  const ultimo = partes[partes.length - 1];
  return `${primeiro} ${ultimo}`;
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

  // datas
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

  // meta / prazo
  const meta = find(h =>
    nrm(h).includes("meta") ||
    nrm(h).includes("prazo") ||
    nrm(h).includes("sla")
  );

  // tipo de solução do processo
  const tipoSolucao = find(h =>
    nrm(h).includes("soluc") ||
    nrm(h).includes("tipo de solucao") ||
    nrm(h).includes("tipo_solucao")
  );

  // colunas extra: orientador, bolsista, consultor IDAF
  const orientador = find(h => nrm(h).includes("orientad"));
  const bolsista   = find(h => nrm(h).includes("bolsista"));
  const consultorIdaf = find(h =>
    nrm(h).includes("consultor") ||
    (nrm(h).includes("idaf") && nrm(h).includes("consul"))
  );

  console.log("Colunas detectadas:", {
    campus,
    municipio,
    status,
    avaliador,
    inicio,
    ultima,
    meta,
    codigo,
    tipoSolucao,
    orientador,
    bolsista,
    consultorIdaf
  });

  return {
    campus,
    municipio,
    status,
    avaliador,
    inicio,
    ultima,
    meta,
    codigo,
    tipoSolucao,
    orientador,
    bolsista,
    consultorIdaf
  };
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
    const rc = campus ? nrm(normalizarCampus(r[campus])) : "";
    const rm = municipio ? nrm(normalizarMunicipio(r[municipio])) : "";
    const rs = status ? nrm(r[status]) : "";
    const ra = avaliador ? nrm(normalizarAvaliador(r[avaliador])) : "";

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

// Abrevia labels de status para caber melhor no eixo Y
function abreviarStatus(texto) {
  if (!texto) return texto;
  let t = texto.trim();

  const lower = t.toLowerCase();
  if (lower.startsWith("aprovado")) t = "Aprov. " + t.substring(8).trim();
  if (lower.startsWith("aprovada")) t = "Aprov. " + t.substring(8).trim();
  if (lower.startsWith("indeferido")) t = "Indef. " + t.substring(10).trim();
  if (lower.startsWith("indeferida")) t = "Indef. " + t.substring(10).trim();
  if (lower.startsWith("reprovado")) t = "Reprov. " + t.substring(9).trim();
  if (lower.startsWith("reprovada")) t = "Reprov. " + t.substring(9).trim();
  if (lower.startsWith("aguardando")) t = "Aguard. " + t.substring(10).trim();

  const MAX_LEN = 30;
  if (t.length > MAX_LEN) {
    t = t.substring(0, MAX_LEN) + "...";
  }

  return t;
}

function plotStatus(rows) {
  const { status } = G_COLS;
  const map = {};

  rows.forEach(r => {
    const rot = status ? (r[status] || "Sem status") : "Sem status";
    map[rot] = (map[rot] || 0) + 1;
  });

  const labelsOriginais = Object.keys(map);
  const values = labelsOriginais.map(k => map[k]);

  const labelsAjustados = labelsOriginais.map(l => abreviarStatus(l));

  const num = labelsAjustados.length || 1;
  const height = Math.max(240, Math.min(700, num * 28));

  Plotly.newPlot("chartGStatus", [{
    x: values,
    y: labelsAjustados,
    type: "bar",
    orientation: "h",
    hoverinfo: "x",
    hovertemplate: "%{x}<extra></extra>"
  }], {
    height: height,
    margin: {
      t: 10,
      l: 220,
      r: 20,
      b: 40
    },
    yaxis: {
      automargin: true,
      tickfont: { size: 11 }
    },
    xaxis: {
      automargin: true,
      tickfont: { size: 11 }
    },
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)"
  }, {
    displayModeBar: false,
    responsive: true
  });
}

// --- Processos por Campus (barras horizontais, nomes normalizados, tooltip só número) ---
function plotPorCampus(rows) {
  const { campus } = G_COLS;
  if (!campus) return;

  const map = {};
  rows.forEach(r => {
    const cRaw = (r[campus] || "Sem campus").toString().trim();
    const c = normalizarCampus(cRaw);
    map[c] = (map[c] || 0) + 1;
  });

  const labels = Object.keys(map);
  const values = labels.map(k => map[k]);

  const num = labels.length || 1;
  const height = Math.max(260, Math.min(700, num * 28));

  Plotly.newPlot("chartGCampus", [{
    x: values,
    y: labels,
    type: "bar",
    orientation: "h",
    hoverinfo: "x",
    hovertemplate: "%{x}<extra></extra>"
  }], {
    height,
    margin:{ t:10, l:200, r:20, b:40 },
    paper_bgcolor:"rgba(0,0,0,0)",
    plot_bgcolor:"rgba(0,0,0,0)",
    yaxis: { automargin: true, tickfont: { size: 11 } },
    xaxis: { automargin: true, tickfont: { size: 11 } }
  }, {
    displayModeBar:false,
    responsive:true
  });
}

// --- Processos por Município (tooltip só número) ---
function plotPorMunicipio(rows) {
  const { municipio } = G_COLS;
  if (!municipio) return;

  const map = {};
  rows.forEach(r => {
    const mRaw = (r[municipio] || "Sem município").toString().trim();
    const m = normalizarMunicipio(mRaw);
    map[m] = (map[m] || 0) + 1;
  });

  const labels = Object.keys(map);
  const values = labels.map(k => map[k]);

  const num = labels.length || 1;
  const height = Math.max(260, Math.min(700, num * 28));

  Plotly.newPlot("chartGMunicipio", [{
    x: values,
    y: labels,
    type: "bar",
    orientation: "h",
    hoverinfo: "x",
    hovertemplate: "%{x}<extra></extra>"
  }], {
    height,
    margin:{ t:10, l:200, r:20, b:40 },
    paper_bgcolor:"rgba(0,0,0,0)",
    plot_bgcolor:"rgba(0,0,0,0)",
    yaxis: { automargin: true, tickfont: { size: 11 } },
    xaxis: { automargin: true, tickfont: { size: 11 } }
  }, {
    displayModeBar:false,
    responsive:true
  });
}

// --- Desempenho por Avaliador (top 10) ---
// agrupa por chave canônica tolerante a erros, mostra só primeiro + último nome
function plotAvaliador(rows) {
  const { avaliador } = G_COLS;
  if (!avaliador) return;

  const map = {};
  rows.forEach(r => {
    const aRaw = (r[avaliador] || "Sem avaliador").toString().trim();
    if (!aRaw) return;

    const key = canonicalAvaliadorKey(aRaw);   // chave robusta p/ agrupamento
    const labelNorm = normalizarAvaliador(aRaw);

    if (!map[key]) {
      map[key] = { labelFull: labelNorm, count: 0 };
    }
    map[key].count += 1;
  });

  const arr = Object.values(map)
    .sort((a,b) => b.count - a.count)
    .slice(0,10);

  const valores = arr.map(x => x.count);
  const labelsCurta = arr.map(x => resumirNomeAvaliador(x.labelFull));

  Plotly.newPlot("chartGAvaliador", [{
    x: valores,
    y: labelsCurta,
    type: "bar",
    orientation: "h",
    hoverinfo: "x",
    hovertemplate: "%{x}<extra></extra>"
  }], {
    margin:{ t:10, l:200 }
  });
}

// --- Tipo de solução dada ao processo ---
function plotTipoSolucao(rows) {
  const { tipoSolucao } = G_COLS;
  if (!tipoSolucao) return;

  const map = {};
  rows.forEach(r => {
    const t = (r[tipoSolucao] || "Sem informação").toString().trim();
    if (!t) return;
    map[t] = (map[t] || 0) + 1;
  });

  const labels = Object.keys(map);
  const values = labels.map(k => map[k]);

  const num = labels.length || 1;
  const height = Math.max(240, Math.min(700, num * 28));

  Plotly.newPlot("chartGTipoSolucao", [{
    x: values,
    y: labels,
    type: "bar",
    orientation: "h",
    hoverinfo: "x",
    hovertemplate: "%{x}<extra></extra>"
  }], {
    height,
    margin: { t:10, l:220, r:20, b:40 },
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    yaxis: { automargin: true, tickfont: { size: 11 } },
    xaxis: { automargin: true, tickfont: { size: 11 } }
  }, {
    displayModeBar: false,
    responsive: true
  });
}

// --- Orientadores (barras horizontais) ---
function plotPorOrientador(rows) {
  const { orientador } = G_COLS;
  if (!orientador) return;

  const map = {};
  rows.forEach(r => {
    const raw = (r[orientador] || "Sem orientador").toString().trim();
    if (!raw) return;

    const key = canonicalAvaliadorKey(raw);
    if (!map[key]) {
      map[key] = { labelFull: raw, count: 0 };
    }
    map[key].count += 1;
  });

  const arr = Object.values(map)
    .sort((a, b) => b.count - a.count);

  const valores = arr.map(x => x.count);
  const labelsCurta = arr.map(x => resumirNomeAvaliador(x.labelFull));

  const num = labelsCurta.length || 1;
  const height = Math.max(240, Math.min(700, num * 28));

  Plotly.newPlot("chartGOrientador", [{
    x: valores,
    y: labelsCurta,
    type: "bar",
    orientation: "h",
    hoverinfo: "x",
    hovertemplate: "%{x}<extra></extra>"
  }], {
    height,
    margin:{ t:10, l:200, r:20, b:40 },
    paper_bgcolor:"rgba(0,0,0,0)",
    plot_bgcolor:"rgba(0,0,0,0)",
    yaxis: { automargin: true, tickfont: { size: 11 } },
    xaxis: { automargin: true, tickfont: { size: 11 } }
  }, {
    displayModeBar:false,
    responsive:true
  });
}

// --- Bolsistas (barras horizontais) ---
function plotPorBolsista(rows) {
  const { bolsista } = G_COLS;
  if (!bolsista) return;

  const map = {};
  rows.forEach(r => {
    const raw = (r[bolsista] || "Sem bolsista").toString().trim();
    if (!raw) return;

    const key = canonicalAvaliadorKey(raw);
    if (!map[key]) {
      map[key] = { labelFull: raw, count: 0 };
    }
    map[key].count += 1;
  });

  const arr = Object.values(map)
    .sort((a, b) => b.count - a.count);

  const valores = arr.map(x => x.count);
  const labelsCurta = arr.map(x => resumirNomeAvaliador(x.labelFull));

  const num = labelsCurta.length || 1;
  const height = Math.max(240, Math.min(700, num * 28));

  Plotly.newPlot("chartGBolsista", [{
    x: valores,
    y: labelsCurta,
    type: "bar",
    orientation: "h",
    hoverinfo: "x",
    hovertemplate: "%{x}<extra></extra>"
  }], {
    height,
    margin:{ t:10, l:200, r:20, b:40 },
    paper_bgcolor:"rgba(0,0,0,0)",
    plot_bgcolor:"rgba(0,0,0,0)",
    yaxis: { automargin: true, tickfont: { size: 11 } },
    xaxis: { automargin: true, tickfont: { size: 11 } }
  }, {
    displayModeBar:false,
    responsive:true
  });
}

// --- Consultores do IDAF (barras horizontais) ---
function plotPorConsultorIDAF(rows) {
  const { consultorIdaf } = G_COLS;
  if (!consultorIdaf) return;

  const map = {};
  rows.forEach(r => {
    const raw = (r[consultorIdaf] || "Sem consultor").toString().trim();
    if (!raw) return;

    const key = canonicalAvaliadorKey(raw);
    if (!map[key]) {
      map[key] = { labelFull: raw, count: 0 };
    }
    map[key].count += 1;
  });

  const arr = Object.values(map)
    .sort((a, b) => b.count - a.count);

  const valores = arr.map(x => x.count);
  const labelsCurta = arr.map(x => resumirNomeAvaliador(x.labelFull));

  const num = labelsCurta.length || 1;
  const height = Math.max(240, Math.min(700, num * 28));

  Plotly.newPlot("chartGConsultorIdaf", [{
    x: valores,
    y: labelsCurta,
    type: "bar",
    orientation: "h",
    hoverinfo: "x",
    hovertemplate: "%{x}<extra></extra>"
  }], {
    height,
    margin:{ t:10, l:200, r:20, b:40 },
    paper_bgcolor:"rgba(0,0,0,0)",
    plot_bgcolor:"rgba(0,0,0,0)",
    yaxis: { automargin: true, tickfont: { size: 11 } },
    xaxis: { automargin: true, tickfont: { size: 11 } }
  }, {
    displayModeBar:false,
    responsive:true
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
        campus: campus ? normalizarCampus(r[campus]) : "",
        municipio: municipio ? normalizarMunicipio(r[municipio]) : "",
        status: r[status],
        dias,
        meta: metaDias,
        avaliador: avaliador ? normalizarAvaliador(r[avaliador]) : "",
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
  plotTipoSolucao(filtered);
  plotPorOrientador(filtered);
  plotPorBolsista(filtered);
  plotPorConsultorIDAF(filtered);
  buildPendencias(filtered);
}

async function initGestao() {
  try {
    G_ROWS = await loadGestaoData();
    G_COLS = detectColumns(G_ROWS);

    fillSelect("fGestaoCampus", G_ROWS.map(r => normalizarCampus(r[G_COLS.campus])), "Todos");
    fillSelect("fGestaoMunicipio", G_ROWS.map(r => normalizarMunicipio(r[G_COLS.municipio])), "Todos");
    fillSelect("fGestaoStatus", G_ROWS.map(r => r[G_COLS.status]), "Todos");
    fillSelect("fGestaoAvaliador", G_ROWS.map(r => normalizarAvaliador(r[G_COLS.avaliador])), "Todos");

    const btn = document.getElementById("btnGestaoLimpar");
    if (btn) {
      btn.addEventListener("click", () => {
        ["fGestaoCampus","fGestaoMunicipio","fGestaoStatus","fGestaoAvaliador"]
          .forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = "";
          });
        refreshGestao();
      });
    }

    ["fGestaoCampus","fGestaoMunicipio","fGestaoStatus","fGestaoAvaliador"]
      .forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener("change", refreshGestao);
      });

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
