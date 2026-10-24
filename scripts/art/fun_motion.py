"""Extra, playful eight-frame clips for the Blender dinosaurs, authored like full_motion.py.

Reuses full_motion's scene preparation, editable shape-key timeline, render and contact
export; only the per-frame pose differs. Each clip is a list of eight keyed poses:
  head   neck and skull turn about the neck base (+ down, - up)
  jaw    the jaw, mouth and teeth open about the hinge
  tail   the tail tip lifts (px, + up), weighted toward the tip
  arms   the arms swing about the shoulder
  crouch the body settles toward planted feet (px)
  jump   the whole animal leaves the ground (px), the legs tucking under
  near/far  a foot's step forward and lift [dx, up] (px)
  blink  the eye closes (1): the pupil flattens to a one-pixel lid line and the white goes behind it
Run: Blender --background --python scripts/art/fun_motion.py -- tyrannosaurus[,allosaurus|all] [clip ...]
"""
import hashlib
import json
import math
import runpy

import bpy
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FM = runpy.run_path(str(ROOT / 'scripts/art/full_motion.py'), run_name='fun_base')
ART = FM['ART']

# The T-rex joints were measured off its model; every other species gets its rig from its parts' names
# and bounds (rig() below), the same parts full_motion.py moves.
RIGS = {
    'tyrannosaurus': {
        'neck': (66, 20), 'hinge': (73, 16.5), 'shoulder': (66, 22), 'tail': (54, 4),
        'near': ('near_thigh', 'near_shin', 'near_toes', 'near_claws'), 'far': ('far_leg', 'far_toes'),
        'head': ('neck', 'skull', 'jaw', 'mouth', 'tooth', 'eye'), 'jaw': ('jaw', 'mouth', 'tooth'),
        'arms': ('near_arm', 'far_arm'),
    },
}
WATER, AIR = FM['WATER'], FM['AIR']
HEAD = ('head','skull','face','cheek','jaw','mouth','eye','tooth','beak','wide_muzzle','near_horn','far_horn','nose_horn',
        'nasal_crest','dome','tube_crest','crest_ridge','near_crest','far_crest','brow','frill','crest','fang','neck',
        'long_neck','neck_light','throat_fluff','snout_notch')
ARMS = ('arm_', 'near_arm', 'far_arm', 'tiny_arm', 'palm', 'finger', 'thumb_spike', 'scythe')
QUAD = ('near_front', 'far_back', 'near_back', 'far_front')

def rig(asset, scene, height):
    """Pivots from the model: the neck base, the jaw hinge, the shoulder, the tail's root and tip."""
    meshes = {o.name.removeprefix(scene.name + '_'): o for o in scene.objects if o.type == 'MESH'}
    points = lambda o: [(v.co.x, height - v.co.z) for v in o.data.vertices]
    def centre(o):
        p = points(o); return sum(x for x, _ in p) / len(p), sum(y for _, y in p) / len(p)
    if asset in RIGS: r = dict(RIGS[asset])
    else:
        quad = any(n.startswith(QUAD) for n in meshes)
        r = {'head': HEAD, 'jaw': ('jaw', 'mouth', 'tooth', 'fang'), 'arms': ARMS,
             'near': ('near_front',) if quad else ('near_0', 'near_1', 'near_foot', 'near_claws', 'near_joint', 'near_tip', 'sickle', 'hind_feather'),
             'far': ('far_back',) if quad else ('far_0', 'far_1', 'far_foot', 'far_joint', 'far_tip'),
             'others': ('near_back', 'far_front') if quad else ()}
        if asset in AIR + WATER: r['near'] = r['far'] = r['others'] = ()
        neck = meshes.get('neck_0') or meshes.get('long_neck_0')
        if neck:
            left = sorted(points(neck))[:4]; r['neck'] = (sum(x for x, _ in left) / 4, sum(y for _, y in left) / 4)
        else:
            spec = ART['MANIFEST']['assets'][asset]; off = spec.get('modelOffsetX', 0)
            r['neck'] = ((spec['width'] - 2 * off) * .55 + off, height * .55)
        jaw = meshes.get('jaw') or meshes.get('mouth')
        r['hinge'] = (min(x for x, _ in points(jaw)) + 1, min(y for _, y in points(jaw)) + .5) if jaw else None
        joint = next((meshes[n] for n in ('arm_joint_0', 'near_arm_joint_0', 'tiny_arm_joint_0') if n in meshes), None)
        r['shoulder'] = centre(joint) if joint else None
        tail = meshes.get('tail') or meshes.get('paddle_tail')
        r['tail'] = (max(x for x, _ in points(tail)), min(x for x, _ in points(tail))) if tail else (25, 1)
    # a long neck swings its head far: the angle shrinks so the head travels about as far as the T-rex's
    head = [p for n, o in meshes.items() if n.startswith(('head', 'skull')) for p in points(o)]
    if head:
        hx, hy = sum(x for x, _ in head) / len(head), sum(y for _, y in head) / len(head)
        r['reach'] = min(1, 18 / max(1, math.hypot(hx - r['neck'][0], hy - r['neck'][1])))
    else: r['reach'] = 1
    r.setdefault('others', ())
    return r

