"""Twelve distinct dinosaur models, authored for the existing pixel camera.

Profiles are extruded Blender meshes with editable anatomy and semantic materials.
The same grounded gait used by the original set drives all four walking poses.
"""
from functools import partial

_shared = runpy.run_path(str(ROOT / 'scripts/art/models.py'), init_globals=globals())
leg = _shared['leg']
gait = _shared['gait']


def eye(scene, x, y):
    rect(scene, 'eye', x, y, 1, 1, 'E', -15)


def feather_fringe(scene, name, points, length, role='A', depth=-3):
    for i, (x, y) in enumerate(points):
        profile(scene, name+str(i), [(x-1,y), (x-3,y-length), (x+2,y-1)], role, depth)


def biped(scene, phase, asset):
    h = scene.render.resolution_y
    # trunk x/y/radii, head x/y/radii, leg thickness; silhouettes differ in proportion.
    specs = {
        'spinosaurus': (33,31,18,7,63,23,11,3.5,3.2),
        'therizinosaurus': (24,35,11,13,44,10,6,3.5,3.5),
        'carnotaurus': (25,21,13,7,49,11,7,6,3.2),
        'yutyrannus': (27,23,14,8,50,11,9,5,3.4),
        'iguanodon': (25,22,14,8,49,15,7,4,3.2),
        'microraptor': (14,12,6.5,3.5,27,7,5,2.5,1.8),
    }
    cx,cy,rx,ry,hx,hy,hrx,hry,radius = specs[asset]
    stride = max(1.6, radius*.85)
    leg(scene,'far',cx-3,cy+ry*.6,h,phase+.5,radius*.85,stride,False,True)
    # Most tails are narrow counterbalances; Spinosaurus has a deep paddle profile.
    if asset == 'spinosaurus':
        profile(scene,'paddle_tail',[(32,28),(23,28),(6,24),(-6,22),(-16,24),(-25,29.5),
                    (-24,31),(-16,36),(-6,39),(6,39),(23,36),(32,34)],'B',0)
        limb(scene,'tail_ridge',[(23,29,1),(6,25,.8),(-6,23,.6),(-16,25,.45),(-23,29.5,.3)],'A',-2)
        # Tall sail with rounded, uneven vertebral tips rather than one triangle.
        profile(scene,'sail',[(15,28),(19,14),(23,7),(28,4),(33,6),(38,8),(43,16),(49,27)],'A',1)
        for i,(x,y) in enumerate(((20,14),(25,7),(30,6),(35,8),(40,13),(44,21))):
            limb(scene,'sail_ray'+str(i),[(x,y,.5),(x+1,28,.6)],'G',-1)
    else:
        tail=[(cx-rx*.3,cy-ry*.5),(cx-rx,cy-ry*.1),(1,cy+ry*.6),
              (cx-rx,cy+ry*.7),(cx,cy+ry*.5)]
        profile(scene,'tail',tail,'B',0)
    if asset == 'yutyrannus':
        feather_fringe(scene,'back_fluff',[(x,ellipse_edge(cx,cy,rx,ry,x)+1.5) for x in range(16,39,3)],2.5)
        for i,x in enumerate(range(4,15,3)):
            feather_fringe(scene,'tail_fluff'+str(i)+'_',[(x,profile_edge(tail,x)+1.5)],2)
            attach(scene,'tail_fluff'+str(i)+'_0','tail',x)
    ellipse(scene,'trunk',cx,cy,rx,ry,'B',0)
    ellipse(scene,'belly',cx+2,cy+ry*.45,rx*.72,ry*.52,'D',-2)
    neck_radius = radius+1 if asset != 'therizinosaurus' else 4
    limb(scene,'neck',[(cx+rx*.7,cy-ry*.2,neck_radius),(hx-hrx*.7,hy+1,max(1.5,radius*.8))],'B',-1)
    if asset == 'therizinosaurus':
        feather_fringe(scene,'neck_fluff',[(34,24),(36,20),(38,16)],3,'A',-2)
        profile(scene,'head',[(38,8),(43,6),(49,8),(51,11),(46,14),(40,13)],'B',-4)
        profile(scene,'beak',[(48,9),(54,11),(51,15),(48,13)],'W',-6)
        rect(scene,'mouth',49,12,3,1,'M',-9)
        eye(scene,44,9)
        # A shared palm roots three curved claws; no claw starts beyond the hand.
        limb(scene,'far_arm',[(33,28,2.5),(38,34,2),(41,34,1.5)],'F',3)
        limb(scene,'near_arm',[(34,27,3),(37,35,2.5),(44,34,1.7)],'B',-7)
        ellipse(scene,'palm',44.8,34.5,2.4,1.5,'B',-8)
        for i in range(3):
            limb(scene,'scythe'+str(i),[(43.5+i*1.6,35,.65),(45+i*1.6,40-i*.3,.5),
                                      (44.5+i*1.6,45-i,.25)],'W',-10)
    else:
        profile(scene,'head',[(hx-hrx,hy-hry*.5),(hx-hrx*.4,hy-hry),(hx+hrx,hy-hry*.4),
                              (hx+hrx,hy+hry*.65),(hx+hrx*.35,hy+hry),(hx-hrx,hy+hry*.5)],'B',-4)
        rect(scene,'jaw',hx,hy+hry*.35,hrx,max(1,hry*.5),'D',-5)
        rect(scene,'mouth',hx+1,hy+hry*.3,hrx-1,1,'M',-9)
        eye(scene,hx-2,hy-1)
        if asset in ('carnotaurus','spinosaurus','yutyrannus'):
            for i,x in enumerate(range(int(hx+1),int(hx+hrx-1),3)):
                rect(scene,'tooth'+str(i),x,hy+hry*.3+1,1,1,'W',-10)
        if asset == 'carnotaurus':
            profile(scene,'far_horn',[(46,7),(44,2),(49,6)],'G',-5)
            profile(scene,'near_horn',[(49,7),(51,1),(53,8)],'W',-11)
            # Abelisaur arms are tiny, with no giant raptor claws.
            limb(scene,'tiny_arm',[(38,22,1.3),(40,24,.6)],'B',-6)
            for i,x in enumerate(range(17,37,4)):
                ellipse(scene,'scute'+str(i),x,17,1.2,.7,'A',-4,6)
        elif asset == 'yutyrannus':
            profile(scene,'nasal_crest',[(45,7),(48,4),(54,5),(57,7)],'A',-6)
            feather_fringe(scene,'throat_fluff',[(43,20),(42,23),(40,26)],-3,'A',-5)
            limb(scene,'arm',[(39,23,2),(42,29,1.2),(46,28,.7)],'B',-6)
            ellipse(scene,'palm',46.5,28,1.8,1,'B',-7)
            for i in range(3):rect(scene,'finger'+str(i),45.5+i,28,1,1.5,'W',-8)
        elif asset == 'iguanodon':
            profile(scene,'beak',[(53,14),(59,16),(58,19),(53,19)],'W',-7)
            limb(scene,'arm',[(38,23,2.3),(41,29,1.7),(46,28,1)],'B',-7)
            profile(scene,'thumb_spike',[(45,28),(46.5,24.5),(47.5,28.5)],'W',-9)
        elif asset == 'spinosaurus':
            limb(scene,'arm',[(46,30,2),(49,35,1.5),(54,34,.8)],'B',-6)
            profile(scene,'snout_notch',[(69,21),(72,23),(74,21)],'D',-8)
        else:
            # Four feathered limbs, folded for this animal's walking poses.
            profile(scene,'tail_fan',[(2,13.5),(3,11.5),(8,12),(9,14),(3,15)],'A',-3)
            attach(scene,'tail_fan','tail',7)
            limb(scene,'arm',[(20,12,1.2),(19,15,1),(23,16,.5)],'B',-5)
            for i in range(4):
                profile(scene,'arm_feather'+str(i),[(19+i,14),(17+i,18-i*.3),(21+i,16)],'A',-8)
            offset,lift=gait(phase,stride,max(2,radius))
            knee_x,knee_y=cx+offset+radius,(cy+ry*.55+h)/2
            for i in range(3):
                profile(scene,'hind_feather'+str(i),[(knee_x-1+i*.7,knee_y-1),
                        (knee_x-4+i*.7,knee_y+3-lift*.3),(knee_x+1+i*.7,knee_y+1)],'A',-8)
    leg(scene,'near',cx,cy+ry*.55,h,phase,radius,stride,True,True)


