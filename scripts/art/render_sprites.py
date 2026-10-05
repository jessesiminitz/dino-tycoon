"""Blender authoring/export entry point; also callable in small steps through MCP.

No third-party Python packages. Each asset gets its own isolated scene.
"""
import argparse
import hashlib
import json
import math
import runpy
import time
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = json.loads((ROOT / 'assets-source/export-manifest.json').read_text())
PATCHES = json.loads((ROOT / 'assets-source/pixel-cleanup/patches.json').read_text())
OUTPUT = ROOT / 'assets-source/renders'
if '.'.join(map(str, bpy.app.version)) != MANIFEST['blenderVersion']:
    raise RuntimeError('Use Blender ' + MANIFEST['blenderVersion'] + ' or review regeneration before changing the manifest')


def linear(value):
    value = value / 255
    return value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4


ROLE_RGB = {key: tuple(linear(int(color[i:i+2], 16)) for i in (1, 3, 5))
            for key, color in MANIFEST['roles'].items()}
ROLE_ENCODED = {role: tuple(int(color[i:i+2], 16)/255 for i in (1, 3, 5))
                for role, color in MANIFEST['roles'].items()}


def setup(asset, frame=0, scene_name=None):
    """Create/rebuild only this tool's scene, leaving the user's scene alone."""
    spec = MANIFEST['assets'][asset]
    name = scene_name or 'DinoTycoon_' + asset + '_Pose' + str(frame)
    old = bpy.data.scenes.get(name)
    if old:
        objects = list(old.objects)
        bpy.data.scenes.remove(old)
        for obj in objects:
            if obj.users == 0:
                data = obj.data
                bpy.data.objects.remove(obj)
                if data and data.users == 0:
                    if isinstance(data, bpy.types.Mesh):
                        bpy.data.meshes.remove(data)
                    elif isinstance(data, bpy.types.Camera):
                        bpy.data.cameras.remove(data)
    scene = bpy.data.scenes.new(name)
    bpy.context.window.scene = scene
    scene['asset'] = asset
    scene.render.engine = MANIFEST['engine']
    scene.cycles.device = MANIFEST['device']
    scene.cycles.samples = MANIFEST['samples']
    scene.cycles.seed = MANIFEST['seed']
    scene.cycles.use_denoising = False
    scene.cycles.filter_width = MANIFEST['pixelFilterWidth']
    scene.render.resolution_x = spec['width']
    scene.render.resolution_y = spec['height']
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.view_settings.view_transform = MANIFEST['viewTransform']
    scene.view_settings.look = 'None'
    scene.view_settings.exposure = 0
    scene.view_settings.gamma = 1
    scene.render.use_file_extension = True
    camera_data = bpy.data.cameras.new(name + '_Camera')
    camera = bpy.data.objects.new(name + '_Camera', camera_data)
    scene.collection.objects.link(camera)
    camera.location = (spec['width'] / 2, MANIFEST['camera']['depth'], spec['height'] / 2)
    camera.rotation_euler = Vector(MANIFEST['camera']['direction']).to_track_quat('-Z', 'Y').to_euler()
    camera_data.type = 'ORTHO'
    camera_data.ortho_scale = max(spec['width'], spec['height'])
    scene.camera = camera
    for role, rgb in ROLE_RGB.items():
        mat = bpy.data.materials.get('DinoTycoon_Role_' + role)
        if mat is None:
            mat = bpy.data.materials.new('DinoTycoon_Role_' + role)
        mat.use_nodes = True
        mat.node_tree.nodes.clear()
        emission = mat.node_tree.nodes.new('ShaderNodeEmission')
        emission.inputs['Color'].default_value = (*rgb, 1)
        output = mat.node_tree.nodes.new('ShaderNodeOutputMaterial')
        mat.node_tree.links.new(emission.outputs[0], output.inputs['Surface'])
        mat.diffuse_color = (*rgb, 1)
    return scene