def keys(*rows):
    """Eight poses from rows of (frame, values): values between keyed frames ease in and out."""
    out = [{} for _ in range(8)]
    for name, points in rows:
        for i in range(8):
            before = max((p for p in points if p[0] <= i), key=lambda p: p[0])
            after = min((p for p in points if p[0] >= i), key=lambda p: p[0], default=before)   # past the last key: hold it
            t = 0 if after[0] == before[0] else (i - before[0]) / (after[0] - before[0])
            t = t * t * (3 - 2 * t)
            a, b = before[1], after[1]
            out[i][name] = [x + (y - x) * t for x, y in zip(a, b)] if isinstance(a, list) else a + (b - a) * t
    return out

FUN = {
    # wind up low, rear back with the jaw wide, hold the bellow, settle
    'roar': (1600, keys(
        ('head', [(0, 0), (1, .18), (3, -.32), (5, -.34), (7, 0)]),
        ('jaw', [(0, 0), (1, .05), (3, .5), (5, .55), (7, 0)]),
        ('tail', [(0, 0), (1, -1), (3, 3), (5, 3.5), (7, 0)]),
        ('arms', [(0, 0), (1, .2), (3, -.6), (4, -.3), (5, -.6), (7, 0)]),
        ('crouch', [(0, 0), (1, 2), (3, -.5), (5, -.5), (7, 0)]))),
    # knee up high, stamp, the whole body jolts
    'stomp': (1200, keys(
        ('near', [(0, [0, 0]), (2, [5, 11]), (3, [6, 12]), (4, [6, 0]), (7, [0, 0])]),
        ('crouch', [(0, 0), (2, -1), (3, -1), (4, 4), (5, 1.5), (7, 0)]),
        ('head', [(0, 0), (2, -.15), (4, .25), (5, .05), (7, 0)]),
        ('tail', [(0, 0), (2, 4), (4, -4), (5, 2), (7, 0)]),
        ('jaw', [(0, 0), (3, .2), (4, .35), (6, 0)]),
        ('arms', [(0, 0), (3, -.3), (4, .4), (7, 0)]))),
    # bounce, tail wag, arms waving, little alternating steps
    'dance': (960, keys(
        ('crouch', [(0, 0), (1, 3.5), (2, 0), (3, 3.5), (4, 0), (5, 3.5), (6, 0), (7, 3.5)]),
        ('tail', [(0, 7), (2, -5), (4, 7), (6, -5), (7, 1)]),
        ('arms', [(0, -.7), (2, .4), (4, -.7), (6, .4), (7, -.2)]),
        ('head', [(0, -.2), (2, .12), (4, -.2), (6, .12), (7, -.04)]),
        ('jaw', [(0, .25), (2, .05), (4, .25), (6, .05), (7, .15)]),
        ('near', [(0, [0, 0]), (1, [2, 5]), (2, [3, 0]), (5, [3, 0]), (7, [0, 0])]),
        ('far', [(0, [0, 0]), (3, [0, 0]), (4, [-2, 0]), (5, [-2, 5]), (6, [0, 0]), (7, [0, 0])]))),
    # crouch, spring up with the legs tucked, land and absorb
    'hop': (960, keys(
        ('crouch', [(0, 0), (1, 4.5), (2, 0), (5, 0), (6, 4.5), (7, 0)]),
        ('jump', [(0, 0), (1, 0), (2, 8), (3, 11), (4, 8), (5, 0), (7, 0)]),
        ('near', [(0, [0, 0]), (2, [2, 4]), (3, [2, 6]), (4, [2, 4]), (5, [0, 0])]),
        ('far', [(0, [0, 0]), (2, [-2, 4]), (3, [-2, 6]), (4, [-2, 4]), (5, [0, 0])]),
        ('tail', [(0, 0), (1, -3), (3, 5), (5, -4), (7, 0)]),
        ('arms', [(0, 0), (2, -.7), (4, -.7), (6, .3), (7, 0)]),
        ('head', [(0, 0), (1, .1), (3, -.12), (6, .1), (7, 0)]))),
    # a cheeky wink: the head cocks, the eye shuts for two frames, a little grin and a tail flick
    'wink': (1200, keys(
        ('blink', [(0, 0), (2, 0), (3, 1), (4, 1), (5, 0), (7, 0)]),
        ('head', [(0, 0), (2, -.1), (3, -.14), (4, -.14), (5, -.08), (7, 0)]),
        ('jaw', [(0, 0), (2, .08), (3, .14), (4, .14), (5, .06), (7, 0)]),
        ('tail', [(0, 0), (2, 2), (3, 3.5), (4, 3.5), (5, 1), (7, 0)]),
        ('crouch', [(0, 0), (3, .8), (4, .8), (6, 0)]))),
    # the breath in, head up, then achoo: snapped down with the jaw open, a little shake
    'sneeze': (1200, keys(
        ('head', [(0, 0), (1, -.18), (2, -.32), (3, -.4), (4, .4), (5, .22), (6, .3), (7, 0)]),
        ('jaw', [(0, 0), (2, .2), (3, .3), (4, .6), (5, .1), (6, .2), (7, 0)]),
        ('crouch', [(0, 0), (3, -1), (4, 3.5), (5, 1.5), (7, 0)]),
        ('tail', [(0, 0), (3, 4), (4, -3), (6, 1), (7, 0)]),
        ('arms', [(0, 0), (3, -.3), (4, .4), (7, 0)]))),
}

