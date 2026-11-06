#!/usr/bin/env python3
"""Verify article assets and optionally the pinned, public release; no clinical runs.

python3 scripts/verify_publication.py
python3 scripts/verify_publication.py --check-live
"""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import argparse
import collections
import hashlib
import json
import re
import urllib.request
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]


def digest(data):
    return hashlib.sha256(data).hexdigest()


def canonical_digest(value):
    return digest(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode())


def require(condition, message):
    if not condition:
        raise ValueError(message)


def download(url):
    request = urllib.request.Request(url, headers={'User-Agent': 'HematoBoard-article-verifier/2.0'})
    with urllib.request.urlopen(request, timeout=45) as response:
        return response.read()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check-live', action='store_true')
    args = parser.parse_args()
    m = json.loads((ROOT / 'diagrams/manifest.json').read_text())

    checked = set()
    def assets(node):
        if isinstance(node, dict):
            if {'path', 'sha256', 'bytes'} <= node.keys():
                path = (ROOT / node['path']).resolve()
                require(path.is_relative_to(ROOT), 'asset escapes repository')
                data = path.read_bytes()
                require(len(data) == node['bytes'] and digest(data) == node['sha256'], f'asset mismatch: {path}')
                checked.add(str(path.relative_to(ROOT)))
            for value in node.values():
                assets(value)
        elif isinstance(node, list):
            for value in node:
                assets(value)
    assets(m)

    text = (ROOT / 'README.md').read_text()
    targets = re.findall(r'(?:href|src)="([^"]+)"', text) + re.findall(r'\]\(([^)]+)\)', text)
    for target in targets:
        if '://' not in target and not target.startswith('#'):
            path = (ROOT / target.split('#')[0]).resolve()
            require(path.is_relative_to(ROOT) and path.exists(), f'missing local link: {target}')
    require('case=case011-v2' not in text, 'retired case URL remains in article')
    require('FUTURE CLINICIAN GATE' not in (ROOT / 'diagrams/hematoboard-trace-system.svg').read_text(), 'old clinician gate')

    graph = m['patient_graph_illustration']
    tree = ET.parse(ROOT / graph['source']['path'])
    ids = sorted(x.get('data-node') for x in tree.iter() if x.get('data-node'))
    edges = sorted((x.get('data-edge'), x.get('data-source'), x.get('data-target'), x.get('data-relation')) for x in tree.iter() if x.get('data-edge'))
    require(len(ids) == len(set(ids)) == graph['object_count'], 'node inventory mismatch')
    require(len(edges) == graph['structural_edge_count'], 'edge inventory mismatch')
    require(all(e[1] in ids and e[2] in ids for e in edges), 'unbound graph endpoint')
    require(canonical_digest(ids) == graph['sorted_object_ids_sha256'], 'node identity mismatch')
    require(canonical_digest(edges) == graph['sorted_edge_records_sha256'], 'edge identity mismatch')
    require(sum(graph['object_counts_by_type'].values()) == len(ids), 'node-type totals mismatch')

    release = m['public_release']
    cases = release['cases']
    require(len(cases) == release['indexed_candidate_count'], 'case count mismatch')
    require(dict(collections.Counter(c['candidate_schema'] for c in cases)) == release['candidate_schema_counts'], 'schema totals mismatch')
    require([c['key'] for c in cases if c['typed_patient_projection']] == release['typed_patient_projection_keys'], 'graph case list mismatch')
    require([c['key'] for c in cases if c['candidate_schema'].endswith('/1.4')] == release['candidate_1_4_keys'], '1.4 case list mismatch')
    for gap in m['recorded_metadata_gaps']:
        require(gap['synthesis_method_id'] is None and gap['synthesis_method_version'] is None, 'historical method filled without provenance')

    if args.check_live:
        base = f"https://raw.githubusercontent.com/{release['repository']}/{release['commit']}/"
        index_bytes = download(base + 'case-index.json')
        require(digest(index_bytes) == release['case_index_sha256'], 'pinned case index mismatch')
        index = json.loads(index_bytes)
        require([c['key'] for c in index['cases']] == [c['key'] for c in cases], 'pinned index inventory mismatch')
        authenticity_bytes = download(base + 'release-authenticity.json')
        require(digest(authenticity_bytes) == release['authenticity_manifest_sha256'], 'pinned authenticity mismatch')
        authenticity = json.loads(authenticity_bytes)

        def verify_case(c):
            data = download(base + c['package_path'])
            require(digest(data) == c['public_package_sha256'], f"package mismatch: {c['key']}")
            d = json.loads(data)
            projection = d['projection']
            require(projection['candidate_sha256'] == c['candidate_sha256'], 'candidate mismatch')
            require(projection['candidate']['schema_version'] == c['candidate_schema'], 'candidate schema mismatch')
            require(('patient_projection' in d) == c['typed_patient_projection'], 'projection capability mismatch')
            require(projection['review_status']['clinician_accepted'] == c['clinician_accepted'], 'clinician status mismatch')
            require(authenticity['cases'][c['key']]['public_package_sha256'] == c['public_package_sha256'], 'release binding mismatch')
        with ThreadPoolExecutor(max_workers=5) as pool:
            list(pool.map(verify_case, cases))

        shots = m['interface_screenshots']
        qa_bytes = download(base + shots['public_qa_receipt'])
        require(digest(qa_bytes) == shots['public_qa_sha256'], 'QA receipt mismatch')
        qa = json.loads(qa_bytes)
        for shot in shots['captures']:
            match = next(x for x in qa['screenshots'] if x['viewport'] == shot['qa_surface'])
            require(match['sha256'] == shot['sha256'], 'screenshot not bound to QA')
        require(qa['ui_source_sha256'] == release['ui_source_sha256'], 'screenshot UI mismatch')
        live_version = download('https://esannikov.github.io/hematoboard/VERSION').decode().strip()
        print(f'Live dashboard version: {live_version}; article snapshot: {release["version"]}.')
    print(f'PASS: {len(checked)} hashed assets; {len(cases)} packages; {len(ids)} graph nodes; {len(edges)} edges; local links and explicit unknown method versions.')


if __name__ == '__main__':
    main()
