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

function cardCanvas(){
 const el=document.createElement("canvas");el.width=1080;el.height=1080;const x=el.getContext("2d");
 x.fillStyle="#f4efe4";x.fillRect(0,0,1080,1080);x.fillStyle="#f5c400";x.fillRect(0,0,1080,26);
 x.fillStyle="#17191c";x.font="900 36px Arial";x.fillText("RN NAS URNAS",72,105);x.font="700 23px Arial";x.fillText("DADOS HISTÓRICOS · ELEIÇÕES 2022",72,148);
 x.fillStyle="#fff";x.fillRect(72,210,936,650);x.fillStyle="#17191c";x.font="900 104px Arial";x.fillText(posterTitle.textContent.slice(0,18),118,425);
 x.font="700 42px Arial";const words=posterSub.textContent.split(" ");let line="",y=525;for(const w of words){const t=line+w+" ";if(x.measureText(t).width>820){x.fillText(line,118,y);line=w+" ";y+=58}else line=t}x.fillText(line,118,y);
 x.font="700 23px Arial";x.fillText("Fonte: Justiça Eleitoral · UEFY",118,808);x.fillStyle="#17191c";x.fillRect(0,930,1080,150);x.fillStyle="#fff";x.font="700 25px Arial";x.fillText("RN NAS URNAS · ARQUIVO ELEITORAL 2022",72,1015);return el;
}
const jpegBlob=()=>new Promise(ok=>cardCanvas().toBlob(ok,"image/jpeg",.94));
async function copyCardImage(){if(!navigator.clipboard?.write||!window.ClipboardItem)throw Error("clipboard");const b=await new Promise(ok=>cardCanvas().toBlob(ok,"image/png"));await navigator.clipboard.write([new ClipboardItem({"image/png":b})])}
document.querySelector("#copyImageBtn")?.addEventListener("click",async()=>{try{await copyCardImage();alert("Imagem copiada.")}catch(e){alert("Seu navegador não permitiu copiar a imagem. Use Baixar imagem.")}});
document.querySelector("#downloadImageBtn")?.addEventListener("click",async()=>{const b=await jpegBlob(),u=URL.createObjectURL(b),a=document.createElement("a");a.href=u;a.download="rn-nas-urnas-2022.jpg";a.click();setTimeout(()=>URL.revokeObjectURL(u),1200)});
document.querySelector("#shareXBtn")?.addEventListener("click",async()=>{const text=(copy.value||"RN nas Urnas · Eleições 2022").slice(0,280),b=await jpegBlob(),file=new File([b],"rn-nas-urnas-2022.jpg",{type:"image/jpeg"});if(navigator.share&&navigator.canShare?.({files:[file]})){try{await navigator.share({text,files:[file]});return}catch(e){if(e.name==="AbortError")return}}try{await copyCardImage()}catch(e){}window.open("https://x.com/intent/post?text="+encodeURIComponent(text),"_blank","noopener")});