def rotate(x, y, pivot, angle):
    dx, dy = x - pivot[0], y - pivot[1]
    return pivot[0] + dx * math.cos(angle) - dy * math.sin(angle), pivot[1] + dx * math.sin(angle) + dy * math.cos(angle)

def fun_pose(asset, clip, index):
    p = dict(FUN[clip][1][index])
    scene = ART['setup'](asset, scene_name=f'DinoTycoon_Motion_{asset}_{clip}_sample')
    builder = ART['BUILDERS'][asset]
    if hasattr(builder, 'func'):
        builder.func.__globals__['leg'].__globals__['gait'] = FM['gait']
        builder.func.__globals__['gait'] = FM['gait']
    # flyers keep flapping and swimmers keep swimming under the new moves, as in every clip of full_motion
    builder(scene, index / 8 if asset in AIR + WATER else 1/6)
    ART['offset_geometry'](scene)
    height = ART['MANIFEST']['assets'][asset]['height']
    r = rig(asset, scene, height)
    # sizes are the T-rex's (44 px tall): a smaller dinosaur hops and stamps less far
    size = min(1.3, max(.5, height / 44))
    for name in ('crouch', 'jump', 'tail'):
        if name in p: p[name] *= size
    for side in ('near', 'far'):
        if side in p: p[side] = [v * size for v in p[side]]
    if asset in AIR + WATER: p['crouch'] = 0; p['jump'] = p.get('jump', 0) * .6
    if 'head' in p: p['head'] *= r['reach']
    if not r['hinge']: p['jaw'] = 0
    if not r['shoulder']: p['arms'] = 0
    tail_root, tail_tip = r['tail']
    # a thin tail tip lifted far breaks apart at native resolution: a short tail lifts less
    if 'tail' in p: p['tail'] = max(-1, min(1, p['tail'] / max(1e-6, .1 * (tail_root - tail_tip)))) * .1 * (tail_root - tail_tip) if abs(p['tail']) > .1 * (tail_root - tail_tip) else p['tail']
    meshes = [(o, o.name.removeprefix(scene.name + '_')) for o in scene.objects if o.type == 'MESH']
    is_head = lambda o, part: part.startswith(r['head']) or o.get('attachment') == 'neck'
    # a nodding head stays above the soil (full_motion's grazing rule)
    if p.get('head', 0) > 0 and asset not in AIR + WATER:
        verts = [(v.co.x, height - v.co.z) for o, part in meshes if is_head(o, part) for v in o.data.vertices]
        for attempt in range(30):
            a = p['head']
            low = max((rotate(x, y, r['neck'], a)[1] for x, y in verts), default=0)
            if low + p.get('crouch', 0) * min(1, max(0, (height - low) / (height * .45))) + 1 <= height: break
            p['head'] *= .85
    pupil = next((o for o, part in meshes if part == 'eye'), None)
    pupil_x = sum(v.co.x for v in pupil.data.vertices) / len(pupil.data.vertices) if pupil else 0
    pupil_y = height - sum(v.co.z for v in pupil.data.vertices) / len(pupil.data.vertices) if pupil else 0
    shut = p.get('blink', 0)
    result = {}
    for obj, part in meshes:
        verts = obj.data.vertices
        cx = sum(v.co.x for v in verts) / len(verts); cy = height - sum(v.co.z for v in verts) / len(verts)
        points = []
        for vertex in verts:
            x, depth, z = vertex.co
            y = height - z
            # the pupil grows to about two pixels (as in full_motion.py); shut, it is a lid line one
            # pixel tall and a little wider, and the white folds away behind it
            if part == 'eye': x, y = cx + (x - cx) * 1.8 * (1 + .2 * shut), cy + (y - cy) * (1.8 - .9 * shut)
            if part == 'eye_white': x, y = pupil_x + (x - pupil_x) * 1.4 * (1 - shut), pupil_y + (y - pupil_y) * 1.4 * (1 - shut)
            # a foot's step and lift, weighted from the hip down (as the walk does)
            for side in ('near', 'far', 'others'):
                key = 'near' if side == 'others' else side
                if r[side] and part.startswith(r[side]) and key in p and (side != 'others' or clip == 'hop'):
                    dx, up = p[key]
                    if side == 'others': dx = 0
                    w = 1 if part.endswith(('toes', 'foot', 'claws')) else min(1, max(0, (y - height * .55) / (height * .38)))
                    x += dx * w; y -= up * w
            if p.get('arms') and part.startswith(r['arms']):
                x, y = rotate(x, y, r['shoulder'], p['arms'])
            if p.get('jaw') and part.startswith(r['jaw']):
                x, y = rotate(x, y, r['hinge'], p['jaw'])
            if p.get('head') and is_head(obj, part):
                x, y = rotate(x, y, r['neck'], p['head'])
            if p.get('tail') and ('tail' in part or obj.get('attachment') == 'tail'):
                w = min(1, max(0, (tail_root - obj.get('anchor_x', x)) / max(1, tail_root - tail_tip)))
                y -= p['tail'] * w ** 1.5
            if p.get('crouch'):   # settle onto the planted feet, as the rest clip does
                y += p['crouch'] * min(1, max(0, (height - y) / (height * .45)))
            if p.get('jump'): y -= p['jump']
            if part == 'eye': depth = -30
            if part == 'eye_white': depth = -29
            points.append((x + 8, depth, height - y))
        result[part] = points
    if shut > .5 and 'eye' in result:
        # the shut eye's lid line is under a pixel tall: centre it on a pixel so it stays one row
        pts = result['eye']; mx = sum(p[0] for p in pts) / len(pts); mz = sum(p[2] for p in pts) / len(pts)
        dx, dz = math.floor(mx) + .5 - mx, math.floor(mz) + .5 - mz
        result['eye'] = [(x + dx, d, z + dz) for x, d, z in pts]
    return scene, result

