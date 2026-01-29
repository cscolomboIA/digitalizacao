// js/relatorio.js
(() => {
  const CSV_URL = "data/TODOS_DADOS_UNIFICADOS.csv";

  const COL = {
    campus: "Campus",
    municipio: "Município",
    orientador: "Nome completo do avaliador do processo CAR",
    status: "Status",
  };

  const STATUS_KEYS = [
    { key: "01 - Digitalizado e Autuado", short: "01", label: "01 - Digitalizado e Autuado" },
    { key: "02 - Reprovado",             short: "02", label: "02 - Reprovado" },
    { key: "03 - Aprovado",             short: "03", label: "03 - Aprovado" },
    { key: "04 - Cancelado",            short: "04", label: "04 - Cancelado" },
    { key: "05 - Sem parecer",          short: "05", label: "05 - Sem parecer" },
  ];

  const el = {
    dimensao: document.getElementById("dimensao"),
    topN: document.getElementById("topN"),
    filtroCampus: document.getElementById("filtroCampus"),
    filtroMunicipio: document.getElementById("filtroMunicipio"),
    btnLimpar: document.getElementById("btnLimpar"),

    kpiTotal: document.getElementById("kpiTotal"),
    kpiLinhas: document.getElementById("kpiLinhas"),
    kpiCampi: document.getElementById("kpiCampi"),
    kpiMunicipios: document.getElementById("kpiMunicipios"),

    tituloTabela: document.getElementById("tituloTabela"),
    tituloGraficos: document.getElementById("tituloGraficos"),

    pivotHead: document.getElementById("pivotHead"),
    pivotBody: document.getElementById("pivotBody"),
    pivotFoot: document.getElementById("pivotFoot"),

    chart01: document.getElementById("chart01"),
    chart02: document.getElementById("chart02"),
    chart03: document.getElementById("chart03"),
    chart04: document.getElementById("chart04"),
    chart05: document.getElementById("chart05"),
  };

  let base = [];

  // -------------------------
  // Utils
  // -------------------------
  const norm = (v) => (v ?? "").toString().trim();

  const simplify = (s) =>
    norm(s)
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove acentos
      .replace(/[\s\-_/]+/g, " ")
      .trim()
      .toLowerCase();

  const removeUfSuffix = (s) => {
    let v = norm(s);
    if (!v) return "";
    return v
      .replace(/\s*-\s*ES\s*$/i, "")
      .replace(/\s*\(\s*ES\s*\)\s*$/i, "")
      .replace(/\s*\/\s*ES\s*$/i, "")
      .replace(/\s*-\s*E\s*S\s*$/i, "") // “- E S”
      .trim();
  };

  const uniqSorted = (arr) => {
    const set = new Set(arr.map(norm).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  };

  const loadCSV = () => new Promise((resolve, reject) => {
    Papa.parse(CSV_URL, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results?.errors?.length) console.error("Erros CSV:", results.errors);
        resolve(results.data || []);
      },
      error: (err) => reject(err),
    });
  });

  // -------------------------
  // Levenshtein (fuzzy match)
  // -------------------------
  const levenshtein = (a, b) => {
    a = simplify(a);
    b = simplify(b);
    const m = a.length, n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;

    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,     // delete
          dp[i][j - 1] + 1,     // insert
          dp[i - 1][j - 1] + cost // replace
        );
      }
    }
    return dp[m][n];
  };

  // =========================
  // MUNICÍPIOS: lista oficial ES (78)
  // =========================
  const ES_MUNICIPIOS = [
    "Afonso Cláudio","Águia Branca","Alegre","Alfredo Chaves","Alto Rio Novo","Anchieta","Apiacá","Aracruz",
    "Atílio Vivácqua","Baixo Guandu","Barra de São Francisco","Boa Esperança","Bom Jesus do Norte","Brejetuba",
    "Cachoeiro de Itapemirim","Cariacica","Castelo","Colatina","Conceição da Barra","Conceição do Castelo",
    "Divino de São Lourenço","Domingos Martins","Dores do Rio Preto","Ecoporanga","Fundão","Governador Lindenberg",
    "Guaçuí","Guarapari","Ibatiba","Ibiraçu","Ibitirama","Iconha","Irupi","Itaguaçu","Itapemirim","Itarana","Iúna",
    "Jaguaré","Jerônimo Monteiro","João Neiva","Laranja da Terra","Linhares","Mantenópolis","Marataízes",
    "Marechal Floriano","Marilândia","Mimoso do Sul","Montanha","Mucurici","Muniz Freire","Muqui","Nova Venécia",
    "Pancas","Pedro Canário","Pinheiros","Piúma","Ponto Belo","Presidente Kennedy","Rio Bananal","Rio Novo do Sul",
    "Santa Leopoldina","Santa Maria de Jetibá","Santa Teresa","São Domingos do Norte","São Gabriel da Palha",
    "São José do Calçado","São Mateus","São Roque do Canaã","Serra","Sooretama","Vargem Alta",
    "Venda Nova do Imigrante","Viana","Vila Pavão","Vila Valério","Vila Velha","Vitória"
  ];

  // índice simplificado -> nome oficial
  const ES_MUNICIPIOS_MAP = new Map(ES_MUNICIPIOS.map(n => [simplify(n), n]));

  // correções explícitas (além do fuzzy)
  const MUNICIPIO_FIX = new Map([
    ["cachoeiro de itapemerim", "Cachoeiro de Itapemirim"],
    ["cachoeiro de itapemirim es", "Cachoeiro de Itapemirim"],
    ["cachoeiro de itapemirim - es", "Cachoeiro de Itapemirim"],
    ["cachoeiro de itapemirim - es", "Cachoeiro de Itapemirim"],
    ["divino de são lourenço - es", "Divino de São Lourenço"],
    ["dores do rio preto - es", "Dores do Rio Preto"],
    ["guaçuí - es", "Guaçuí"],
    ["guaçuí- es", "Guaçuí"],
    ["ibitirama - es", "Ibitirama"],
    ["jerônimo monteiro - es", "Jerônimo Monteiro"],
    ["muniz freire - es", "Muniz Freire"],
    ["vila velha - es", "Vila Velha"],
    ["vitória - es", "Vitória"],
  ]);

  const normalizeMunicipio = (raw) => {
    let v = removeUfSuffix(raw);
    if (!v) return "";

    // correções diretas comuns
    v = v.replace(/Itapemerim/gi, "Itapemirim");
    v = v.replace(/\s+/g, " ").trim();

    const key = simplify(v);

    // 1) correções explícitas
    if (MUNICIPIO_FIX.has(key)) return MUNICIPIO_FIX.get(key);

    // 2) match exato com lista oficial
    if (ES_MUNICIPIOS_MAP.has(key)) return ES_MUNICIPIOS_MAP.get(key);

    // 3) fuzzy match contra lista oficial
    // threshold: nomes longos toleram 3; curtos toleram 2
    const maxDist = key.length >= 12 ? 3 : 2;

    let best = null;
    let bestD = Infinity;

    for (const [k, official] of ES_MUNICIPIOS_MAP.entries()) {
      const d = levenshtein(key, k);
      if (d < bestD) {
        bestD = d;
        best = official;
      }
      if (bestD === 0) break;
    }

    if (best && bestD <= maxDist) return best;

    // se não achou, devolve como está (já sem "- ES")
    return v;
  };

  // =========================
  // CAMPUS: dicionário simples (baseado na sua foto)
  // =========================
  // Regra: colapsar variações para um conjunto pequeno e consistente.
  const CAMPUS_CANON = [
    "Alegre",
    "Barra de São Francisco",
    "Cachoeiro de Itapemirim",
    "Colatina",
    "Ibatiba",
    "Itapina",
    "Linhares",
    "Montanha",
    "Nova Venécia",
    "Piúma",
    "Santa Teresa",
    "Vitória",
    "IDAF",      // aparece como origem/colaborador
    "Outros"     // se você já usa “Outros”
  ];

  const CAMPUS_MAP = new Map(CAMPUS_CANON.map(n => [simplify(n), n]));

  const CAMPUS_FIX = new Map([
    // variações de Alegre
    ["alegre - es", "Alegre"],
    ["alegre es", "Alegre"],
    ["ifes campus de alegre", "Alegre"],
    ["ifes campus alegre", "Alegre"],

    // variações de IDAF
    ["idaf", "IDAF"],
    ["i d a f", "IDAF"],

    // normaliza sem UF para evitar “Cachoeiro... - ES”
    ["cachoeiro de itapemirim es", "Cachoeiro de Itapemirim"],
    ["cachoeiro de itapemirim - es", "Cachoeiro de Itapemirim"],

    // Se aparecer “Piúma - ES”
    ["piuma - es", "Piúma"],
    ["piuma es", "Piúma"],

    // Se aparecerem problemas com acento
    ["vitoria", "Vitória"],
    ["santa teresa", "Santa Teresa"],
    ["nova venecia", "Nova Venécia"],
  ]);

  const normalizeCampus = (raw) => {
    let v = removeUfSuffix(raw);
    if (!v) return "";

    // correções explícitas
    const key0 = simplify(v);
    if (CAMPUS_FIX.has(key0)) return CAMPUS_FIX.get(key0);

    // match exato (com acento)
    const key = simplify(v);
    if (CAMPUS_MAP.has(key)) return CAMPUS_MAP.get(key);

    // fuzzy leve (para “Alegre - Es” etc, mas já tratamos acima)
    const maxDist = key.length >= 10 ? 3 : 2;

    let best = null;
    let bestD = Infinity;

    for (const [k, canon] of CAMPUS_MAP.entries()) {
      const d = levenshtein(key, k);
      if (d < bestD) { bestD = d; best = canon; }
      if (bestD === 0) break;
    }

    if (best && bestD <= maxDist) return best;

    // fallback
    return v;
  };

  // =========================
  // STATUS
  // =========================
  const statusNormalize = (s) => norm(s);

  // =========================
  // DIM / FILTERS
  // =========================
  const getDimKey = () => {
    const d = norm(el.dimensao?.value);
    if (d === "campus") return COL.campus;
    if (d === "municipio") return COL.municipio;
    return COL.orientador;
  };

  const getDimValue = () => norm(el.dimensao?.value);

  const getDimLabel = () => {
    const v = getDimValue();
    return v === "campus" ? "Campus" : v === "municipio" ? "Município" : "Orientador";
  };

  const getFilters = () => ({
    campus: norm(el.filtroCampus?.value),
    municipio: norm(el.filtroMunicipio?.value),
  });

  const applyFilters = (rows, f) => rows.filter((r) => {
    if (f.campus && norm(r[COL.campus]) !== f.campus) return false;
    if (f.municipio && norm(r[COL.municipio]) !== f.municipio) return false;
    return true;
  });

  // =========================
  // PIVOT
  // =========================
  const buildPivot = (rows, dimKey, dimValue) => {
    const pivot = new Map();

    for (const r of rows) {
      const rowLabel = norm(r[dimKey]) || "Não informado";
      const st = statusNormalize(r[COL.status]) || "Não informado";

      if (!pivot.has(rowLabel)) {
        const obj = {};
        for (const s of STATUS_KEYS) obj[s.key] = 0;
        obj.__total = 0;
        pivot.set(rowLabel, obj);
      }

      const obj = pivot.get(rowLabel);
      if (obj[st] !== undefined) {
        obj[st] += 1;
        obj.__total += 1;
      }
    }

    let arr = Array.from(pivot.entries()).map(([label, counts]) => ({ label, ...counts }));

    // Município: A→Z; demais: total desc
    if (dimValue === "municipio") arr.sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
    else arr.sort((a, b) => (b.__total || 0) - (a.__total || 0));

    return arr;
  };

  // =========================
  // HEATMAP
  // =========================
  const lerp = (a, b, t) => a + (b - a) * t;

  const heatColor = (value, min, max) => {
    if (max <= min) return "rgba(255,255,255,0)";
    const t = (value - min) / (max - min);

    const mid = 0.5;
    let r, g, b;

    if (t <= mid) {
      const tt = t / mid;
      r = lerp(232, 250, tt);
      g = lerp(110, 215, tt);
      b = lerp(97, 105, tt);
    } else {
      const tt = (t - mid) / (1 - mid);
      r = lerp(250, 120, tt);
      g = lerp(215, 200, tt);
      b = lerp(105, 155, tt);
    }

    return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},0.95)`;
  };

  const escapeHtml = (s) => {
    const span = document.createElement("span");
    span.textContent = s ?? "";
    return span.innerHTML;
  };

  const renderPivotTable = (pivotRows, dimLabel, topN) => {
    const rows = pivotRows.slice(0, topN);

    const mins = {};
    const maxs = {};
    for (const s of STATUS_KEYS) {
      mins[s.key] = Infinity;
      maxs[s.key] = -Infinity;
      for (const r of rows) {
        const v = r[s.key] || 0;
        mins[s.key] = Math.min(mins[s.key], v);
        maxs[s.key] = Math.max(maxs[s.key], v);
      }
      if (mins[s.key] === Infinity) mins[s.key] = 0;
      if (maxs[s.key] === -Infinity) maxs[s.key] = 0;
    }

    el.pivotHead.innerHTML = `
      <tr>
        <th>${dimLabel}</th>
        ${STATUS_KEYS.map(s => `<th>${s.label}</th>`).join("")}
        <th>Total</th>
      </tr>
    `;

    el.pivotBody.innerHTML = rows.map(r => {
      const cells = STATUS_KEYS.map(s => {
        const v = r[s.key] || 0;
        const bg = heatColor(v, mins[s.key], maxs[s.key]);
        return `<td class="cell-num" style="background:${bg}">${v}</td>`;
      }).join("");

      return `
        <tr>
          <th>${escapeHtml(r.label)}</th>
          ${cells}
          <td class="cell-num" style="background: rgba(250, 220, 140, 0.65); font-weight: 700;">${r.__total || 0}</td>
        </tr>
      `;
    }).join("");

    const colTotals = {};
    for (const s of STATUS_KEYS) colTotals[s.key] = 0;
    let grand = 0;

    for (const r of rows) {
      for (const s of STATUS_KEYS) colTotals[s.key] += (r[s.key] || 0);
      grand += (r.__total || 0);
    }

    el.pivotFoot.innerHTML = `
      <tr>
        <th>Total</th>
        ${STATUS_KEYS.map(s => `<td class="cell-num">${colTotals[s.key]}</td>`).join("")}
        <td class="cell-num">${grand}</td>
      </tr>
    `;
  };

  // =========================
  // CHARTS
  // =========================
  const renderChart = (targetDiv, title, xLabels, yValues) => {
    if (!targetDiv) return;

    const data = [{
      type: "bar",
      x: xLabels,
      y: yValues,
      text: yValues,
      textposition: "outside",
      hovertemplate: "%{x}<br>%{y}<extra></extra>",
    }];

    const layout = {
      title: { text: title, x: 0 },
      margin: { l: 60, r: 20, t: 60, b: 100 },
      xaxis: { tickangle: -45, automargin: true },
      yaxis: { rangemode: "tozero", automargin: true },
      height: 260,
    };

    Plotly.react(targetDiv, data, layout, { responsive: true, displayModeBar: false });
  };

  const renderCharts = (pivotRows, dimLabel, topN) => {
    const rows = pivotRows.slice(0, topN);
    const x = rows.map(r => r.label);
    const series = (statusKey) => rows.map(r => r[statusKey] || 0);

    renderChart(el.chart01, `01 - Digitalizado e Autuado versus ${dimLabel}`, x, series(STATUS_KEYS[0].key));
    renderChart(el.chart02, `02 - Reprovado versus ${dimLabel}`,             x, series(STATUS_KEYS[1].key));
    renderChart(el.chart03, `03 - Aprovado versus ${dimLabel}`,              x, series(STATUS_KEYS[2].key));
    renderChart(el.chart04, `04 - Cancelado versus ${dimLabel}`,             x, series(STATUS_KEYS[3].key));
    renderChart(el.chart05, `05 - Sem parecer versus ${dimLabel}`,           x, series(STATUS_KEYS[4].key));
  };

  // =========================
  // KPIs + Filters
  // =========================
  const renderKPIs = (rows, pivotRowsShown) => {
    if (el.kpiTotal) el.kpiTotal.textContent = rows.length.toLocaleString("pt-BR");
    if (el.kpiLinhas) el.kpiLinhas.textContent = pivotRowsShown.toLocaleString("pt-BR");

    const campi = uniqSorted(rows.map(r => r[COL.campus]));
    const municipios = uniqSorted(rows.map(r => r[COL.municipio]));

    if (el.kpiCampi) el.kpiCampi.textContent = campi.length.toLocaleString("pt-BR");
    if (el.kpiMunicipios) el.kpiMunicipios.textContent = municipios.length.toLocaleString("pt-BR");
  };

  const fillSelect = (selectEl, values) => {
    if (!selectEl) return;
    selectEl.innerHTML = `<option value="">Todos</option>`;
    for (const v of values) {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      selectEl.appendChild(opt);
    }
  };

  const initFilterOptions = (rows) => {
    fillSelect(el.filtroCampus, uniqSorted(rows.map(r => r[COL.campus])));
    fillSelect(el.filtroMunicipio, uniqSorted(rows.map(r => r[COL.municipio])));
  };

  // =========================
  // REFRESH
  // =========================
  const refresh = () => {
    const dimKey = getDimKey();
    const dimValue = getDimValue();
    const dimLabel = getDimLabel();
    const topN = parseInt(norm(el.topN?.value) || "30", 10);

    const f = getFilters();
    const recorte = applyFilters(base, f);

    const pivot = buildPivot(recorte, dimKey, dimValue);

    if (el.tituloTabela) el.tituloTabela.textContent = `${dimLabel} · Pivô (01..05 + Total)`;
    if (el.tituloGraficos) el.tituloGraficos.textContent = `${dimLabel} · Gráficos por Status`;

    renderKPIs(recorte, Math.min(pivot.length, topN));
    renderPivotTable(pivot, dimLabel, topN);
    renderCharts(pivot, dimLabel, topN);

    setTimeout(() => {
      [el.chart01, el.chart02, el.chart03, el.chart04, el.chart05].forEach(div => {
        if (div) Plotly.Plots.resize(div);
      });
    }, 50);
  };

  const wireEvents = () => {
    el.dimensao?.addEventListener("change", refresh);
    el.topN?.addEventListener("change", refresh);
    el.filtroCampus?.addEventListener("change", refresh);
    el.filtroMunicipio?.addEventListener("change", refresh);

    el.btnLimpar?.addEventListener("click", () => {
      if (el.filtroCampus) el.filtroCampus.value = "";
      if (el.filtroMunicipio) el.filtroMunicipio.value = "";
      refresh();
    });

    window.addEventListener("resize", () => refresh());
  };

  // =========================
  // BOOT
  // =========================
  document.addEventListener("DOMContentLoaded", async () => {
    try {
      wireEvents();
      base = await loadCSV();

      // ✅ normaliza Município e Campus ANTES de filtros/pivôs
      base = base
        .map(r => ({
          ...r,
          [COL.campus]: normalizeCampus(r[COL.campus]),
          [COL.municipio]: normalizeMunicipio(r[COL.municipio]),
          [COL.orientador]: norm(r[COL.orientador]),
          [COL.status]: statusNormalize(r[COL.status]),
        }))
        .filter(r => r[COL.status]);

      initFilterOptions(base);
      refresh();
    } catch (e) {
      console.error("Falha ao carregar CSV:", e);
      if (el.kpiTotal) el.kpiTotal.textContent = "Erro";
    }
  });
})();
