
async function loadExcel(){
  const buf = await fetch("data.xlsx").then(r=>r.arrayBuffer());
  const wb = XLSX.read(buf,{type:'array'});
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws,{defval:''});
}

function group(rows,key){
  const map={}; rows.forEach(r=>{const k=r[key]; map[k]=(map[k]||0)+1;});
  return Object.entries(map).map(([k,v])=>({k,v})).sort((a,b)=>b.v-a.v);
}

function plotBar(div,labels,values,title){
  Plotly.newPlot(div,[{x:labels,y:values,type:'bar'}],{title,margin:{t:30}});
}

function plotPie(div,labels,values,title){
  Plotly.newPlot(div,[{labels,values,type:'pie'}],{title});
}

$(async function(){
  const rows = await loadExcel();
  $("#fileInfo").text("data.xlsx carregado");

  $("#kpiTotal").text(rows.length);
  $("#kpiCampi").text(new Set(rows.map(r=>r["Campus de Atuação"])).size);
  $("#kpiMunicipios").text(new Set(rows.map(r=>r["3) Município onde reside:"])).size);
  $("#kpiOrientadores").text(rows.filter(r=>r["6) Função exercida no Projeto IntegraCAR:"].includes("Orientador")).length);

  const byCampus = group(rows,"Campus de Atuação");
  plotBar("chartCampus",byCampus.map(x=>x.k),byCampus.map(x=>x.v),"Por Campus");

  const byMun = group(rows,"3) Município onde reside:");
  plotBar("chartMunicipio",byMun.map(x=>x.k),byMun.map(x=>x.v),"Por Município");

  const byFunc = group(rows,"6) Função exercida no Projeto IntegraCAR:");
  plotPie("chartFuncao",byFunc.map(x=>x.k),byFunc.map(x=>x.v),"Funções");

  const emit = rows.filter(r=>r["Título CAR Emitido"]==="Sim").length;
  const valid = rows.filter(r=>r["Título CAR Validado"]==="Sim").length;
  plotBar("chartTitulo",["Emitidos","Validados"],[emit,valid],"Títulos/Processos");

  $('#dataTable').DataTable({data:rows,columns:Object.keys(rows[0]).map(k=>({title:k,data:k}))});

  $("#btnDownloadCSV").on("click",()=>{
    $('#dataTable').DataTable().button('.buttons-csv').trigger();
  });

  // theme toggle
  $("#themeToggle").on("click",()=>{
    const theme = document.documentElement.getAttribute("data-theme");
    const next = theme==="dark"?"":"dark";
    if(next) document.documentElement.setAttribute("data-theme",next);
    else document.documentElement.removeAttribute("data-theme");
  });
});
