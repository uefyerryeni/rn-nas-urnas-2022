window.__rn2022Booted=true;
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const OFFICES={gov:"Governador",sen:"Senador",depf:"Deputado Federal",depe:"Deputado Estadual",pres:"Presidente"};
let db=null,mapFC=null,mesos={},selectedMunicipality="",textMode="full",currentRows=[],currentLabel="Rio Grande do Norte";
const PARTY_COLORS={"PT":"#C62828","PL":"#184E8A","UNIÃO":"#008C95","PP":"#4A54A8","MDB":"#2E7D32","PSD":"#7A5C00","PSDB":"#0077B6","REPUBLICANOS":"#5B3C88","PSB":"#B56A00","PDT":"#AD1457","PODE":"#3569B7","SOLIDARIEDADE":"#6A3D9A","PSOL":"#D4A000","NOVO":"#8C6D1F","CIDADANIA":"#9B4D5F","AVANTE":"#006B6B","PSC":"#2F5597","PATRIOTA":"#547A3F","PROS":"#8B5E3C","PC DO B":"#7F1D1D","PV":"#3E8E41","REDE":"#5AAE61","PMB":"#8854A2","PSTU":"#374151","PMN":"#0F4C81","PRTB":"#5E6F52","DC":"#6B7280","UP":"#111827"};
function partyColor(p){return PARTY_COLORS[String(p||"").toUpperCase()]||"#727b83"}
const RAW_ALIASES={"ACU":"ASSU","ARES":"AREZ","JANUARIO CICCO":"BOA SAUDE"};
const norm=s=>{
  const raw=String(s||"")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g," ")
    .trim()
    .replace(/\s+/g," ");
  return RAW_ALIASES[raw]||raw;
};
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
async function fetchJSON(paths){
  let lastError=null;
  for(const url of paths){
    try{
      const r=await fetch(url,{cache:"no-store"});
      if(!r.ok)throw Error(url+" · HTTP "+r.status);
      return await r.json();
    }catch(e){lastError=e}
  }
  throw lastError||Error("Falha ao carregar recurso");
}
const fmt=n=>Number(n||0).toLocaleString("pt-BR"), pct=n=>Number(n||0).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})+"%";
function coords(g,o=[]){if(!g)return o;if(g.type==="Polygon")g.coordinates.forEach(r=>r.forEach(p=>o.push(p)));else if(g.type==="MultiPolygon")g.coordinates.forEach(p=>p.forEach(r=>r.forEach(x=>o.push(x))));return o}
function projector(fc,w,h,pad=12){const a=[];fc.features.forEach(f=>coords(f.geometry,a));let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;a.forEach(([x,y])=>{x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y)});const s=Math.min((w-pad*2)/(x1-x0),(h-pad*2)/(y1-y0)),ox=(w-(x1-x0)*s)/2,oy=(h-(y1-y0)*s)/2;return([x,y])=>[ox+(x-x0)*s,h-(oy+(y-y0)*s)]}
function ring(r,p){return r.map((q,i)=>{const[x,y]=p(q);return(i?"L":"M")+x.toFixed(2)+" "+y.toFixed(2)}).join(" ")+" Z"}
function path(g,p){return g.type==="Polygon"?g.coordinates.map(r=>ring(r,p)).join(" "):g.type==="MultiPolygon"?g.coordinates.flatMap(a=>a.map(r=>ring(r,p))).join(" "):""}
async function loadMap(){mapFC=await fetchJSON(["rn2022-map.json","data/rn-municipios.geojson"]);renderMap()}
function renderMap(){if(!mapFC)return;const svg=$("#rnMap"),p=projector(mapFC,760,560,12),scope=$("#scopeSelect").value,meso=$("#mesoSelect").value;svg.innerHTML=mapFC.features.map((f,i)=>{const name=f.properties?.nome||"",inside=scope!=="meso"||mesos[meso]?.has(norm(name));return '<path class="rn-mun '+(inside?"":"dim")+'" data-i="'+i+'" d="'+path(f.geometry,p)+'"><title>'+esc(name)+'</title></path>'}).join("");svg.querySelectorAll(".rn-mun").forEach(el=>el.onclick=()=>{const f=mapFC.features[+el.dataset.i],name=f.properties?.nome||"";selectedMunicipality=name;$("#scopeSelect").value="municipality";$("#municipalityInput").value=name;syncFilters();applySelection()});markMap()}
function colorMap(){if(!mapFC||!db)return;const office=$("#officeSelect").value,round=$("#roundSelect").value;$("#rnMap").querySelectorAll(".rn-mun").forEach((el,i)=>{const name=mapFC.features[i].properties?.nome||"",rows=rowsForMunicipality(name,office,round),lead=rows[0],party=office==="party"?lead?.partido:lead?.partido;el.style.fill=lead?partyColor(party):"#dedbd3";el.dataset.party=party||""});renderLegend()}
function renderLegend(){let box=$("#mapLegend");if(!box){box=document.createElement("div");box.id="mapLegend";box.className="map-legend";$("#rnMap").insertAdjacentElement("afterend",box)}const parties=[...new Set($$("#rnMap .rn-mun").map(x=>x.dataset.party).filter(Boolean))].sort();box.innerHTML=parties.map(p=>'<span><i style="background:'+partyColor(p)+'"></i>'+esc(p)+'</span>').join("")+ '<small>Cores de visualização · partido do líder em cada município · não são cores oficiais dos partidos</small>'}
function markMap(){if(!mapFC)return;colorMap();$("#rnMap").querySelectorAll(".rn-mun").forEach((el,i)=>{const active=norm(mapFC.features[i].properties?.nome)===norm(selectedMunicipality);el.classList.toggle("active",active)})}
async function loadMesos(){const x=await fetchJSON(["rn2022-regions.json","data/mesorregioes.json"]);mesos=Object.fromEntries(Object.entries(x).map(([name,items])=>[name,new Set(items.map(norm))]))}
function keyForMunicipality(name){const target=norm(name);return Object.keys(db?.municipios||{}).find(k=>norm(k)===target)}
function rowsForMunicipality(name,office,round){const k=keyForMunicipality(name);if(!k)return[];if(office==="party"){const cargo=$("#partyOfficeSelect")?.value||"Deputado Federal";return db.partidos?.[k]?.[round]?.[cargo]||[]}return db.municipios?.[k]?.[round]?.[OFFICES[office]]||[]}
function aggregate(names,office,round){const by=new Map();names.forEach(name=>rowsForMunicipality(name,office,round).forEach(x=>{const key=office==="party"?x.partido:(x.nome+"|"+x.partido);const old=by.get(key)||{...(x),votos:0};old.votos+=Number(x.votos||0);by.set(key,old)}));return [...by.values()].sort((a,b)=>b.votos-a.votos)}
function allNames(){return Object.keys(db?.municipios||{})}
function zoneRows(zone,office,round){if(office==="party"){const cargo=$("#partyOfficeSelect")?.value||"Deputado Federal";return db?.partidosZonasNatal?.[String(zone)]?.[round]?.[cargo]||[]}return db?.zonasNatal?.[String(zone)]?.[round]?.[OFFICES[office]]||[]}
function syncTerritoryButtons(){const scope=$("#scopeSelect").value,meso=$("#mesoSelect").value;$$(".territory-bar button").forEach(b=>b.classList.toggle("active",b.dataset.scope===scope||(scope==="meso"&&b.dataset.meso===meso)))}
function syncFilters(){const scope=$("#scopeSelect").value,office=$("#officeSelect").value;$("#mesoField").hidden=scope!=="meso";$("#munField").hidden=scope!=="municipality";$("#zoneField").hidden=scope!=="natalzone";$("#partyField").hidden=office!=="party";$("#subfilters").hidden=scope==="state"&&office!=="party";$("#roundSelect").disabled=office!=="pres";if(office!=="pres")$("#roundSelect").value="1";syncTerritoryButtons();renderMap()}
function currentSelection(){const office=$("#officeSelect").value,round=$("#roundSelect").value,scope=$("#scopeSelect").value;let rows=[],label="Rio Grande do Norte";if(scope==="state"){rows=aggregate(allNames(),office,round)}else if(scope==="meso"){label=$("#mesoSelect").value;rows=aggregate(allNames().filter(n=>mesos[label]?.has(norm(n))),office,round)}else if(scope==="municipality"){label=$("#municipalityInput").value.trim()||selectedMunicipality||"Município";rows=rowsForMunicipality(label,office,round)}else{label="Natal · "+$("#zoneSelect").value+"ª Zona";rows=zoneRows($("#zoneSelect").value,office,round)}return{office,round,scope,rows,label}}
function applySelection(){if(!db){$("#statusTitle").textContent="Base oficial ainda não carregada";return}const s=currentSelection();currentRows=s.rows;currentLabel=s.label;selectedMunicipality=s.scope==="municipality"?s.label:"";markMap();const title=s.office==="party"?"Partidos · "+($("#partyOfficeSelect")?.value||"Deputado Federal"):OFFICES[s.office];$("#viewTitle").textContent=s.label;$("#viewSubtitle").textContent=title+" · "+s.round+"º turno · Eleições 2022";$("#resultTitle").textContent=title;$("#resultMeta").textContent=s.label+" · 2022";$("#statusTitle").textContent=s.rows.length?"Resultado histórico carregado":"Sem resultado para este recorte";$("#statusText").textContent=s.rows.length?"Dados consolidados das Eleições 2022 · fonte TSE.":"A combinação selecionada não possui registros na base processada.";renderRows(s.rows,s.office);renderInsights(s);updatePublication(s)}
function renderRows(rows,office){const box=$("#resultRows");if(!rows.length){box.innerHTML='<div class="empty">Nenhum registro disponível neste recorte.</div>';return}const total=rows.reduce((a,x)=>a+Number(x.votos||0),0);box.innerHTML=rows.slice(0,12).map((x,i)=>{const p=total?x.votos/total*100:0,name=office==="party"?x.partido:x.nome,meta=office==="party"?(x.federacao?x.federacao:"votos válidos do partido"):([x.partido,x.numero].filter(Boolean).join(" · ")),color=partyColor(x.partido);return '<div class="result-row"><div class="who"><b>'+(i+1)+'. '+esc(name)+'</b><small>'+esc(meta)+'</small></div><span class="bar"><i style="width:'+Math.min(100,p)+'%;background:'+color+'"></i></span><span class="pct">'+pct(p)+'</span></div>'}).join("")}
function renderInsights(s){const box=$("#insights");if(!s.rows.length){box.innerHTML='<article class="card"><span>SEM DADOS</span><strong>—</strong><p>Não há leitura disponível para esta combinação.</p></article>';return}const total=s.rows.reduce((a,x)=>a+Number(x.votos||0),0),a=s.rows[0],b=s.rows[1],ap=total?a.votos/total*100:0,gap=b&&total?(a.votos-b.votos)/total*100:null,name=s.office==="party"?a.partido:a.nome;box.innerHTML='<article class="card"><span>MAIOR VOTAÇÃO NO RECORTE</span><strong>'+esc(name)+'</strong><p>'+fmt(a.votos)+' votos · '+pct(ap)+'</p></article><article class="card"><span>VOTOS COMPUTADOS NESTA LISTA</span><strong>'+fmt(total)+'</strong><p>'+esc(s.label)+' · '+s.round+'º turno</p></article>'+(gap!==null?'<article class="card"><span>DIFERENÇA ENTRE 1º E 2º</span><strong>'+pct(gap)+'</strong><p>Diferença descritiva dentro do recorte selecionado.</p></article>':'')}

