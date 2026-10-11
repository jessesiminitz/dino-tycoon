/** Editable cartoon character curves and articulated poses; coordinates are world art units. */
export function drawCartoonRex(ctx: CanvasRenderingContext2D, frame: number, clip: string, baby: boolean): void {
  const ink = '#202019', body = baby ? '#a3c747' : '#95b82f', cream = '#ffe59a', dark = '#6d8c25';
  const phase = frame / 8 * Math.PI * 2;
  const wave = Math.sin(phase), breath = (1-Math.cos(phase))/2;
  const walking = clip === 'walk', resting = clip === 'rest';
  ctx.lineWidth = .9; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = ink;
  const path = (d: string, fill: string, stroke = true) => { const p = new Path2D(d);ctx.fillStyle=fill;ctx.fill(p);if(stroke)ctx.stroke(p); };
  const oval = (x:number,y:number,rx:number,ry:number,fill:string,stroke=true) => {
    ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();if(stroke)ctx.stroke();
  };
  const leg = (near: boolean) => {
    const p = phase + (near ? 0 : Math.PI), swing = walking ? Math.cos(p)*3 : 0;
    const lift = walking ? Math.max(0,-Math.sin(p))*3 : 0;
    ctx.save();ctx.translate(near?0:10, near?0:-1);
    // The hip stays attached while the ankle swings and the toes lift.
    path(`M 60 41 C 52 41 49 48 52 55 C 54 59 59 60 61 61 C ${63+swing} 63 ${59+swing} 67 ${57+swing} ${70-lift} C ${54+swing} ${73-lift} ${56+swing} ${76-lift} ${61+swing} ${76-lift} L ${75+swing} ${76-lift} Q ${79+swing} ${75-lift} ${76+swing} ${72-lift} L ${67+swing} ${69-lift} C ${70+swing} 63 76 57 75 50 C 74 44 67 40 60 41 Z`,near?body:dark);
    for(let i=0;i<3;i++) path(`M ${65+swing+i*4} ${73-lift} Q ${67+swing+i*4} ${71-lift} ${70+swing+i*4} ${76-lift} Q ${67+swing+i*4} ${77-lift} ${65+swing+i*4} ${73-lift} Z`,'#57534b');
    ctx.restore();
  };
  leg(false);
  // The complete torso and tail are one connected rounded silhouette.
  path(`M 9 ${33+wave*.6} C 27 33 38 32 50 29 C 57 26 66 25 75 30 C 86 33 92 42 88 49 C 81 59 70 61 56 56 C 37 49 23 39 9 ${33+wave*.6} Z`,body);
  path('M 10 34 C 28 38 45 42 56 43 C 69 46 79 47 88 43 C 91 51 82 58 70 58 C 49 55 28 41 10 34 Z',cream,false);
  // Sparse triangular markings retain the reference character’s broad color areas.
  path('M 37 32 Q 41 33 41 39 Q 37 37 37 32 Z',dark,false);
  path('M 48 30 Q 52 30 53 38 Q 48 36 48 30 Z',dark,false);
  path('M 61 28 Q 66 28 65 36 Q 61 35 61 28 Z',dark,false);
  leg(true);
  ctx.save();
  const angle = clip === 'eat' ? breath*.28 : resting ? .1 : wave*.02;
  ctx.translate(78,37);ctx.rotate(angle);ctx.translate(-78,-37);
  path('M 71 35 C 78 27 77 15 84 8 C 89 2 95 3 98 7 C 102 4 106 6 107 10 C 109 12 111 16 111 21 C 111 26 107 28 103 29 C 106 36 99 42 91 44 C 84 45 76 44 71 35 Z',body);
  path('M 81 29 C 86 30 90 30 94 28 C 97 27 102 27 104 29 C 111 34 102 42 92 43 C 85 44 79 41 77 38 Z',cream);
  // Wide smiling jaw, independently attached to the skull.
  if(!resting){
    path('M 91 25 Q 98 28 108 25 C 110 28 105 37 99 37 C 96 37 91 31 91 25 Z','#6e302c');
    path('M 97 32 Q 102 31 104 34 Q 102 37 99 36 Z','#ef9b94',false);
    for(let i=0;i<4;i++)path(`M ${94+i*3} 26 L ${97+i*3} 26 Q ${97+i*3} 30 ${96+i*3} 30 Q ${95+i*3} 30 ${94+i*3} 26 Z`,'#fff9df');
  }
  // Broad muzzle and enormous white eyes are the character's signature.
  path('M 91 15 C 97 14 103 15 109 16 C 113 16 114 20 112 25 C 110 28 105 28 99 27 L 92 26 C 88 26 88 20 91 15 Z',body);
  ctx.lineWidth=.7;
  oval(96,12,3.6,5.1,'#fffdf4');oval(91,11,4.2,5.6,'#fffdf4');
  if(resting){ctx.beginPath();ctx.moveTo(88,11);ctx.quadraticCurveTo(91,13,94,11);ctx.moveTo(94,13);ctx.lineTo(97,13);ctx.stroke();}
  else{oval(91.8,11.8,1.2,1.9,ink,false);oval(97,12.8,.9,1.5,ink,false);}
  oval(108,20,.8,1.2,ink,false);
  ctx.beginPath();ctx.moveTo(87,22);ctx.quadraticCurveTo(84,21,84,24);ctx.stroke();
  // Two tiny arms with two fingers each.
  ctx.lineWidth=.9;
  path('M 83 38 Q 78 42 81 46 Q 86 48 87 45 L 88 43 Q 87 42 86 44 L 85 46 Q 84 42 86 40 Z',body);
  ctx.beginPath();ctx.moveTo(85,45);ctx.lineTo(85,48);ctx.moveTo(87,44);ctx.lineTo(88,47);ctx.stroke();
  ctx.restore();
}
