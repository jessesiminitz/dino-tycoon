import { describe, expect, it } from 'vitest';
import { advanceMotion, type AnimalMotion } from '../src/render/parkMotion';
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
      expect(next.frame).toBe(2);
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
      for(let step=0;step<16;step++){
        previous=advanceMotion(previous,{...input,baby,moving:true,x:20+direction*step*cycle/8*(baby?.6:1),time:1000+step*16});
        expect(previous.frame).toBe(step%8);
      }
    }
  });
  it('does not animate a teleport as a giant stride and can suppress idle motion',()=>{
    const previous=advanceMotion(undefined,input);
    expect(advanceMotion(previous,{...input,moving:true,x:500}).distance).toBe(0);
    expect(advanceMotion(previous,{...input,time:1800,ambient:false}).frame).toBe(0);
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
