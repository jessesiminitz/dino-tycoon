"""Species and building profiles for the native-resolution Blender camera.

Loaded by render_sprites.py with its modeling helpers. All geometry is editable
in the saved Blender scenes; materials retain semantic palette roles.
"""
from functools import partial


def gait(phase, stride, clearance):
    # Right-facing: planted feet travel backwards, lifted feet return forwards.
    angle = phase * math.tau
    return math.cos(angle) * stride, max(0, -math.sin(angle)) * clearance


def leg(scene, name, x, hip_y, bottom, phase, radius, stride, near=True, biped=False):
    offset, lift = gait(phase, stride, max(2, radius))
    role, depth = ('B', -6) if near else ('F', 4)
    knee_x = x + offset + (radius if biped else -1)
    foot_x = x + offset
    limb(scene, name, [(x,hip_y,radius), (knee_x,(hip_y+bottom)/2,radius*.65),
                      (foot_x,bottom-2-lift,max(.8,radius*.38))], role, depth)
    width = max(3, radius*1.8)
    rect(scene, name+'_foot', foot_x-1, bottom-2-lift, width, 2, role, depth)
    if near:
        rect(scene, name+'_claws', foot_x+width-3, bottom-1-lift, 2, 1, 'W', depth-2)


def biped(scene, phase, asset):
    w, h = scene.render.resolution_x, scene.render.resolution_y
    # Each species has its own trunk, neck, head and appendage proportions.
    specs = {
        'compsognathus': (12,8,6,3,21,4,6,3,1.5),
        'velociraptor': (16,11,8,4,28,6,7,3,2.2),
        'dilophosaurus': (19,16,9,5,35,9,8,4,2.8),
        'allosaurus': (25,20,11,6,45,11,10,5,3.6),
        'pachycephalosaurus': (16,16,8,5,28,9,6,4,2.7),
        'parasaurolophus': (23,22,12,7,40,8,8,4,3.5),
    }
    cx, cy, rx, ry, hx, hy, hrx, hry, radius = specs[asset]
    stride = max(1.6, radius*.85)
    leg(scene,'far',cx-3,cy+ry*.6,h,phase+.5,radius*.85,stride,False,True)
    profile(scene,'tail',[(cx-rx*.4,cy-ry*.6),(cx-rx,cy-ry*.4),(1,cy+ry*.8),
                         (cx-rx,cy+ry*.7),(cx,cy+ry*.6)],'B',0)
    ellipse(scene,'trunk',cx,cy,rx,ry,'B',0)
    profile(scene,'belly',[(cx-rx*.6,cy+ry*.4),(cx+rx*.9,cy+ry*.2),
                          (cx+rx*.6,cy+ry*.9),(cx-rx*.2,cy+ry)],'D',-2)
    limb(scene,'neck',[(cx+rx*.65,cy-ry*.1,radius+1),(hx-hrx*.65,hy+1,radius*.8)],'B',-1)
    if asset == 'pachycephalosaurus':
        ellipse(scene,'dome',hx-1,hy-2,4.5,5,'A',-3)
        ellipse(scene,'dome_highlight',hx-1.5,hy-3,3,3,'G',-4)
    if asset == 'parasaurolophus':
        profile(scene,'tube_crest',[(hx-3,hy-2),(hx-8,2),(hx-15,2),(hx-15,4),(hx-7,6),(hx-2,hy+1)],'A',-2)
        limb(scene,'crest_ridge',[(hx-14,2.7,.6),(hx-8,3,.8),(hx-3,hy-2,.6)],'G',-4)
    profile(scene,'head',[(hx-hrx,hy-hry*.7),(hx-hrx*.3,hy-hry),(min(w-1,hx+hrx),hy-hry*.5),
                         (min(w-1,hx+hrx),hy+hry*.8),(hx,hy+hry),(hx-hrx,hy+hry*.5)],'B',-3)
    rect(scene,'jaw',hx-1,hy+hry*.4,hrx, max(1,hry*.5),'D',-4)
    rect(scene,'mouth',hx+1,hy+hry*.3,hrx-1,1,'M',-6)
    rect(scene,'eye',hx-1,hy-1,1,1,'E',-9)
    if asset == 'dilophosaurus':
        profile(scene,'far_crest',[(hx-5,hy-3),(hx-4,2),(hx+1,3),(hx+3,hy-3)],'G',-3)
        profile(scene,'near_crest',[(hx-4,hy-3),(hx-3,1),(hx+2,2),(hx+4,hy-3)],'A',-7)
    if asset == 'allosaurus':
        profile(scene,'brow',[(hx-2,hy-2),(hx-1,hy-5),(hx+1,hy-2)],'A',-8)
    arm_x = cx+rx*.9
    limb(scene,'arm',[(arm_x,cy,1),(arm_x+2,cy+3,.8),(arm_x+5,cy+2,.5)],'B',-5)
    if asset == 'velociraptor':
        profile(scene,'tail_fan',[(1,cy+3),(3,cy+1),(8,cy+2),(8,cy+4),(2,cy+5)],'A',-3)
        attach(scene,'tail_fan','tail',7)
        for i in range(3):
            profile(scene,'arm_feather'+str(i),[(arm_x+i,cy+2),(arm_x+i+1,cy+6),(arm_x+i+3,cy+2)],'A',-7)
    leg(scene,'near',cx,cy+ry*.5,h,phase,radius,stride,True,True)
    if asset == 'velociraptor':
        offset,lift = gait(phase,stride,max(2,radius))
        profile(scene,'sickle',[(cx+offset+3,h-2-lift),(cx+offset+4,h-5-lift),(cx+offset+5,h-3-lift)],'W',-9)


