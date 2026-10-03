#!/usr/bin/env python3
"""Consolida os CSV oficiais do TSE de 2022 para uso estático no RN nas Urnas."""
import csv,io,json,urllib.request,zipfile
CAND="https://cdn.tse.jus.br/estatistica/sead/odsele/votacao_candidato_munzona/votacao_candidato_munzona_2022.zip"
PART="https://cdn.tse.jus.br/estatistica/sead/odsele/votacao_partido_munzona/votacao_partido_munzona_2022.zip"
def s(v): return (v or "").strip()
def n(v):
    try:return int(s(v) or 0)
    except:return 0
def rows(url):
    req=urllib.request.Request(url,headers={"User-Agent":"RN-nas-Urnas-UEFY"})
    raw=urllib.request.urlopen(req,timeout=180).read()
    z=zipfile.ZipFile(io.BytesIO(raw))
    names=[x for x in z.namelist() if x.lower().endswith(".csv") and "_rn" in x.lower()]
    if not names:names=[x for x in z.namelist() if x.lower().endswith(".csv")]
    for name in names:
        with z.open(name) as f:
            yield from csv.DictReader(io.TextIOWrapper(f,encoding="latin-1",errors="replace"),delimiter=";")
d={"meta":{"ano":2022,"uf":"RN","fonte":"Tribunal Superior Eleitoral","tipo":"dados históricos consolidados"},"municipios":{},"zonasNatal":{},"partidos":{}}
for r in rows(CAND):
    if s(r.get("SG_UF"))!="RN":continue
    m=s(r.get("NM_MUNICIPIO")); z=s(r.get("NR_ZONA")); t=s(r.get("NR_TURNO")); cargo=s(r.get("DS_CARGO"))
    votos=n(r.get("QT_VOTOS_NOMINAIS_VALIDOS") or r.get("QT_VOTOS_NOMINAIS"))
    if not m or not cargo or votos<=0:continue
    cand={"nome":s(r.get("NM_URNA_CANDIDATO") or r.get("NM_CANDIDATO")),"partido":s(r.get("SG_PARTIDO")),"numero":s(r.get("NR_CANDIDATO"))}
    def add(root,key):
        box=root.setdefault(key,{}).setdefault(t,{}).setdefault(cargo,{})
        k=cand["nome"]+"|"+cand["partido"]; e=box.setdefault(k,{**cand,"votos":0});e["votos"]+=votos
    add(d["municipios"],m)
    if m=="NATAL":add(d["zonasNatal"],z)
for rootname in ("municipios","zonasNatal"):
    for _,turnos in d[rootname].items():
        for _,cargos in turnos.items():
            for cargo,items in list(cargos.items()):cargos[cargo]=sorted(items.values(),key=lambda x:x["votos"],reverse=True)
for r in rows(PART):
    if s(r.get("SG_UF"))!="RN":continue
    m=s(r.get("NM_MUNICIPIO"));t=s(r.get("NR_TURNO"));cargo=s(r.get("DS_CARGO"));p=s(r.get("SG_PARTIDO"))
    votos=n(r.get("QT_VOTOS_LEGENDA_VALIDOS") or r.get("QT_VOTOS_LEGENDA"))
    if m and cargo and p and votos>0:
        box=d["partidos"].setdefault(m,{}).setdefault(t,{}).setdefault(cargo,{})
        box[p]=box.get(p,0)+votos
for _,turnos in d["partidos"].items():
    for _,cargos in turnos.items():
        for cargo,items in list(cargos.items()):cargos[cargo]=[{"partido":p,"votos":v} for p,v in sorted(items.items(),key=lambda x:x[1],reverse=True)]
assert len(d["municipios"])==167, len(d["municipios"])
with open("data/eleicoes-2022.json","w",encoding="utf-8") as f:json.dump(d,f,ensure_ascii=False,separators=(",",":"))
print("OK",len(d["municipios"]),"municípios; zonas de Natal:",sorted(d["zonasNatal"]))
