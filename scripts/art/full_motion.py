"""Author the full roster of eight-frame clips in Blender, with editable shape-key timelines.

Uses the canonical extruded anatomy and pixel camera. Canonical source files,
manifest, renders and runtime grids stay intact. Prepare and render in small steps.
"""
import hashlib
import json
import math
import runpy
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parents[2]
ART = runpy.run_path(str(ROOT / 'scripts/art/render_sprites.py'), run_name='prototype_base')
BASE_SPECS = {asset:dict(spec) for asset,spec in ART['MANIFEST']['assets'].items()}
SPECIES = tuple(asset for asset,spec in BASE_SPECS.items() if spec['kind'] == 'dino')
WATER = ('plesiosaurus','mosasaurus')
AIR = ('pteranodon','dimorphodon')
CLIPS = {'walk': 960, 'idle': 1600, 'eat': 2000, 'rest': 2400}
OUTPUT = ROOT / 'assets-source/renders/motion'


def gait(phase, stride, clearance):
    """Linear stance (2/3 cycle), then a lifted return; planted feet never reverse."""
    phase %= 1
    if phase < 2/3:
        return stride * (1 - 3*phase), 0
    swing = (phase-2/3)*3
    return stride * (-1+2*swing), math.sin(swing*math.pi)*clearance


