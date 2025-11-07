// map.js — versão robusta com normalização de nomes
const FILE_PATH = 'data.xlsx';

function normalize(x) {
  return (x || '')
    .normalize('NFD')                 // remove acentos
    .replace(/[\u0300-\u036f]/g, '')  // remove diacríticos
    .replace(/\s+/g, ' ')             // normaliza espaços
    .trim()
    .toLowerCase();
}

async function loadXLSX() {
  const res = await fetch(FILE_PATH);
  const buf = await res.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { defval: '' });
}

// Coordenadas dos municípios do ES
const ES_CENTROIDS = {
  "Afonso Cláudio": [-41.126, -20.074], "Água Doce do Norte": [-40.985, -18.548], "Águia Branca": [-40.735, -18.984],
  "Alegre": [-41.532, -20.763], "Alfredo Chaves": [-40.737, -20.639], "Alto Rio Novo": [-41.023, -19.062],
  "Anchieta": [-40.642, -20.800], "Apiacá": [-41.569, -21.152], "Aracruz": [-40.273, -19.820],
  "Atilio Vivacqua": [-41.196, -20.913], "Baixo Guandu": [-41.015, -19.517], "Barra de São Francisco": [-40.889, -18.755],
  "Boa Esperança": [-40.296, -18.540], "Bom Jesus do Norte": [-41.680, -21.118], "Brejetuba": [-41.290, -20.153],
  "Cachoeiro de Itapemirim": [-41.112, -20.846], "Cariacica": [-40.416, -20.264], "Castelo": [-41.183, -20.604],
  "Colatina": [-40.626, -19.539], "Conceição da Barra": [-39.730, -18.592], "Conceição do Castelo": [-41.240, -20.363],
  "Divino de São Lourenço": [-41.699, -20.620], "Domingos Martins": [-40.659, -20.365], "Dores do Rio Preto": [-41.841, -20.693],
  "Ecoporanga": [-40.833, -18.371], "Fundão": [-40.403, -19.936], "Governador Lindenberg": [-40.460, -19.233],
  "Guaçuí": [-41.677, -20.773], "Guarapari": [-40.505, -20.673], "Ibatiba": [-41.509, -20.234],
  "Ibiraçu": [-40.373, -19.836], "Ibitirama": [-41.670, -20.546], "Iconha": [-40.812, -20.791],
  "Irupi": [-41.644, -20.350], "Itaguaçu": [-40.858, -19.803], "Itapemirim": [-40.834, -21.009],
  "Itarana": [-40.875, -19.875], "Iúna": [-41.536, -20.353], "Jaguaré": [-39.983, -18.908],
  "Jerônimo Monteiro": [-41.395, -20.797], "João Neiva": [-40.386, -19.756], "Laranja da Terra": [-41.062, -19.900],
  "Linhares": [-39.855, -19.394], "Mantenópolis": [-41.124, -18.865], "Marataízes": [-40.828, -21.039],
  "Marechal Floriano": [-40.669, -20.415], "Marilândia": [-40.539, -19.413], "Mimoso do Sul": [-41.359, -21.063],
  "Montanha": [-40.366, -18.126], "Mucurici": [-40.514, -18.096], "Muniz Freire": [-41.415, -20.465],
  "Muqui": [-41.344, -20.951], "Nova Venécia": [-40.397, -18.715], "Pancas": [-40.851, -19.222],
  "Pedro Canário": [-39.957, -18.300], "Pinheiros": [-40.217, -18.414], "Piúma": [-40.730, -20.835],
  "Ponto Belo": [-40.541, -18.125], "Presidente Kennedy": [-41.052, -21.096], "Rio Bananal": [-40.336, -19.268],
  "Rio Novo do Sul": [-40.936, -20.862], "Santa Leopoldina": [-40.525, -20.100], "Santa Maria de Jetibá": [-40.743, -20.030],
  "Santa Teresa": [-40.600, -19.936], "São Domingos do Norte": [-40.627, -19.142], "São Gabriel da Palha": [-40.536, -19.018],
  "São José do Calçado": [-41.664, -21.028], "São Mateus": [-39.864, -18.720], "São Roque do Canaã": [-40.652, -19.741],
  "Serra": [-40.307, -20.121], "Sooretama": [-40.090, -19.189], "Vargem Alta": [-41.006, -20.670],
  "Venda Nova do Imigrante": [-41.126, -20.330], "Viana": [-40.495, -20.393], "Vila Pavão": [-40.607, -18.613],
  "Vila Valério": [-40.390, -18.993], "Vila Velha": [-40.292, -20.329], "Vitória": [-40.308, -20.315]
};

// Normaliza dicionário
const normalizedCentroids = Object.fromEntries(
  Object.entries(ES_CENTROIDS).map(([k, v]) => [normalize(k), v])
);

async function main() {
  const rows = await loadXLSX();
  const key = Object.keys(rows[0]).find(k => k.toUpperCase().includes('MUNICÍPIO'));
  if (!key) {
    alert('Coluna de município não encontrada no arquivo.');
    return;
  }

  const counts = {};
  rows.forEach(r => {
    const name = normalize(r[key]);
    if (!name) return;
    counts[name] = (counts[name] || 0) + 1;
  });

  const points = Object.entries(counts)
    .filter(([n]) => normalizedCentroids[n])
    .map(([n, v]) => ({ nome: n, valor: v, coord: normalizedCentroids[n] }));

  const lons = points.map(p => p.coord[0]);
  const lats = points.map(p => p.coord[1]);
  const texts = points.map(p => `${p.nome.toUpperCase()}: ${p.valor}`);

  const trace = {
    type: 'scattergeo',
    mode: 'markers+text',
    lon: lons,
    lat: lats,
    text: texts,
    textposition: 'bottom center',
    marker: { size: points.map(p => 5 + p.valor * 2), color: '#2A61A8', opacity: 0.7 }
  };

  const layout = {
    geo: {
      projection: { type: 'mercator' },
      lonaxis: { range: [-41.9, -39.0] },
      lataxis: { range: [-21.4, -18.0] },
      showland: true,
      landcolor: '#f6f6f6',
      showframe: false
    },
    margin: { t: 0, b: 0, l: 0, r: 0 },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)'
  };

  Plotly.newPlot('chartMapaES', [trace], layout, { displayModeBar: false, responsive: true });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', main);
else main();
