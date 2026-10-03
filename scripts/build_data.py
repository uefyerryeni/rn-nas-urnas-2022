#!/usr/bin/env python3
"""Consolida os dados oficiais do TSE de 2022 para uso estático no RN nas Urnas."""
import csv
import io
import json
import urllib.request
import zipfile

CAND="https://cdn.tse.jus.br/estatistica/sead/odsele/votacao_candidato_munzona/votacao_candidato_munzona_2022.zip"
PART="https://cdn.tse.jus.br/estatistica/sead/odsele/votacao_partido_munzona/votacao_partido_munzona_2022.zip"

def s(v):
    return (v or "").strip()

def clean(v):
    x=s(v)
    return "" if x in {"#NULO#","#NE#","NÃO DIVULGÁVEL"} else x

def n(v):
    try:
        return int(s(v) or 0)
    except Exception:
        return 0

def download(url):
    req=urllib.request.Request(url,headers={"User-Agent":"RN-nas-Urnas-UEFY/2022"})
    with urllib.request.urlopen(req,timeout=240) as r:
        return r.read()

def rows(url):
    z=zipfile.ZipFile(io.BytesIO(download(url)))
    csvs=[x for x in z.namelist() if x.lower().endswith(".csv")]
    chosen=[]
    for name in csvs:
        low=name.lower()
        if low.endswith("_rn.csv"):
            chosen.append(("RN",name))
        elif low.endswith("_brasil.csv") or low.endswith("_br.csv"):
            chosen.append(("BR",name))
    if not chosen:
        raise RuntimeError("Arquivos RN/BR não encontrados no ZIP do TSE")
    for scope,name in chosen:
        with z.open(name) as f:
            for row in csv.DictReader(
                io.TextIOWrapper(f,encoding="latin-1",errors="replace"),
                delimiter=";"
            ):
                yield scope,row

d={
    "meta":{
        "ano":2022,
        "uf":"RN",
        "fonte":"Tribunal Superior Eleitoral",
        "tipo":"dados históricos consolidados"
    },
    "municipios":{},
    "zonasNatal":{},
    "partidos":{},
    "partidosZonasNatal":{}
}

for r in rows(CAND):
    if s(r.get("SG_UF"))!="RN":
        continue
    m=s(r.get("NM_MUNICIPIO"))
    z=s(r.get("NR_ZONA"))
    t=s(r.get("NR_TURNO"))
    cargo=s(r.get("DS_CARGO"))
    if scope=="RN" and cargo=="Presidente":
        continue
    if scope=="BR" and cargo!="Presidente":
        continue
    votos=n(r.get("QT_VOTOS_NOMINAIS_VALIDOS") or r.get("QT_VOTOS_NOMINAIS"))
    if not m or not cargo or votos<=0:
        continue

    cand={
        "nome":s(r.get("NM_URNA_CANDIDATO") or r.get("NM_CANDIDATO")),
        "partido":s(r.get("SG_PARTIDO")),
        "numero":s(r.get("NR_CANDIDATO")),
        "federacao":clean(
            r.get("NM_FEDERACAO")
            or r.get("SG_FEDERACAO")
            or r.get("DS_COMPOSICAO_FEDERACAO")
        )
    }

    def add_candidate(root,key):
        box=root.setdefault(key,{}).setdefault(t,{}).setdefault(cargo,{})
        ck=cand["nome"]+"|"+cand["partido"]
        e=box.setdefault(ck,{**cand,"votos":0})
        e["votos"]+=votos

    add_candidate(d["municipios"],m)
    if m=="NATAL":
        add_candidate(d["zonasNatal"],z)

for rootname in ("municipios","zonasNatal"):
    for turnos in d[rootname].values():
        for cargos in turnos.values():
            for cargo,items in list(cargos.items()):
                cargos[cargo]=sorted(items.values(),key=lambda x:x["votos"],reverse=True)

for r in rows(PART):
    if s(r.get("SG_UF"))!="RN":
        continue
    m=s(r.get("NM_MUNICIPIO"))
    z=s(r.get("NR_ZONA"))
    t=s(r.get("NR_TURNO"))
    cargo=s(r.get("DS_CARGO"))
    p=s(r.get("SG_PARTIDO"))
    legenda=n(r.get("QT_TOTAL_VOTOS_LEG_VALIDOS") or r.get("QT_VOTOS_LEGENDA_VALIDOS"))
    total=n(r.get("QT_VOTOS_NOMINAIS_VALIDOS"))+legenda
    fed=clean(
        r.get("NM_FEDERACAO")
        or r.get("SG_FEDERACAO")
        or r.get("DS_COMPOSICAO_FEDERACAO")
    )

    def add_party(root,key):
        box=root.setdefault(key,{}).setdefault(t,{}).setdefault(cargo,{})
        e=box.setdefault(p,{"partido":p,"federacao":fed,"votos":0})
        e["votos"]+=total
        if not e.get("federacao") and fed:
            e["federacao"]=fed

    if m and cargo and p and total>0:
        add_party(d["partidos"],m)
        if m=="NATAL":
            add_party(d["partidosZonasNatal"],z)

for rootname in ("partidos","partidosZonasNatal"):
    for turnos in d[rootname].values():
        for cargos in turnos.values():
            for cargo,items in list(cargos.items()):
                cargos[cargo]=sorted(items.values(),key=lambda x:x["votos"],reverse=True)

assert len(d["municipios"])==167, len(d["municipios"])
assert set(d["zonasNatal"]) >= {"1","2","3","4","69"}, sorted(d["zonasNatal"])
assert all("Presidente" in v.get("1",{}) for v in d["municipios"].values()), "Presidente 1T ausente"
assert all("Presidente" in v.get("2",{}) for v in d["municipios"].values()), "Presidente 2T ausente"
assert d["partidos"], "Base partidária vazia"
assert d["partidosZonasNatal"], "Base partidária por zona de Natal vazia"

with open("data/eleicoes-2022.json","w",encoding="utf-8") as f:
    json.dump(d,f,ensure_ascii=False,separators=(",",":"))

print(
    "OK",
    len(d["municipios"]),
    "municípios; Presidente 1T/2T; zonas de Natal:",
    sorted(d["zonasNatal"],key=int)
)