def quadruped(scene, phase, asset):
    h = scene.render.resolution_y
    specs = {
        'kentrosaurus': (25,21,14,8,18,34,25,2.5),
        'styracosaurus': (24,23,14,8,16,34,27,3),
        'amargasaurus': (28,30,15,7,22,41,34,3),
        'diplodocus': (42,28,17,8,34,53,32,3),
        'argentinosaurus': (45,43,23,12,34,61,48,4.8),
        'nigersaurus': (24,20,13,6,17,34,24,2.7),
    }
    cx,cy,rx,ry,hind,front,hip,radius = specs[asset]
    stride=max(1.5,radius*.65)
    leg(scene,'far_back',hind-2,hip,h,phase+.5,radius*.85,stride,False)
    leg(scene,'far_front',front-2,hip-2,h,phase,radius*.85,stride,False)
    # Diplodocus devotes roughly a third of its sprite to its whip tail.
    tail=[(cx-rx*.4,cy-ry*.5),(cx-rx,cy),(2,cy+ry*.6),(1,cy+ry*.85),
          (cx-rx,cy+ry*.65),(cx,cy+ry*.5)]
    if asset == 'kentrosaurus':
        tail=[(18,19),(11,21),(-1,23),(-17,24),(-16,24.8),(-1,26),(11,26),(18,25)]
    profile(scene,'tail',tail,'B',0)
    ellipse(scene,'trunk',cx,cy,rx,ry,'B',0)
    ellipse(scene,'belly',cx+1,cy+ry*.5,rx*.75,ry*.5,'D',-2)
    if asset == 'kentrosaurus':
        for i,x in enumerate((24,29,34,37)):
            base=ellipse_edge(cx,cy,rx,ry,x)+1.5
            profile(scene,'plate'+str(i),[(x-2,base),(x-1,base-5+i*.5),(x+2,base-1),(x+2,base+2)],'A',-3)
            profile(scene,'plate_light'+str(i),[(x-1,base-3.5+i*.5),(x+1,base-1),(x-1,base-1)],'G',-4)
        for i,x in enumerate((-11,-4,3,10)):
            base=profile_edge(tail,x)+1
            limb(scene,'tail_spike'+str(i),[(x,base,.85),(x-2,base-4.5-i*.45,.25)],'W',-3)
            attach(scene,'tail_spike'+str(i),'tail',x)
        profile(scene,'shoulder_spike',[(31,22),(30,28),(34,24)],'W',-5)
        limb(scene,'neck',[(36,24,3),(42,26,2)],'B',-1)
        ellipse(scene,'head',46,26,4.5,2.5,'B',-4)
        eye(scene,45,25)
    elif asset == 'styracosaurus':
        limb(scene,'neck',[(35,22,5),(43,25,4)],'B',-1)
        for i,(x,y,tx,ty) in enumerate(((38,12,30,4),(41,9,38,1),(45,10,47,2),(47,15,54,8))):
            limb(scene,'frill_spike'+str(i),[(x,y,1),(x+(tx-x)*.75,y+(ty-y)*.75,.25)],'W',-2)
        ellipse(scene,'frill',41,16,6.5,10,'A',-3)
        ellipse(scene,'frill_inset',42,16,4.5,7.5,'G',-4)
        profile(scene,'face',[(43,21),(49,20),(55,24),(57,28),(54,31),(45,30),(42,26)],'B',-5)
        profile(scene,'beak',[(55,26),(59,28),(57,32),(53,30)],'M',-8)
        limb(scene,'nose_horn',[(54,25,1.4),(55.5,20,.8),(56,16,.25)],'W',-10)
        eye(scene,48,23)
    elif asset == 'amargasaurus':
        neck=[(41,26,4),(48,20,3.2),(55,17,2.6),(60,17,2.3)]
        limb(scene,'neck',neck,'B',-1)
        for i,(x,y) in enumerate(((32,24),(38,25),(44,21),(49,18),(54,16),(58,16))):
            # Short paired spines overlap the back/neck surface at their roots.
            length=8-i*.45
            limb(scene,'far_spine'+str(i),[(x,y,.85),(x-2,y-length,.3)],'G',-3)
            limb(scene,'near_spine'+str(i),[(x+1,y,.85),(x-1,y-length-1,.3)],'A',-5)
            if i >= 2:
                attach(scene,'far_spine'+str(i),'neck',x)
                attach(scene,'near_spine'+str(i),'neck',x+1)
        ellipse(scene,'head',64,18,4.5,2.5,'B',-6)
        rect(scene,'jaw',64,20,4,1,'D',-7)
        eye(scene,63,17)
    elif asset == 'diplodocus':
        limb(scene,'long_neck',[(54,26,5),(68,19,3.5),(80,15,2.5),(89,15,2)],'B',-1)
        limb(scene,'neck_light',[(58,28,1),(72,21,.8),(85,17,.5)],'D',-3)
        profile(scene,'head',[(87,13),(95,13),(98,15),(97,18),(88,18)],'B',-4)
        rect(scene,'jaw',92,17,5,1,'D',-5)
        eye(scene,91,14)
        for i,x in enumerate(range(18,56,5)):
            base=min(profile_edge(tail,x) if x <= cx else h,
                     ellipse_edge(cx,cy,rx,ry,x) if abs(x-cx)<rx else h)+1.5
            profile(scene,'back_spine'+str(i),[(x-1,base),(x,base-2.5),(x+2,base)],'A',-3)
            if x < cx-rx:
                attach(scene,'back_spine'+str(i),'tail',x)
    elif asset == 'argentinosaurus':
        limb(scene,'long_neck',[(63,37,8),(73,28,6),(83,17,4.2),(89,10,3.2)],'B',-1)
        limb(scene,'neck_light',[(68,37,1.8),(78,28,1.3),(87,18,1)],'D',-3)
        profile(scene,'head',[(87,6),(94,5),(101,9),(101,12),(94,14),(86,11)],'B',-4)
        rect(scene,'jaw',95,12,5,1,'D',-5)
        eye(scene,93,8)
        for i,x in enumerate((30,39,48,57)):
            ellipse(scene,'back_scute'+str(i),x,ellipse_edge(cx,cy,rx,ry,x)+.5,1.8,1.2,'A',-3,6)
    else:
        limb(scene,'neck',[(35,20,3.8),(43,23,3),(50,26,2.5)],'B',-1)
        # Downward-facing broad muzzle: a squared scoop rather than a tiny snout.
        profile(scene,'head',[(48,23),(55,22),(60,25),(61,30),(51,31),(48,28)],'B',-4)
        rect(scene,'wide_muzzle',55,27,7,4,'A',-5)
        rect(scene,'tooth_battery',55,30,7,1,'W',-8)
        for x in range(56,62,2):rect(scene,'tooth_gap'+str(x),x,30,.5,1,'D',-9)
        eye(scene,53,24)
    leg(scene,'near_back',hind,hip,h,phase,radius,stride,True)
    leg(scene,'near_front',front,hip-2,h,phase+.5,radius,stride,True)


EXPANSION_BUILDERS = {}
for asset in ('spinosaurus','therizinosaurus','carnotaurus','yutyrannus','iguanodon','microraptor'):
    EXPANSION_BUILDERS[asset] = partial(biped, asset=asset)
for asset in ('amargasaurus','kentrosaurus','styracosaurus','diplodocus','argentinosaurus','nigersaurus'):
    EXPANSION_BUILDERS[asset] = partial(quadruped, asset=asset)
