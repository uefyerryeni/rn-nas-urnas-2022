#!/usr/bin/env python3
"""Consolida dados oficiais TSE 2022 e recortes territoriais IBGE para o RN nas Urnas."""
import csv,io,json,urllib.request,zipfile

CAND="https://cdn.tse.jus.br/estatistica/sead/odsele/votacao_candidato_munzona/votacao_candidato_munzona_2022.zip"
PART="https://cdn.tse.jus.br/estatistica/sead/odsele/votacao_partido_munzona/votacao_partido_munzona_2022.zip"
MAP="https://servicodados.ibge.gov.br/api/v3/malhas/estados/24?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=municipio"
MESOS={"Oeste Potiguar":2401,"Central Potiguar":2402,"Agreste Potiguar":2403,"Leste Potiguar":2404}

def s(v): return (v or "").strip()
def n(v):
    try:return int(s(v) or 0)
    except:return 0

def request(url):
    return urllib.request.urlopen(urllib.request.Request(url,headers={"User-Agent":"RN-nas-Urnas-UEFY/2022"}),timeout=240)

def get_json(url):
    with request(url) as r:return json.load(r)

def rows(url):
    raw=request(url).read()
    z=zipfile.ZipFile(io.BytesIO(raw))
    csvs=[x for x in z.namelist() if x.lower().endswith(".csv")]
    # O arquivo RN contém os cargos estaduais; o BR contém Presidente para todas as UFs.
    names=[x for x in csvs if "_rn" in x.lower() or "_br" in x.lower()]
    if not names:names=csvs
    for name in names:
        with z.open(name) as f:
            yield from csv.DictReader(io.TextIOWrapper(f,encoding="latin-1",errors="replace"),delimiter=";")

d={
  "meta":{"ano":2022,"uf":"RN","fonte":"Tribunal Superior Eleitoral","tipo":"dados históricos consolidados"},
  "municipios":{},"zonasNatal":{},"partidos":{},"partidosZonasNatal":{}
}

for r in rows(CAND):
    if s(r.get("SG_UF"))!="RN":continue
    m=s(r.get("NM_MUNICIPIO")); z=s(r.get("NR_ZONA")); t=s(r.get("NR_TURNO")); cargo=s(r.get("DS_CARGO"))
    votos=n(r.get("QT_VOTOS_NOMINAIS_VALIDOS") or r.get("QT_VOTOS_NOMINAIS"))
    if not m or not cargo or votos<=0:continue
    cand={
      "nome":s(r.get("NM_URNA_CANDIDATO") or r.get("NM_CANDIDATO")),
      "partido":s(r.get("SG_PARTIDO")),
      "numero":s(r.get("NR_CANDIDATO")),
      "federacao":s(r.get("NM_FEDERACAO") or r.get("SG_FEDERACAO") or r.get("DS_COMPOSICAO_FEDERACAO"))
    }
    def add(root,key):
        box=root.setdefault(key,{}).setdefault(t,{}).setdefault(cargo,{})
        k=cand["nome"]+"|"+cand["partido"]
        e=box.setdefault(k,{**cand,"votos":0});e["votos"]+=votos
    add(d["municipios"],m)
    if m=="NATAL":add(d["zonasNatal"],z)

for rootname in ("municipios","zonasNatal"):
    for turnos in d[rootname].values():
        for cargos in turnos.values():
            for cargo,items in list(cargos.items()):
                cargos[cargo]=sorted(items.values(),key=lambda x:x["votos"],reverse=True)

for r in rows(PART):
    if s(r.get("SG_UF"))!="RN":continue
    m=s(r.get("NM_MUNICIPIO")); z=s(r.get("NR_ZONA")); t=s(r.get("NR_TURNO")); cargo=s(r.get("DS_CARGO")); p=s(r.get("SG_PARTIDO"))
    # Para cargos proporcionais, total partidário = votos nominais válidos + votos válidos de legenda.
    legenda=n(r.get("QT_TOTAL_VOTOS_LEG_VALIDOS") or r.get("QT_VOTOS_LEGENDA_VALIDOS"))
    total=n(r.get("QT_VOTOS_NOMINAIS_VALIDOS"))+legenda
    fed=s(r.get("NM_FEDERACAO") or r.get("SG_FEDERACAO") or r.get("DS_COMPOSICAO_FEDERACAO"))
    def add_party(root,key):
        box=root.setdefault(key,{}).setdefault(t,{}).setdefault(cargo,{})
        e=box.setdefault(p,{"partido":p,"federacao":fed,"votos":0});e["votos"]+=total
        if not e.get("federacao") and fed:e["federacao"]=fed
    if m and cargo and p and total>0:
        add_party(d["partidos"],m)
        if m=="NATAL":add_party(d["partidosZonasNatal"],z)

for rootname in ("partidos","partidosZonasNatal"):
    for turnos in d[rootname].values():
        for cargos in turnos.values():
            for cargo,items in list(cargos.items()):
                cargos[cargo]=sorted(items.values(),key=lambda x:x["votos"],reverse=True)

assert len(d["municipios"])==167, len(d["municipios"])
assert all("Presidente" in d["municipios"][m].get("1",{}) for m in d["municipios"]), "Presidente 1T ausente"
assert all("Presidente" in d["municipios"][m].get("2",{}) for m in d["municipios"]), "Presidente 2T ausente"

with open("data/eleicoes-2022.json","w",encoding="utf-8") as f:
    json.dump(d,f,ensure_ascii=False,separators=(",",":"))

geo=get_json(MAP)
assert len(geo.get("features",[]))==167, len(geo.get("features",[]))
with open("data/rn-municipios.geojson","w",encoding="utf-8") as f:
    json.dump(geo,f,ensure_ascii=False,separators=(",",":"))

mesos={}
for name,id_ in MESOS.items():
    x=get_json(f"https://servicodados.ibge.gov.br/api/v1/localidades/mesorregioes/{id_}/municipios")
    mesos[name]=[s(v.get("nome")) for v in x if s(v.get("nome"))]
assert sum(len(v) for v in mesos.values())==167, {k:len(v) for k,v in mesos.items()}
with open("data/mesorregioes.json","w",encoding="utf-8") as f:
    json.dump(mesos,f,ensure_ascii=False,separators=(",",":"))

print("OK",len(d["municipios"]),"municípios; Presidente 1T/2T; zonas de Natal:",sorted(d["zonasNatal"]))
print("IBGE",len(geo["features"]),"geometrias;",{k:len(v) for k,v in mesos.items()})
