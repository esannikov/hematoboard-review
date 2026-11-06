#!/usr/bin/env python3
"""Build the article module table and SVG/PNG from the descriptive manifest.

Requires cairosvg for PNG rendering; does not access the clinical runtime.
Example on macOS with Homebrew Cairo:
DYLD_FALLBACK_LIBRARY_PATH=/opt/homebrew/lib uv run --with cairosvg python scripts/build_architecture.py
"""
from pathlib import Path
from html import escape
import hashlib
import json
import re
import struct

ROOT=Path(__file__).resolve().parents[1]
MANIFEST=ROOT/'diagrams/manifest.json'
ACTORS={'code':('CODE','#007976','#E8F3EF'),
        'model':('AI MODEL','#7354A3','#F0EBF6'),
        'human':('HUMAN','#A76A18','#FAF0DD')}
INK='#183B47'


def asset(path):
    raw=path.read_bytes()
    item={'path':str(path.relative_to(ROOT)),'sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw)}
    if path.suffix=='.png':item.update(zip(('width','height'),struct.unpack('>II',raw[16:24])))
    return item


def make_table(passport):
    rows=['| Module | Main actors | Input → result | Responsibility |',
          '| --- | --- | --- | --- |']
    for m in passport['modules']:
        actors=', '.join({'code':'code','model':'AI model','human':'human'}[x] for x in m['actors'])
        inputs='; '.join(m['inputs']);outputs='; '.join(m['outputs'])
        rows.append(f"| **{m['title']}** | {actors} | {inputs} → {outputs} | {m['state_owned']} |")
    rows.append('\nRoles describe permitted responsibilities, not a requirement that every role acts in every format. Source reading uses its recorded human or explicitly delegated review route.')
    return '\n'.join(rows)


def make_svg(p):
    modules={m['id']:m for m in p['modules']}
    s=['<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1420" viewBox="0 0 1600 1420" role="img" aria-labelledby="title desc" lang="en">',
       '<title id="title">HematoBoard: modules, responsibilities and data flow</title>',
       '<desc id="desc">Three numbered rows: prepare a reviewed patient graph; form hypotheses, check medical sources and synthesize a candidate; independently critique, publish a verified read-only projection and record a separate clinician decision. Code, model and human responsibilities are labelled. The graph feeds both breadth and synthesis. A separate medical library feeds source checking. A dashed loop marks bounded repair followed by fresh critique.</desc>',
       '<defs>']
    for name,color in [('teal','#007976'),('purple','#7354A3'),('amber','#A76A18'),('grey','#6C8389')]:
        s.append(f'<marker id="arrow-{name}" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10Z" fill="{color}"/></marker>')
    s+=['</defs>','<rect width="1600" height="1420" fill="#FAFAF6"/>']
    def text(x,y,t,size=20,color=INK,weight=400,extra=''):
        s.append(f'<text x="{x}" y="{y}" font-family="Helvetica, Arial, sans-serif" font-size="{size}" font-weight="{weight}" fill="{color}" {extra}>{escape(t)}</text>')
    def line(d,color='teal',dash=False,flow=None):
        colors={'teal':'#007976','purple':'#7354A3','amber':'#A76A18','grey':'#6C8389'}
        data=f' data-source="{flow[0]}" data-target="{flow[1]}" data-flow="{flow[2]}"' if flow else ''
        pattern=' stroke-dasharray="8 7"' if dash else ''
        s.append(f'<path d="{d}" fill="none" stroke="{colors[color]}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round" marker-end="url(#arrow-{color})"{pattern}{data}/>')
    def card(id,x,y,h):
        m=modules[id];base=ACTORS[m['actors'][0]][1]
        s.append(f'<g id="module-{id}" data-module="{id}"><rect x="{x}" y="{y}" width="460" height="{h}" rx="16" fill="#FFFFFF" stroke="#D0DBD6" stroke-width="1.4"/>')
        cursor=x+22
        for actor in m['actors']:
            label,color,fill=ACTORS[actor];width={'code':64,'model':92,'human':82}[actor]
            s.append(f'<rect x="{cursor}" y="{y+19}" width="{width}" height="23" rx="5" fill="{fill}"/>')
            text(cursor+10,y+35,label,12,color,700)
            cursor+=width+8
        text(x+22,y+76,m['title'],26,INK,700)
        for i,t in enumerate(m['diagram_lines']):text(x+22,y+108+i*23,t,20,INK)
        s.append(f'<path d="M{x+22} {y+h-43}H{x+438}" fill="none" stroke="#E1E7E3"/>')
        text(x+22,y+h-18,m['diagram_footer'],17,base,500)
        s.append('</g>')

    text(60,75,'HematoBoard',54,INK,700)
    text(60,115,'Modules, responsibilities and data flow',26,'#49676F')
    for x,actor in [(60,'code'),(230,'model'),(435,'human')]:
        label,color,fill=ACTORS[actor]
        s.append(f'<circle cx="{x+7}" cy="158" r="6" fill="{color}"/>')
        text(x+24,164,{'code':'Code','model':'AI model','human':'Human'}[actor],20,color,600)
    text(1540,72,'06 NOV 2026',17,'#627D80',600,'text-anchor="end" letter-spacing="1.2"')
    text(1540,158,'Roles are explicit; source review follows its recorded authority.',17,'#627D80',400,'text-anchor="end"')
    s.append('<path d="M60 188H1540" stroke="#CFD9D5"/>')

    text(60,231,'01  /  Patient record',25,'#007976',700)
    card('documents',60,260,180);card('source_reading',570,260,180);card('patient_graph',1080,260,180)
    line('M520 350H566',flow=('documents','source_reading','data'))
    line('M1030 350H1076',flow=('source_reading','patient_graph','reviewed_data'))

    line('M1310 440V470Q1310 480 1300 480H44Q34 480 34 490V732Q34 742 44 742H56',flow=('patient_graph','starting_hypotheses','data'))
    text(75,469,'Reviewed graph to the first model pass',17,'#007976',500)
    line('M1310 480V636',flow=('patient_graph','candidate','data'))
    s.append('<circle cx="1310" cy="480" r="4" fill="#007976"/>')
    text(1332,552,'Same patient graph',17,'#007976',500)

    s.append('<g id="input-medical_library" data-input="medical_library"><rect x="570" y="500" width="460" height="92" rx="12" fill="#F1F3F1" stroke="#BECFCB" stroke-dasharray="5 5"/>')
    text(592,535,'Permitted guidelines & articles',23,INK,600)
    text(592,568,'External knowledge, separate from patient data',18,'#49676F')
    s.append('</g>')
    line('M800 592V636','grey',flow=('medical_library','source_grounding','external_evidence'))
    text(60,611,'02  /  Hypotheses and evidence',25,'#7354A3',700)
    card('starting_hypotheses',60,640,205);card('source_grounding',570,640,205);card('candidate',1080,640,205)
    line('M520 742H566','purple',flow=('starting_hypotheses','source_grounding','questions'))
    line('M1030 742H1076','purple',flow=('source_grounding','candidate','reviewed_evidence'))

    line('M1310 845V884Q1310 894 1300 894H44Q34 894 34 904V1077Q34 1087 44 1087H56','purple',flow=('candidate','critic','candidate'))
    text(75,883,'Candidate sent for a separate critique',17,'#7354A3',500)
    line('M480 985V940Q480 930 490 930H1558Q1568 930 1568 920V772Q1568 762 1558 762H1544','amber',True,flow=('critic','candidate','bounded_repair'))
    text(715,918,'One bounded repair, then fresh independent critique',17,'#A76A18',500)
    text(60,956,'03  /  Review and delivery',25,'#A76A18',700)
    card('critic',60,985,205);card('projection',570,985,205);card('clinician_decision',1080,985,205)
    line('M520 1087H566','purple',flow=('critic','projection','review'))
    line('M1030 1087H1076','teal',flow=('projection','clinician_decision','human_review'))

    s.append('<path d="M60 1230H1540" stroke="#CFD9D5"/>')
    s.append('<g id="module-controller" data-module="controller"><rect x="60" y="1260" width="1480" height="120" rx="16" fill="#E8F3EF" stroke="#A4C8BD"/>')
    text(84,1297,'Code supervises every handoff',27,'#007976',700)
    text(84,1330,modules['controller']['diagram_lines'][0],22,INK)
    text(84,1359,modules['controller']['diagram_footer'],18,'#49676F')
    s.append('</g></svg>')
    return '\n'.join(s)+'\n'


def main():
    import cairosvg
    m=json.loads(MANIFEST.read_text());p=m['architecture_passport']
    table=make_table(p)
    readme=ROOT/'README.md';body=readme.read_text()
    pattern=r'<!-- BEGIN GENERATED MODULE CONTRACTS -->.*?<!-- END GENERATED MODULE CONTRACTS -->'
    body,count=re.subn(pattern,'<!-- BEGIN GENERATED MODULE CONTRACTS -->\n'+table+'\n<!-- END GENERATED MODULE CONTRACTS -->',body,flags=re.S)
    if count!=1:raise ValueError('module table markers missing or duplicated')
    readme.write_text(body)
    svg=ROOT/'diagrams/hematoboard-trace-system.svg';png=svg.with_suffix('.png')
    svg.write_text(make_svg(p))
    cairosvg.svg2png(url=str(svg),write_to=str(png),scale=1.5)
    m['article']=asset(readme)
    m['architecture_figure']={'source':asset(svg),'raster':asset(png),
        'represents':'Three phases, role labels, distinct patient/evidence inputs and bounded repair in the current graph-backed route.',
        'generated_from':'architecture_passport in diagrams/manifest.json',
        'generator':asset(Path(__file__).resolve())}
    MANIFEST.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')
    print('Built module table and new architecture SVG/PNG from the manifest.')


if __name__=='__main__':main()
