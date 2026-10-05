"""Blender mesh profiles for scenery and seamless native-resolution ground tiles.

Scenery shares the game's existing dimensions and effect anchors. Tile materials
use quiet color clusters so small animals and construction overlays remain clear.
"""
from functools import partial
import random


def crown(scene,name,cx,cy,rx,ry):
    ellipse(scene,name,cx,cy,rx,ry,'B',0,12)
    profile(scene,name+'_shade',[(cx+rx*.25,cy-ry*.8),(cx+rx*.9,cy-ry*.3),
                                (cx+rx,cy+ry*.3),(cx+rx*.3,cy+ry),(cx-rx*.2,cy+ry*.8)],'D',-2)
    ellipse(scene,name+'_light',cx-rx*.3,cy-ry*.3,rx*.55,ry*.5,'G',-3,10)
    profile(scene,name+'_facet',[(cx-rx*.6,cy-ry*.5),(cx-rx*.15,cy-ry*.85),
                                (cx+rx*.25,cy-ry*.3),(cx-rx*.5,cy-ry*.1)],'A',-4)


def frond(scene,name,points,width=1):
    # A continuous, tapering leaf avoids disconnected outline rings at game size.
    left=[];right=[]
    for i,(x,y) in enumerate(points):
        before=points[max(0,i-1)];after=points[min(len(points)-1,i+1)]
        dx,dy=after[0]-before[0],after[1]-before[1];length=math.hypot(dx,dy)
        radius=width*(.9 if i==0 else 1.3 if i==1 else .8 if i==2 else .12)
        nx,ny=-dy/length,dx/length
        for side,vertices in ((1,left),(-1,right)):
            vertices.append((max(1.2,min(scene.render.resolution_x-1.2,x+side*nx*radius)),y+side*ny*radius))
    profile(scene,name,left+list(reversed(right)),'B',-3)
    limb(scene,name+'_vein',[(x,y,.45) for x,y in points[:-1]],'G',-4)


