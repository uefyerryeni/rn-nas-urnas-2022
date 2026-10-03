// Mapa oficial do RN — malha do IBGE.
(async function(){
  const host=document.querySelector(".map-placeholder");
  if(!host)return;
  host.innerHTML='<div id="rnMap" style="width:100%;height:560px;border-radius:20px"></div>';
  if(!window.L){host.innerHTML='<p>Não foi possível carregar o módulo cartográfico.</p>';return}
  const map=L.map("rnMap",{zoomControl:true,attributionControl:true}).setView([-5.8,-36.5],7);
  try{
    const url="https://servicodados.ibge.gov.br/api/v3/malhas/estados/24?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=municipio";
    const res=await fetch(url); if(!res.ok)throw new Error("IBGE "+res.status);
    const geo=await res.json();
    const layer=L.geoJSON(geo,{style:{color:"#17191c",weight:1,fillColor:"#f5c400",fillOpacity:.32},onEachFeature:(f,l)=>{
      const nome=f.properties?.nome||f.properties?.NM_MUN||f.properties?.name||"Município";
      l.bindTooltip(nome,{sticky:true});
      l.on("click",()=>{const input=document.querySelector("#municipio");if(input){input.value=nome;document.querySelector("#exploreBtn")?.click()}});
    }}).addTo(map);
    map.fitBounds(layer.getBounds(),{padding:[10,10]});
  }catch(e){host.innerHTML='<div style="padding:28px"><b>Malha municipal indisponível.</b><p>O mapa não será substituído por uma simulação. Tente novamente quando o serviço do IBGE estiver acessível.</p></div>'}
})();