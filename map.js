
// map.js — remove frame & grid; ES-only viewport; show everything without panning
const FILE_PATH = 'data.xlsx';

function normalize(x){ return (x===undefined||x===null) ? '' : String(x).trim(); }
function groupCount(rows, keySelector){
  const m = new Map();
  rows.forEach(r=>{ const k=keySelector(r); if(k) m.set(k, (m.get(k)||0)+1); });
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
  "Vitória": [-40.3089, -20.3155],
  "Vila Velha": [-40.2922, -20.3297],
  "Serra": [-40.3072, -20.1211],
  "Cariacica": [-40.4165, -20.2642],
  "Guarapari": [-40.5057, -20.6734],
  "Linhares": [-39.8558, -19.3946],
  "Colatina": [-40.6269, -19.5393],
  "Cachoeiro de Itapemirim": [-41.1121, -20.8467],
  "São Mateus": [-39.8647, -18.7201],
  "Aracruz": [-40.2734, -19.8198]
};
function computeBounds(names){
  // If you later add more cities, this will auto-extend
  let minLon=  999, maxLon= -999, minLat=  999, maxLat= -999;
  names.forEach(n=>{
    const c = ES_CENTROIDS[n];
    if(!c) return;
    minLon = Math.min(minLon, c[0]); maxLon = Math.max(maxLon, c[0]);
    minLat = Math.min(minLat, c[1]); maxLat = Math.max(maxLat, c[1]);
  });
  if (minLon===999) return {lon:[-41.7,-39.3], lat:[-21.3,-18.3]}; // fallback ES bbox
  // add padding
  const padLon = 0.15, padLat = 0.20;
  return { lon:[minLon-padLon, maxLon+padLon], lat:[minLat-padLat, maxLat+padLat] };
}
async function main(){
  const rows = await loadXLSX();
  if (!rows.length){
    Plotly.newPlot('chartMapaES', [], {title:'Sem dados', margin:{t:30}});
    return;
  }
  const muniKey = pickMunicipioKey(rows[0]);
  if (!muniKey){
    Plotly.newPlot('chartMapaES', [], {title:'Coluna de município não encontrada', margin:{t:30}});
    return;
  }
  const byMun = groupCount(rows, r=> normalize(r[muniKey]));
  const lats = [], lons = [], sizes=[], texts=[], names=[];
  byMun.forEach(item=>{
    const name=item.key; const count=item.value;
    const coords = ES_CENTROIDS[name];
    if(!coords) return;
    names.push(name);
    lons.push(coords[0]); lats.push(coords[1]);
    sizes.push(10 + Math.min(50, count*3));
    texts.push(`${name}: ${count}`);
  });
  const bounds = computeBounds(names);
  const data=[{
    type:'scattergeo', lon:lons, lat:lats, text:texts, mode:'markers+text', textposition:'top center',
    marker:{ size:sizes, line:{width:1,color:'#333'} }
  }];
  const layout = { geo:{
      projection:{type:'mercator'},
      lonaxis:{range:bounds.lon},
      lataxis:{range:bounds.lat},
      showcountries:false, showcoastlines:true, coastlinecolor:'#aaa',
      showland:true, landcolor:'#f5f5f5',
      showframe:false,   // remove retângulo
      showgrid:false
    },
    margin:{t:10,r:10,b:10,l:10},
    paper_bgcolor:'rgba(0,0,0,0)'
  };
  Plotly.newPlot('chartMapaES', data, layout, {displayModeBar:false, responsive:true});
}
if (document.readyState === 'loading'){ document.addEventListener('DOMContentLoaded', main); } else { main(); }