def bridge(rows):
    """A thin tail or spine tip bent by a fraction of a pixel can break off at native resolution: join any
    small piece within four pixels of the body (a tiny tip within eight) back to it with its own colour, never erasing pixels."""
    grid = [list(r) for r in rows]; h, w = len(grid), len(grid[0])
    seen, parts = set(), []
    for y in range(h):
        for x in range(w):
            if grid[y][x] == '.' or (x, y) in seen: continue
            group, queue = [], [(x, y)]; seen.add((x, y))
            while queue:
                cx, cy = queue.pop(); group.append((cx, cy))
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        n = (cx + dx, cy + dy)
                        if 0 <= n[0] < w and 0 <= n[1] < h and n not in seen and grid[n[1]][n[0]] != '.':
                            seen.add(n); queue.append(n)
            parts.append(group)
    parts.sort(key=len, reverse=True)
    body = parts[0] if parts else []
    for group in parts[1:]:
        if len(group) > 12: continue   # a whole loose accessory is a real fault: leave it for the check
        (gx, gy), (bx, by) = min(((g, b) for g in group for b in body), key=lambda gb: max(abs(gb[0][0]-gb[1][0]), abs(gb[0][1]-gb[1][1])))
        if max(abs(gx - bx), abs(gy - by)) > (8 if len(group) <= 4 else 4): continue
        role = grid[gy][gx]
        steps = max(abs(gx - bx), abs(gy - by))
        for i in range(1, steps):
            x, y = round(gx + (bx - gx) * i / steps), round(gy + (by - gy) * i / steps)
            if grid[y][x] == '.': grid[y][x] = role
    return [''.join(r) for r in grid]

