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

  let base = [];
  let el = null;

  // paginação (Dimensão/linhas)
  let pageIndex = 0; // 0-based

  // -------------------------
  // Utils
  // -------------------------
  const norm = (v) => (v ?? "").toString().trim();

  // robusto contra NBSP e hífens unicode
  const simplify = (s) =>
    norm(s)
      .replace(/\u00A0/g, " ")                 // NBSP -> espaço normal
      .replace(/[‐-‒–—−]/g, "-")               // todos os dashes unicode -> "-"
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove acentos
      .replace(/[\s\-_/]+/g, " ")              // normaliza separadores
      .trim()
      .toLowerCase();

  const removeUfSuffix = (s) => {
    let v = norm(s)
      .replace(/\u00A0/g, " ")
      .replace(/[‐-‒–—−]/g, "-");             // garante "-" padrão
    if (!v) return "";

    return v
      .replace(/\s*-\s*ES\s*$/i, "")
      .replace(/\s*\(\s*ES\s*\)\s*$/i, "")
      .replace(/\s*\/\s*ES\s*$/i, "")
      .replace(/\s*-\s*E\s*S\s*$/i, "")
      .trim();
  };

  const uniqSorted = (arr) => {
    const set = new Set(arr.map(norm).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  };

  // ✅ getField — pega campo mesmo com variação de header (acento/case)
  const getField = (row, ...names) => {
    // 1) tentativa direta (nome exato)
    for (const n of names) {
      if (row && row[n] != null && String(row[n]).trim() !== "") return row[n];
    }

    // 2) fallback: tenta bater ignorando acentos/case (pra headers tipo "Municipio")
    const keys = row ? Object.keys(row) : [];
    const wanted = names.map(simplify);

    for (const k of keys) {
      const ks = simplify(k);
      if (wanted.includes(ks)) return row[k];
    }

    return "";
  };

  const loadCSV = () =>
    new Promise((resolve, reject) => {
      if (typeof Papa === "undefined") {
        reject(new Error("PapaParse (Papa) não carregou. Verifique os <script> no HTML."));
        return;
      }

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
    const m = a.length,
      n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;

    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + cost
        );
      }
    }
    return dp[m][n];
  };

  // =========================
  // MUNICÍPIOS: lista oficial ES (78)
  // =========================
  const ES_MUNICIPIOS = [
    "Afonso Cláudio",
    "Águia Branca",
    "Alegre",
    "Alfredo Chaves",
    "Alto Rio Novo",
    "Anchieta",
    "Apiacá",
    "Aracruz",
    "Atílio Vivácqua",
    "Baixo Guandu",
    "Barra de São Francisco",
    "Boa Esperança",
    "Bom Jesus do Norte",
    "Brejetuba",
    "Cachoeiro de Itapemirim",
    "Cariacica",
    "Castelo",
    "Colatina",
    "Conceição da Barra",
    "Conceição do Castelo",
    "Divino de São Lourenço",
    "Domingos Martins",
    "Dores do Rio Preto",
    "Ecoporanga",
    "Fundão",
    "Governador Lindenberg",
    "Guaçuí",
    "Guarapari",
    "Ibatiba",
    "Ibiraçu",
    "Ibitirama",
    "Iconha",
    "Irupi",
    "Itaguaçu",
    "Itapemirim",
    "Itarana",
    "Iúna",
    "Jaguaré",
    "Jerônimo Monteiro",
    "João Neiva",
    "Laranja da Terra",
    "Linhares",
    "Mantenópolis",
    "Marataízes",
    "Marechal Floriano",
    "Marilândia",
    "Mimoso do Sul",
    "Montanha",
    "Mucurici",
    "Muniz Freire",
    "Muqui",
    "Nova Venécia",
    "Pancas",
    "Pedro Canário",
    "Pinheiros",
    "Piúma",
    "Ponto Belo",
    "Presidente Kennedy",
    "Rio Bananal",
    "Rio Novo do Sul",
    "Santa Leopoldina",
    "Santa Maria de Jetibá",
    "Santa Teresa",
    "São Domingos do Norte",
    "São Gabriel da Palha",
    "São José do Calçado",
    "São Mateus",
    "São Roque do Canaã",
    "Serra",
    "Sooretama",
    "Vargem Alta",
    "Venda Nova do Imigrante",
    "Viana",
    "Vila Pavão",
    "Vila Valério",
    "Vila Velha",
    "Vitória",
  ];

  const ES_MUNICIPIOS_MAP = new Map(ES_MUNICIPIOS.map((n) => [simplify(n), n]));

  // Correções explícitas "humanas" -> chave normalizada automaticamente
  const MUNICIPIO_FIX_RAW = [
    ["Cachoeiro de Itapemerim", "Cachoeiro de Itapemirim"],
    ["Cachoeiro de Itapemirim - ES", "Cachoeiro de Itapemirim"],
    ["Divino de São Lourenço - ES", "Divino de São Lourenço"],
    ["Dores do Rio Preto - ES", "Dores do Rio Preto"],
    ["Guaçuí - ES", "Guaçuí"],
    ["Guaçuí- ES", "Guaçuí"],
    ["Ibitirama - ES", "Ibitirama"],
    ["Jerônimo Monteiro - ES", "Jerônimo Monteiro"],
    ["Muniz Freire - ES", "Muniz Freire"],
    ["Vila Velha - ES", "Vila Velha"],
    ["Vitória - ES", "Vitória"],
  ];

  const MUNICIPIO_FIX = new Map(
    MUNICIPIO_FIX_RAW.map(([from, to]) => [simplify(removeUfSuffix(from)), to])
  );

  const normalizeMunicipio = (raw) => {
    if (!raw) return "";

    let v = removeUfSuffix(raw);
    if (!v) return "";

    // correções diretas comuns
    v = v.replace(/Itapemerim/gi, "Itapemirim").replace(/\s+/g, " ").trim();

    const key = simplify(v);

    // 1) correções explícitas
    if (MUNICIPIO_FIX.has(key)) return MUNICIPIO_FIX.get(key);

    // 2) match exato com lista oficial
    if (ES_MUNICIPIOS_MAP.has(key)) return ES_MUNICIPIOS_MAP.get(key);

    // 3) fuzzy
    const maxDist = key.length >= 12 ? 3 : 2;
    let best = null;
    let bestDist = Infinity;

    for (const [k, official] of ES_MUNICIPIOS_MAP.entries()) {
      const d = levenshtein(key, k);
      if (d < bestDist) {
        bestDist = d;
        best = official;
      }
      if (bestDist === 0) break;
    }

    if (best && bestDist <= maxDist) return best;

    return v;
  };

  // =========================
  // CAMPUS
  // =========================
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
    "IDAF",
    "Outros",
  ];

  const CAMPUS_MAP = new Map(CAMPUS_CANON.map((n) => [simplify(n), n]));

  const CAMPUS_FIX = new Map([
    ["alegre - es", "Alegre"],
    ["alegre es", "Alegre"],
    ["ifes campus de alegre", "Alegre"],
    ["ifes campus alegre", "Alegre"],

    ["idaf", "IDAF"],
    ["i d a f", "IDAF"],

    ["cachoeiro de itapemirim es", "Cachoeiro de Itapemirim"],
    ["cachoeiro de itapemirim - es", "Cachoeiro de Itapemirim"],

    ["piuma - es", "Piúma"],
    ["piuma es", "Piúma"],

    ["vitoria", "Vitória"],
    ["santa teresa", "Santa Teresa"],
    ["nova venecia", "Nova Venécia"],
  ]);

  const normalizeCampus = (raw) => {
    let v = removeUfSuffix(raw);
    if (!v) return "";

    const key0 = simplify(v);
    if (CAMPUS_FIX.has(key0)) return CAMPUS_FIX.get(key0);

    const key = simplify(v);
    if (CAMPUS_MAP.has(key)) return CAMPUS_MAP.get(key);

    const maxDist = key.length >= 10 ? 3 : 2;
    let best = null;
    let bestD = Infinity;

    for (const [k, canon] of CAMPUS_MAP.entries()) {
      const d = levenshtein(key, k);
      if (d < bestD) {
        bestD = d;
        best = canon;
      }
      if (bestD === 0) break;
    }

    if (best && bestD <= maxDist) return best;

    return v;
  };

  // =========================
  // STATUS
  // =========================
  const statusNormalize = (s) => norm(s);

  // -------------------------
  // DOM refs (após DOM pronto)
  // -------------------------
  const initDom = () => ({
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
  });

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

  const applyFilters = (rows, f) =>
    rows.filter((r) => {
      if (f.campus && norm(r[COL.campus]) !== f.campus) return false;
      if (f.municipio && norm(r[COL.municipio]) !== f.municipio) return false;
      return true;
    });

  // =========================
  // PIVOT
  // =========================
  const buildPivot = (rows, dimKey) => {
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

    // ✅ Sempre A→Z (Campus / Município / Orientador)
    arr.sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));

    return arr;
  };

  // =========================
  // Pager UI (tabela)
  // =========================
