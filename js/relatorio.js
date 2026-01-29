// js/relatorio.js
(() => {
  // =========================
  // CONFIG
  // =========================
  const CSV_URL = "data/TODOS_DADOS_UNIFICADOS.csv";

  // Colunas do CSV
  const COL = {
    campus: "Campus",
    municipio: "Município",
    orientador: "Nome completo do avaliador do processo CAR",
    status: "Status",
  };

  // Status esperados (ordem e rótulos como nas imagens)
  const STATUS_KEYS = [
    { key: "01 - Digitalizado e Autuado", short: "01", label: "01 - Digitalizado e Autuado" },
    { key: "02 - Reprovado",             short: "02", label: "02 - Reprovado" },
    { key: "03 - Aprovado",             short: "03", label: "03 - Aprovado" },
    { key: "04 - Cancelado",            short: "04", label: "04 - Cancelado" },
    { key: "05 - Sem parecer",          short: "05", label: "05 - Sem parecer" },
  ];

  // =========================
  // DOM
  // =========================
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

  // =========================
  // STATE
  // =========================
  let base = [];

  // =========================
  // HELPERS
  // =========================
  const norm = (v) => (v ?? "").toString().trim();

  const uniqSorted = (arr) => {
    const set = new Set(arr.map(norm).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  };

  const loadCSV = () => {
    return new Promise((resolve, reject) => {
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
  };

  const statusNormalize = (s) => {
    const v = norm(s);
    // Se vier com variações, tenta encaixar
    // Ex.: "01 - Digitalizado e Autuado" (ok)
    // Caso venha algo levemente diferente, você pode ampliar aqui.
    return v;
  };

  const getDimKey = () => {
    const d = norm(el.dimensao?.value);
    if (d === "campus") return COL.campus;
    if (d === "municipio") return COL.municipio;
    return COL.orientador; // orientador
  };

  const getFilters = () => ({
    campus: norm(el.filtroCampus?.value),
    municipio: norm(el.filtroMunicipio?.value),
  });

  const applyFilters = (rows, f) => {
    return rows.filter((r) => {
      if (f.campus && norm(r[COL.campus]) !== f.campus) return false;
      if (f.municipio && norm(r[COL.municipio]) !== f.municipio) return false;
      return true;
    });
  };

  // =========================
  // PIVOT
  // =========================
  const buildPivot = (rows, dimKey) => {
    // pivot[rowLabel][statusKey] = count
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
      } else {
        // status fora do esperado -> ignora (ou você pode criar coluna “Outros”)
        // aqui vamos ignorar para manter igual às imagens
      }
    }

    // transforma em array e ordena por total desc
    const arr = Array.from(pivot.entries())
      .map(([label, counts]) => ({ label, ...counts }))
      .sort((a, b) => (b.__total || 0) - (a.__total || 0));

    return arr;
  };

  // =========================
  // HEATMAP COLOR
  // (aproxima a lógica do Sheets: baixo = vermelho, alto = verde)
  // =========================
  const lerp = (a, b, t) => a + (b - a) * t;

  const heatColor = (value, min, max) => {
    if (max <= min) return "rgba(255,255,255,0)";

    const t = (value - min) / (max - min); // 0..1
    // cores: vermelho -> amarelo -> verde
    // vamos interpolar em 2 fases
    const mid = 0.5;

    let r, g, b;
    if (t <= mid) {
      // vermelho(232,110,97) -> amarelo(250,215,105)
      const tt = t / mid;
      r = lerp(232, 250, tt);
      g = lerp(110, 215, tt);
      b = lerp(97, 105, tt);
    } else {
      // amarelo(250,215,105) -> verde(120,200,155)
      const tt = (t - mid) / (1 - mid);
      r = lerp(250, 120, tt);
      g = lerp(215, 200, tt);
      b = lerp(105, 155, tt);
    }

    return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},0.95)`;
  };

  // =========================
  // RENDER: Pivot Table
  // =========================
  const renderPivotTable = (pivotRows, dimLabel, topN) => {
    const rows = pivotRows.slice(0, topN);

    // min/max por coluna (para heatmap por coluna, como no Sheets)
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

    // Header
    const headHtml = `
      <tr>
        <th>${dimLabel}</th>
        ${STATUS_KEYS.map(s => `<th>${s.label}</th>`).join("")}
        <th>Total</th>
      </tr>
    `;
    el.pivotHead.innerHTML = headHtml;

    // Body
    const bodyHtml = rows.map(r => {
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

    el.pivotBody.innerHTML = bodyHtml;

    // Footer totals (col totals + total geral)
    const colTotals = {};
    for (const s of STATUS_KEYS) colTotals[s.key] = 0;
    let grand = 0;

    for (const r of rows) {
      for (const s of STATUS_KEYS) colTotals[s.key] += (r[s.key] || 0);
      grand += (r.__total || 0);
    }

    const footHtml = `
      <tr>
        <th>Total</th>
        ${STATUS_KEYS.map(s => `<td class="cell-num">${colTotals[s.key]}</td>`).join("")}
        <td class="cell-num">${grand}</td>
      </tr>
    `;
    el.pivotFoot.innerHTML = footHtml;
  };

  const escapeHtml = (s) => {
    const span = document.createElement("span");
    span.textContent = s ?? "";
    return span.innerHTML;
  };

  // =========================
  // RENDER: Charts (01..05 versus dimensão)
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
      margin: { l: 60, r: 20, t: 60, b: 90 },
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
  // KPIs
  // =========================
  const renderKPIs = (rows, pivotRowsShown) => {
    if (el.kpiTotal) el.kpiTotal.textContent = rows.length.toLocaleString("pt-BR");
    if (el.kpiLinhas) el.kpiLinhas.textContent = pivotRowsShown.toLocaleString("pt-BR");

    const campi = uniqSorted(rows.map(r => r[COL.campus]));
    const municipios = uniqSorted(rows.map(r => r[COL.municipio]));

    if (el.kpiCampi) el.kpiCampi.textContent = campi.length.toLocaleString("pt-BR");
    if (el.kpiMunicipios) el.kpiMunicipios.textContent = municipios.length.toLocaleString("pt-BR");
  };

  // =========================
  // FILTER DROPDOWNS
  // =========================
  const initFilterOptions = (rows) => {
    const campi = uniqSorted(rows.map(r => r[COL.campus]));
    const municipios = uniqSorted(rows.map(r => r[COL.municipio]));

    fillSelect(el.filtroCampus, campi);
    fillSelect(el.filtroMunicipio, municipios);
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

  // =========================
  // REFRESH
  // =========================
  const refresh = () => {
    const dimKey = getDimKey();
    const dimValue = norm(el.dimensao?.value);
    const dimLabel =
      dimValue === "campus" ? "Campus" :
      dimValue === "municipio" ? "Município" :
      "Orientador";

    const topN = parseInt(norm(el.topN?.value) || "30", 10);

    const f = getFilters();
    const recorte = applyFilters(base, f);

    const pivot = buildPivot(recorte, dimKey);

    // Atualiza títulos
    if (el.tituloTabela) el.tituloTabela.textContent = `${dimLabel} · Pivô (01..05 + Total)`;
    if (el.tituloGraficos) el.tituloGraficos.textContent = `${dimLabel} · Gráficos por Status`;

    // KPIs
    renderKPIs(recorte, Math.min(pivot.length, topN));

    // Tabela + charts
    renderPivotTable(pivot, dimLabel, topN);
    renderCharts(pivot, dimLabel, topN);

    // Resize Plotly (segurança)
    setTimeout(() => {
      [el.chart01, el.chart02, el.chart03, el.chart04, el.chart05].forEach(div => {
        if (div) Plotly.Plots.resize(div);
      });
    }, 50);
  };

  // =========================
  // EVENTS
  // =========================
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

      // normaliza campos essenciais
      base = base
        .map(r => ({
          ...r,
          [COL.campus]: norm(r[COL.campus]),
          [COL.municipio]: norm(r[COL.municipio]),
          [COL.orientador]: norm(r[COL.orientador]),
          [COL.status]: statusNormalize(r[COL.status]),
        }))
        .filter(r => r[COL.status]); // mantém linhas com status

      initFilterOptions(base);
      refresh();
    } catch (e) {
      console.error("Falha ao carregar CSV:", e);
      if (el.kpiTotal) el.kpiTotal.textContent = "Erro";
    }
  });
})();