def bridge_clip(asset, clip):
    path = FM['OUTPUT'] / f'{asset}-{clip}.json'
    payload = json.loads(path.read_text())
    payload['frames'] = [bridge(rows) for rows in payload['frames']]
    payload['hashes'] = [hashlib.sha256('\n'.join(rows).encode()).hexdigest() for rows in payload['frames']]
    path.write_text(json.dumps(payload, indent=2) + '\n')

# runpy hands back a copy of the module's globals: patch the dictionary its functions really use
FM['prepare'].__globals__['pose'] = fun_pose
FM['CLIPS'].update({name: ms for name, (ms, _) in FUN.items()})

if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else ['tyrannosaurus']
    assets = FM['SPECIES'] if args[0] == 'all' else args[0].split(',')
    for asset, clip in [(a, c) for a in assets for c in (args[1:] or list(FUN))]:
        FM['prepare'](asset, clip)
        # room over the head for the rear-ups and the hop (prepare gives 8 px)
        scene = bpy.data.scenes[f'DinoTycoon_Motion_{asset}_{clip}']
        spec = ART['MANIFEST']['assets'][asset]; spec['height'] += max(6, math.ceil(6 * spec['height'] / 44))
        scene.render.resolution_y = spec['height']; scene.camera.location.z = spec['height'] / 2
        scene.camera.data.ortho_scale = max(spec['width'], spec['height'])
        # a jump, or a stomp with the near foot up (the far foot sits higher in the picture), leaves the
        # bottom row empty for a few frames: the canvas keeps its size, so the grounded check can go
        ART['MANIFEST']['assets'][asset]['grounded'] = False
        FM['save_source'](asset, clip)
        FM['render_clip'](asset, clip)
        bridge_clip(asset, clip)
