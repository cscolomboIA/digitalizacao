// js/dashboard.js
(() => {
  // =========================
  // CONFIG
  // =========================
  const CSV_URL = "data/TODOS_DADOS_UNIFICADOS.csv"; // caminho no GitHub Pages

  // Colunas do CSV (nomes exatamente como no arquivo)
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

  // IDs do seu HTML
  const el = {
    fCampus: document.getElementById("fCampus"),
    fMunicipio: document.getElementById("fMunicipio"),
    fFuncao: document.getElementById("fFuncao"),
    btnLimpar: document.getElementById("btnLimpar"),

    kpiTotal: document.getElementById("kpiTotal"),
    kpiCampi: document.getElementById("kpiCampi"),
    kpiMunicipios: document.getElementById("kpiMunicipios"),
    kpiOrientadores: document.getElementById("kpiOrientadores"),

    chartCampus: document.getElementById("chartCampus"),
    chartMunicipio: document.getElementById("chartMunicipio"),

    dataTable: document.getElementById("dataTable"),
    btnDownloadCSV: document.getElementById("btnDownloadCSV"),
  };

  // =========================
  // STATE
  // =========================
  let base = [];
  let dt = null; // DataTables instance

  // =========================
  // HELPERS
  // =========================
  const norm = (v) => (v ?? "").toString().trim();

  const uniqSorted = (arr) => {
    const set = new Set(arr.map(norm).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  };

  const setSelectOptions = (selectEl, values) => {
    if (!selectEl) return;
    selectEl.innerHTML = "";

    const optAll = document.createElement("option");
    optAll.value = "";
    optAll.textContent = "Todos";
    selectEl.appendChild(optAll);

    for (const v of values) {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      selectEl.appendChild(opt);
    }
  };

  const getFilters = () => ({
    campus: norm(el.fCampus?.value),
    municipio: norm(el.fMunicipio?.value),
    autor: norm(el.fFuncao?.value),
  });

  const applyFilters = (rows, f) => {
    return rows.filter((r) => {
      if (f.campus && norm(r[COL.campus]) !== f.campus) return false;
      if (f.municipio && norm(r[COL.municipio]) !== f.municipio) return false;
      if (f.autor && norm(r[COL.autor]) !== f.autor) return false;
      return true;
    });
  };

  const groupCount = (rows, key) => {
    const m = new Map();
    for (const r of rows) {
      const k = norm(r[key]) || "Não informado";
      m.set(k, (m.get(k) || 0) + 1);
    }
    return Array.from(m.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  };

  const csvEscape = (v) => {
    const s = norm(v);
    // força aspas para segurança (ponto e vírgula será separador)
    return `"${s.replace(/"/g, '""')}"`;
  };

  // =========================
  // RENDER: KPIs
  // =========================
  const renderKPIs = (rows) => {
    if (el.kpiTotal) el.kpiTotal.textContent = rows.length.toLocaleString("pt-BR");

    const campi = uniqSorted(rows.map((r) => r[COL.campus]));
    const municipios = uniqSorted(rows.map((r) => r[COL.municipio]));
    const autores = uniqSorted(rows.map((r) => r[COL.autor]));

    if (el.kpiCampi) el.kpiCampi.textContent = campi.length.toLocaleString("pt-BR");
    if (el.kpiMunicipios) el.kpiMunicipios.textContent = municipios.length.toLocaleString("pt-BR");
    if (el.kpiOrientadores) el.kpiOrientadores.textContent = autores.length.toLocaleString("pt-BR");
  };

  // =========================
  // RENDER: Plotly
  // =========================
  const renderPlotlyBar = (targetDiv, title, series, topN = 15) => {
    if (!targetDiv) return;

    const top = series.slice(0, topN);
    const x = top.map((d) => d.label);
    const y = top.map((d) => d.count);

    const data = [
      {
        type: "bar",
        x,
        y,
        hovertemplate: "%{x}<br>Registros: %{y}<extra></extra>",
      },
    ];

    const layout = {
      title: { text: title, x: 0 },
      margin: { l: 55, r: 20, t: 60, b: 120 },
      xaxis: { tickangle: -45, automargin: true },
      yaxis: { rangemode: "tozero", automargin: true },
      height: 420,
    };

    const config = {
      displayModeBar: true,
      responsive: true,
    };

    Plotly.react(targetDiv, data, layout, config);
  };

  const renderCharts = (rows) => {
    const byCampus = groupCount(rows, COL.campus);
    const byMunicipio = groupCount(rows, COL.municipio);

    renderPlotlyBar(el.chartCampus, "Registros por Campus (Top 15)", byCampus, 15);
    renderPlotlyBar(el.chartMunicipio, "Registros por Município (Top 15)", byMunicipio, 15);
  };

  // =========================
  // RENDER: DataTables
  // =========================
  const getTableColumns = () => ([
    { title: "Data início", data: COL.dataInicio },
    { title: "Campus", data: COL.campus },
    { title: "Município", data: COL.municipio },
    { title: "Autor/Função", data: COL.autor },
    { title: "Status", data: COL.status },
    { title: "Código Edocs", data: COL.edocs },
    { title: "Processo florestal nº", data: COL.processo },
    { title: "Empreendimento nº", data: COL.empreendimento },
    { title: "Data última atualização", data: COL.dataUltStatus },
  ]);

  const initOrUpdateTable = (rows) => {
    if (!el.dataTable) return;

    const columns = getTableColumns();

    // Se já existe DataTable, apenas atualiza dados
    if (dt) {
      dt.clear();
      dt.rows.add(rows);
      dt.draw();
      return;
    }

    // Criar DataTable
    dt = $(el.dataTable).DataTable({
      data: rows,
      columns,
      pageLength: 25,
      lengthMenu: [10, 25, 50, 100, 200],
      order: [],

      // idioma PT-BR simples (sem depender de URL externa)
      language: {
        search: "Buscar:",
        lengthMenu: "Mostrar _MENU_ registros",
        info: "Mostrando _START_ a _END_ de _TOTAL_",
        infoEmpty: "Mostrando 0 a 0 de 0",
        infoFiltered: "(filtrado de _MAX_ no total)",
        zeroRecords: "Nenhum registro encontrado",
        paginate: { first: "Primeiro", last: "Último", next: "Próximo", previous: "Anterior" }
      },
    });
  };

  // =========================
  // EXPORT CSV (recorte filtrado)
  // =========================
  const exportFilteredCSV = (rows) => {
    const columns = getTableColumns().map((c) => c.data);

    const header = columns.map(csvEscape).join(";");

    const lines = rows.map((r) => {
      return columns.map((col) => csvEscape(r[col])).join(";");
    });

    const csv = [header, ...lines].join("\n");
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

  // =========================
  // REFRESH (aplica filtros e atualiza tudo)
  // =========================
  const refresh = () => {
    const f = getFilters();
    const recorte = applyFilters(base, f);

    renderKPIs(recorte);
    renderCharts(recorte);
    initOrUpdateTable(recorte);
  };

  // =========================
  // LOAD CSV
  // =========================
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
    setSelectOptions(el.fCampus, uniqSorted(rows.map((r) => r[COL.campus])));
    setSelectOptions(el.fMunicipio, uniqSorted(rows.map((r) => r[COL.municipio])));
    setSelectOptions(el.fFuncao, uniqSorted(rows.map((r) => r[COL.autor])));
  };

  const wireEvents = () => {
    el.fCampus?.addEventListener("change", refresh);
    el.fMunicipio?.addEventListener("change", refresh);
    el.fFuncao?.addEventListener("change", refresh);

    el.btnLimpar?.addEventListener("click", () => {
      if (el.fCampus) el.fCampus.value = "";
      if (el.fMunicipio) el.fMunicipio.value = "";
      if (el.fFuncao) el.fFuncao.value = "";
      refresh();
    });

    el.btnDownloadCSV?.addEventListener("click", () => {
      const f = getFilters();
      const recorte = applyFilters(base, f);
      exportFilteredCSV(recorte);
    });

    // Plotly responsivo em resize
    window.addEventListener("resize", () => {
      if (el.chartCampus) Plotly.Plots.resize(el.chartCampus);
      if (el.chartMunicipio) Plotly.Plots.resize(el.chartMunicipio);
    });
  };

  // =========================
  // BOOT
  // =========================
  document.addEventListener("DOMContentLoaded", async () => {
    try {
      wireEvents();

      base = await loadCSV();

      // Normaliza: garante strings e remove linhas totalmente vazias
      base = base
        .map((r) => {
          const out = {};
          for (const k of Object.keys(r)) out[k] = norm(r[k]);
          return out;
        })
        .filter((r) => {
          // considera "linha útil" se ao menos 1 campo relevante existir
          return (
            norm(r[COL.campus]) ||
            norm(r[COL.municipio]) ||
            norm(r[COL.autor]) ||
            norm(r[COL.status]) ||
            norm(r[COL.edocs]) ||
            norm(r[COL.processo]) ||
            norm(r[COL.empreendimento])
          );
        });

      initFilters(base);
      refresh();
    } catch (e) {
      console.error("Falha ao carregar o CSV:", e);
      if (el.kpiTotal) el.kpiTotal.textContent = "Erro";
    }
  });
})();
