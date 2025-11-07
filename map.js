// map.js — IntegraCAR · Mapa ES funcionando

const FILE_PATH = "data.xlsx";

// Normaliza para comparar nomes de forma robusta
function normalizeName(str) {
  return (str || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// Carrega planilha XLSX
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

// Detecta a coluna de município (NOME MUNICÍPIO, etc.)
function detectMunicipioColumn(headers) {
  return headers.find(h => {
    const n = normalizeName(h);
    return n.includes("munic"); // pega NOME MUNICÍPIO / MUNICIPIO / MUNICÍPIOS
  }) || null;
}

// Centroides dos municípios do ES
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
  "vila pavão": [-40.607, -18.613],
  "vila valerio": [-40.39, -18.993],
  "vila velha": [-40.292, -20.329],
  "vitoria": [-40.308, -20.315]
};

// Função principal
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
        "Coluna de município não encontrada no arquivo (esperado algo como 'NOME MUNICÍPIO').";
      return;
    }

    // Contagem por município normalizado
    const counts = {};
    rows.forEach(r => {
      const nomeBruto = r[munCol];
      const norm = normalizeName(nomeBruto);
      if (!norm) return;
      counts[norm] = (counts[norm] || 0) + 1;
    });

    const lons = [];
    const lats = [];
    const texts = [];
    const sizes = [];

    Object.entries(counts).forEach(([norm, qtd]) => {
      const centro = ES_CENTROIDS[norm];
      if (!centro) {
        // Município fora do ES ou nome diferente do dicionário → ignora
        return;
      }
      lons.push(centro[0]);
      lats.push(centro[1]);
      texts.push(`${norm.toUpperCase()}: ${qtd}`);
      sizes.push(8 + Math.min(30, qtd * 3));
    });

    if (!lons.length) {
      document.getElementById("chartMapaES").innerHTML =
        "Nenhum município do ES foi reconhecido nos dados (confira os nomes).";
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
        opacity: 0.8,
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

// Dispara após carregar a página
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mainMapaES);
} else {
  mainMapaES();
}
