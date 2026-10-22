'use strict';
const { Skin, shade, mix } = require('../../hand/paint');
const L=(c,t)=>mix(c,[255,255,255,255],t), D=(c,t)=>mix(c,[0,0,0,255],t);
const s=new Skin();
const SKIN=[222,184,158,255],SKD=shade(SKIN,0.78);
const STEEL=[176,184,196,255],STEELH=[214,220,228,255],STEELD=[120,128,140,255];
const EM=[40,200,120,255],EMD=shade([40,200,120,255],0.6);
const GOLD=[238,200,110,255];
const HAIR=[90,64,40,255];
// HEAD — open helmet with an emerald
s.cuboid('head',SKIN,5);s.fill('head','front',0,7,8,1,SKD);
s.faceFill('head','top',STEEL,5);s.faceFill('head','back',STEEL,5);
for(let x=0;x<8;x++)s.px('head','top',x,0,STEELH);
for(let x=0;x<8;x++)s.px('head','front',x,0,STEEL);
// helmet cheek guards
for(let y=0;y<6;y++){s.px('head','right',0,y,STEEL);s.px('head','right',1,y,STEELD);s.px('head','left',7,y,STEEL);s.px('head','left',6,y,STEELD);}
for(let y=1;y<6;y++){s.px('head','front',0,y,STEEL);s.px('head','front',7,y,STEEL);}
// brow guard + emerald
s.fill('head','front',1,1,6,1,STEELH);s.px('head','front',3,1,EM);s.px('head','front',4,1,L(EM,0.4));
// hair from under the helmet
s.px('head','front',2,2,HAIR);s.px('head','front',5,2,HAIR);
// FACE — noble
const Wt=[238,242,248,255];
for(const ex of [1,5]){s.px('head','front',ex,3,Wt);s.px('head','front',ex+1,3,Wt);s.px('head','front',ex,4,Wt);s.px('head','front',ex+1,4,Wt);}
s.px('head','front',1,4,EM);s.px('head','front',2,4,[40,40,50,255]);s.px('head','front',5,4,[40,40,50,255]);s.px('head','front',6,4,EM);
s.px('head','front',2,3,[255,255,255,255]);s.px('head','front',5,3,[255,255,255,255]);
s.px('head','front',4,5,SKD);s.px('head','front',3,6,shade(SKIN,0.55));s.px('head','front',4,6,shade(SKIN,0.55));
for(const x of [2,3,4,5])s.px('head','front',x,7,D(HAIR,0.1)); // beard
// TORSO — plate armor with a cape
for(const p of ['body','rarm','larm','rleg','lleg'])s.cuboid(p,STEEL,5);
s.fill('body','front',1,1,6,8,STEEL);s.fill('body','front',1,1,6,1,STEELH);
// chest plates
s.px('body','front',2,2,STEELH);s.px('body','front',5,2,STEELH);s.fill('body','front',1,5,6,1,STEELD);
// emerald heart gem in a gold setting
s.px('body','front',3,3,GOLD);s.px('body','front',4,3,GOLD);s.px('body','front',3,4,EM);s.px('body','front',4,4,L(EM,0.4));s.px('body','front',3,5,EMD);s.px('body','front',4,5,GOLD);
// cape at the edges (emerald)
for(let y=1;y<10;y++){s.px('body','front',0,y,EMD);s.px('body','front',7,y,EMD);}
s.px('body','front',0,1,EM);s.px('body','front',7,1,EM);
// gold belt
s.fill('body','front',1,9,6,1,GOLD);s.px('body','front',3,9,EM);s.px('body','front',4,9,EM);
s.faceFill('body','back',EMD,5);s.faceFill('body','top',STEELH,4); // cape at the back
for(const a of ['rarm','larm']){
  s.faceFill(a,'top',STEELH,4);
  s.fill(a,'front',0,0,4,3,STEEL);s.fill(a,'front',0,0,4,1,STEELH); // shoulder pad
  s.px(a,'front',1,1,EM);s.px(a,'front',2,1,EM);
  s.fill(a,'front',0,5,4,2,STEELD);s.fill(a,'front',0,4,4,1,GOLD); // vambrace
  s.fill(a,'front',0,8,4,4,STEEL);s.px(a,'front',1,9,GOLD);s.px(a,'front',2,9,GOLD); // armored glove
}
for(const l of ['rleg','lleg']){
  s.fill(l,'front',0,0,4,7,STEEL);s.fill(l,'front',0,4,4,1,GOLD); // greaves
  s.px(l,'front',1,2,STEELH);
  s.fill(l,'front',0,8,4,4,STEELD);s.fill(l,'front',0,8,4,1,GOLD); // sabatons
}
s.save(process.argv[2]);
module.exports={meta:{id:'fantasy-male-emerald-knight',nameRu:'Изумрудный Рыцарь',nameEn:'Emerald Knight',role:'паладин клятвы',style:'fantasy',gender:'male',model:'classic'}};