def quadruped(scene, phase, asset):
    w,h=scene.render.resolution_x,scene.render.resolution_y
    specs={
        'protoceratops':(14,10,9,5,9,20,12,1.8),
        'stegosaurus':(25,18,16,10,17,35,23,3),
        'ankylosaurus':(25,13,17,7.5,16,34,17,2.8),
        'brachiosaurus':(29,38,15,9,22,40,40,3.4),
    }
    cx,cy,rx,ry,hind,front,hip,radius=specs[asset]
    stride=max(1.5,radius*.65)
    leg(scene,'far_back',hind-2,hip,h,phase+.5,radius*.85,stride,False)
    leg(scene,'far_front',front-2,hip-2,h,phase,radius*.85,stride,False)
    tip_y=cy+ry*.25 if asset in ('stegosaurus','ankylosaurus') else cy+ry+4
    tail=[(cx-rx*.6,cy-ry*.3),(cx-rx,cy),(1,tip_y),
          (cx-rx*.8,cy+ry*.7),(cx-rx*.2,cy+ry*.5)]
    profile(scene,'tail',tail,'B',0)
    ellipse(scene,'trunk',cx,cy,rx,ry,'B',0)
    ellipse(scene,'belly',cx+1,cy+ry*.45,rx*.75,ry*.5,'D',-2)
    if asset=='protoceratops':
        limb(scene,'neck',[(20,10,3),(27,11,3)],'B',0)
        ellipse(scene,'frill',23,6,4,5,'A',-3)
        ellipse(scene,'frill_inset',23,6,2.5,3.5,'G',-4)
        profile(scene,'head',[(25,7),(30,8),(32,11),(31,14),(26,14),(23,11)],'B',-5)
        profile(scene,'beak',[(30,10),(33,11),(31,15),(29,14)],'M',-7)
        rect(scene,'eye',26,8,1,1,'E',-9)
    elif asset=='stegosaurus':
        for i,x in enumerate((10,15,21,27,33,38)):
            base=18-9*math.exp(-((x-25)/15)**2)
            profile(scene,'plate'+str(i),[(x-3,base+2),(x-2,base-5),(x+1,base-7),(x+4,base),(x+2,base+3)],'A',-3)
            profile(scene,'plate_edge'+str(i),[(x-2,base-4),(x+1,base-7),(x+2,base-4)],'G',-4)
        limb(scene,'neck',[(38,23,4),(46,25,2.5)],'B',-1)
        ellipse(scene,'head',50,25,6,3,'B',-3)
        rect(scene,'jaw',50,27,6,1,'D',-4)
        rect(scene,'eye',50,24,1,1,'E',-9)
        for i in range(4):
            x=3+i*2
            base=profile_edge(tail,x)+.8
            profile(scene,'tail_spike'+str(i),[(x-1,base+1),(x-1.5,base-3.5),(x+1,base)],'W',-3)
            attach(scene,'tail_spike'+str(i),'tail',x)
    elif asset=='ankylosaurus':
        club_x=4
        club_y=(profile_edge(tail,club_x)+profile_edge(tail,club_x,True))/2
        ellipse(scene,'tail_club',club_x,club_y,2.4,2.2,'A',-3)
        attach(scene,'tail_club','tail',club_x)
        for row in range(3):
            for col in range(6):
                x=13+col*4+row%2; y=9+row*3
                ellipse(scene,f'scute_{row}_{col}',x,y,1.4,1,'A',-4,6)
        for x in (11,18,25,32,38):
            base=ellipse_edge(cx,cy,rx,ry,x,True)-1
            profile(scene,'side_spike'+str(x),[(x-1.5,base),(x,base+2.5),(x+1.5,base)],'W',-5)
        limb(scene,'neck',[(38,13,4),(44,14,3)],'B',-1)
        profile(scene,'head',[(43,10),(49,10),(53,13),(52,17),(43,17)],'B',-3)
        rect(scene,'jaw',48,16,4,1,'D',-4)
        rect(scene,'eye',47,12,1,1,'E',-9)
    else:
        limb(scene,'long_neck',[(40,34,7),(46,21,5),(51,9,3.8),(53,5,3.2)],'B',-1)
        limb(scene,'neck_light',[(43,31,1.5),(49,18,1.2),(53,8,1)],'D',-3)
        profile(scene,'head',[(51,2),(57,1),(62,3),(63,7),(54,9),(50,6)],'B',-4)
        rect(scene,'jaw',57,7,5,1,'D',-5)
        rect(scene,'eye',55,3,1,1,'E',-9)
    leg(scene,'near_back',hind,hip,h,phase,radius,stride,True)
    leg(scene,'near_front',front,hip-2,h,phase+.5,radius,stride,True)


