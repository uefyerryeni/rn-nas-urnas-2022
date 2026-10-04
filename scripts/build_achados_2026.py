#!/usr/bin/env python3
"""Gera a camada 2026 do Achados UEFY sem tocar na Central das Eleições 2026."""
import json, re, unicodedata, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone, timedelta
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'data'/'achados-2026.json';HIST=ROOT/'data'/'eleicoes-2022.json'
BASE='https://resultados.tse.jus.br/oficial/ele2026';FED='6257';STATE='6259';ELF='006257';ELS='006259'
CONFIG=f'{BASE}/{FED}/config/mun-e{ELF}-cm.json'
OFFICES={'pres':{'cargo':'0001','label':'Presidente','election':FED,'el':ELF},'gov':{'cargo':'0003','label':'Governador','election':STATE,'el':ELS},'sen':{'cargo':'0005','label':'Senado','election':STATE,'el':ELS},'depf':{'cargo':'0006','label':'Deputado federal','election':STATE,'el':ELS},'depe':{'cargo':'0007','label':'Deputado estadual','election':STATE,'el':ELS}}
TZ=timezone(timedelta(hours=-3));ALIASES={'ACU':'ASSU','ARES':'AREZ','JANUARIO CICCO':'BOA SAUDE'}
def norm(s):
    x=''.join(c for c in unicodedata.normalize('NFD',str(s or '')) if unicodedata.category(c)!='Mn').upper();x=re.sub(r'[^A-Z0-9]+',' ',x).strip();x=re.sub(r'\s+',' ',x);return ALIASES.get(x,x)
def fetch_json(url,timeout=22):
    req=urllib.request.Request(url,headers={'User-Agent':'UEFY-Achados-2026/1.0'})
    with urllib.request.urlopen(req,timeout=timeout) as r:return json.loads(r.read().decode('utf-8-sig'))
def num(v):
    try:return int(str(v or '0').replace('.','').replace(',','.').split('.')[0])
    except:return 0
def dec(v):
    try:return float(str(v or '0').replace(',','.'))
    except:return 0.0
def progress(data):
    s=data.get('s') or {}
    if s.get('pst') is not None:return dec(s.get('pst'))
    return num(s.get('st'))/num(s.get('ts'))*100 if num(s.get('ts')) else 0.0
def flatten(data):
    out=[]
    for cargo in data.get('carg',[]) or []:
      for agr in cargo.get('agr',[]) or []:
       for par in agr.get('par',[]) or []:
        for c in par.get('cand',[]) or []:
         out.append({'id':str(c.get('sqcand') or c.get('n') or ''),'number':str(c.get('n') or ''),'name':str(c.get('nmu') or c.get('nm') or ''),'party':str(par.get('sg') or ''),'votes':num(c.get('vap')),'pct':dec(c.get('pvap')),'elected':str(c.get('e') or '').lower()=='s','status':str(c.get('st') or ''),'vote_destination':str(c.get('dvt') or '')})
    return sorted(out,key=lambda x:(-x['votes'],x['name']))
def party_rows(data,office):
    by={}
    if office in ('depf','depe'):
      for cargo in data.get('carg',[]) or []:
       for agr in cargo.get('agr',[]) or []:
        for par in agr.get('par',[]) or []:
         p=str(par.get('sg') or '').strip()
         if p:by[p]=by.get(p,0)+num(par.get('tvtn'))+num(par.get('tvtl'))
    else:
      for c in flatten(data):by[c['party']]=by.get(c['party'],0)+c['votes']
    return [{'party':p,'votes':v} for p,v in sorted(by.items(),key=lambda x:-x[1]) if v>0]
def parse_result(data,office):
    cand=flatten(data);elected=[x for x in cand if x['elected']];eb={}
    for x in elected:eb[x['party']]=eb.get(x['party'],0)+1
    return {'progress':progress(data),'final':str(data.get('tf') or '').lower()=='s' or str(data.get('and') or '').lower()=='f','generated_at':' · '.join(x for x in [str(data.get('dg') or ''),str(data.get('hg') or '')] if x),'candidates':cand,'candidates_with_votes':sum(x['votes']>0 for x in cand),'elected':len(elected),'elected_by_party':[{'party':p,'count':n} for p,n in sorted(eb.items(),key=lambda x:-x[1])],'parties':party_rows(data,office)}
