'use strict';
const { Skin, shade, mix } = require('../../hand/paint');
const L=(c,t)=>mix(c,[255,255,255,255],t), D=(c,t)=>mix(c,[0,0,0,255],t);
const s=new Skin();
const SKIN=[200,160,135,255],SKD=shade(SKIN,0.78);
const HOOD=[26,32,30,255],HOODH=[44,54,50,255];          // dark green hoodie
const MTX=[60,255,140,255],MTXD=shade([60,255,140,255],0.55); // matrix green
const HAIR=[40,38,42,255];
// HEAD (hood pulled up)
s.cuboid('head',SKIN,5);s.fill('head','front',0,7,8,1,SKD);
// the hood covers the top and sides of the head
s.faceFill('head','top',HOOD,5);s.faceFill('head','back',HOOD,5);
for(let x=0;x<8;x++)s.px('head','top',x,0,HOODH);
for(let y=0;y<8;y++){for(let x=0;x<8;x++){s.px('head','right',x,y,HOOD);s.px('head','left',x,y,HOOD);}}
for(let x=0;x<8;x++)s.px('head','front',x,0,HOOD);        // hood edge
for(let x=0;x<8;x++)s.px('head','front',x,1,HOOD);
s.px('head','front',0,2,HOOD);s.px('head','front',7,2,HOOD);
// fringe from under the hood
s.px('head','front',2,1,HAIR);s.px('head','front',5,1,HAIR);
// FACE — in the hood's shadow, glowing eyes
const Wt=[210,225,215,255],P=[16,22,18,255];
for(const ex of [1,5]){s.px('head','front',ex,3,Wt);s.px('head','front',ex+1,3,Wt);s.px('head','front',ex,4,Wt);s.px('head','front',ex+1,4,Wt);}
s.px('head','front',1,4,MTX);s.px('head','front',2,4,MTXD);s.px('head','front',5,4,MTXD);s.px('head','front',6,4,MTX); // fully glowing eyes
s.px('head','front',2,3,L(MTX,0.4));s.px('head','front',5,3,L(MTX,0.4));
// hood shadow on the upper face
for(let x=1;x<7;x++)s.px('head','front',x,2,shade(SKIN,0.6));
s.px('head','front',4,5,SKD);s.px('head','front',3,6,shade(SKIN,0.5));s.px('head','front',4,6,shade(SKIN,0.5));
// TORSO — hoodie with a matrix stream
for(const p of ['body','rarm','larm','rleg','lleg'])s.cuboid(p,HOOD,5);
// kangaroo pocket
s.fill('body','front',1,6,6,3,HOODH);s.fill('body','front',1,6,6,1,D(HOOD,0.2));
// hoodie drawstrings
s.px('body','front',3,0,L(HOOD,0.3));s.px('body','front',4,0,L(HOOD,0.3));s.px('body','front',3,1,MTXD);s.px('body','front',4,1,MTXD);
// falling code matrix on the torso
const cols=[[2,1,5],[4,2,7],[6,3,8]];
for(const [cx,y0,y1] of cols){for(let y=y0;y<y1;y++)s.px('body','front',cx,y, y===y0?L(MTX,0.4):MTXD);} 
s.px('body','front',2,3,MTX);s.px('body','front',4,4,MTX);s.px('body','front',6,5,MTX);
// hoodie bottom cuff
s.fill('body','front',0,9,8,1,D(HOOD,0.25));
s.faceFill('body','top',HOODH,4);s.faceFill('body','back',D(HOOD,0.15),5);
// ARMS — hoodie sleeves + matrix stripe + fingerless gloves
for(const a of ['rarm','larm']){
  s.faceFill(a,'top',HOODH,4);
  s.fill(a,'front',0,7,4,1,D(HOOD,0.25));        // cuff
  s.px(a,'front',0,3,MTXD);s.px(a,'front',3,5,MTXD); // code sparks
  s.fill(a,'front',0,8,4,4,D(HOOD,0.1));          // glove
  s.px(a,'front',0,8,MTX);s.px(a,'front',3,8,MTX); // green knuckles
}
// LEGS — cargo pants + sneakers with green soles
for(const l of ['rleg','lleg']){
  s.fill(l,'front',0,2,4,2,HOODH);               // pocket
  s.fill(l,'front',0,9,4,3,D(HOOD,0.2));          // sneaker
  s.fill(l,'front',0,11,4,1,MTXD);               // glowing sole
}
s.save(process.argv[2]);
module.exports={meta:{id:'cyber-male-pulse-hacker',nameRu:'Импульсный Хакер',nameEn:'Pulse Hacker',role:'взломщик сетей',style:'cyber',gender:'male',model:'classic'}};