def pose(asset, clip, index):
    scene = ART['setup'](asset, scene_name=f'DinoTycoon_Motion_{asset}_{clip}_sample')
    builder = ART['BUILDERS'][asset]
    # These globals belong to this runpy instance, leaving the canonical gait alone.
    if hasattr(builder, 'func'):
        builder.func.__globals__['leg'].__globals__['gait'] = gait
        builder.func.__globals__['gait'] = gait
    phase = index/8
    builder(scene, phase if asset not in ('tyrannosaurus','triceratops') and (clip == 'walk' or asset in AIR+WATER) else 1/6)
    ART['offset_geometry'](scene)
    spec = ART['MANIFEST']['assets'][asset]
    height = spec['height']
    wave = math.sin(phase*math.tau)
    breath = (1-math.cos(phase*math.tau))/2
    # Rotate the connected neck and skull around the shoulder; secondary jaw motion
    # stays attached to the skull. Feet remain anchored while the body settles.
    width = spec['width']
    offset = spec.get('modelOffsetX',0)
    pivot = ((width-2*offset)*.55+offset,height*.55)
    neck = next((o for o in scene.objects if o.type == 'MESH' and o.name.endswith('_neck_0')), None)
    if neck:
        vx = sorted(neck.data.vertices, key=lambda v:v.co.x)[:4]
        pivot = (sum(v.co.x for v in vx)/len(vx), height-sum(v.co.z for v in vx)/len(vx))
    if clip == 'walk': angle, crouch = wave*.025, 0
    elif clip == 'idle': angle, crouch = wave*.10, 0
    elif clip == 'eat': angle, crouch = breath*.5, 0
    else: angle, crouch = .08+wave*.025, min(4,height*.1)+breath*.4
    if asset in WATER: angle,crouch = angle*.35,0
    if asset in AIR: angle,crouch = angle*.3,0
    head_names = ('head','skull','face','jaw','mouth','eye','tooth','beak','wide_muzzle',
                  'near_horn','far_horn','nose_horn','nasal_crest','dome','tube_crest','crest_ridge',
                  'near_crest','far_crest','brow','frill','crest','fang','neck','long_neck','neck_light','throat_fluff','snout_notch')
    tail = next((o for o in scene.objects if o.type == 'MESH' and o.name.removeprefix(scene.name+'_') in ('tail','paddle_tail')),None)
    tail_root = max((v.co.x for v in tail.data.vertices),default=25) if tail else 25
    tail_tip = min((v.co.x for v in tail.data.vertices),default=1) if tail else 1
    # Keep a grazing muzzle above the soil, including short, low necks.
    if angle > 0 and asset not in WATER+AIR:
        head_vertices = [(v.co.x,height-v.co.z) for o in scene.objects if o.type == 'MESH' and o.name.removeprefix(scene.name+'_').startswith(head_names) for v in o.data.vertices]
        for attempt in range(30):
            lowest=max((pivot[1]+(x-pivot[0])*math.sin(angle)+(y-pivot[1])*math.cos(angle) for x,y in head_vertices),default=0)
            if lowest+crouch+1 <= height: break
            angle *= .9
    rest_shift = 0
    if asset in AIR and clip == 'rest':
        feet=[height-v.co.z for o in scene.objects if o.type == 'MESH' and '_feet_' in o.name for v in o.data.vertices]
        rest_shift=height-max(feet)
    result = {}
    for obj in scene.objects:
        if obj.type != 'MESH': continue
        part = obj.name.removeprefix(scene.name+'_')
        points = []
        for vertex in obj.data.vertices:
            x,depth,z = vertex.co
            y = height-z
            if part == 'eye':
                # The tiny eye must survive rotated sampling at native resolution.
                center_x = sum(v.co.x for v in obj.data.vertices)/len(obj.data.vertices)
                center_y = height-sum(v.co.z for v in obj.data.vertices)/len(obj.data.vertices)
                x,y = center_x+(x-center_x)*1.8,center_y+(y-center_y)*1.8
            if asset in ('tyrannosaurus','triceratops') and clip == 'walk':
                if asset == 'tyrannosaurus':
                    limb = 'near' if part.startswith(('near_thigh','near_shin','near_toes','near_claws')) else 'far' if part.startswith(('far_leg','far_toes')) else None
                    stride = 3
                    shift = 0 if limb == 'near' else .5
                    old_x = 1.5 if limb == 'near' else -1.5
                    old_lift = 0 if limb == 'near' else math.sin(math.tau/6)*3
                else:
                    limb = next((n for n in ('near_back','near_front','far_back','far_front') if part.startswith(n)),None)
                    stride = 2
                    shift = 0 if limb in ('near_back','far_front') else .5
                    old_x = 1 if shift == 0 else -1
                    old_lift = 0 if shift == 0 else math.sin(math.tau/6)*2
                if limb:
                    offset,lift = gait(phase+shift,stride,3 if asset == 'tyrannosaurus' else 2)
                    weight = 1 if part.endswith(('toes','foot','claws')) else min(1,max(0,(y-height*.55)/(height*.38)))
                    x += (offset-old_x)*weight
                    y += (old_lift-lift)*weight
            if part.startswith(head_names) or obj.get('attachment') == 'neck':
                dx,dy = x-pivot[0], y-pivot[1]
                x = pivot[0]+dx*math.cos(angle)-dy*math.sin(angle)
                y = pivot[1]+dx*math.sin(angle)+dy*math.cos(angle)
                if clip == 'eat' and part.startswith(('jaw','mouth','tooth')):
                    y += breath*.8
            if part == 'eye': depth = -30
            if asset in AIR and clip == 'rest' and part.startswith(('near_membrane','far_wing','wing_fingers')):
                x = width*.48+(x-width*.48)*.45
                y = height*.65+(y-height*.65)*.35
            if asset not in WATER+AIR and ('tail' in part or obj.get('attachment') == 'tail'):
                anchor = obj.get('anchor_x',x)
                weight = min(1,max(0,(tail_root-anchor)/max(1,tail_root-tail_tip)))
                y += wave*1.1*weight**2
            if clip == 'rest' and asset not in WATER+AIR:
                # One continuous deformation preserves every joint, including
                # hand claws, shoulder spikes, feathers and foot sickles.
                weight = min(1,max(0,(height-y)/(height*.45)))
                y += crouch*weight
            elif clip == 'idle' and asset not in WATER+AIR:
                y -= breath*.45*max(0,(height-y)/height)
            points.append((x+8,depth,height-y-rest_shift))
        result[part] = points
    return scene, result


