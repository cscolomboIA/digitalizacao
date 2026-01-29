// js/dashboard.js
(() => {
  // ====== CONFIG ======
  const CSV_URL = "data/TODOS_DADOS_UNIFICADOS.csv"; // ajuste o caminho no seu repo

  // Mapeamento de colunas (conforme o CSV anexado)
  const COL = {
    campus: "Campus",
    municipio: "Município",
    autor: "Nome completo do avaliador do processo CAR",
    status: "Status",
    dataInicio: "Data do início da análise",
    edocs: "Código Edocs",
    processo: "Processo florestal nº",
    empreendimento: "Código do empreendimento nº",
    dataUltStatus: "Data da ultima atualização de status",
  };

  // IDs esperados no DOM
  const el = {
    filtroCampus: document.getElementById("filtroCampus"),
    filtroMunicipio: document.getElementById("filtroMunicipio"),
    filtroAutor: document.getElementById("filtroAutor"),
    btnLimpar: document.getElementById("btnLimparFiltros"),

    cardTotal: document.getElementById("cardTotalRegistros"),
    cardCampi: document.getElementById("cardCampi"),
    cardMunicipios: document.getElementById("cardMunicipios"),
    cardAutores: document.getElementById("cardAutores"),

    canvasCampus: document.getElementById("graficoCampus"),
    canvasMunicipio: document.getElementById("graficoMunicipio"),

    tbody: document.getElementById("tbodyBaseCompleta"),
    btnExportar: document.getElementById("btnExportarCSV"),
  };

  // ====== STATE ======
  let base = [];
  let chartCampus = null;
  let chartMunicipio = null;

  // ====== HELPERS ======
  const norm = (v) => (v ?? "").toString().trim();

  const uniqSorted = (arr) => {
    const set = new Set(arr.map(norm).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  };

  const groupCount = (rows, key) => {
    const m = new Map();
    for (const r of rows) {
      const k = norm(r[key]) || "Não informado";
      m.set(k, (m.get(k) || 0) + 1);
    }
    // retorna [{label,count}] ordenado desc
    return Array.from(m.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  };

  const setSelectOptions = (selectEl, values, labelTodos = "Todos") => {
    if (!selectEl) return;
    selectEl.innerHTML = "";
    const optAll = document.createElement("option");
    optAll.value = "";
    optAll.textContent = labelTodos;
    selectEl.appendChild(optAll);

    for (const v of values) {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      selectEl.appendChild(opt);
    }
  };

  const getFilters = () => ({
    campus: norm(el.filtroCampus?.value),
    municipio: norm(el.filtroMunicipio?.value),
    autor: norm(el.filtroAutor?.value),
  });

  const applyFilters = (rows, f) => {
    return rows.filter((r) => {
      if (f.campus && norm(r[COL.campus]) !== f.campus) return false;
      if (f.municipio && norm(r[COL.municipio]) !== f.municipio) return false;
      if (f.autor && norm(r[COL.autor]) !== f.autor) return false;
      return true;
    });
  };

  const safeText = (s) => {
    // evita quebrar HTML
    const span = document.createElement("span");
    span.textContent = s ?? "";
    return span.innerHTML;
  };

  const renderCards = (rows) => {
    if (el.cardTotal) el.cardTotal.textContent = rows.length.toLocaleString("pt-BR");

    const campi = uniqSorted(rows.map((r) => r[COL.campus]));
    const municipios = uniqSorted(rows.map((r) => r[COL.municipio]));
    const autores = uniqSorted(rows.map((r) => r[COL.autor]));

    if (el.cardCampi) el.cardCampi.textContent = campi.length.toLocaleString("pt-BR");
    if (el.cardMunicipios) el.cardMunicipios.textContent = municipios.length.toLocaleString("pt-BR");
    if (el.cardAutores) el.cardAutores.textContent = autores.length.toLocaleString("pt-BR");
  };

  const renderCharts = (rows) => {
    const byCampus = groupCount(rows, COL.campus);
    const byMunicipio = groupCount(rows, COL.municipio);

    // limita para ficar legível (ajuste como quiser)
    const topCampus = byCampus.slice(0, 15);
    const topMunicipio = byMunicipio.slice(0, 15);

    const mkChart = (canvas, currentChart, title, dataArr) => {
      if (!canvas) return currentChart;

      if (currentChart) currentChart.destroy();

      return new Chart(canvas, {
        type: "bar",
        data: {
          labels: dataArr.map((x) => x.label),
          datasets: [
            {
              label: "Registros",
              data: dataArr.map((x) => x.count),
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            title: { display: true, text: title },
            tooltip: { enabled: true },
          },
          scales: {
            x: {
              ticks: {
                autoSkip: false,
                maxRotation: 60,
                minRotation: 0,
              },
            },
            y: {
              beginAtZero: true,
              ticks: {
                precision: 0,
              },
            },
          },
        },
      });
    };

    chartCampus = mkChart(el.canvasCampus, chartCampus, "Registros por Campus (Top 15)", topCampus);
    chartMunicipio = mkChart(el.canvasMunicipio, chartMunicipio, "Registros por Município (Top 15)", topMunicipio);
  };

  const renderTable = (rows) => {
    if (!el.tbody) return;

    // Colunas que vão aparecer na “Base completa”
    const cols = [
      COL.dataInicio,
      COL.campus,
      COL.municipio,
      COL.autor,
      COL.status,
      COL.edocs,
      COL.processo,
      COL.empreendimento,
      COL.dataUltStatus,
    ];

    // (opcional) ordena por data de início “dd/mm/aa” como texto (mantém simples)
    const sorted = [...rows];

    const html = sorted
      .slice(0, 500) // evita travar navegador; aumente se quiser
      .map((r) => {
        const tds = cols.map((c) => `<td>${safeText(norm(r[c]))}</td>`).join("");
        return `<tr>${tds}</tr>`;
      })
      .join("");

    el.tbody.innerHTML = html;
  };

  const refresh = () => {
    const f = getFilters();
    const recorte = applyFilters(base, f);

    renderCards(recorte);
    renderCharts(recorte);
    renderTable(recorte);
  };

  const exportCSV = () => {
    const f = getFilters();
    const recorte = applyFilters(base, f);

    const csv = Papa.unparse(recorte, { quotes: true, delimiter: ";" });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "base_filtrada.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const wireEvents = () => {
    el.filtroCampus?.addEventListener("change", refresh);
    el.filtroMunicipio?.addEventListener("change", refresh);
    el.filtroAutor?.addEventListener("change", refresh);

    el.btnLimpar?.addEventListener("click", () => {
      if (el.filtroCampus) el.filtroCampus.value = "";
      if (el.filtroMunicipio) el.filtroMunicipio.value = "";
      if (el.filtroAutor) el.filtroAutor.value = "";
      refresh();
    });

    el.btnExportar?.addEventListener("click", exportCSV);
  };

  const loadCSV = async () => {
    return new Promise((resolve, reject) => {
      Papa.parse(CSV_URL, {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results?.errors?.length) {
            console.error("Erros ao ler CSV:", results.errors);
          }
          resolve(results.data || []);
        },
        error: (err) => reject(err),
      });
    });
  };

  const initFilters = (rows) => {
    setSelectOptions(el.filtroCampus, uniqSorted(rows.map((r) => r[COL.campus])), "Todos");
    setSelectOptions(el.filtroMunicipio, uniqSorted(rows.map((r) => r[COL.municipio])), "Todos");
    setSelectOptions(el.filtroAutor, uniqSorted(rows.map((r) => r[COL.autor])), "Todos");
  };

  // ====== BOOT ======
  document.addEventListener("DOMContentLoaded", async () => {
    try {
      wireEvents();

      base = await loadCSV();

      // Normaliza: garante strings (evita undefined)
      base = base.map((r) => {
        const out = {};
        for (const k of Object.keys(r)) out[k] = norm(r[k]);
        return out;
      });

      initFilters(base);
      refresh();
    } catch (e) {
      console.error("Falha ao carregar o CSV:", e);
      // opcional: mostrar msg na UI
      if (el.cardTotal) el.cardTotal.textContent = "Erro";
    }
  });
})();
