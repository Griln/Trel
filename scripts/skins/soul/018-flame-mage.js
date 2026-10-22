'use strict';
const { Skin, shade, mix } = require('../../hand/paint');
const L=(c,t)=>mix(c,[255,255,255,255],t), D=(c,t)=>mix(c,[0,0,0,255],t);
const s=new Skin();
const SKIN=[216,176,148,255],SKD=shade(SKIN,0.78);
const ROBE=[120,30,30,255],ROBEH=[160,50,40,255],ROBED=[80,20,22,255]; // crimson robe
const FIRE=[255,150,40,255],FIREH=[255,220,90,255];
const GOLD=[240,200,110,255];
const HAIR=[210,210,215,255],HAIRD=[170,170,180,255]; // grey
s.cuboid('head',SKIN,5);s.fill('head','front',0,7,8,1,SKD);
// long grey hair
s.faceFill('head','top',HAIR,5);s.faceFill('head','back',HAIR,5);
for(let x=0;x<8;x++)s.px('head','top',x,0,L(HAIR,0.2));
for(let y=0;y<8;y++){s.px('head','right',0,y,HAIR);s.px('head','right',1,y,HAIRD);s.px('head','left',7,y,HAIR);s.px('head','left',6,y,HAIRD);}
s.px('head','front',0,1,HAIR);s.px('head','front',7,1,HAIR);s.px('head','front',0,2,HAIR);s.px('head','front',7,2,HAIR);
for(let x=0;x<8;x++)s.px('head','front',x,0,HAIR);
s.px('head','front',1,1,HAIRD);s.px('head','front',6,1,HAIRD);
// FACE — a sage with fiery eyes
const Wt=[238,242,248,255];
for(const ex of [1,5]){s.px('head','front',ex,3,Wt);s.px('head','front',ex+1,3,Wt);s.px('head','front',ex,4,Wt);s.px('head','front',ex+1,4,Wt);}
s.px('head','front',1,4,FIRE);s.px('head','front',2,4,FIREH);s.px('head','front',5,4,FIREH);s.px('head','front',6,4,FIRE);
s.px('head','front',1,3,L(FIRE,0.4));s.px('head','front',6,3,L(FIRE,0.4));
s.px('head','front',4,5,SKD);
// long grey beard
s.fill('head','front',2,6,4,2,HAIR);s.px('head','front',3,7,HAIRD);s.px('head','front',4,7,HAIRD);
s.px('head','front',3,6,SKD);s.px('head','front',4,6,SKD); // mouth
// TORSO — wizard robe with fiery runes
for(const p of ['body','rarm','larm','rleg','lleg'])s.cuboid(p,ROBE,5);
s.fill('body','front',0,0,8,12,ROBE);
// gold V-collar
s.px('body','front',2,0,GOLD);s.px('body','front',5,0,GOLD);s.px('body','front',3,1,GOLD);s.px('body','front',4,1,GOLD);
// the beard continues onto the chest
s.fill('body','front',3,0,2,2,HAIR);
// vertical fiery runes
for(const [x,y] of [[1,3],[6,3],[2,5],[5,5],[3,7],[4,7],[1,8],[6,8]])s.px('body','front',x,y,FIRE);
for(const [x,y] of [[1,4],[6,4],[3,8],[4,8]])s.px('body','front',x,y,FIREH);
// central flame amulet
s.px('body','front',3,4,GOLD);s.px('body','front',4,4,GOLD);s.px('body','front',3,5,FIREH);s.px('body','front',4,5,FIRE);s.px('body','front',3,6,FIRE);s.px('body','front',4,6,FIREH);
// gold sash
s.fill('body','front',0,9,8,1,GOLD);s.px('body','front',3,9,FIRE);s.px('body','front',4,9,FIRE);
// hem with fire
for(let x=0;x<8;x++)s.px('body','front',x,11, x%2?FIRE:ROBED);
s.faceFill('body','back',ROBED,5);s.faceFill('body','top',ROBEH,4);
for(const a of ['rarm','larm']){
  s.fill(a,'front',0,0,4,12,ROBE); // long sleeve
  s.fill(a,'front',0,0,4,1,ROBEH);
  s.px(a,'front',1,3,FIRE);s.px(a,'front',2,6,FIREH);s.px(a,'front',1,9,FIRE); // runes on the sleeve
  s.fill(a,'front',0,8,4,4,GOLD); // fiery cuff-glove
  s.fill(a,'front',0,10,4,2,FIRE);s.px(a,'front',1,11,FIREH);s.px(a,'front',2,11,FIREH);
}
for(const l of ['rleg','lleg']){
  s.fill(l,'front',0,0,4,9,ROBE);for(let y=0;y<9;y++)s.px(l,'front',0,y,ROBED);
  s.px(l,'front',1,3,FIRE);s.px(l,'front',2,6,FIREH);
  s.fill(l,'front',0,9,4,3,D([60,40,30,255],0.1));s.fill(l,'front',0,9,4,1,GOLD); // shoes
}
s.save(process.argv[2]);
module.exports={meta:{id:'fantasy-male-flame-mage',nameRu:'Огненный Маг',nameEn:'Flame Mage',role:'архимаг пламени',style:'fantasy',gender:'male',model:'classic'}};
