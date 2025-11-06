
// map.js — ES full fit, many centroids, no frame
const FILE_PATH = 'data.xlsx';

function normalize(x){ return (x===undefined||x===null) ? '' : String(x).trim(); }
function groupCount(rows, fn){
  const m = new Map(); rows.forEach(r => { const k = fn(r); if(k) m.set(k,(m.get(k)||0)+1); });
  return Array.from(m, ([key,value])=>({key,value})).sort((a,b)=>b.value-a.value);
}
async function loadXLSX(){
  const res = await fetch(FILE_PATH);
  if(!res.ok) throw new Error('Falha ao baixar ' + FILE_PATH);
  const buf = await res.arrayBuffer();
  const wb = XLSX.read(buf, { type:'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { defval: '' });
}
function pickMunicipioKey(row){
  if (!row) return null;
  if ('NOME MUNICÍPIO' in row) return 'NOME MUNICÍPIO';
  if ('NOME MUNICÍPIO ' in row) return 'NOME MUNICÍPIO ';
  if ('3) Município onde reside:' in row) return '3) Município onde reside:';
  return null;
}
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
function computeBounds(names){
  let minLon= 999, maxLon= -999, minLat= 999, maxLat= -999;
  names.forEach(n=>{ const c = ES_CENTROIDS[n]; if(!c) return;
    minLon = Math.min(minLon, c[0]); maxLon = Math.max(maxLon, c[0]);
    minLat = Math.min(minLat, c[1]); maxLat = Math.max(maxLat, c[1]);
  });
  if (minLon===999) return {lon:[-41.9,-39.1], lat:[-21.4,-18.1]};
  const padLon = 0.20, padLat = 0.25;
  return { lon:[minLon-padLon, maxLon+padLon], lat:[maxLat+padLat, minLat-padLat] }
}