def prepare(asset, clip):
    if asset not in SPECIES or clip not in CLIPS: raise ValueError('Unknown animation clip')
    ART['MANIFEST']['assets'][asset] = dict(BASE_SPECS[asset])
    # Previously saved prototype scenes can be reloaded from their .blend files.
    # Remove only our own temporary animation scenes to keep UI evaluation small.
    for old in list(bpy.data.scenes):
        if not old.name.startswith('DinoTycoon_Motion_'): continue
        objects = list(old.objects)
        bpy.data.scenes.remove(old)
        for obj in objects:
            if obj.users == 0: bpy.data.objects.remove(obj)
    samples = []
    for index in range(8):
        scene, points = pose(asset,clip,index)
        samples.append(points)
    # Keep one scene with a genuine editable animation timeline per clip.
    scene.name = f'DinoTycoon_Motion_{asset}_{clip}'
    for obj in scene.objects:
        if obj.type != 'MESH': continue
        part = obj.name.split('_sample_',1)[1]
        obj.name = scene.name+'_'+part
        for v,co in zip(obj.data.vertices,samples[0][part]): v.co = co
        obj.shape_key_add(name='Basis')
        for index in range(8):
            key = obj.shape_key_add(name=f'{clip}_{index:02d}')
            for v,co in zip(key.data,samples[index][part]): v.co = co
            for tick in range(9):
                key.value = 1 if tick%8 == index else 0
                key.keyframe_insert(data_path='value',frame=1+tick*CLIPS[clip]/80)
    spec = ART['MANIFEST']['assets'][asset]
    spec['width'] += 16
    ART['PATCHES']['assets'].pop(asset,None)
    spec['height'] += 8
    scene.render.resolution_x,scene.render.resolution_y = spec['width'],spec['height']
    scene.camera.location.x = spec['width']/2
    scene.camera.location.z = spec['height']/2
    scene.camera.data.ortho_scale = max(spec['width'],spec['height'])
    scene.render.fps = 100
    scene.frame_start,scene.frame_end = 1,CLIPS[clip]//10
    scene['clip'],scene['durationMs'] = clip,CLIPS[clip]
    OUTPUT.mkdir(parents=True,exist_ok=True)
    print('Prepared',scene.name,'with eight shape-key poses')
    return scene


def save_source(asset, clip):
    scene = bpy.data.scenes[f'DinoTycoon_Motion_{asset}_{clip}']
    folder = ROOT/'assets-source/blender/motion'
    folder.mkdir(parents=True,exist_ok=True)
    bpy.data.libraries.write(str(folder/f'{asset}-{clip}.blend'),{scene},fake_user=True,compress=True)
    print('Saved',asset,clip)


def render_clip(asset, clip, start=0, end=8):
    scene = bpy.data.scenes[f'DinoTycoon_Motion_{asset}_{clip}']
    bpy.context.window.scene = scene
    spec = ART['MANIFEST']['assets'][asset]
    spec['width'],spec['height'] = scene.render.resolution_x,scene.render.resolution_y
    for index in range(start,end):
        scene.frame_set(1+index*CLIPS[clip]//80)
        scene.render.filepath = str(OUTPUT/f'{asset}-{clip}-{index}.png')
        bpy.ops.render.render(write_still=True,scene=scene.name)
        image = bpy.data.images.load(scene.render.filepath,check_existing=False)
        try: rows = ART['convert'](scene,image,0)
        finally: bpy.data.images.remove(image)
        frame_hash = hashlib.sha256('\n'.join(rows).encode()).hexdigest()
        feet = []
        depsgraph = bpy.context.evaluated_depsgraph_get()
        for obj in scene.objects:
            if not obj.name.endswith('_foot') and not (asset == 'tyrannosaurus' and obj.name.endswith('_toes')): continue
            mesh = obj.evaluated_get(depsgraph).data
            xs = [v.co.x for v in mesh.vertices]
            bottom = spec['height']-min(v.co.z for v in mesh.vertices)
            feet.append({'name':obj.name.rsplit(clip+'_',1)[1],
                         'x':round((min(xs)+max(xs))/2,3),
                         'y':round(bottom,3),'planted':bottom>=spec['height']-.05})
        (OUTPUT/f'{asset}-{clip}-{index}.json').write_text(json.dumps({'rows':rows,'contact':feet,'hash':frame_hash})+'\n')
    if end == 8:
        samples = [json.loads((OUTPUT/f'{asset}-{clip}-{i}.json').read_text()) for i in range(8)]
        payload = {'asset':asset,'clip':clip,'width':spec['width'],'height':spec['height'],
                   'durationMs':CLIPS[clip],'frames':[p['rows'] for p in samples],
                   'contacts':[p['contact'] for p in samples],'hashes':[p['hash'] for p in samples]}
        (OUTPUT/f'{asset}-{clip}.json').write_text(json.dumps(payload,indent=2)+'\n')
    print('Rendered',asset,clip,start,end)


def export(asset, clip):
    prepare(asset,clip)
    save_source(asset,clip)
    render_clip(asset,clip)

if __name__ == '__main__':
    import sys,traceback
    requested = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else list(SPECIES)
    failures=[]
    for asset in requested:
        for clip in CLIPS:
            try:
                export(asset,clip)
            except Exception as error:
                failures.append({'asset':asset,'clip':clip,'error':str(error)})
                traceback.print_exc()
            (OUTPUT/'full-motion-status.json').write_text(json.dumps({'failures':failures,'last':asset+'-'+clip})+'\n')
    if failures: raise RuntimeError(str(failures))
