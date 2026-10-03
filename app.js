const stories={gov:{title:"58,31%",sub:"Fátima Bezerra foi reeleita governadora no primeiro turno.",copy:"Em 2022, Fátima Bezerra foi reeleita governadora do Rio Grande do Norte no primeiro turno, com 58,31% dos votos válidos. Fábio Dantas teve 22,22% e Styvenson Valentim, 16,80%.\n\nFonte: Justiça Eleitoral."},sen:{title:"41,85%",sub:"Rogério Marinho foi eleito senador pelo Rio Grande do Norte.",copy:"Na eleição para o Senado em 2022 no Rio Grande do Norte, Rogério Marinho foi eleito com 41,85% dos votos válidos. Carlos Eduardo teve 33,40% e Rafael Motta, 22,76%.\n\nFonte: Justiça Eleitoral."},pres:{title:"65,10%",sub:"Lula recebeu 1.326.785 votos no RN no segundo turno.",copy:"No segundo turno da eleição presidencial de 2022, Lula recebeu 1.326.785 votos no Rio Grande do Norte, 65,10% dos votos válidos. Jair Bolsonaro recebeu 711.381, ou 34,90%.\n\nFonte: Justiça Eleitoral."}};const story=document.querySelector("#story");function renderStory(){const s=stories[story.value];posterTitle.textContent=s.title;posterSub.textContent=s.sub;copy.value=s.copy}story.onchange=renderStory;copyBtn.onclick=async()=>{await navigator.clipboard.writeText(copy.value);copyBtn.textContent="Copiado";setTimeout(()=>copyBtn.textContent="Copiar texto",1200)};exploreBtn.onclick=()=>{const m=municipio.value.trim();resultBox.textContent=m?m+" · a camada municipal oficial está sendo consolidada para liberar rankings, candidatos e percentuais por município.":"Digite um município para explorar."};compareBtn.onclick=()=>{const a=munA.value.trim(),b=munB.value.trim();compareOut.textContent=a&&b?"Comparação "+a+" × "+b+": aguardando a consolidação municipal do TSE.": "Informe os dois municípios.";compareOut.style.gridColumn="1/-1";compareOut.style.paddingTop="12px"};window.addEventListener("scroll",()=>top.classList.toggle("show",scrollY>500));top.onclick=()=>scrollTo({top:0,behavior:"smooth"});

/* Base oficial processada: habilita município e zonas de Natal quando data/eleicoes-2022.json existir. */
let election2022=null;
const cargoLabels={pres2:"Presidente",gov:"Governador",sen:"Senador",depf:"Deputado Federal",depe:"Deputado Estadual"};
fetch("data/eleicoes-2022.json").then(r=>r.ok?r.json():Promise.reject()).then(d=>{
 election2022=d;
 const dl=document.querySelector("#municipios");
 if(dl){dl.innerHTML=Object.keys(d.municipios||{}).sort((a,b)=>a.localeCompare(b,"pt-BR")).map(m=>'<option value="'+m.replace(/"/g,"&quot;")+'"></option>').join("")}
}).catch(()=>{});
function officialRows(m,c,t="1"){
 const cargo=cargoLabels[c]||c;
 return election2022?.municipios?.[m?.toUpperCase()]?.[t]?.[cargo]||election2022?.municipios?.[m]?.[t]?.[cargo]||[];
}
const oldExplore=exploreBtn.onclick;
exploreBtn.onclick=()=>{
 const m=municipio.value.trim(),c=cargo.value,t=c==="pres2"?"2":"1";
 if(!m){resultBox.textContent="Digite um município para explorar.";return}
 const rows=officialRows(m,c,t);
 if(!rows.length){oldExplore();return}
 const total=rows.reduce((s,x)=>s+x.votos,0);
 resultBox.innerHTML='<strong>'+m+' · '+(cargoLabels[c]||c)+' · Eleições 2022</strong><div class="official-list">'+rows.slice(0,8).map((x,i)=>'<p><b>'+(i+1)+'. '+x.nome+'</b> <span>'+x.partido+' · '+x.votos.toLocaleString("pt-BR")+' votos · '+(total?100*x.votos/total:0).toFixed(2).replace(".",",")+'%</span></p>').join("")+'</div><small>Dados históricos consolidados · Fonte: TSE</small>';
};
