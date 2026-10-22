'use strict';
const { Skin, shade, mix } = require('../../hand/paint');
const L=(c,t)=>mix(c,[255,255,255,255],t), D=(c,t)=>mix(c,[0,0,0,255],t);
const s=new Skin();
const SKIN=[228,192,168,255],SKD=shade(SKIN,0.8);
const HAIR=[90,200,255,255],HAIRH=[160,230,255,255],HAIRD=shade([90,200,255,255],0.6); // electric blue
const SUIT=[28,30,44,255],SUITH=[48,52,72,255];
const ELEC=[120,235,255,255],ELECD=shade([120,235,255,255],0.6);
const PUR=[150,90,255,255];
s.cuboid('head',SKIN,4);s.fill('head','front',0,7,8,1,SKD);
// high ponytail
s.faceFill('head','top',HAIR,5);s.faceFill('head','back',HAIR,5);
for(let x=0;x<8;x++)s.px('head','top',x,0,HAIRH);
for(let y=0;y<5;y++){for(let x=0;x<8;x++){s.px('head','right',x,y,HAIR);s.px('head','left',x,y,HAIR);}}
for(let x=0;x<8;x++)s.px('head','front',x,0,HAIR);
s.px('head','front',0,1,HAIR);s.px('head','front',7,1,HAIR);
s.px('head','front',2,1,HAIRH);s.px('head','front',5,1,HAIRH);
// ponytail down the back
for(let y=0;y<9;y++){s.px('body','back',3,y,HAIR);s.px('body','back',4,y,HAIR);}
s.px('body','back',3,0,HAIRH);for(let y=2;y<9;y+=2){s.px('body','back',3,y,HAIRD);}
// FACE
s.px('head','front',1,2,HAIRD);s.px('head','front',6,2,HAIRD);
const Wt=[240,243,249,255],P=[20,18,30,255];
for(const ex of [1,5]){s.px('head','front',ex,3,Wt);s.px('head','front',ex+1,3,Wt);s.px('head','front',ex,4,Wt);s.px('head','front',ex+1,4,Wt);}
s.px('head','front',1,4,ELEC);s.px('head','front',2,4,P);s.px('head','front',5,4,P);s.px('head','front',6,4,ELEC);
s.px('head','front',2,3,[255,255,255,255]);s.px('head','front',5,3,[255,255,255,255]);
s.px('head','front',0,3,P);s.px('head','front',7,3,P);
s.px('head','front',4,5,SKD);s.px('head','front',3,6,[210,120,130,255]);s.px('head','front',4,6,[210,120,130,255]);
// lightning tattoo under the eye
s.px('head','front',1,5,ELEC);s.px('head','front',0,4,ELECD);
// TORSO — bodysuit with current arcs
for(const p of ['body','rarm','larm','rleg','lleg'])s.cuboid(p,SUIT,4);
s.fill('body','front',1,1,6,8,SUITH);
// coils on the chest
s.px('body','front',3,3,ELEC);s.px('body','front',4,3,ELEC);s.px('body','front',3,4,L(ELEC,0.4));s.px('body','front',4,4,ELEC);
// current arcs in a zigzag
s.px('body','front',2,2,ELEC);s.px('body','front',1,3,PUR);s.px('body','front',2,4,ELEC);s.px('body','front',1,5,ELEC);
s.px('body','front',5,2,ELEC);s.px('body','front',6,3,PUR);s.px('body','front',5,4,ELEC);s.px('body','front',6,5,ELEC);
s.px('body','front',3,6,PUR);s.px('body','front',4,7,ELEC);
s.fill('body','front',0,10,8,1,D(SUIT,0.3));s.px('body','front',3,10,ELEC);s.px('body','front',4,10,ELEC);
s.faceFill('body','top',SUITH,3);s.faceFill('body','back',D(SUIT,0.2),4);
for(const a of ['rarm','larm']){
  s.faceFill(a,'top',SUITH,3);
  s.px(a,'front',1,2,ELEC);s.px(a,'front',2,3,PUR);s.px(a,'front',1,5,ELEC); // arcs
  s.fill(a,'front',0,7,4,1,ELECD);
  s.fill(a,'front',0,8,4,4,D(SUIT,0.15));s.px(a,'front',0,8,ELEC);s.px(a,'front',3,8,ELEC);
}
for(const l of ['rleg','lleg']){
  for(let y=0;y<7;y++)s.px(l,'front',1,y,ELECD);
  s.fill(l,'front',0,8,4,4,D(SUIT,0.2));s.fill(l,'front',0,11,4,1,ELEC);
}
s.save(process.argv[2]);
module.exports={meta:{id:'cyber-female-electra',nameRu:'Электра',nameEn:'Electra',role:'повелительница тока',style:'cyber',gender:'female',model:'classic'}};