function officeTitle(s){return s.office==="party"?"Partidos · "+($("#partyOfficeSelect")?.value||"Deputado Federal"):OFFICES[s.office]}
function scopeTitle(s){
  if(s.scope==="meso")return "Mesorregião histórica · "+s.label;
  if(s.scope==="municipality")return "Município · "+s.label;
  if(s.scope==="natalzone")return s.label.replace("Natal · ","Natal · Zona Eleitoral ");
  return "Rio Grande do Norte";
}
function scopeIntro(s){
  if(s.scope==="meso")return "Na mesorregião histórica "+s.label;
  if(s.scope==="municipality")return "No município de "+s.label;
  if(s.scope==="natalzone")return "Na "+s.label.replace("Natal · ","")+" Zona Eleitoral de Natal";
  return "No Rio Grande do Norte";
}
function totalDescriptor(s){
  if(s.office==="party")return "votos válidos atribuídos aos partidos (nominais + legenda)";
  if(["depf","depe"].includes(s.office))return "votos nominais computados para as candidaturas";
  return "votos válidos computados para as candidaturas";
}
function methodNote(s){
  const notes=[];
  if(s.scope==="meso")notes.push("Mesorregião é um recorte histórico do IBGE e não corresponde à divisão regional vigente.");
  if(["depf","depe"].includes(s.office))notes.push("A liderança no recorte não determina eleição: deputados são eleitos pelo sistema proporcional.");
  if(s.office==="party")notes.push("Na leitura por partidos, a totalização combina votos nominais válidos e votos válidos de legenda.");
  return notes.join(" ");
}

