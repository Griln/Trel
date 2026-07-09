'use strict';
// Brush library — reusable hand-tuned drawing primitives.
const { Skin, shade, mix } = require('../hand/paint');

const cl = v => v<0?0:v>255?255:v|0;
const lighten=(c,t)=>mix(c,[255,255,255,255],t);
const darken =(c,t)=>mix(c,[0,0,0,255],t);

// ---------------- HAIR ----------------
// style: 'short','swept','spiky','bob','long','ponytail','mohawk','bald'
function hair(s, col, style){
  const hi = lighten(col,0.28), dk = darken(col,0.25);
  if(style==='bald'){ return; }
  s.faceFill('head','top',col,7);
  for(let x=0;x<8;x++) s.px('head','top',x,0,hi);
  s.faceFill('head','back',col,7);
  // sides
  const sideRows = (style==='long'||style==='ponytail'||style==='bob')?8:(style==='short'?3:5);
  for(let y=0;y<sideRows;y++){ for(let x=0;x<8;x++){ s.px('head','right',x,y,col); s.px('head','left',x,y,col);} }
  // front fringe
  let fr=2;
  if(style==='swept'){ for(let x=0;x<8;x++) s.px('head','front',x,0,col); for(const x of [0,1,2,3,4]) s.px('head','front',x,1,col); s.px('head','front',5,1,hi); fr=1; }
  else if(style==='spiky'){ for(let x=0;x<8;x++) s.px('head','front',x,0,col); for(const x of [0,2,4,6]) s.px('head','front',x,1,dk); fr=1; }
  else if(style==='mohawk'){ for(const x of [3,4]) {s.px('head','front',x,0,col);} for(let x=0;x<8;x++){ if(x<3||x>4){/*shaved sides*/} } for(let y=0;y<sideRows;y++){for(let x=0;x<8;x++){s.px('head','right',x,y,[0,0,0,0]);s.px('head','left',x,y,[0,0,0,0]);}} for(const x of [3,4]) s.px('head','top',x,0,hi); fr=0; }
  else { for(let x=0;x<8;x++) s.px('head','front',x,0,col); for(let x=0;x<8;x++) s.px('head','front',x,1,col); }
  for(let y=fr;y<(style==='long'||style==='bob'?6:4);y++){ s.px('head','front',0,y,col); s.px('head','front',7,y,col); }
  if(fr>0){ s.px('head','front',2,fr-1,hi); s.px('head','front',5,fr-1,hi); }
  // long hair flows onto back of body
  if(style==='long'){ for(let y=0;y<6;y++){ s.px('body','back',0,y,col); s.px('body','back',7,y,col); s.px('body','back',1,y,dk); s.px('body','back',6,y,dk);} }
  if(style==='ponytail'){ for(let y=0;y<8;y++){ s.px('body','back',3,y,col); s.px('body','back',4,y,col);} s.px('body','back',3,0,hi); }
}

// ---------------- FACE ----------------
// opts: { skin, eye, mood:'neutral|fierce|soft|cool|happy', lashes:bool, visor:false|color, paint:false|color, mark:false|color }
function face(s, opts){
  const SK=opts.skin, SKD=shade(SK,0.74), eye=opts.eye||[80,200,255,255];
  const WHITE=[240,243,249,255], PUP=[20,18,28,255], brow=darken(opts.browCol||[60,55,60,255],0.1);
  // jaw shade
  for(let x=0;x<8;x++) s.px('head','front',x,7,SKD);
  s.px('head','front',4,5,SKD); // nose
  if(opts.visor){
    const b=opts.visor;
    for(let x=1;x<7;x++){ s.px('head','front',x,4,b); s.px('head','front',x,3,shade(b,0.65)); }
    s.px('head','front',2,4,lighten(b,0.7)); s.px('head','front',5,3,lighten(b,0.4));
  } else {
    // brows
    for(const x of [1,2]) s.px('head','front',x,2,brow);
    for(const x of [5,6]) s.px('head','front',x,2,brow);
    if(opts.mood==='fierce'){ s.px('head','front',2,2,brow); s.px('head','front',2,3,brow); s.px('head','front',5,3,brow); s.px('head','front',5,2,brow); }
    // eyes 2x2 each with sclera+iris+pupil+glint (ALWAYS a pupil dot)
    const drawEye=(ex,inner)=>{
      s.px('head','front',ex,3,WHITE); s.px('head','front',ex+1,3,WHITE);
      s.px('head','front',ex,4,WHITE); s.px('head','front',ex+1,4,WHITE);
      const pupilCell = inner, irisCell = inner===ex?ex+1:ex;
      s.px('head','front',irisCell,4,eye); s.px('head','front',irisCell,3,shade(eye,0.7));
      s.px('head','front',pupilCell,4,PUP);
      s.px('head','front',pupilCell,3,[255,255,255,255]);
    };
    drawEye(1,2); drawEye(5,5);
    if(opts.lashes){ s.px('head','front',0,3,brow); s.px('head','front',7,3,brow); s.px('head','front',0,4,mix(brow,SK,0.3)); s.px('head','front',7,4,mix(brow,SK,0.3)); }
    if(opts.mood==='cool'){ s.px('head','front',1,3,brow); s.px('head','front',2,3,brow); s.px('head','front',5,3,brow); s.px('head','front',6,3,brow); }
  }
  // mouth
  if(opts.mood==='happy'){ s.px('head','front',2,6,SKD); s.px('head','front',3,6,shade(SK,0.5)); s.px('head','front',4,6,shade(SK,0.5)); s.px('head','front',5,6,SKD); }
  else { s.px('head','front',3,6,shade(SK,0.5)); s.px('head','front',4,6,shade(SK,0.5)); }
  // cheeks / blush
  if(opts.mood==='soft'||opts.mood==='happy'){ const bl=mix(SK,[255,120,150,255],0.5); s.px('head','front',1,5,bl); s.px('head','front',6,5,bl); }
  // war paint / runic mark
  if(opts.paint){ s.px('head','front',0,4,opts.paint); s.px('head','front',7,4,opts.paint); s.px('head','front',1,5,opts.paint); s.px('head','front',6,5,opts.paint); }
  if(opts.mark){ s.px('head','front',6,5,opts.mark); s.px('head','front',6,6,opts.mark); }
}

module.exports = { Skin, shade, mix, lighten, darken, hair, face };