def walk_municipalities(node,uf=None,out=None):
    if out is None:out=[]
    if isinstance(node,list):
      for x in node:walk_municipalities(x,uf,out)
      return out
    if not isinstance(node,dict):return out
    local=str(node.get('sg') or node.get('uf') or node.get('cdabr') or node.get('abr') or uf or '').lower()
    if isinstance(node.get('mu'),list):
      maybe=str(node.get('cd') or '')
      if len(maybe)==2 and maybe.isalpha():local=maybe.lower()
      for m in node['mu']:
       if not isinstance(m,dict):continue
       code=str(m.get('cd') or m.get('c') or m.get('cdmun') or m.get('mun') or m.get('codigo') or '').zfill(5);name=str(m.get('nm') or m.get('nmu') or m.get('nome') or m.get('ds') or m.get('descricao') or '').strip()
       if code and name:out.append({'uf':local,'code':code,'name':name})
    for k,v in node.items():
      if k!='mu':walk_municipalities(v,local,out)
    return out
def state_url(o):
    m=OFFICES[o];return f"{BASE}/{m['election']}/dados/rn/rn-c{m['cargo']}-e{m['el']}-u.json"
def municipal_url(code,o):
    m=OFFICES[o];return f"{BASE}/{m['election']}/dados/rn/rn{code}-c{m['cargo']}-e{m['el']}-u.json"
def hist_leaders(hist,office):
    cargo={'pres':'Presidente','gov':'Governador'}[office];out={}
    for name,turns in hist.get('municipios',{}).items():
      rows=(turns.get('1') or {}).get(cargo) or []
      if rows:out[norm(name)]={'name':rows[0]['nome'],'party':rows[0].get('partido',''),'votes':num(rows[0].get('votos'))}
    return out
def finding(fid,typ,office,headline,summary,display,progress_value,confirmed=False):
    labels={'change':'Mudou desde 2022','exception':'Exceção no mapa','closest':'Disputa mais apertada','widest':'Maior vantagem','extreme':'Extremo municipal'}
    return {'id':fid,'type':typ,'type_label':labels.get(typ,typ),'office':office,'headline':headline,'summary':summary,'display_value':display,'progress':round(progress_value,2),'confirmed':bool(confirmed)}
def build_findings(hist,municipal,statewide):
    findings=[]
    for office in ('pres','gov'):
      rows=municipal.get(office,{});usable=[(n,r) for n,r in rows.items() if r.get('candidates') and r.get('progress',0)>=50]
      if not usable:continue
      old=hist_leaders(hist,office)
      for name,r in usable:
       cur=r['candidates'][0];prev=old.get(norm(name))
       if prev and norm(prev['name'])!=norm(cur['name']):findings.append(finding('change-'+office+'-'+norm(name),'change',office,f'{name} mudou de liderança',f"Em 2022, {prev['name']} liderou o município no 1º turno. Em 2026, {cur['name']} aparece em 1º com {cur['pct']:.2f}%.",f"{prev['name']} → {cur['name']}",r['progress'],r['final']))
      races=[]
      for name,r in usable:
       if len(r['candidates'])>=2:
        a,b=r['candidates'][:2];races.append((a['pct']-b['pct'],name,r,a,b))
      if races:
       gap,name,r,a,b=min(races,key=lambda x:x[0]);findings.append(finding('closest-'+office,'closest',office,f'{name} tem a disputa mais apertada',f"{a['name']} e {b['name']} estão separados por {gap:.2f} ponto percentual neste recorte.",f'{gap:.2f} p.p.',r['progress'],r['final']))
       gap,name,r,a,b=max(races,key=lambda x:x[0]);findings.append(finding('widest-'+office,'widest',office,f'{name} registra a maior vantagem',f"A diferença entre {a['name']} e {b['name']} é de {gap:.2f} pontos percentuais.",f'{gap:.2f} p.p.',r['progress'],r['final']))
      counts={}
      for name,r in usable:
       lead=r['candidates'][0];k=lead['name']+'|'+lead['party'];counts.setdefault(k,{'candidate':lead,'places':[]});counts[k]['places'].append((name,r))
      for k,x in counts.items():
       if 1<=len(x['places'])<=3 and len(usable)>=80:
        names=', '.join(n for n,_ in x['places']);conf=all(r['final'] for _,r in x['places']) and len(usable)>=167
        findings.append(finding('exception-'+office+'-'+norm(k),'exception',office,f"{x['candidate']['name']} lidera em apenas {len(x['places'])} município(s)",f"No conjunto de municípios com dados suficientes, a liderança aparece em {names}.",names,min(r['progress'] for _,r in x['places']),conf))
      for cand in (statewide.get(office,{}).get('candidates') or [])[:3]:
       pts=[]
       for name,r in usable:
        row=next((x for x in r['candidates'] if x['number']==cand['number'] and x['party']==cand['party']),None)
        if row:pts.append((row['pct'],name,r))
       if pts:
        hi=max(pts,key=lambda x:x[0]);lo=min(pts,key=lambda x:x[0])
        findings.append(finding('extreme-hi-'+office+'-'+cand['number'],'extreme',office,f"Maior percentual de {cand['name']}",f"Entre os municípios com pelo menos 50% das seções totalizadas, o maior percentual aparece em {hi[1]}.",f'{hi[0]:.2f}% · {hi[1]}',hi[2]['progress'],hi[2]['final']))
        findings.append(finding('extreme-lo-'+office+'-'+cand['number'],'extreme',office,f"Menor percentual de {cand['name']}",f"Entre os municípios com pelo menos 50% das seções totalizadas, o menor percentual aparece em {lo[1]}.",f'{lo[0]:.2f}% · {lo[1]}',lo[2]['progress'],lo[2]['final']))
    findings.sort(key=lambda x:(not x['confirmed'],{'exception':0,'change':1,'closest':2,'widest':3,'extreme':4}.get(x['type'],9),-x['progress']));return findings