function makeText(s=currentSelection()){
  if(!s.rows.length)return "RN NAS URNAS | ELEIÇÕES 2022\n\nSem dados disponíveis para o recorte selecionado.\n\nFonte: Tribunal Superior Eleitoral.";
  const total=s.rows.reduce((a,x)=>a+Number(x.votos||0),0),title=officeTitle(s),limit=textMode==="compact"?3:5;
  if(textMode==="compact"){
    const lines=["RN NAS URNAS | ELEIÇÕES 2022",title+" · "+scopeTitle(s)+" · "+s.round+"º turno",""];
    s.rows.slice(0,limit).forEach((x,i)=>{const name=s.office==="party"?x.partido:x.nome,p=total?x.votos/total*100:0;lines.push((i+1)+". "+name+" — "+fmt(x.votos)+" votos · "+pct(p))});
    lines.push("","Total computado: "+fmt(total)+" votos.","Fonte: TSE.");
    return lines.join("\n");
  }
  const lead=s.rows[0],leadName=s.office==="party"?lead.partido:lead.nome,leadPct=total?lead.votos/total*100:0;
  const lines=[
    "RN NAS URNAS | ELEIÇÕES 2022","",
    scopeIntro(s)+", nas Eleições 2022, a maior votação para "+title.toLowerCase()+" no "+s.round+"º turno foi de "+leadName+", com "+fmt(lead.votos)+" votos ("+pct(leadPct)+") dentro do total computado neste recorte.","",
    "Resultado do recorte:"
  ];
  s.rows.slice(0,limit).forEach((x,i)=>{const name=s.office==="party"?x.partido:x.nome,p=total?x.votos/total*100:0;lines.push((i+1)+". "+name+" — "+fmt(x.votos)+" votos · "+pct(p))});
  lines.push("","Totalização: "+fmt(total)+" "+totalDescriptor(s)+".");
  const note=methodNote(s);if(note)lines.push("",note);
  lines.push("","Dados históricos consolidados das Eleições 2022.","Fonte: Tribunal Superior Eleitoral.");
  return lines.join("\n");
}
function makeXText(s=currentSelection()){
  if(!s.rows.length)return "RN nas Urnas · Eleições 2022 — sem dados para o recorte. Fonte: TSE.";
  const total=s.rows.reduce((a,x)=>a+Number(x.votos||0),0),title=officeTitle(s);
  const lines=["RN nas Urnas · Eleições 2022",title+" · "+scopeTitle(s)];
  s.rows.slice(0,2).forEach((x,i)=>{const n=s.office==="party"?x.partido:x.nome,p=total?x.votos/total*100:0;lines.push((i+1)+". "+n+" — "+fmt(x.votos)+" · "+pct(p))});
  lines.push("Total: "+fmt(total)+" votos · Fonte: TSE");
  let out=lines.join("\n");
  return out.length<=280?out:out.slice(0,276)+"…";
}
function fit(ctx,text,x,y,max,size=48,weight=700){let s=size;do{ctx.font=weight+" "+s+"px Arial";if(ctx.measureText(text).width<=max)break;s--}while(s>18);ctx.fillText(text,x,y)}
function drawCanvas(s=currentSelection()){
  const c=$("#shareCanvas"),x=c.getContext("2d"),W=1080,H=1080;
  x.clearRect(0,0,W,H);
  x.fillStyle="#F2EDE3";x.fillRect(0,0,W,H);
  x.fillStyle="#F5C400";x.fillRect(0,0,W,30);
  x.fillStyle="#17191C";x.fillRect(0,30,W,150);
  x.fillStyle="#F5C400";x.font="800 24px Arial";x.fillText("RN NAS URNAS",70,88);
  x.fillStyle="#FFFFFF";x.font="600 18px Arial";x.fillText("ARQUIVO ELEITORAL · ELEIÇÕES 2022",70,124);
  x.fillStyle="#C9CDD1";x.font="500 15px Arial";x.fillText("Dados históricos consolidados",70,151);
  const title=officeTitle(s),scope=scopeTitle(s),total=s.rows.reduce((a,v)=>a+Number(v.votos||0),0);
  x.fillStyle="#17191C";fit(x,title,70,245,940,46,800);
  x.fillStyle="#FFFFFF";x.fillRect(70,272,940,78);
  x.fillStyle="#17191C";x.font="800 18px Arial";x.fillText("RECORTE",94,304);
  fit(x,scope,215,322,760,25,700);
  x.fillStyle="#626970";x.font="600 16px Arial";x.fillText(s.round+"º turno · Total computado: "+fmt(total)+" votos",94,378);
  const rows=s.rows.slice(0,4);let y=420;
  rows.forEach((r,i)=>{
    const name=s.office==="party"?r.partido:r.nome,p=total?r.votos/total*100:0,color=partyColor(r.partido);
    x.fillStyle="#FFFFFF";x.fillRect(70,y,940,112);
    x.fillStyle=color;x.fillRect(70,y,12,112);
    x.fillStyle="#17191C";x.font="800 19px Arial";x.fillText(String(i+1).padStart(2,"0"),102,y+36);
    fit(x,name,155,y+38,560,26,800);
    x.fillStyle="#626970";x.font="600 16px Arial";x.fillText((r.partido||"")+" · "+fmt(r.votos)+" votos",155,y+70);
    x.textAlign="right";x.fillStyle="#17191C";x.font="800 28px Arial";x.fillText(pct(p),965,y+47);x.textAlign="left";
    x.fillStyle="#E8E5DE";x.fillRect(155,y+86,810,8);
    x.fillStyle=color;x.fillRect(155,y+86,810*Math.min(100,p)/100,8);
    y+=126;
  });
  x.fillStyle="#17191C";x.fillRect(0,940,1080,140);
  x.fillStyle="#FFFFFF";x.font="700 19px Arial";x.fillText("Fonte: Tribunal Superior Eleitoral",70,988);
  const note=methodNote(s);
  x.fillStyle="#C9CDD1";x.font="500 14px Arial";fit(x,note||"Percentuais calculados sobre o total computado no recorte selecionado.",70,1024,930,14,500);
  x.fillStyle="#F5C400";x.font="700 15px Arial";x.fillText("UEFY · RN NAS URNAS",70,1055);
}
function updatePublication(s=currentSelection()){const t=makeText(s);$("#postText").value=t;$("#charCount").textContent=t.length+" caracteres";drawCanvas(s)}
async function canvasBlob(type="image/png"){return new Promise(ok=>$("#shareCanvas").toBlob(ok,type,.94))}
async function copyImage(){const b=await canvasBlob();if(!navigator.clipboard?.write||!window.ClipboardItem)throw Error();await navigator.clipboard.write([new ClipboardItem({"image/png":b})])}
async function init(){syncFilters();try{db=await fetchJSON(["rn2022-results.json","data/eleicoes-2022.json"]);const names=allNames().sort((a,b)=>a.localeCompare(b,"pt-BR"));$("#municipios").innerHTML=names.map(n=>'<option value="'+esc(n)+'"></option>').join("");const zones=Object.keys(db.zonasNatal||{}).sort((a,b)=>+a-+b);$("#zoneSelect").innerHTML=zones.map(z=>'<option value="'+z+'">'+z+'ª Zona</option>').join("");$("#statusTitle").textContent="Base oficial carregada";$("#statusText").textContent=names.length+" municípios disponíveis · Eleições 2022."}catch(e){$("#statusTitle").textContent="Base oficial indisponível";$("#statusText").textContent="A base eleitoral não pôde ser carregada.";$("#resultRows").innerHTML='<div class="empty">Dados não carregados. Nenhuma simulação foi usada como substituição.</div>';drawCanvas();return}try{
  await Promise.all([loadMesos(),loadMap()]);
  const mapNames=mapFC.features.map(f=>f.properties?.nome||"").filter(Boolean).sort((a,b)=>a.localeCompare(b,"pt-BR"));
  $("#municipios").innerHTML=mapNames.map(n=>'<option value="'+esc(n)+'"></option>').join("");
  const unresolved=mapNames.filter(n=>!keyForMunicipality(n));
  if(unresolved.length)throw Error("Municípios sem correspondência TSE/IBGE: "+unresolved.join(", "));
}catch(e){
  console.error(e);
  $("#mapHint").textContent="O mapa territorial não pôde ser associado integralmente à base eleitoral, mas os resultados continuam disponíveis.";
}
applySelection()}
$("#scopeSelect").onchange=syncFilters;$("#officeSelect").onchange=()=>{syncFilters();applySelection()};$("#roundSelect").onchange=applySelection;$("#mesoSelect").onchange=()=>{syncTerritoryButtons();renderMap();applySelection()};$("#zoneSelect").onchange=applySelection;$("#partyOfficeSelect").onchange=()=>{syncFilters();applySelection()};$("#applyBtn").onclick=applySelection;$("#clearMap").onclick=()=>{$("#scopeSelect").value="state";selectedMunicipality="";syncFilters();applySelection()};
$$(".territory-bar button").forEach(b=>b.onclick=()=>{if(b.dataset.meso){$("#scopeSelect").value="meso";$("#mesoSelect").value=b.dataset.meso}else $("#scopeSelect").value=b.dataset.scope;syncFilters();applySelection()});
$$(".text-mode-switch button").forEach(b=>b.onclick=()=>{$$(".text-mode-switch button").forEach(x=>x.classList.remove("active"));b.classList.add("active");textMode=b.dataset.mode;updatePublication()});
$("#copyText").onclick=async()=>{await navigator.clipboard.writeText($("#postText").value);$("#copyText").textContent="Copiado";setTimeout(()=>$("#copyText").textContent="Copiar texto",1000)};
$("#copyImage").onclick=async()=>{try{await copyImage();$("#copyImage").textContent="Imagem copiada";setTimeout(()=>$("#copyImage").textContent="Copiar imagem",1200)}catch{alert("Este navegador não permite copiar a imagem diretamente.")}};
$("#downloadImage").onclick=async()=>{const b=await canvasBlob("image/jpeg"),u=URL.createObjectURL(b),a=document.createElement("a");a.href=u;a.download="rn-nas-urnas-2022.jpg";a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)};
$("#openX").onclick=async()=>{try{await copyImage()}catch{}const text=makeXText();window.open("https://x.com/intent/post?text="+encodeURIComponent(text),"_blank","noopener")};
$("#shareBundle").onclick=async()=>{const b=await canvasBlob("image/jpeg"),file=new File([b],"rn-nas-urnas-2022.jpg",{type:"image/jpeg"}),text=$("#postText").value;if(navigator.share&&navigator.canShare?.({files:[file]})){try{await navigator.share({text,files:[file]});return}catch(e){if(e.name==="AbortError")return}}try{await copyImage();alert("Imagem copiada. O texto permanece no campo acima para ser copiado separadamente.")}catch{}};
window.addEventListener("scroll",()=>$("#toTop").classList.toggle("show",scrollY>500));$("#toTop").onclick=()=>scrollTo({top:0,behavior:"smooth"});
init().catch(e=>{
  console.error("Falha de inicialização",e);
  const t=$("#statusTitle"),p=$("#statusText"),box=$("#resultRows");
  if(t)t.textContent="Falha ao iniciar a interface";
  if(p)p.textContent="Ocorreu um erro de execução. A página não ficará presa em carregamento.";
  if(box)box.innerHTML='<div class="empty">Falha de inicialização registrada. Recarregue após a correção publicada.</div>';
});