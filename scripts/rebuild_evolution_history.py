#!/usr/bin/env python3
import json, urllib.request
from datetime import datetime
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'data'/'evolucao-2026.json'
API='https://api.github.com/repos/uefyerryeni/rn-nas-urnas-2022'
def get(url):
 req=urllib.request.Request(url,headers={'User-Agent':'UEFY-Evolucao-2026/1.0','Accept':'application/vnd.github+json'})
 with urllib.request.urlopen(req,timeout=30) as r:return json.loads(r.read().decode())
def raw(sha):
 u=f'https://raw.githubusercontent.com/uefyerryeni/rn-nas-urnas-2022/{sha}/data/achados-2026.json'
 req=urllib.request.Request(u,headers={'User-Agent':'UEFY-Evolucao-2026/1.0'})
 with urllib.request.urlopen(req,timeout=30) as r:return json.loads(r.read().decode())
commits=get(API+'/commits?path=data/achados-2026.json&per_page=100')
commits=[x for x in commits if '2026-10-04T19:00:00Z'<=x['commit']['author']['date']<='2026-10-05T07:00:00Z'][::-1]
series={o:[] for o in ('pres','gov','sen')}
seen={o:set() for o in series}
for meta in commits:
 try:d=raw(meta['sha'])
 except Exception as e:
  print('skip',meta['sha'],e);continue
 for o in series:
  r=(d.get('offices') or {}).get(o) or {}
  cand=r.get('candidates') or []
  if not cand or float(r.get('progress') or 0)<=0:continue
  snap={'time':r.get('generated_at') or d.get('source_generated_at') or meta['commit']['author']['date'],'progress':round(float(r.get('progress') or 0),2),'candidates':[{k:x.get(k) for k in ('number','name','party','votes','pct')} for x in cand[:8]]}
  key=(snap['progress'],tuple((x.get('number'),x.get('votes')) for x in snap['candidates']))
  if key in seen[o]:continue
  seen[o].add(key);series[o].append(snap)
data={'source':'Tribunal Superior Eleitoral · snapshots EA20 preservados pelo Achados 2026','election_date':'2026-10-04','generated_at':datetime.now().astimezone().isoformat(timespec='seconds'),'series':series}
OUT.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
print({o:len(v) for o,v in series.items()})
if not all(len(series[o])>=10 for o in series):raise SystemExit('Histórico insuficiente')
