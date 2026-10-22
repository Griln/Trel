'use strict';
const { Skin, shade, mix } = require('../../hand/paint');
const L=(c,t)=>mix(c,[255,255,255,255],t), D=(c,t)=>mix(c,[0,0,0,255],t);
const s=new Skin();
const BARK=[96,68,44,255],BARKH=[126,92,58,255],BARKD=[64,44,28,255]; // bark
const LEAF=[70,150,70,255],LEAFH=[100,190,96,255],LEAFD=[48,108,52,255];
const GLOW=[200,255,150,255]; // sap glow
const MOSS=[110,140,70,255];
// HEAD — treelike with a crown
s.cuboid('head',BARK,4);
// crown on top
s.faceFill('head','top',LEAF,4);for(let x=0;x<8;x++)s.px('head','top',x,0,LEAFH);
s.faceFill('head','back',BARKD,4);
for(let x=0;x<8;x++)s.px('head','front',x,0,LEAF);s.px('head','front',1,1,LEAFD);s.px('head','front',6,1,LEAFD);
// bark texture — vertical grooves
for(let x=0;x<8;x+=2)for(let y=2;y<8;y++)s.px('head','front',x,y,BARKD);
for(let x=1;x<8;x+=2)for(let y=2;y<8;y++)s.px('head','front',x,y,BARKH);
// moss on the cheek
s.px('head','front',6,5,MOSS);s.px('head','front',6,6,MOSS);s.px('head','front',1,6,MOSS);
// FACE — hollow glowing eyes
s.px('head','front',1,3,BARKD);s.px('head','front',2,3,BARKD);s.px('head','front',5,3,BARKD);s.px('head','front',6,3,BARKD);
s.px('head','front',1,4,GLOW);s.px('head','front',2,4,L(GLOW,0.3));s.px('head','front',5,4,L(GLOW,0.3));s.px('head','front',6,4,GLOW);
// cracked mouth
s.fill('head','front',2,6,4,1,BARKD);s.px('head','front',3,6,GLOW);s.px('head','front',4,6,GLOW);
// twig eyebrow
s.px('head','front',0,2,LEAFD);s.px('head','front',7,2,LEAFD);
// TORSO — trunk with branches
for(const p of ['body','rarm','larm','rleg','lleg'])s.cuboid(p,BARK,4);
// bark grooves
for(let x=0;x<8;x+=2)for(let y=0;y<12;y++)s.px('body','front',x,y,BARKD);
for(let x=1;x<8;x+=2)for(let y=0;y<12;y++)s.px('body','front',x,y,BARKH);
// glowing sap core
s.px('body','front',3,4,GLOW);s.px('body','front',4,4,L(GLOW,0.4));s.px('body','front',3,5,GLOW);s.px('body','front',4,5,GLOW);s.px('body','front',3,6,L(GLOW,0.3));s.px('body','front',4,6,GLOW);
s.px('body','front',3,3,GLOW);s.px('body','front',4,7,GLOW);
// moss and leaves on the shoulders
s.fill('body','front',0,0,8,1,LEAF);for(let x=0;x<8;x++)if(x%2)s.px('body','front',x,0,LEAFH);
s.px('body','front',1,2,MOSS);s.px('body','front',6,3,MOSS);s.px('body','front',2,8,LEAF);s.px('body','front',5,8,LEAF);
s.faceFill('body','back',BARKD,4);s.faceFill('body','top',LEAFD,4);
for(const a of ['rarm','larm']){
  for(let y=0;y<12;y++)s.px(a,'front',0,y,BARKD);for(let y=0;y<12;y++)s.px(a,'front',1,y,BARKH);for(let y=0;y<12;y++)s.px(a,'front',2,y,BARK);for(let y=0;y<12;y++)s.px(a,'front',3,y,BARKD);
  s.fill(a,'front',0,0,4,1,LEAF); // leaf shoulders
  s.px(a,'front',1,4,GLOW);s.px(a,'front',2,8,MOSS); // sap and moss
  s.px(a,'front',0,10,LEAFD);s.px(a,'front',3,10,LEAFD); // twig fingers
}
for(const l of ['rleg','lleg']){
  for(let y=0;y<12;y++){s.px(l,'front',0,y,BARKD);s.px(l,'front',1,y,BARKH);s.px(l,'front',2,y,BARK);s.px(l,'front',3,y,BARKD);}
  s.px(l,'front',1,5,GLOW);s.px(l,'front',2,8,MOSS);
  s.fill(l,'front',0,11,4,1,BARKD); // root feet
  s.px(l,'front',0,10,BARKD);s.px(l,'front',3,10,BARKD);
}
s.save(process.argv[2]);
module.exports={meta:{id:'fantasy-neutral-treant',nameRu:'Древесный Энт',nameEn:'Treant',role:'древний хранитель леса',style:'fantasy',gender:'neutral',model:'classic'}};
