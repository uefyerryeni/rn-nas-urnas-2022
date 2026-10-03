// Mapa eleitoral SVG: mesma linguagem cartográfica da Central 2026, sem dependência de Leaflet.
(async function(){
 const host=document.querySelector(".map-placeholder");if(!host)return;
 host.innerHTML='<div class="map-title-2022"><div><b>Rio Grande do Norte</b><span>167 municípios · Eleições 2022</span></div><small>IBGE · GeoJSON</small></div><svg id="rnMapSvg" viewBox="0 0 760 560" aria-label="Mapa municipal do Rio Grande do Norte"></svg><div class="map-help">Toque ou clique em um município para selecionar.</div>';
 const svg=document.querySelector("#rnMapSvg");
 const norm=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
 function pts(g,o=[]){if(!g)return o;if(g.type==="Polygon")g.coordinates.forEach(r=>r.forEach(p=>o.push(p)));else if(g.type==="MultiPolygon")g.coordinates.forEach(p=>p.forEach(r=>r.forEach(x=>o.push(x))));return o}
 function projector(fc,w,h,p=12){const a=[];fc.features.forEach(f=>pts(f.geometry,a));let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;a.forEach(([x,y])=>{x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y)});const s=Math.min((w-p*2)/(x1-x0),(h-p*2)/(y1-y0)),ox=(w-(x1-x0)*s)/2,oy=(h-(y1-y0)*s)/2;return([x,y])=>[ox+(x-x0)*s,h-(oy+(y-y0)*s)]}
 function ring(r,p){return r.map((q,i)=>{const [x,y]=p(q);return(i?"L":"M")+x.toFixed(2)+" "+y.toFixed(2)}).join(" ")+" Z"}
 function path(g,p){return g.type==="Polygon"?g.coordinates.map(r=>ring(r,p)).join(" "):g.type==="MultiPolygon"?g.coordinates.flatMap(a=>a.map(r=>ring(r,p))).join(" "):""}
 try{
  const res=await fetch("https://servicodados.ibge.gov.br/api/v3/malhas/estados/24?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=municipio");if(!res.ok)throw Error(res.status);
  const fc=await res.json(),p=projector(fc,760,560,14);
  svg.innerHTML=fc.features.map((f,i)=>'<path class="rn-mun-2022" data-i="'+i+'" d="'+path(f.geometry,p)+'"><title>'+(f.properties?.nome||"Município")+'</title></path>').join("");
  svg.querySelectorAll(".rn-mun-2022").forEach(el=>el.onclick=()=>{svg.querySelectorAll(".rn-mun-2022").forEach(x=>x.classList.remove("active"));el.classList.add("active");const f=fc.features[+el.dataset.i],name=f.properties?.nome||"";const input=document.querySelector("#municipio");if(input){input.value=name;document.querySelector("#exploreBtn")?.click()}});
 }catch(e){host.innerHTML='<div class="map-error"><b>Mapa municipal indisponível</b><span>A visualização não será substituída por uma simulação.</span></div>'}
})();