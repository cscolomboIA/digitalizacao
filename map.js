
const FILE_PATH = 'data.xlsx';
const COLS = {
  municipio: '3) Município onde reside:'
};
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
function el(id){ return document.getElementById(id); }
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
async function main(){
  const rows = await loadXLSX();
  const byMun = groupCount(rows, r=> normalize(r[COLS.municipio]));
  const lats = [], lons = [], sizes=[], texts=[];
  byMun.forEach(item=>{
    const name=item.key; const count=item.value;
    const coords = ES_CENTROIDS[name];
    if(!coords) return;
    lons.push(coords[0]); lats.push(coords[1]);
    sizes.push(10 + Math.min(40, count*3));
    texts.push(`${name}: ${count}`);
  });
  const data=[{
    type:'scattergeo', lon:lons, lat:lats, text:texts, mode:'markers+text', textposition:'top center',
    marker:{ size:sizes, line:{width:1,color:'#333'} }
  }];
  // Focused only on ES bounding box
  const layout = { geo:{
      projection:{type:'mercator'},
      lonaxis:{range:[-41.7, -39.3]},
      lataxis:{range:[-21.3, -18.3]},
      showcountries:false, showcoastlines:true, coastlinecolor:'#aaa',
      showland:true, landcolor:'#f5f5f5'
    },
    margin:{t:10,r:10,b:10,l:10}, paper_bgcolor:'rgba(0,0,0,0)'
  };
  Plotly.newPlot('chartMapaES', data, layout, {displayModeBar:false, responsive:true});
}
if (document.readyState === 'loading'){ document.addEventListener('DOMContentLoaded', main); } else { main(); }
