import { describe, expect, it } from 'vitest';
import { advanceMotion, clipFrames, idleTurnMs, standPhase, walkCycle, type AnimalMotion } from '../src/render/parkMotion';
import { advanceGlide, glideAt, glideEase, type Glide } from '../src/render/dinoGlide';
import { BLENDER_MOTION } from '../src/render/generated/blenderMotion';
import { motionWalkSpeed } from '../src/render/immersionMotion';
import { Simulation } from '../src/sim/Simulation';
import { newGame } from '../src/sim/GameState';
import { applyCommand } from '../src/sim/commands';
import { pathEdges } from '../src/sim/grid';
import { dinoWorldScale } from '../src/render/dinoSize';

const input = { species:'carnotaurus' as const,baby:false,x:20,y:20,time:1000,paused:false,moving:false,asleep:false,ambient:true };

describe('park behavior animation',()=>{
  it('matches the walking stride to the selected pixel or cartoon size',()=>{
    for(const style of ['blender','cartoon'] as const){
      const species='compsognathus';
      const cycle=motionWalkSpeed(species)*BLENDER_MOTION[species].walk.durationMs/1000*dinoWorldScale(species,style);
      const previous=advanceMotion(undefined,{...input,species,style,moving:true});
      const next=advanceMotion(previous,{...input,species,style,moving:true,x:input.x+cycle/4});
      // a quarter of the way round: sixteen poses in the pixel art, eight in the cartoon
      expect(next.frame).toBe(style==='blender'?4:2);
    }
  });
  it('shows real meals, then returns to idle; walking and sleeping take priority',()=>{
    expect(advanceMotion(undefined,{...input,eatingSince:800}).clip).toBe('eat');
    expect(advanceMotion(undefined,{...input,eatingSince:300}).clip).toBe('idle');
    expect(advanceMotion(undefined,{...input,eatingSince:800,moving:true}).clip).toBe('walk');
    expect(advanceMotion(undefined,{...input,eatingSince:800,asleep:true}).clip).toBe('rest');
  });
  it('freezes pose and position during pause, including across behavior changes',()=>{
    const previous=advanceMotion(undefined,{...input,moving:true});
    expect(advanceMotion(previous,{...input,x:500,time:9000,paused:true,asleep:true})).toBe(previous);
  });
  it('matches distance, direction and baby size instead of restarting at every tile',()=>{
    const cycle=motionWalkSpeed(input.species)*BLENDER_MOTION[input.species].walk.durationMs/1000*dinoWorldScale(input.species, 'blender');
    for(const direction of [-1,1])for(const baby of [false,true]){
      let previous: AnimalMotion|undefined;
      for(let step=0;step<32;step++){
        previous=advanceMotion(previous,{...input,baby,moving:true,x:20+direction*step*cycle/16*(baby?.6:1),time:1000+step*16});
        expect(previous.frame).toBe(step%16);
      }
    }
  });
  it('does not animate a teleport as a giant stride and can suppress idle motion',()=>{
    const previous=advanceMotion(undefined,input);
    // only the step off from the standing pose is counted, not the 480 px
    expect(advanceMotion(previous,{...input,moving:true,x:500}).distance).toBeLessThan(walkCycle(input.species,false,'blender'));
    expect(advanceMotion(previous,{...input,time:1800,ambient:false}).frame).toBe(0);
  });
  it('steps off from the standing pose and settles back into it when it stops',()=>{
    const frames=clipFrames(input.species,'walk','blender'),stand=Math.round(standPhase(input.species,'blender')*frames)%frames;
    const cycle=walkCycle(input.species,false,'blender');
    let m=advanceMotion(undefined,input);
    expect(m.clip).toBe('idle');
    m=advanceMotion(m,{...input,moving:true,time:1016});
    expect(m.frame).toBe(stand);
    // stop somewhere else in the stride: the legs keep the walk until they reach the standing pose
    m=advanceMotion(m,{...input,moving:true,x:input.x+cycle*6.6/frames,time:1032});
    const stoppedAt=m.frame;
    expect(stoppedAt).not.toBe(stand);
    const seen: number[]=[];
    let time=1032;
    for(let i=0;i<40&&m.clip==='walk';i++){time+=16;m=advanceMotion(m,{...input,x:m.x,time});if(m.clip==='walk')seen.push(m.frame);}
    expect(m.clip).toBe('idle');
    expect(seen.at(-1)).toBe(stand);
    // one frame at a time, the short way round
    expect(new Set(seen).size).toBeLessThanOrEqual(frames/2+1);
    for(let i=1;i<seen.length;i++)expect([0,1,frames-1]).toContain((seen[i]-seen[i-1]+frames)%frames);
    // with motion turned down it simply stands
    expect(advanceMotion(advanceMotion(m,{...input,moving:true,x:m.x+3,time:time+16}),{...input,x:m.x+3,time:time+32,ambient:false}).clip).toBe('idle');
  });
  it('stands a turn before its first idle move, in every art style',()=>{
    for(const style of ['blender','cartoon'] as const){
      const first=advanceMotion(undefined,{...input,style});
      expect(advanceMotion(first,{...input,style,time:input.time+idleTurnMs(0)-1}).fun).toBeUndefined();
      expect(advanceMotion(first,{...input,style,time:input.time+idleTurnMs(0)-1}).turn).toBe(0);
    }
  });
  it('walks tile to tile at a steady pace: easing away from a stand and into a stop',()=>{
    const base={tile:16,stepMs:1000};
    let g: Glide=advanceGlide(undefined,{...base,tileX:5,tileY:5,x:88,y:88,time:0,last:true});
    expect(glideAt(g,500)).toEqual({x:88,y:88,moving:false});
    // first tile of a longer route: eases in, then full speed
    g=advanceGlide(g,{...base,tileX:6,tileY:5,x:104,y:88,time:2000,last:false});
    expect(g.easeIn).toBe(true);expect(g.easeOut).toBe(false);
    expect(glideAt(g,2250).x-88).toBeLessThan(4);
    expect(glideAt(g,2999).moving).toBe(true);
    // the next tile carries on without a pause, and the last one eases to a stop
    g=advanceGlide(g,{...base,tileX:7,tileY:5,x:120,y:88,time:3000,last:false});
    expect(g.easeIn).toBe(false);
    expect(glideAt(g,3500).x).toBeCloseTo(112,5);
    g=advanceGlide(g,{...base,tileX:8,tileY:5,x:136,y:88,time:4000,last:true});
    expect(g.easeOut).toBe(true);
    expect(glideAt(g,4750).x).toBeGreaterThan(132);
    expect(glideAt(g,5000)).toEqual({x:136,y:88,moving:false});
    // position never jumps or runs backward along the way
    let last=88;
    for(const [from,gl] of [[2000,advanceGlide(advanceGlide(undefined,{...base,tileX:5,tileY:5,x:88,y:88,time:0,last:true}),{...base,tileX:6,tileY:5,x:104,y:88,time:2000,last:true})]] as const)
      for(let t=from;t<=from+1000;t+=20){const x=glideAt(gl,t).x;expect(x).toBeGreaterThanOrEqual(last);expect(x-last).toBeLessThan(1);last=x;}
    // the eases join a steady walk at its own speed
    for(const [a,b] of [[true,false],[false,true]] as const){
      const slope=a?(glideEase(1,a,b)-glideEase(.999,a,b))/.001:(glideEase(.001,a,b)-glideEase(0,a,b))/.001;
      expect(slope).toBeCloseTo(1,1);
    }
    // carried across the park: no walking over
    const far=advanceGlide(g,{...base,tileX:40,tileY:5,x:648,y:88,time:9000,last:true});
    expect(glideAt(far,9000)).toEqual({x:648,y:88,moving:false});
  });
  it('emits a meal only when stock is consumed, without changing logs or saved state',()=>{
    const state=newGame(7),sim=new Simulation(state);
    state.money=1_000_000;
    const x=state.entrance.x,y=state.entrance.y-5;
    applyCommand(state,{type:'buildFences',edges:[...pathEdges(x-2,y-2,x+3,y+3,true),...pathEdges(x-2,y-2,x+3,y+3,false)],fence:4});
    expect(applyCommand(state,{type:'buyDino',species:'triceratops',x,y}).ok).toBe(true);
    expect(applyCommand(state,{type:'placeFeeder',kind:'plants',x,y}).ok).toBe(true);
    const d=state.dinos[0],f=state.feeders[0];d.hunger=90;
    const actions: unknown[]=[],off=sim.onDinoAction(action=>actions.push(action));
    const before=state.log.length;
    sim.step();
    expect(actions).toEqual([{kind:'eat',dinoId:d.id,feederId:f.id}]);
    expect(d.hunger).toBeLessThan(50);expect(f.stock).toBeLessThan(100);
    expect(state.log.length).toBe(before);
    off();d.hunger=90;sim.step();expect(actions).toHaveLength(1);
    expect(JSON.stringify(state)).not.toContain('eatingSince');
  });
});
