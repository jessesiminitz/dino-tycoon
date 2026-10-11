"""Export editable Blender contours, without rendering or pixel quantization.

Reads the local canonical scenes and animation shape keys; never saves over them.
Run with Blender --background --python scripts/art/export_cartoon.py.
"""
import json
from pathlib import Path
import bpy

ROOT = Path(__file__).resolve().parents[2]
manifest = json.loads((ROOT / 'assets-source/export-manifest.json').read_text())
output = {}

def contours(scene, key=None):
    shapes = []
    for obj in scene.objects:
        if obj.type != 'MESH' or not obj.data.polygons:
            continue
        mesh = obj.data
        vertices = mesh.shape_keys.key_blocks[key].data if key and mesh.shape_keys and key in mesh.shape_keys.key_blocks else mesh.vertices
        face = max(mesh.polygons, key=lambda p: len(p.vertices))
        points = [[round(vertices[i].co.x, 2), round(scene.render.resolution_y - vertices[i].co.z, 2)] for i in face.vertices]
        depth = sum(vertices[i].co.y for i in face.vertices) / len(face.vertices)
        name = obj.name.removeprefix(scene.name + '_')
        role = obj.get('role', '')
        if not role and obj.data.materials:
            role = obj.data.materials[0].name.removeprefix('DinoTycoon_Role_')
        shapes.append((depth, [name, role, points]))
    return [shape for _, shape in sorted(shapes, key=lambda s: -s[0])]

def load(path):
    bpy.ops.wm.open_mainfile(filepath=str(path))
    return sorted(bpy.data.scenes, key=lambda s: s.name)

folders = {'dino': 'dinos', 'building': 'buildings', 'environment': 'environment', 'terrain': 'terrain'}
for asset, spec in manifest['assets'].items():
    if spec['kind'] == 'terrain':
        continue  # Continuous procedural terrain is drawn in the browser.
    scenes = load(ROOT / 'assets-source/blender' / folders[spec['kind']] / (asset + '.blend'))
    scenes = [s for s in scenes if s.name.startswith('DinoTycoon_' + asset + '_Pose')]
    assert len(scenes) == len(spec['frames']), (asset, len(scenes))
    entry = {'width': spec['width'], 'height': spec['height'], 'frames': [contours(s) for s in scenes]}
    if 'colors' in spec:
        entry['colors'] = spec['colors']
    if spec['kind'] == 'dino':
        entry['motion'] = {}
        for clip in ('walk', 'idle', 'eat', 'rest'):
            scene = load(ROOT / 'assets-source/blender/motion' / f'{asset}-{clip}.blend')[0]
            entry['motion'][clip] = {'width': scene.render.resolution_x, 'height': scene.render.resolution_y,
                                     'frames': [contours(scene, f'{clip}_{i:02d}') for i in range(8)]}
    output[asset] = entry
    print('Exported cartoon contours:', asset, flush=True)

target = ROOT / 'src/render/generated/cartoonGeometry.json'
pool, known = [], {}
def pack(frames):
    result = []
    for frame in frames:
        indices = []
        for shape in frame:
            key = json.dumps(shape, separators=(',', ':'))
            if key not in known:
                known[key] = len(pool)
                pool.append(shape)
            indices.append(known[key])
        result.append(indices)
    return result
for entry in output.values():
    entry['frames'] = pack(entry['frames'])
    for pose in entry.get('motion', {}).values():
        pose['frames'] = pack(pose['frames'])
target.write_text(json.dumps({'shapes': pool, 'assets': output}, separators=(',', ':')) + '\n')
print('Wrote', target, target.stat().st_size, 'bytes', flush=True)