def swimmer(scene, phase, asset):
    wave=math.sin(phase*math.tau); sweep=math.cos(phase*math.tau)
    plesio=asset=='plesiosaurus'
    cx,rx=(23,12) if plesio else (31,20)
    for i,x in enumerate((cx-9,cx+7)):
        profile(scene,'far_paddle'+str(i),[(x,12),(x+4+sweep,17+wave),(x+8+sweep,17+wave),(x+3,10)],'F',4)
    profile(scene,'tail',[(cx-rx+4,10),(8,12),(1,14+wave*2),(8,17),(cx-rx+4,17)],'B',0)
    if not plesio:
        profile(scene,'tail_fin',[(1,6+wave),(6,12),(1,20+wave),(3,13)],'A',-2)
    ellipse(scene,'trunk',cx,14 if plesio else 11,rx,5 if plesio else 6,'B',0)
    ellipse(scene,'belly',cx+2,16 if plesio else 14,rx*.8,2,'D',-2)
    if plesio:
        limb(scene,'neck',[(32,12,3),(38,8,2),(44,5,1.6)],'B',-1)
        profile(scene,'head',[(43,2),(48,2),(53,4),(53,6),(46,7),(43,5)],'B',-3)
        rect(scene,'mouth',49,5,4,1,'M',-5);rect(scene,'eye',47,3,1,1,'E',-9)
    else:
        profile(scene,'head',[(44,5),(54,4),(63,7),(62,13),(51,15),(43,12)],'B',-3)
        rect(scene,'mouth',50,10,12,1,'M',-5)
        for x in (52,55,58,61):
            profile(scene,'tooth'+str(x),[(x,11),(x+1,11),(x,13)],'W',-7)
        rect(scene,'eye',52,7,1,1,'E',-9)
    for i,x in enumerate((cx-9,cx+7)):
        sign=1 if i==0 else -1
        profile(scene,'near_paddle'+str(i),[(x-2,14),(x+1,17),(x+6+sign*sweep*2,22-max(0,sign*wave)),
                                             (x+9+sign*sweep*2,22-max(0,sign*wave)),(x+4,15)],'B',-6)
        limb(scene,'paddle_edge'+str(i),[(x+2,17,.5),(x+7+sign*sweep*2,20+sign*wave,.5)],'D',-8)