def main():
    now=datetime.now(TZ).isoformat(timespec='seconds');previous={}
    if OUT.exists():
      try:previous=json.loads(OUT.read_text(encoding='utf-8'))
      except:pass
    hist=json.loads(HIST.read_text(encoding='utf-8'))
    try:
      cfg=fetch_json(CONFIG);municipalities=[m for m in walk_municipalities(cfg) if m['uf']=='rn']
      if len(municipalities)!=167:raise RuntimeError(f'Configuração municipal incompleta: {len(municipalities)}')
      statewide={}
      for o in OFFICES:
       try:statewide[o]=parse_result(fetch_json(state_url(o)),o)
       except urllib.error.HTTPError as e:
        if e.code==404:statewide[o]={'progress':0,'final':False,'generated_at':'','candidates':[],'candidates_with_votes':0,'elected':0,'elected_by_party':[],'parties':[]}
        else:raise
      municipal={'pres':{},'gov':{}};jobs=[]
      with ThreadPoolExecutor(max_workers=12) as ex:
       for o in ('pres','gov'):
        for m in municipalities:jobs.append((ex.submit(fetch_json,municipal_url(m['code'],o)),o,m))
       for fut,o,m in jobs:
        try:
         d=fut.result();r=parse_result(d,o);municipal[o][m['name']]={'code':m['code'],'progress':r['progress'],'final':r['final'],'generated_at':r['generated_at'],'candidates':r['candidates'][:8]}
        except Exception:continue
      progress_values=[statewide[o]['progress'] for o in ('gov','sen','depf','depe')];overall=sum(progress_values)/len(progress_values) if progress_values else 0
      status='final' if progress_values and all(statewide[o]['final'] for o in ('gov','sen','depf','depe')) else ('live' if overall>0 else 'waiting')
      parn=next((r for n,r in municipal['pres'].items() if norm(n)=='PARNAMIRIM'),None);findings=build_findings(hist,municipal,statewide);source_stamp=max([statewide[o].get('generated_at','') for o in statewide]+[''])
      data={'status':status,'generated_at':now,'source_generated_at':source_stamp,'progress':round(overall,2),'message':('Resultados oficiais de 2026 carregados para comparação.' if overall>0 else 'Aguardando o início da divulgação oficial dos resultados de 2026.'),'source':'Tribunal Superior Eleitoral · EA20','offices':statewide,'municipal_pres':municipal['pres'],'parnamirim':parn,'municipal_coverage':{o:len(municipal[o]) for o in municipal},'findings':findings,'methodology_version':'1.0'}
      OUT.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8');print('OK',status,'progress',overall,'findings',len(findings))
    except Exception as e:
      if previous and previous.get('status') in ('live','final'):
       previous['generated_at']=now;previous['message']='A nova consulta ao TSE falhou; o último resultado válido foi preservado.';previous['stale']=True;OUT.write_text(json.dumps(previous,ensure_ascii=False,indent=2),encoding='utf-8');print('Preservado último resultado válido:',e)
      else:
       data={'status':'waiting','generated_at':now,'source_generated_at':'','progress':0,'message':'Aguardando a disponibilização oficial dos resultados de 2026 pelo TSE.','source':'Tribunal Superior Eleitoral · EA20','offices':{},'municipal_pres':{},'parnamirim':None,'municipal_coverage':{},'findings':[],'methodology_version':'1.0'};OUT.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8');print('WAITING',e)
if __name__=='__main__':main()
