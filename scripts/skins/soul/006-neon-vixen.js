'use strict';
const { Skin, shade, mix } = require('../../hand/paint');
const L=(c,t)=>mix(c,[255,255,255,255],t), D=(c,t)=>mix(c,[0,0,0,255],t);
const s=new Skin();
const SKIN=[236,200,176,255],SKD=shade(SKIN,0.8);
const HAIR=[255,120,40,255],HAIRH=[255,170,90,255],HAIRD=shade([255,120,40,255],0.6); // fox-orange
const SUIT=[30,28,40,255],SUITH=[52,48,66,255];
const PINK=[255,60,150,255],PINKD=shade([255,60,150,255],0.6);
s.cuboid('head',SKIN,4);s.fill('head','front',0,7,8,1,SKD);
// long orange hair
s.faceFill('head','top',HAIR,6);s.faceFill('head','back',HAIR,6);
for(let x=0;x<8;x++)s.px('head','top',x,0,HAIRH);
for(let y=0;y<8;y++){for(let x=0;x<8;x++){s.px('head','right',x,y,HAIR);s.px('head','left',x,y,HAIR);}}
for(let x=0;x<8;x++)s.px('head','front',x,0,HAIR);
s.px('head','front',0,1,HAIR);s.px('head','front',1,1,HAIR);s.px('head','front',6,1,HAIR);s.px('head','front',7,1,HAIR);
for(let y=1;y<6;y++){s.px('head','front',0,y,HAIR);s.px('head','front',7,y,HAIR);}
// length down the back
for(let y=0;y<8;y++){s.px('body','back',0,y,HAIR);s.px('body','back',7,y,HAIR);s.px('body','back',1,y,HAIRD);s.px('body','back',6,y,HAIRD);}
// fox ears
s.px('hat','top',1,0,HAIR);s.px('hat','top',2,0,HAIRD);s.px('hat','top',5,0,HAIRD);s.px('hat','top',6,0,HAIR);
s.px('head','top',1,0,PINKD);s.px('head','top',6,0,PINKD);
// FACE — sly, eyelashes
const Wt=[240,243,249,255],P=[22,18,28,255];
s.px('head','front',1,2,HAIRD);s.px('head','front',6,2,HAIRD); // thin eyebrows
for(const ex of [1,5]){s.px('head','front',ex,3,Wt);s.px('head','front',ex+1,3,Wt);s.px('head','front',ex,4,Wt);s.px('head','front',ex+1,4,Wt);}
s.px('head','front',1,4,PINK);s.px('head','front',2,4,P);s.px('head','front',5,4,P);s.px('head','front',6,4,PINK);
s.px('head','front',2,3,[255,255,255,255]);s.px('head','front',5,3,[255,255,255,255]);
s.px('head','front',0,3,P);s.px('head','front',7,3,P); // eyelashes
s.px('head','front',4,5,SKD);
s.px('head','front',3,6,[210,90,110,255]);s.px('head','front',4,6,[210,90,110,255]); // lipstick
const bl=mix(SKIN,[255,120,150,255],0.4);s.px('head','front',1,5,bl);s.px('head','front',6,5,bl);
// TORSO — skintight suit with pink neon
for(const p of ['body','rarm','larm','rleg','lleg'])s.cuboid(p,SUIT,4);
s.fill('body','front',1,1,6,8,SUITH);
// neon contour lines
for(let y=1;y<9;y++)s.px('body','front',2,y,PINK);
for(let y=1;y<9;y++)s.px('body','front',5,y,HAIR);
s.px('body','front',3,4,L(PINK,0.4));s.px('body','front',4,4,PINK); // emblem
s.px('body','front',3,5,PINK);s.px('body','front',4,5,PINKD);
s.fill('body','front',0,10,8,1,D(SUIT,0.3));s.px('body','front',3,10,PINK);s.px('body','front',4,10,PINK);
s.faceFill('body','top',SUITH,3);s.faceFill('body','back',D(SUIT,0.2),4);
for(const a of ['rarm','larm']){
  s.faceFill(a,'top',SUITH,3);
  s.fill(a,'front',0,1,4,11,SUIT);
  for(let y=1;y<8;y++)s.px(a,'front',1,y,PINK);  // neon along the arm
  s.fill(a,'front',0,8,4,4,D(SUIT,0.15));s.px(a,'front',0,8,PINK);s.px(a,'front',3,8,PINK);
}
for(const l of ['rleg','lleg']){
  for(let y=0;y<7;y++)s.px(l,'front',1,y,HAIR); // neon stripes
  s.fill(l,'front',0,8,4,4,D(SUIT,0.2));s.fill(l,'front',0,11,4,1,PINK); // heeled boots
}
s.save(process.argv[2]);
module.exports={meta:{id:'cyber-female-neon-vixen',nameRu:'Неоновая Лиса',nameEn:'Neon Vixen',role:'хитрая воровка данных',style:'cyber',gender:'female',model:'classic'}};