def flyer(scene, phase, asset):
    large=asset=='pteranodon'; h=scene.render.resolution_y
    cx,cy=(28,17) if large else (19,12)
    flap=math.cos(phase*math.tau); sweep=math.sin(phase*math.tau)
    tip_y=(h-3)/2-flap*(h-7)/2
    tip_x=5+sweep*2
    profile(scene,'far_wing',[(cx+2,cy-3),(cx+11+sweep*2,max(1,tip_y-1)),
                              (cx+14,tip_y+4),(cx+5,cy+2)],'F',4)
    ellipse(scene,'body',cx,cy,5.5 if large else 4,3,'B',0)
    profile(scene,'near_membrane',[(cx+2,cy-3),(cx-7,cy-7*flap),(tip_x,tip_y),
                                   (tip_x+4,tip_y+4),(cx-9,cy+2),(cx,cy+2)],'A',-3)
    limb(scene,'wing_fingers',[(cx+2,cy-3,1),(cx-7,cy-7*flap,.8),(tip_x,tip_y,.6)],'B',-5)
    limb(scene,'feet',[(cx,cy+2,1),(cx-3,cy+5,.6),(cx,cy+5,.5)],'W',-4)
    if large:
        profile(scene,'crest',[(33,12),(28,8),(20,5),(29,14)],'A',-3)
        limb(scene,'neck',[(31,16,2),(34,12,2)],'B',-2)
        ellipse(scene,'head',35,12,4,3,'B',-5)
        profile(scene,'beak',[(37,10),(57,14),(37,15)],'W',-6)
        rect(scene,'eye',36,11,1,1,'E',-9)
    else:
        limb(scene,'tail',[(16,12,1),(8,13,.6),(3,13,.4)],'B',-1)
        profile(scene,'tail_vane',[(0,13),(3,11),(6,13),(3,15)],'A',-3)
        limb(scene,'neck',[(22,12,2),(26,9,2)],'B',-2)
        ellipse(scene,'head',28,8,5,4,'B',-5)
        profile(scene,'beak',[(31,6),(37,10),(31,12)],'D',-6)
        rect(scene,'mouth',32,10,4,1,'M',-7)
        for x in (33,35):rect(scene,'fang'+str(x),x,11,1,2,'W',-8)
        rect(scene,'eye',27,6,1,1,'E',-9)


