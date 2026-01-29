// js/relatorio.js
(() => {
  const CSV_URL = "data/TODOS_DADOS_UNIFICADOS.csv";

  const COL = {
    campus: "Campus",
    municipio: "Município",
    orientador: "Nome completo do avaliador do processo CAR",
    status: "Status",
  };

  // ... seus STATUS_KEYS e el e base aqui ...

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

  const getField = (row, ...names) => {
    // 1) tentativa direta (nome exato)
    for (const n of names) {
      if (row && row[n] != null && String(row[n]).trim() !== "") return row[n];
    }

    // 2) fallback: tenta bater ignorando acentos/maiúsculas (pra headers tipo "Municipio")
    const keys = row ? Object.keys(row) : [];
    const wanted = names.map(simplify);

    for (const k of keys) {
      const ks = simplify(k);
      if (wanted.includes(ks)) return row[k];
    }

    return "";
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

  // ... resto do seu arquivo continua aqui (levenshtein, listas, normalizeMunicipio, etc.) ...

})();