const ensurePager = () => {
  if (!el?.pivotHead) return null;

  let pager = document.getElementById("pivotPager");
  if (pager) return pager;

  pager = document.createElement("div");
  pager.id = "pivotPager";
  pager.style.display = "flex";
  pager.style.gap = "10px";
  pager.style.alignItems = "center";
  pager.style.justifyContent = "flex-end";
  pager.style.margin = "8px 0 10px";

  pager.innerHTML = `
    <button id="btnPrevPage" class="btn" type="button">Anterior</button>
    <span id="pageInfo" style="font-weight:600; opacity:.85;"></span>
    <button id="btnNextPage" class="btn" type="button">Próximo</button>
  `;

  // ✅ Encontra a tabela real, independente se pivotHead é <thead> ou <tr>
  const table = el.pivotHead.closest("table");
  if (table && table.parentElement) {
    table.parentElement.insertBefore(pager, table);
  } else {
    // fallback: coloca no topo do container principal
    (document.querySelector("main") || document.body).prepend(pager);
  }

  pager.querySelector("#btnPrevPage").addEventListener("click", () => {
    if (pageIndex > 0) {
      pageIndex--;
      refresh();
    }
  });

  pager.querySelector("#btnNextPage").addEventListener("click", () => {
    pageIndex++;
    refresh();
  });

  return pager;
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

  // =========================
  // TABELA (com paginação)
  // =========================
  const renderPivotTable = (pivotRows, dimLabel, pageSize) => {
    if (!el.pivotHead || !el.pivotBody || !el.pivotFoot) return;

    const totalRows = pivotRows.length;
    const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));

    // mantém pageIndex dentro do intervalo
    pageIndex = Math.max(0, Math.min(pageIndex, totalPages - 1));

    const start = pageIndex * pageSize;
    const end = start + pageSize;
    const rows = pivotRows.slice(start, end);

    // pager
    const pager = ensurePager();
    if (pager) {
      const info = pager.querySelector("#pageInfo");
      const btnPrev = pager.querySelector("#btnPrevPage");
      const btnNext = pager.querySelector("#btnNextPage");

      if (info) info.textContent = `Página ${pageIndex + 1} de ${totalPages} · ${totalRows} linhas`;
      if (btnPrev) btnPrev.disabled = pageIndex === 0;
      if (btnNext) btnNext.disabled = pageIndex >= totalPages - 1;
    }

    // mins/maxs por coluna (na página atual)
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
        ${STATUS_KEYS.map((s) => `<th>${s.label}</th>`).join("")}
        <th>Total</th>
      </tr>
    `;

    el.pivotBody.innerHTML = rows
      .map((r) => {
        const cells = STATUS_KEYS.map((s) => {
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
      })
      .join("");

    // totais da página
    const colTotals = {};
    for (const s of STATUS_KEYS) colTotals[s.key] = 0;
    let grand = 0;

    for (const r of rows) {
      for (const s of STATUS_KEYS) colTotals[s.key] += r[s.key] || 0;
      grand += r.__total || 0;
    }

    el.pivotFoot.innerHTML = `
      <tr>
        <th>Total (página)</th>
        ${STATUS_KEYS.map((s) => `<td class="cell-num">${colTotals[s.key]}</td>`).join("")}
        <td class="cell-num">${grand}</td>
      </tr>
    `;
  };

  // =========================
  // CHARTS (página atual)
  // =========================
  const renderChart = (targetDiv, title, xLabels, yValues) => {
    if (!targetDiv || typeof Plotly === "undefined") return;

    const data = [
      {
        type: "bar",
        x: xLabels,
        y: yValues,
        text: yValues,
        textposition: "outside",
        hovertemplate: "%{x}<br>%{y}<extra></extra>",
      },
    ];

    const layout = {
      title: { text: title, x: 0 },
      margin: { l: 60, r: 20, t: 60, b: 100 },
      xaxis: { tickangle: -45, automargin: true },
      yaxis: { rangemode: "tozero", automargin: true },
      height: 260,
    };

    Plotly.react(targetDiv, data, layout, { responsive: true, displayModeBar: false });
  };

  const renderCharts = (pivotRows, dimLabel, pageSize) => {
    const totalRows = pivotRows.length;
    const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
    const safePage = Math.max(0, Math.min(pageIndex, totalPages - 1));

    const start = safePage * pageSize;
    const end = start + pageSize;
    const rows = pivotRows.slice(start, end);

    const x = rows.map((r) => r.label);
    const series = (statusKey) => rows.map((r) => r[statusKey] || 0);

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

    const campi = uniqSorted(rows.map((r) => r[COL.campus]));
    const municipios = uniqSorted(rows.map((r) => r[COL.municipio]));

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

  // ✅ initFilterOptions atualizado (re-normaliza municípios no dropdown)
  const initFilterOptions = (rows) => {
    const campi = uniqSorted(rows.map((r) => r[COL.campus]).filter(Boolean));
    const municipios = uniqSorted(
      rows.map((r) => normalizeMunicipio(r[COL.municipio])).filter(Boolean)
    );

    fillSelect(el.filtroCampus, campi);
    fillSelect(el.filtroMunicipio, municipios);
  };

  // =========================
  // REFRESH
  // =========================
  const refresh = () => {
    const dimKey = getDimKey();
    const dimLabel = getDimLabel();
    const pageSize = parseInt(norm(el.topN?.value) || "30", 10);

    const f = getFilters();
    const recorte = applyFilters(base, f);

    const pivot = buildPivot(recorte, dimKey);

    if (el.tituloTabela) el.tituloTabela.textContent = `${dimLabel} · Pivô (01..05 + Total)`;
    if (el.tituloGraficos) el.tituloGraficos.textContent = `${dimLabel} · Gráficos por Status`;

    // KPI "linhas" mostra quantas linhas existiriam ao todo (não só a página)
    renderKPIs(recorte, pivot.length);

    renderPivotTable(pivot, dimLabel, pageSize);
    renderCharts(pivot, dimLabel, pageSize);

    setTimeout(() => {
      [el.chart01, el.chart02, el.chart03, el.chart04, el.chart05].forEach((div) => {
        if (div && typeof Plotly !== "undefined") Plotly.Plots.resize(div);
      });
    }, 50);
  };

  const wireEvents = () => {
    // qualquer mudança que altere o conjunto/ordem de linhas -> volta pra página 1
    el.dimensao?.addEventListener("change", () => {
      pageIndex = 0;
      refresh();
    });

    el.topN?.addEventListener("change", () => {
      pageIndex = 0;
      refresh();
    });

    el.filtroCampus?.addEventListener("change", () => {
      pageIndex = 0;
      refresh();
    });

    el.filtroMunicipio?.addEventListener("change", () => {
      pageIndex = 0;
      refresh();
    });

    el.btnLimpar?.addEventListener("click", () => {
      if (el.filtroCampus) el.filtroCampus.value = "";
      if (el.filtroMunicipio) el.filtroMunicipio.value = "";
      pageIndex = 0;
      refresh();
    });

    window.addEventListener("resize", () => refresh());
  };

  // =========================
  // BOOT
  // =========================
  document.addEventListener("DOMContentLoaded", async () => {
    try {
      el = initDom();
      wireEvents();

      base = await loadCSV();

      base = base
        .map((r) => {
          const rawMunicipio = getField(r, COL.municipio, "Municipio", "MUNICIPIO", "municipio");
          const rawCampus = getField(r, COL.campus, "CAMPUS", "campus");

          return {
            ...r,
            [COL.campus]: normalizeCampus(rawCampus),
            [COL.municipio]: normalizeMunicipio(rawMunicipio),
            [COL.orientador]: norm(getField(r, COL.orientador)),
            [COL.status]: statusNormalize(getField(r, COL.status, "STATUS", "status")),
          };
        })
        .filter((r) => r[COL.status]);

      initFilterOptions(base);
      pageIndex = 0;
      refresh();
    } catch (e) {
      console.error("Falha ao carregar/renderizar:", e);
      alert(e?.message || e);
    }
  });

  // (opcional) debug
  // window.normalizeMunicipio = normalizeMunicipio;
})();
