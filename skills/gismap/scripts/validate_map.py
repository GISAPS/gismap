#!/usr/bin/env python3
"""Offline *preliminary* map-v1 checks; does not validate live fields or rendering."""
import json
import math
import re
import sys
from urllib.parse import urlsplit, parse_qsl

TYPES = {'arcgis-auto', 'feature', 'map-image', 'imagery', 'geojson', 'wms', 'wfs', 'kml'}
SECRET = re.compile(r'^(token|oauth[_-]?token|access[_-]?token|api[_-]?key|key|client[_-]?secret|password|passwd|pwd|authorization|auth|signature|sig)$', re.I)
RENDERERS = {'service', 'simple', 'choropleth', 'graduated-symbols', 'categories', 'heatmap', 'arcgis', 'auto'}

def validate(spec):
    issues = []
    def error(path, message): issues.append({'level': 'error', 'code': 'INVALID_SPEC', 'path': path, 'message': message})
    if not isinstance(spec, dict):
        error('', 'Expected a map-v1 object.')
        return issues
    if spec.get('version') != 1: error('version', 'Expected version 1.')
    layers = spec.get('layers')
    if not isinstance(layers, list) or not 1 <= len(layers) <= 10:
        error('layers', 'Expected 1–10 layers.')
        layers = []
    for i, layer in enumerate(layers):
        path = f'layers[{i}]'
        if not isinstance(layer, dict):
            error(path, 'Expected a layer object.')
            continue
        try:
            url = urlsplit(layer.get('url', ''))
            if url.scheme != 'https' or not url.hostname or url.username or url.password or any(SECRET.match(k) for k, _ in parse_qsl(url.query, keep_blank_values=True)):
                error(path + '.url', 'Expected a public HTTPS URL without credentials.')
        except (TypeError, ValueError): error(path + '.url', 'Invalid URL.')
        if layer.get('type', 'arcgis-auto') not in TYPES: error(path + '.type', 'Unsupported map-v1 layer type.')
        where = layer.get('where')
        if where is not None and (not isinstance(where, str) or len(where) > 2000 or re.search(r';|--|/\*|\b(drop|delete|insert|update|alter|exec|execute|merge|truncate|create)\b', where, re.I)):
            error(path + '.where', 'Filter must be a read-only attribute expression.')
        renderer = layer.get('renderer')
        if renderer is not None and (not isinstance(renderer, dict) or not isinstance(renderer.get('type'), str)):
            error(path + '.renderer', 'Renderer must be an object with a type.')
        elif isinstance(renderer, dict):
            if renderer['type'] not in RENDERERS: error(path + '.renderer.type', 'Unsupported renderer type.')
            if renderer['type'] in ('choropleth', 'graduated-symbols', 'categories', 'heatmap', 'auto') and (not isinstance(renderer.get('field'), str) or not renderer['field'].strip()): error(path + '.renderer.field', 'A field name is required.')
    camera = spec.get('camera')
    if camera is not None:
        if not isinstance(camera, dict): error('camera', 'Expected an object.')
        elif camera.get('fit') not in ('layers', 'none'):
            center = camera.get('center')
            number = lambda n: isinstance(n, (int, float)) and not isinstance(n, bool) and math.isfinite(n)
            if not isinstance(center, list) or len(center) != 2 or not all(number(n) for n in center) or abs(center[0]) > 180 or abs(center[1]) > 90:
                error('camera.center', 'Expected [longitude, latitude] in degrees.')
            for key, low, high in [('zoom',0,24),('tilt',0,90),('heading',-360,360)]:
                if key in camera and (not number(camera[key]) or not low <= camera[key] <= high): error('camera.' + key, 'Camera value is outside the supported range.')
    if 'briefing' in spec and spec['briefing'] is not None and not isinstance(spec['briefing'], dict): error('briefing', 'Expected a briefing-v1 object.')
    return issues

def main():
    if len(sys.argv) != 2:
        print(json.dumps({'valid': False, 'error': 'Usage: validate_map.py MAP.json'})); return 2
    try:
        with open(sys.argv[1], encoding='utf-8') as handle: spec = json.load(handle, parse_constant=lambda _: (_ for _ in ()).throw(ValueError('Non-finite JSON number')))
        issues = validate(spec)
    except (OSError, ValueError) as exc:
        print(json.dumps({'valid': False, 'error': str(exc)})); return 2
    print(json.dumps({'valid': not issues, 'issues': issues, 'scope': 'preliminary structural checks only; use GISMap Online core validation and verify live rendering'}))
    return 1 if issues else 0
if __name__ == '__main__': sys.exit(main())