def scenery(scene,variant,asset):
    v=int(variant); w,h=scene.render.resolution_x,scene.render.resolution_y
    if asset in ('conifer','giant'):
        giant=asset=='giant';cx=w/2+(v-1)*.5
        limb(scene,'trunk',[(cx,h-3,1.6 if giant else 1),(cx-1,8,1)],'F',1)
        rect(scene,'trunk_light',cx-1,h-14,1,11,'W',-1)
        tiers=5 if giant else 4
        for i in range(tiers):
            top=2+i*(4.5 if giant else 4);half=2+i*1.5
            bottom=top+8+(1 if giant else 0)
            profile(scene,'bough'+str(i),[(cx,top),(cx-half*.8,top+4),(cx-half,bottom),
                                         (cx-1,bottom-1),(cx+half,bottom),(cx+half*.7,top+4)],'B',-i)
            profile(scene,'bough_shade'+str(i),[(cx,top+2),(cx+half,bottom),(cx+1,bottom-1)],'D',-i-.2)
            limb(scene,'bough_light'+str(i),[(cx-1,top+3,.6),(cx-half*.7,bottom-2,.7)],'G',-i-.4)
    elif asset=='broadleaf':
        limb(scene,'trunk',[(10,h-3,1.5),(9,13,1.3)],'F',2)
        limb(scene,'branch',[(9,18,1),(5,12,.7)],'F',2)
        rect(scene,'trunk_light',9,17,1,6,'W',-3)
        crown(scene,'left_crown',6,9+v%2,4.5,6)
        crown(scene,'right_crown',14,10-v%2,4.5,6)
        crown(scene,'top_crown',10+(v-1)*.7,7,5.5,5)
    elif asset in ('cycad','treefern','palm'):
        palm=asset=='palm';fern=asset=='treefern';cx=w/2;top=8 if palm else 7 if fern else 10
        bend=(v-1)*2 if palm else 0
        limb(scene,'stem',[(cx,h-3,1.2 if fern else 1.5),(cx+bend*.4,(h+top)/2,1.2),(cx+bend,top,1)],'F',1)
        for y in range(top+4,h-3,3):rect(scene,'stem_ring'+str(y),cx+bend*(h-y)/(h-top)-1,y,2,1,'W',-2)
        for i,(dx,dy) in enumerate(((-8,2),(-7,-3),(-3,-5),(3,-5),(7,-3),(8,2))):
            dy+=((v+i)%3-1)*.5
            x0=cx+bend;end=max(2,min(w-3,x0+dx))
            frond(scene,'frond'+str(i),[(x0,top),(x0+dx*.4,top+dy*.5),(end,top+dy),(end,top+dy+2)],1.1 if palm else .85)
        if palm:
            ellipse(scene,'coconut',cx+bend+1,top+2,1.2,1.2,'F',-6,8)
    elif asset=='mountain':
        cx=12+(v%3)*2;peak=3+(v//3)*3
        profile(scene,'rock',[(2,31),(7,22),(cx-4,13),(cx,peak),(cx+4,11),(23,22),(28,31)],'B',0)
        profile(scene,'east_face',[(cx,peak),(cx+4,11),(23,22),(28,31),(cx+2,31),(cx-1,16)],'D',-2)
        profile(scene,'west_face',[(cx,peak),(cx-4,13),(7,22),(3,29),(cx-2,23),(cx+1,12)],'F',-2)
        limb(scene,'ridge',[(cx-.5,peak+1,.6),(cx-3,13,.6),(7,23,.5)],'A',-4)
        for i in range(3):
            y=20+i*4;limb(scene,'strata'+str(i),[(7-i,y,.5),(cx,y-2,.5),(21+i,y+1,.5)],'G',-5)
        profile(scene,'ledge_foot',[(3,30),(6,29),(9,31),(15,30),(21,31),(26,30),(28,32),(3,32)],'F',-6)
    elif asset=='volcano':
        profile(scene,'cone',[(3,67),(14,54),(24,34),(31,10),(42,8),(52,10),(61,34),(72,54),(81,67)],'B',0)
        profile(scene,'shadow_face',[(45,11),(52,10),(61,34),(72,54),(81,67),(48,67),(48,38)],'D',-2)
        profile(scene,'lit_face',[(31,11),(41,10),(36,31),(30,45),(12,65),(4,65),(22,33)],'F',-2)
        for i,x in enumerate((24,32,56,65)):
            limb(scene,'old_channel'+str(i),[(42+(x-42)*.4,20,1),(x,43,1),(x+(x-42)*.6,61,.7)],'M',-3)
        limb(scene,'lava_flow',[(44,12,1.2),(43,21,1.5),(47,31,1),(45,41,.6)],'A',-4)
        limb(scene,'lava_highlight',[(43.5,12,.6),(43,21,.6),(46,28,.5)],'W',-5)
        ellipse(scene,'crater_rim',42,10,10,2.5,'M',-6,16)
        ellipse(scene,'crater',42,10,7.5,1.2,'A',-8,16)
        rect(scene,'crater_glint',39,10,5,1,'W',-9)
        profile(scene,'moss_foot',[(4,65),(16,63),(26,65),(38,64),(50,65),(66,63),(79,65),(81,67),(3,67)],'G',-5)
    elif asset=='bush':
        crown(scene,'shrub_left',4.5,6,3,3)
        crown(scene,'shrub_right',9,6,3,3)
        crown(scene,'shrub_top',7+(v-1),4.5,3,2.5)
        if v==1:rect(scene,'flower',6,4,1,1,'E',-7)
    elif asset=='reeds':
        for i in range(4):
            x=2+i*2;top=3+(i+v)%4
            limb(scene,'reed'+str(i),[(x,14,.5),(x+((v+i)%2),top,.5)],'B',0)
            rect(scene,'cattail'+str(i),x+((v+i)%2),top,1,3,'F',-3)
            limb(scene,'leaf'+str(i),[(x,13,.5),(max(1,x-2),top+4,.4)],'G',-2)
    elif asset=='flowers':
        ellipse(scene,'soil',8,8,6,2,'G',0,12)
        for i in range(5):
            x=3+i*2;y=4+(i+v)%3
            limb(scene,'stem'+str(i),[(x,9,.5),(x,y,.5)],'F',-1)
            ellipse(scene,'flower'+str(i),x,y,1.5,1.3,('A','W','E')[(i+v)%3],-3,8)
            rect(scene,'center'+str(i),x,y,1,1,'W',-5)
    elif asset=='fountain':
        ellipse(scene,'basin',9,14,7,3,'B',0,16)
        ellipse(scene,'basin_shadow',9,15,6,2,'D',-2,12)
        ellipse(scene,'pool',9,13,5.5,1.5,'F',-4,12)
        ellipse(scene,'pool_glint',7,12.5,2,1,'A',-5,10)
        limb(scene,'pedestal',[(9,13,1.5),(9,7,1)],'B',-6)
        ellipse(scene,'upper_bowl',9,7,3.5,1.2,'W',-7,12)
        limb(scene,'jet',[(9,6,.6),(9,3,.5)],'E',-8)
        limb(scene,'left_water',[(9,3,.5),(6,5,.5),(5,9,.4)],'A',-7)
        limb(scene,'right_water',[(9,3,.5),(12,5,.5),(13,9,.4)],'A',-7)
    elif asset=='lamp':
        rect(scene,'post',4,8,2,13,'B',0)
        rect(scene,'post_edge',4,10,1,11,'F',-2)
        rect(scene,'foot',2,21,6,1,'D',-2)
        rect(scene,'lantern',2,3,6,6,'B',-3)
        rect(scene,'glass',3,4,4,4,'A',-4)
        rect(scene,'warm_glass',5,5,2,3,'G',-5)
        rect(scene,'glint',3,4,1,3,'E',-6)
        profile(scene,'cap',[(2,3),(5,1),(8,3)],'D',-6)
    elif asset=='bench':
        for x in (3,12):rect(scene,'leg'+str(x),x,6,1,4,'F',1)
        rect(scene,'back',2,2,12,3,'B',0)
        rect(scene,'back_edge',2,2,12,1,'A',-2)
        rect(scene,'slat_line',3,4,10,1,'D',-3)
        profile(scene,'seat',[(2,6),(12,6),(14,8),(3,8)],'B',-4)
        rect(scene,'seat_lip',3,8,11,1,'D',-5)
        limb(scene,'left_arm',[(2,4,.5),(2,6,.5),(4,7,.5)],'F',-6)
        limb(scene,'right_arm',[(12,4,.5),(12,6,.5),(14,7,.5)],'F',-6)
    elif asset=='skeleton':
        limb(scene,'spine',[(2,7,.6),(8,5,1),(14,5,1),(17,4,.8)],'B',0)
        for x in (6,9,12):limb(scene,'rib'+str(x),[(x,5,.6),(x+1,7,.5),(x,9,.5)],'F',-2)
        for x in (5,12):limb(scene,'leg'+str(x),[(x,7,.6),(x-1,10,.5),(x+2,10,.5)],'D',-3)
        profile(scene,'skull',[(16,3),(19,3),(20,5),(20,7),(16,7)],'B',-4)
        rect(scene,'socket',17,4,1,1,'E',-6)
        rect(scene,'jaw',17,7,3,1,'D',-6)


def tile(scene,variant,asset):
    v=int(variant);rng=random.Random(sum((i+1)*ord(c) for i,c in enumerate(asset))+v*7919)
    rect(scene,'ground',0,0,16,16,'B',8)
    water=asset in ('tile_deepwater','tile_shallows','tile_pond','tile_river','tile_hotspring')
    if water:
        for i in range(5):
            x=rng.randrange(16);y=1+i*3;length=3+rng.randrange(4)
            role=('F','A','D','F','A')[i]
            for wrap in (0,-16):
                profile(scene,f'ripple{i}_{wrap}',[(x+wrap,y),(x+wrap+length-1,y),(x+wrap+length,y+1),
                                                  (x+wrap+1,y+1)],role,-i*.2)
        if asset=='tile_pond' and v%2==0:
            ellipse(scene,'lily',5+v,9,2.5,1.4,'G',-5,8)
            rect(scene,'lily_flower',5+v,8,1,1,'E',-7)
        if asset=='tile_hotspring':
            for i in range(3):ellipse(scene,'bubble'+str(i),2+rng.randrange(12),2+rng.randrange(12),.7,.5,'E',-5,8)
    elif asset=='tile_waterfall':
        for i in range(6):
            x=1+i*2;y=(i*3+v*2)%8
            rect(scene,'cascade'+str(i),x,y,1,5+rng.randrange(5),'W' if i%2 else 'F',-2)
            rect(scene,'cascade_shadow'+str(i),x+1,y+1,1,4,'D',-3)
        rect(scene,'foam',0,14,16,2,'A',-4)
    elif asset=='tile_cliff':
        rect(scene,'grass_lip',0,0,16,2,'G',-2)
        rect(scene,'lip_light',0,0,16,1,'W',-3)
        rect(scene,'foot_shadow',0,14,16,2,'M',-3)
        for i in range(3):
            y=4+i*3
            profile(scene,'stratum'+str(i),[(0,y),(5,y-1),(10,y),(16,y-1),(16,y+1),(0,y+1)],'D' if i%2 else 'F',-2)
        for i in range(3):rect(scene,'joint'+str(i),(i*6+v*3)%16,3+i*3,1,3,'M',-4)
    else:
        rock=asset in ('tile_rock','tile_mountain','tile_volcano','tile_lavarock','tile_lava')
        for i in range(9 if rock else 7):
            x=2+rng.randrange(11);y=2+rng.randrange(11);rx=1+rng.randrange(2)
            role=('D','F','A')[i%3]
            profile(scene,'cluster'+str(i),[(x-rx,y),(x,y-1),(x+rx,y),(x+rx-1,y+1),(x-rx,y+1)],role,-i*.15)
            if rock and i%2==0:rect(scene,'facet'+str(i),x-rx,y,rx,1,'A',-4)
        if asset in ('tile_grass','tile_forest','tile_marsh'):
            for i in range(3):
                x=2+rng.randrange(11);y=4+rng.randrange(9)
                profile(scene,'tuft'+str(i),[(x-1,y),(x-1,y-2),(x,y-1),(x+1,y-3),(x+1,y)],'G',-5)
        if asset=='tile_forest':
            for i in range(3):rect(scene,'leaf_litter'+str(i),2+rng.randrange(12),2+rng.randrange(12),2,1,'M',-6)
        if asset=='tile_marsh':ellipse(scene,'puddle',8+(v-1),9,3.5,1.4,'G',-5,10)
        if asset=='tile_lavarock':
            limb(scene,'crack',[(3+v,2,.4),(5+v,6,.4),(3+v,9,.4),(6+v,14,.4)],'M',-6)
            rect(scene,'ember',5+v,7,1,1,'E',-7)
        if asset=='tile_lava':
            for i in range(3):
                x=3+rng.randrange(10);y=2+rng.randrange(9)
                profile(scene,'crust'+str(i),[(x-2,y),(x+2,y-1),(x+1,y+4),(x-2,y+3)],'M',-7)
                rect(scene,'magma_edge'+str(i),x-2,y+4,3,1,'W',-8)


ENVIRONMENT_BUILDERS={}
for asset,spec in MANIFEST['assets'].items():
    if spec['kind']=='environment':ENVIRONMENT_BUILDERS[asset]=partial(scenery,asset=asset)
    elif spec['kind']=='terrain':ENVIRONMENT_BUILDERS[asset]=partial(tile,asset=asset)
