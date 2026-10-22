'use strict';
const { Skin, shade, mix } = require('../../hand/paint');
const L=(c,t)=>mix(c,[255,255,255,255],t), D=(c,t)=>mix(c,[0,0,0,255],t);
const s=new Skin();
const BODY=[24,30,52,255],BODYH=[40,50,84,255];          // dark blue digital plane
const GRID=[60,255,200,255],GRIDD=shade([60,255,200,255],0.55); // turquoise code
const CYAN=[80,210,255,255];
// HEAD — holographic, made of code
s.cuboid('head',BODY,4);
s.faceFill('head','top',BODYH,4);s.faceFill('head','back',D(BODY,0.15),4);
// grid over the head
for(let y=0;y<8;y+=2)for(let x=0;x<8;x++)s.px('head','front',x,y,D(BODY,0.1));
for(let x=0;x<8;x+=2)for(let y=0;y<8;y++)s.px('head','front',x,y,D(BODY,0.1));
// FACE — data eyes + running digits
const Wt=[160,220,235,255];
for(const ex of [1,5]){s.px('head','front',ex,3,Wt);s.px('head','front',ex+1,3,Wt);s.px('head','front',ex,4,Wt);s.px('head','front',ex+1,4,Wt);}
s.px('head','front',1,4,GRID);s.px('head','front',2,4,CYAN);s.px('head','front',5,4,CYAN);s.px('head','front',6,4,GRID);
s.px('head','front',1,3,L(GRID,0.4));s.px('head','front',6,3,L(GRID,0.4));
// digit tracks on the cheeks
s.px('head','front',0,2,GRIDD);s.px('head','front',0,5,GRID);s.px('head','front',7,3,GRID);s.px('head','front',7,6,GRIDD);
s.px('head','front',3,6,GRIDD);s.px('head','front',4,6,GRIDD); // mouth line
// TORSO — body made of data streams
for(const p of ['body','rarm','larm','rleg','lleg'])s.cuboid(p,BODY,4);
// vertical code streams
for(const cx of [1,3,5,7]){for(let y=0;y<12;y++)s.px('body','front',cx,y, y%3? D(BODY,0.05):GRIDD);}
s.px('body','front',1,2,GRID);s.px('body','front',3,5,GRID);s.px('body','front',5,3,GRID);s.px('body','front',7,7,GRID);
// central data-heart core
s.px('body','front',3,4,L(GRID,0.5));s.px('body','front',4,4,GRID);s.px('body','front',3,5,GRID);s.px('body','front',4,5,CYAN);
s.faceFill('body','top',BODYH,4);s.faceFill('body','back',D(BODY,0.15),4);
for(const a of ['rarm','larm']){
  s.faceFill(a,'top',BODYH,4);
  for(let y=0;y<12;y++)s.px(a,'front',1,y, y%3?D(BODY,0.05):GRIDD);
  s.px(a,'front',2,3,GRID);s.px(a,'front',1,7,CYAN);
}
for(const l of ['rleg','lleg']){
  for(let y=0;y<12;y++)s.px(l,'front',1,y, y%3?D(BODY,0.05):GRIDD);
  s.px(l,'front',2,9,GRID);s.fill(l,'front',0,11,4,1,GRIDD);
}
s.save(process.argv[2]);
module.exports={meta:{id:'cyber-neutral-data-spirit',nameRu:'Дата-Дух',nameEn:'Data Spirit',role:'хранитель данных',style:'cyber',gender:'neutral',model:'classic'}};