def profile(scene, name, points, role='B', depth=0, thickness=2):
    """Extruded low-poly profile, in native sprite pixel coordinates."""
    height = scene.render.resolution_y
    count = len(points)
    verts = [(x, depth + side * thickness / 2, height - y) for side in (-1, 1) for x, y in points]
    faces = [tuple(reversed(range(count))), tuple(range(count, count * 2))]
    faces += [(i, (i+1) % count, (i+1) % count + count, i + count) for i in range(count)]
    mesh = bpy.data.meshes.new(scene.name + '_' + name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(scene.name + '_' + name, mesh)
    scene.collection.objects.link(obj)
    obj.data.materials.append(bpy.data.materials['DinoTycoon_Role_' + role])
    obj['role'] = role
    return obj


def ellipse(scene, name, cx, cy, rx, ry, role='B', depth=0, sides=16):
    return profile(scene, name, [(cx + rx * math.cos(i*2*math.pi/sides), cy + ry * math.sin(i*2*math.pi/sides))
                                for i in range(sides)], role, depth)


def limb(scene, name, points, role='B', depth=0):
    for i, ((ax, ay, ar), (bx, by, br)) in enumerate(zip(points, points[1:])):
        dx, dy = bx-ax, by-ay
        length = math.hypot(dx, dy)
        nx, ny = -dy / length, dx / length
        profile(scene, name + '_' + str(i), [(ax+nx*ar, ay+ny*ar), (bx+nx*br, by+ny*br),
                                             (bx-nx*br, by-ny*br), (ax-nx*ar, ay-ny*ar)], role, depth)
        ellipse(scene, name + '_joint_' + str(i), ax, ay, ar, ar, role, depth)
    bx, by, br = points[-1]
    ellipse(scene, name + '_tip', bx, by, br, br, role, depth)


def rect(scene, name, x, y, w, h, role, depth):
    return profile(scene, name, [(x,y), (x+w,y), (x+w,y+h), (x,y+h)], role, depth)


def rex(scene, phase):
    stride = math.cos(phase * math.tau) * 3
    near_lift = max(0, -math.sin(phase * math.tau)) * 3
    far_lift = max(0, math.sin(phase * math.tau)) * 3
    # Far leg is a darker silhouette with space between shin and near ankle.
    limb(scene, 'far_leg', [(28,25,4), (24-stride,33,3), (25-stride,41-far_lift,1.5)], 'F', 4)
    profile(scene, 'far_toes', [(23-stride,40-far_lift), (27-stride,41-far_lift), (31-stride,43-far_lift), (31-stride,44-far_lift), (23-stride,44-far_lift)], 'F', 4)
    # The tail counterbalances a horizontal trunk rather than a vertical blob.
    profile(scene, 'tail', [(29,18), (20,19), (11,23), (1,23), (9,27), (20,27), (30,28)], 'B', 0)
    ellipse(scene, 'torso', 32, 22, 12, 7, 'B', 0)
    profile(scene, 'neck', [(39,19), (42,11), (47,8), (50,12), (46,23), (39,26)], 'B', -1)
    profile(scene, 'skull', [(47,7), (53,5), (61,6), (65,9), (64,16), (55,17), (48,14)], 'B', -2)
    profile(scene, 'jaw', [(51,16), (63,16), (61,20), (52,20), (48,16)], 'D', -3)
    rect(scene, 'mouth', 54, 15, 10, 1, 'M', -5)
    for x in (55, 58, 61):
        profile(scene, 'tooth_' + str(x), [(x,16), (x+1.5,16), (x+0.5,18)], 'W', -6)
    rect(scene, 'eye', 57, 10, 1, 1, 'E', -7)
    profile(scene, 'belly', [(28,26), (36,26), (43,22), (43,25), (35,29), (29,29)], 'D', -3)
    limb(scene, 'far_arm', [(42,23,1), (46,25,0.8), (48,23,0.6)], 'F', 3)
    limb(scene, 'near_arm', [(42,22,1.2), (44,26,0.8), (47,26,0.7)], 'B', -5)
    limb(scene, 'near_thigh', [(31,25,4.5), (35+stride,32,3)], 'B', -5)
    limb(scene, 'near_shin', [(35+stride,32,2.4), (32+stride,40-near_lift,1.5), (34+stride,42-near_lift,1.3)], 'B', -5)
    profile(scene, 'near_toes', [(32+stride,41-near_lift), (36+stride,41-near_lift), (42+stride,43-near_lift), (42+stride,44-near_lift), (32+stride,44-near_lift)], 'B', -5)
    rect(scene, 'near_claws', 39+stride, 43-near_lift, 3, 1, 'W', -7)


def trike(scene, phase):
    stride = math.cos(phase * math.tau) * 2
    for name, x, offset in [('far_back',16,-stride), ('far_front',36,stride)]:
        lift = max(0, math.sin(phase*math.tau) * (1 if name == 'far_back' else -1)) * 2
        limb(scene, name, [(x,21,2.4), (x+offset-2,27,1.8), (x+offset,33-lift,1.4)], 'F', 4)
        rect(scene, name + '_foot', x+offset-1, 32-lift, 5, 2, 'F', 4)
    profile(scene, 'tail', [(14,15), (8,17), (1,20), (8,22), (15,21)], 'B', 0)
    ellipse(scene, 'torso', 26, 17, 16, 9, 'B', 0)
    profile(scene, 'belly', [(14,21), (28,23), (39,21), (37,25), (19,25)], 'D', -2)
    limb(scene, 'neck', [(36,16,6), (44,18,5)], 'B', 0)
    ellipse(scene, 'frill', 43, 12, 6, 10, 'A', -2)
    ellipse(scene, 'frill_inset', 43, 12, 4.5, 8, 'G', -4)
    profile(scene, 'face', [(43,14), (49,14), (54,18), (57,21), (56,25), (50,25), (43,22)], 'B', -5)
    profile(scene, 'beak', [(55,21), (59,22), (57,26), (54,24)], 'M', -7)
    limb(scene, 'far_horn', [(46,14,1.2), (50,10,0.8), (54,7,0.25)], 'W', -4)
    limb(scene, 'near_horn', [(48,14,1.4), (53,10,0.9), (58,7,0.25)], 'W', -8)
    limb(scene, 'nose_horn', [(54,19,1), (57,15,0.25)], 'W', -8)
    rect(scene, 'eye', 49, 17, 1, 1, 'E', -9)
    for name, x, offset in [('near_back',17,stride), ('near_front',35,-stride)]:
        lift = max(0, -math.sin(phase*math.tau) * (1 if name == 'near_back' else -1)) * 2
        limb(scene, name, [(x,22,3), (x+offset,28,2), (x+offset-1,33-lift,1.5)], 'B', -6)
        rect(scene, name + '_foot', x+offset-2, 32-lift, 6, 2, 'B', -6)
        rect(scene, name + '_toes', x+offset+1, 33-lift, 3, 1, 'W', -8)


def tower(scene, phase):
    # Binocular lenses, platform and a braced ladder stay legible at 24x42.
    limb(scene, 'left_brace', [(10,31,1), (3,39,1)], 'F', 1)
    limb(scene, 'right_brace', [(14,31,1), (21,39,1)], 'D', 1)
    rect(scene, 'ladder_left', 10, 17, 1, 23, 'G', -1)
    rect(scene, 'ladder_right', 13, 17, 1, 23, 'F', -1)
    for y in range(21, 40, 3):
        rect(scene, 'rung_' + str(y), 11, y, 2, 1, 'W', -2)
    rect(scene, 'platform', 5, 16, 14, 2, 'M', -3)
    rect(scene, 'platform_rim', 5, 16, 14, 1, 'W', -4)
    rect(scene, 'neck', 11, 12, 2, 4, 'F', 0)
    rect(scene, 'focus', 10, 3, 4, 2, 'F', -2)
    rect(scene, 'bridge', 9, 6, 6, 5, 'B', -1)
    for x in (7, 16):
        ellipse(scene, 'barrel_' + str(x), x, 8, 4.5, 6, 'B', -2, 12)
        ellipse(scene, 'rim_' + str(x), x, 8.5, 3.5, 4.5, 'D', -4, 12)
        ellipse(scene, 'lens_' + str(x), x, 8.5, 2.5, 3.5, 'A', -6, 12)
        rect(scene, 'glint_' + str(x), x-1, 6, 1, 1, 'E', -8)


BUILDERS = {'tyrannosaurus': rex, 'triceratops': trike, 'tower': tower}
BUILDERS.update(runpy.run_path(str(ROOT / 'scripts/art/models.py'), init_globals=globals())['EXTRA_BUILDERS'])
BUILDERS.update(runpy.run_path(str(ROOT / 'scripts/art/environment_models.py'), init_globals=globals())['ENVIRONMENT_BUILDERS'])
BUILDERS.update(runpy.run_path(str(ROOT / 'scripts/art/expansion_models.py'), init_globals=globals())['EXPANSION_BUILDERS'])


def build(asset, frame=0):
    scene = setup(asset, frame)
    BUILDERS[asset](scene, MANIFEST['assets'][asset]['frames'][frame])
    scene['pose'] = frame
    return scene


def convert(scene, image, frame):
    spec = MANIFEST['assets'][scene['asset']]
    width, height = spec['width'], spec['height']
    pixels = list(image.pixels)
    if len(pixels) != width*height*4:
        raise ValueError('Render pixel dimensions do not match manifest')
    rows = []
    for y in range(height):
        row = []
        for x in range(width):
            offset = ((height-1-y)*width+x)*4
            r,g,b,a = pixels[offset:offset+4]
            if a < MANIFEST['alphaThreshold']:
                row.append('.')
                continue
            # Loaded 8-bit PNG pixels expose encoded, straight RGB (not the
            # scene-linear emission values used to author the materials).
            rgb = (r,g,b)
            distances = {role: sum((c-v)**2 for c,v in zip(rgb, color)) for role,color in ROLE_ENCODED.items()}
            role = min(distances, key=distances.get)
            if a > 0.999 and distances[role] > 0.002:
                raise ValueError(f'Unknown interior color at {x},{y}: {rgb}')
            row.append(role)
        rows.append(row)
    patches = PATCHES['assets'].get(scene['asset'], {})
    for x,y,role in patches.get('all', []) + patches.get(str(frame), []):
        if not (0 <= x < width and 0 <= y < height) or role not in set('.BDFAGWEM'):
            raise ValueError('Invalid cleanup patch')
        rows[y][x] = role
    if spec['grounded'] and not any(role != '.' for role in rows[-1]):
        raise ValueError('Grounded sprite misses its bottom row')
    if spec['kind'] == 'dino' and not any('E' in row for row in rows):
        raise ValueError('Dinosaur eye missing')
    if spec['kind'] == 'terrain' and any('.' in row for row in rows):
        raise ValueError('Terrain must fill every pixel, including tile edges')
    if spec['kind'] == 'environment' and (any(c != '.' for c in rows[0]+rows[-1]) or any(row[0] != '.' or row[-1] != '.' for row in rows)):
        raise ValueError(f'{scene["asset"]}:{frame} environment contour needs room for its outline')
    return [''.join(row) for row in rows]


def render(asset, frame=0):
    scene = build(asset, frame)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    scene.render.filepath = str(OUTPUT / f'{asset}-{frame}.png')
    started = time.monotonic()
    bpy.ops.render.render(write_still=True, scene=scene.name)
    # Render Result pixels can be empty through the UI render engine. Loading the
    # saved PNG provides stable encoded RGB through Blender's image API.
    image = bpy.data.images.load(scene.render.filepath, check_existing=False)
    try:
        rows = convert(scene, image, frame)
    finally:
        bpy.data.images.remove(image)
    payload = {'asset': asset, 'frame': frame, 'rows': rows,
               'hash': hashlib.sha256('\n'.join(rows).encode()).hexdigest(),
               'seconds': round(time.monotonic()-started, 3)}
    if MANIFEST['assets'][asset]['grounded'] and MANIFEST['assets'][asset]['kind'] == 'dino':
        suffix = 'near_toes' if asset == 'tyrannosaurus' else 'near_back_foot' if asset in ('triceratops','protoceratops','stegosaurus','ankylosaurus','brachiosaurus') else 'near_foot'
        suffix = MANIFEST['assets'][asset].get('contactMesh', suffix)
        foot = bpy.data.objects[scene.name + '_' + suffix]
        xs = [v.co.x for v in foot.data.vertices]
        bottom = scene.render.resolution_y - min(v.co.z for v in foot.data.vertices)
        payload['contact'] = {'x': round((min(xs)+max(xs))/2, 4), 'y': round(bottom, 4),
                              'right': round(max(xs), 4)}
    (OUTPUT / f'{asset}-{frame}.json').write_text(json.dumps(payload, indent=2) + '\n')
    return payload


def save_source(asset):
    folder = ROOT / 'assets-source/blender' / {'building': 'buildings', 'dino': 'dinos', 'environment': 'environment', 'terrain': 'terrain'}[MANIFEST['assets'][asset]['kind']]
    folder.mkdir(parents=True, exist_ok=True)
    # Write just the asset scene and its dependencies, not the user's active file.
    scenes = {scene for scene in bpy.data.scenes if scene.name.startswith('DinoTycoon_'+asset+'_Pose')}
    bpy.data.libraries.write(str(folder / (asset+'.blend')), scenes,
                             fake_user=True, compress=True)


def save_template():
    scene = setup('tyrannosaurus', scene_name='DinoTycoon_Template')
    materials = {bpy.data.materials['DinoTycoon_Role_'+role] for role in ROLE_RGB}
    path = ROOT / 'assets-source/blender/template.blend'
    path.parent.mkdir(parents=True, exist_ok=True)
    bpy.data.libraries.write(str(path), {scene, *materials}, fake_user=True, compress=True)
    return str(path)


def export(asset):
    payloads = [render(asset, frame) for frame in range(len(MANIFEST['assets'][asset]['frames']))]
    save_source(asset)
    print(json.dumps({'asset': asset, 'hashes': [p['hash'] for p in payloads],
                      'seconds': sum(p['seconds'] for p in payloads)}))
    return payloads


if __name__ == '__main__':
    import sys
    parser = argparse.ArgumentParser()
    parser.add_argument('--asset', choices=list(BUILDERS), required=True)
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    export(args.asset)