def door(scene,x,y,w=5,h=7):
    rect(scene,'door_frame',x-1,y-1,w+2,h+1,'D',-7)
    rect(scene,'door',x,y,w,h,'M',-8)
    rect(scene,'door_light',x,y,1,h,'G',-9)
    rect(scene,'door_knob',x+w-2,y+h//2,1,1,'W',-10)


def building(scene, phase, asset):
    if asset=='restaurant':
        for i,(x,y) in enumerate(((4,3),(7,2),(10,4),(13,1),(16,3),(19,5))):
            rect(scene,'fry'+str(i),x,y,2,14,'A',0)
            rect(scene,'fry_edge'+str(i),x,y,1,11,'F',-2)
        profile(scene,'carton',[(2,13),(21,13),(19,30),(4,30)],'B',-3)
        profile(scene,'carton_shade',[(18,14),(21,13),(19,30),(16,30)],'D',-4)
        rect(scene,'sign',7,15,10,3,'W',-5); door(scene,10,23,5,7)
    elif asset=='snackstall':
        profile(scene,'bucket',[(2,12),(20,12),(17,28),(5,28)],'B',0)
        for i in range(3):rect(scene,'stripe'+str(i),5+i*5,13,2,15,'W',-3)
        for i,(x,y) in enumerate(((4,10),(8,6),(12,8),(16,7),(18,11),(7,11),(12,4),(4,7))):
            ellipse(scene,'popcorn'+str(i),x,y,2.8,2.4,'A' if i%3 else 'W',-4-i*.1,8)
        rect(scene,'rim',2,12,18,2,'W',-6); door(scene,9,21,4,7)
    elif asset=='restroom':
        for i,x in enumerate((2,13)):
            rect(scene,'stall'+str(i),x,5,9,23,'B' if i==0 else 'A',0)
            rect(scene,'roof'+str(i),x-1,3,11,3,'F',-2)
            rect(scene,'panel'+str(i),x+1,10,7,17,'D' if i==0 else 'G',-3)
            rect(scene,'vent'+str(i),x+2,6,5,2,'W',-4)
            ellipse(scene,'head'+str(i),x+4.5,13,1.3,1.3,'W',-5,8)
            rect(scene,'icon'+str(i),x+4,15,1,4,'W',-5)
            if i:profile(scene,'skirt',[(x+4,15),(x+2,18),(x+6,18)],'W',-6)
            rect(scene,'handle'+str(i),x+6,22,1,2,'E',-6)
    elif asset=='giftshop':
        limb(scene,'handle',[(5,16,1),(8,4,1.3),(19,4,1.3),(23,16,1)],'D',1)
        ellipse(scene,'toy_rex',10,12,4,3,'F',-1)
        limb(scene,'toy_neck',[(12,12,1.5),(14,8,1.2),(17,8,1)],'F',-2)
        rect(scene,'toy_eye',15,7,1,1,'E',-4)
        ellipse(scene,'egg',20,11,3,4,'W',-1)
        profile(scene,'basket',[(2,15),(26,15),(23,30),(5,30)],'B',-3)
        for y in (18,22,26):rect(scene,'weave'+str(y),4,y,20,1,'A',-5)
        for x in (7,13,19):rect(scene,'vertical'+str(x),x,16,1,13,'D',-4)
        rect(scene,'rim',2,15,24,2,'W',-6);door(scene,11,23,5,7)
    elif asset=='trashcan':
        ellipse(scene,'head',7,6,6,5,'B',0,12)
        rect(scene,'bin',3,8,8,9,'B',0)
        rect(scene,'belly',4,12,6,4,'A',-2)
        rect(scene,'mouth',3,7,9,3,'M',-3)
        for x in (4,7,10):rect(scene,'tooth'+str(x),x,7,1,1,'W',-4)
        rect(scene,'eye',9,4,1,1,'E',-5)
        rect(scene,'base',2,16,10,1,'D',-4)
    elif asset=='station':
        rect(scene,'body',2,10,25,11,'B',0)
        rect(scene,'hood',21,11,7,5,'W',-2)
        rect(scene,'rollbar',7,3,1,8,'M',1)
        rect(scene,'roof',5,2,17,2,'D',-2)
        rect(scene,'windshield',9,4,11,6,'A',-3)
        rect(scene,'glint',10,4,2,5,'G',-4)
        rect(scene,'stripe',2,15,25,2,'F',-4)
        for x in (6,23):
            ellipse(scene,'wheel'+str(x),x,21,4,3.5,'M',-5,12)
            ellipse(scene,'hub'+str(x),x,21,1.5,1.5,'D',-6,8)
        rect(scene,'headlight',26,12,2,2,'E',-5);door(scene,12,15,5,8)
    elif asset=='petting':
        ellipse(scene,'baby_green',9,7,4,3,'F',1)
        ellipse(scene,'baby_gold',18,9,3,4,'A',1)
        rect(scene,'eye_green',10,6,1,1,'E',-3)
        rect(scene,'eye_gold',19,8,1,1,'E',-3)
        profile(scene,'egg_shell',[(2,11),(5,15),(8,12),(11,15),(15,12),(18,15),(22,12),
                                   (24,16),(22,22),(18,24),(7,24),(3,21)],'B',-4)
        profile(scene,'egg_shade',[(21,14),(24,16),(22,22),(18,24),(18,21),(21,19)],'D',-5)
        profile(scene,'heart',[(11,16),(12,15),(13,16),(14,15),(15,16),(15,18),(13,20),(11,18)],'G',-6)
        door(scene,11,21,4,3)
    elif asset=='pump':
        rect(scene,'house',3,11,17,13,'B',0)
        profile(scene,'roof',[(1,11),(11,5),(22,11)],'D',-2)
        rect(scene,'window',6,13,4,4,'A',-3)
        rect(scene,'window_glint',6,13,1,3,'W',-4)
        limb(scene,'pipe',[(18,16,1.5),(23,16,1.5),(23,12,1.5)],'F',-3)
        for y in range(16,24,2):rect(scene,'water'+str(y),23,y,1,1,'A',-5)
        ellipse(scene,'puddle',23,24,2,1,'A',-6,8);door(scene,12,17,5,7)
    elif asset=='digsite':
        profile(scene,'sand',[(1,23),(6,17),(15,14),(23,19),(27,24)],'B',0)
        profile(scene,'sand_shade',[(16,15),(23,19),(27,24),(14,24)],'D',-2)
        limb(scene,'bone',[(7,17,2),(19,11,2)],'W',-3)
        for x,y in ((5,16),(7,19),(18,9),(21,12)):ellipse(scene,'knuckle'+str(x),x,y,2,2,'W',-4,8)
        rect(scene,'flagpole',23,3,1,17,'M',2)
        profile(scene,'flag',[(24,3),(27,5),(24,8)],'A',-3)
        limb(scene,'shovel',[(5,7,.6),(9,19,.6)],'F',-5)
        profile(scene,'spade',[(7,18),(11,17),(12,21),(10,23),(8,22)],'F',-6)


EXTRA_BUILDERS={}
for asset in ('compsognathus','velociraptor','dilophosaurus','allosaurus','pachycephalosaurus','parasaurolophus'):
    EXTRA_BUILDERS[asset]=partial(biped,asset=asset)
for asset in ('protoceratops','stegosaurus','ankylosaurus','brachiosaurus'):
    EXTRA_BUILDERS[asset]=partial(quadruped,asset=asset)
for asset in ('plesiosaurus','mosasaurus'):
    EXTRA_BUILDERS[asset]=partial(swimmer,asset=asset)
for asset in ('pteranodon','dimorphodon'):
    EXTRA_BUILDERS[asset]=partial(flyer,asset=asset)
for asset in ('restaurant','snackstall','restroom','giftshop','trashcan','station','petting','pump','digsite'):
    EXTRA_BUILDERS[asset]=partial(building,asset=asset)
