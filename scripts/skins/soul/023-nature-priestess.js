'use strict';
const { Skin, shade, mix } = require('../../hand/paint');
const L=(c,t)=>mix(c,[255,255,255,255],t), D=(c,t)=>mix(c,[0,0,0,255],t);
const s=new Skin();
const SKIN=[200,158,124,255],SKD=shade(SKIN,0.78);       // warm tan
const HAIR=[80,52,30,255],HAIRH=[112,76,44,255];          // chestnut
const ROBE=[80,140,90,255],ROBEH=[110,176,118,255],ROBED=[54,100,64,255];
const FLOW=[255,150,190,255],FLOWY=[255,225,120,255];     // flowers
const WOOD=[140,100,60,255];
const GLOW=[180,255,160,255];
s.cuboid('head',SKIN,4);s.fill('head','front',0,7,8,1,SKD);
// chestnut hair with flowers
s.faceFill('head','top',HAIR,4);s.faceFill('head','back',HAIR,4);
for(let x=0;x<8;x++)s.px('head','top',x,0,HAIRH);
for(let y=0;y<8;y++){for(let x=0;x<8;x++){s.px('head','right',x,y,HAIR);s.px('head','left',x,y,HAIR);}}
for(let x=0;x<8;x++)s.px('head','front',x,0,HAIR);
for(let y=1;y<6;y++){s.px('head','front',0,y,HAIR);s.px('head','front',7,y,HAIR);}
for(let y=0;y<8;y++){s.px('body','back',0,y,HAIR);s.px('body','back',7,y,HAIR);}
// wreath of flowers
s.fill('head','front',1,1,6,1,ROBE);s.px('head','front',2,1,FLOW);s.px('head','front',4,1,FLOWY);s.px('head','front',5,0,FLOW);s.px('head','front',2,0,FLOWY);
// FACE — kindly
s.px('head','front',1,2,HAIRH);s.px('head','front',6,2,HAIRH);
const Wt=[240,243,249,255];
for(const ex of [1,5]){s.px('head','front',ex,3,Wt);s.px('head','front',ex+1,3,Wt);s.px('head','front',ex,4,Wt);s.px('head','front',ex+1,4,Wt);}
s.px('head','front',1,4,[90,160,90,255]);s.px('head','front',2,4,[40,60,40,255]);s.px('head','front',5,4,[40,60,40,255]);s.px('head','front',6,4,[90,160,90,255]);
s.px('head','front',2,3,[255,255,255,255]);s.px('head','front',5,3,[255,255,255,255]);
s.px('head','front',4,5,SKD);s.px('head','front',3,6,[200,120,110,255]);s.px('head','front',4,6,[200,120,110,255]);
const bl=mix(SKIN,[255,150,150,255],0.35);s.px('head','front',1,5,bl);s.px('head','front',6,5,bl);
// leaf tattoo on the cheek
s.px('head','front',6,5,GLOW);
// TORSO — nature robe
for(const p of ['body','rarm','larm','rleg','lleg'])s.cuboid(p,ROBE,4);
s.fill('body','front',0,0,8,12,ROBE);
// floral collar
for(let x=1;x<7;x++)s.px('body','front',x,1, x%3? ROBEH: FLOW);
// vines across the torso
s.px('body','front',2,2,ROBED);s.px('body','front',2,3,ROBED);s.px('body','front',3,4,ROBED);s.px('body','front',2,5,GLOW);
s.px('body','front',5,2,ROBED);s.px('body','front',5,3,ROBED);s.px('body','front',4,4,ROBED);s.px('body','front',5,5,GLOW);
// flowers on the vines
s.px('body','front',1,4,FLOW);s.px('body','front',6,4,FLOWY);s.px('body','front',2,7,FLOWY);s.px('body','front',5,7,FLOW);
// glowing wooden seed amulet
s.px('body','front',3,4,WOOD);s.px('body','front',4,4,WOOD);s.px('body','front',3,5,GLOW);s.px('body','front',4,5,L(GLOW,0.4));
// woven belt
s.fill('body','front',0,9,8,1,WOOD);s.px('body','front',3,9,FLOW);s.px('body','front',4,9,FLOWY);
// leaf hem
for(let x=0;x<8;x++)s.px('body','front',x,11, x%2?ROBEH:ROBED);
s.faceFill('body','back',ROBED,4);s.faceFill('body','top',ROBEH,4);
for(const a of ['rarm','larm']){
  s.fill(a,'front',0,0,4,4,ROBE);s.px(a,'front',1,1,FLOW);
  s.fill(a,'front',0,4,4,3,SKIN); // bare forearm
  s.px(a,'front',1,5,ROBED);s.px(a,'front',2,5,GLOW); // vine tattoo
  s.fill(a,'front',0,7,4,1,WOOD); // bracelet
  s.fill(a,'front',0,8,4,4,SKIN);
}
for(const l of ['rleg','lleg']){
  s.fill(l,'front',0,0,4,8,ROBE);for(let y=0;y<8;y++)s.px(l,'front',0,y,ROBED);
  s.px(l,'front',1,3,FLOW);s.px(l,'front',2,6,GLOW);
  s.fill(l,'front',0,8,4,4,WOOD);s.fill(l,'front',0,8,4,1,ROBEH); // wooden sandals
}
s.save(process.argv[2]);
module.exports={meta:{id:'fantasy-female-nature-priestess',nameRu:'Жрица Природы',nameEn:'Nature Priestess',role:'друид, целительница рощ',style:'fantasy',gender:'female',model:'slim'}};
