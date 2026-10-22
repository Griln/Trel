'use strict';
const { Skin, shade, mix } = require('../../hand/paint');
const L=(c,t)=>mix(c,[255,255,255,255],t), D=(c,t)=>mix(c,[0,0,0,255],t);
const s=new Skin();
const SKIN=[232,198,178,255],SKD=shade(SKIN,0.8);
const HAIR=[230,235,240,255],HAIRD=[180,190,205,255];
const ROBE=[236,240,248,255],ROBEH=[255,255,255,255],ROBES=[200,210,225,255]; // white robe
const CYAN=[60,220,255,255],CYAND=shade([60,220,255,255],0.6);
const GOLD=[240,205,120,255];
s.cuboid('head',SKIN,4);s.fill('head','front',0,7,8,1,SKD);
// long white hair
s.faceFill('head','top',HAIR,4);s.faceFill('head','back',HAIR,4);
for(let y=0;y<8;y++){for(let x=0;x<8;x++){s.px('head','right',x,y,HAIR);s.px('head','left',x,y,HAIR);}}
for(let x=0;x<8;x++)s.px('head','front',x,0,HAIR);
for(let y=1;y<6;y++){s.px('head','front',0,y,HAIR);s.px('head','front',7,y,HAIR);}
for(let y=0;y<8;y++){s.px('body','back',0,y,HAIR);s.px('body','back',7,y,HAIR);s.px('body','back',1,y,HAIRD);s.px('body','back',6,y,HAIRD);}
// halo ring
for(let x=1;x<7;x++)s.px('hat','top',x,0,CYAN);
s.px('hat','top',0,0,GOLD);s.px('hat','top',7,0,GOLD);
// FACE — serene, cyan mark on the forehead
s.px('head','front',3,1,CYAN);s.px('head','front',4,1,CYAND);
s.px('head','front',1,2,HAIRD);s.px('head','front',6,2,HAIRD);
const Wt=[240,243,249,255],P=[22,20,28,255];
for(const ex of [1,5]){s.px('head','front',ex,3,Wt);s.px('head','front',ex+1,3,Wt);s.px('head','front',ex,4,Wt);s.px('head','front',ex+1,4,Wt);}
s.px('head','front',1,4,CYAN);s.px('head','front',2,4,P);s.px('head','front',5,4,P);s.px('head','front',6,4,CYAN);
s.px('head','front',2,3,[255,255,255,255]);s.px('head','front',5,3,[255,255,255,255]);
s.px('head','front',0,3,P);s.px('head','front',7,3,P);
s.px('head','front',4,5,SKD);s.px('head','front',3,6,[210,140,140,255]);s.px('head','front',4,6,[210,140,140,255]);
// TORSO — white robe with gold and cyan runes
for(const p of ['body','rarm','larm','rleg','lleg'])s.cuboid(p,ROBE,3);
s.fill('body','front',0,0,8,12,ROBE);
s.fill('body','front',0,0,8,1,ROBEH);
// gold collar-shoulder piece
for(let x=1;x<7;x++)s.px('body','front',x,1,GOLD);
s.px('body','front',2,2,GOLD);s.px('body','front',5,2,GOLD);
// central cyan rune (data cross)
s.fill('body','front',3,3,2,6,CYAND);s.fill('body','front',2,5,4,2,CYAND);
s.px('body','front',3,4,CYAN);s.px('body','front',4,6,CYAN);s.px('body','front',3,7,CYAN);
// gold belt
s.fill('body','front',0,9,8,1,GOLD);s.px('body','front',3,9,CYAN);s.px('body','front',4,9,CYAN);
// shadows of the robe folds
for(let y=2;y<9;y++){s.px('body','front',1,y,ROBES);s.px('body','front',6,y,ROBES);}
s.faceFill('body','top',ROBEH,2);s.faceFill('body','back',ROBES,3);
// wide robe sleeves
for(const a of ['rarm','larm']){
  s.cuboid(a,ROBE,3);
  s.fill(a,'front',0,0,4,12,ROBE);
  s.fill(a,'front',0,8,4,4,ROBES); // flared cuff
  s.fill(a,'front',0,8,4,1,GOLD);
  s.px(a,'front',1,10,CYAND);s.px(a,'front',2,10,CYAND);
}
for(const l of ['rleg','lleg']){
  s.fill(l,'front',0,0,4,9,ROBE); // hem
  for(let y=0;y<9;y++)s.px(l,'front',0,y,ROBES);
  s.fill(l,'front',0,9,4,3,GOLD);s.px(l,'front',1,10,CYAN);
}
s.save(process.argv[2]);
module.exports={meta:{id:'cyber-female-cyber-priestess',nameRu:'Кибер-Жрица',nameEn:'Cyber Priestess',role:'жрица сети',style:'cyber',gender:'female',model:'classic'}};
