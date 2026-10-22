'use strict';
const { Skin, shade, mix } = require('../../hand/paint');
const L=(c,t)=>mix(c,[255,255,255,255],t), D=(c,t)=>mix(c,[0,0,0,255],t);
const s=new Skin();
const SKIN=[224,212,214,255],SKD=shade(SKIN,0.82);       // pale with a cold tint
const HAIR=[180,220,240,255],HAIRH=[225,245,255,255],HAIRD=[140,180,210,255]; // icy hair
const ROBE=[40,60,96,255],ROBEH=[64,92,140,255],ROBED=[28,42,70,255];
const ICE=[150,230,255,255],ICEH=[210,245,255,255];
const SILV=[200,210,225,255];
s.cuboid('head',SKIN,4);s.fill('head','front',0,7,8,1,SKD);
// long icy hair
s.faceFill('head','top',HAIR,4);s.faceFill('head','back',HAIR,4);
for(let x=0;x<8;x++)s.px('head','top',x,0,HAIRH);
for(let y=0;y<8;y++){for(let x=0;x<8;x++){s.px('head','right',x,y,HAIR);s.px('head','left',x,y,HAIR);}}
for(let x=0;x<8;x++)s.px('head','front',x,0,HAIR);
for(let y=1;y<6;y++){s.px('head','front',0,y,HAIR);s.px('head','front',7,y,HAIR);}
for(let y=0;y<8;y++){s.px('body','back',0,y,HAIR);s.px('body','back',7,y,HAIR);s.px('body','back',1,y,HAIRD);s.px('body','back',6,y,HAIRD);}
// icy crown of spikes
s.px('hat','top',1,0,ICE);s.px('hat','top',3,0,ICEH);s.px('hat','top',4,0,ICEH);s.px('hat','top',6,0,ICE);
s.px('head','front',3,0,ICEH);s.px('head','front',4,0,ICEH);
// FACE
s.px('head','front',1,2,HAIRD);s.px('head','front',6,2,HAIRD);
const Wt=[240,245,250,255];
for(const ex of [1,5]){s.px('head','front',ex,3,Wt);s.px('head','front',ex+1,3,Wt);s.px('head','front',ex,4,Wt);s.px('head','front',ex+1,4,Wt);}
s.px('head','front',1,4,ICE);s.px('head','front',2,4,[60,90,120,255]);s.px('head','front',5,4,[60,90,120,255]);s.px('head','front',6,4,ICE);
s.px('head','front',2,3,[255,255,255,255]);s.px('head','front',5,3,[255,255,255,255]);
s.px('head','front',0,3,[60,80,110,255]);s.px('head','front',7,3,[60,80,110,255]);
s.px('head','front',4,5,SKD);s.px('head','front',3,6,[170,130,150,255]);s.px('head','front',4,6,[170,130,150,255]);
// frost on the cheeks
s.px('head','front',1,5,ICEH);s.px('head','front',6,5,ICEH);
// TORSO — frost mantle
for(const p of ['body','rarm','larm','rleg','lleg'])s.cuboid(p,ROBE,4);
s.fill('body','front',0,0,8,12,ROBE);
// silver snowflake collar
for(let x=2;x<6;x++)s.px('body','front',x,0,SILV);s.px('body','front',3,1,ICE);s.px('body','front',4,1,ICE);
// frosty blizzard patterns
for(const [x,y] of [[1,3],[6,3],[2,5],[5,5],[1,7],[6,7],[3,6],[4,6]])s.px('body','front',x,y,ICE);
for(const [x,y] of [[2,4],[5,4],[3,8],[4,8]])s.px('body','front',x,y,ICEH);
// ice crystal heart
s.px('body','front',3,3,ICEH);s.px('body','front',4,3,ICE);s.px('body','front',3,4,ICE);s.px('body','front',4,4,L(ICE,0.4));s.px('body','front',3,5,ICE);s.px('body','front',4,5,ICEH);
// silver sash
s.fill('body','front',0,9,8,1,SILV);s.px('body','front',3,9,ICE);s.px('body','front',4,9,ICE);
// icicle hem
for(let x=0;x<8;x++)s.px('body','front',x,11, x%2?ICE:ROBED);
s.faceFill('body','back',ROBED,4);s.faceFill('body','top',ROBEH,4);
for(const a of ['rarm','larm']){
  s.fill(a,'front',0,0,4,12,ROBE);s.fill(a,'front',0,0,4,1,ROBEH);
  s.px(a,'front',1,3,ICE);s.px(a,'front',2,6,ICEH);s.px(a,'front',1,9,ICE);
  s.fill(a,'front',0,9,4,3,ROBED);s.fill(a,'front',0,8,4,1,SILV); // cuff
  s.px(a,'front',1,10,ICEH);s.px(a,'front',2,10,ICEH); // frost on the hand
}
for(const l of ['rleg','lleg']){
  s.fill(l,'front',0,0,4,9,ROBE);for(let y=0;y<9;y++)s.px(l,'front',0,y,ROBED);
  s.px(l,'front',1,3,ICE);s.px(l,'front',2,6,ICEH);
  s.fill(l,'front',0,9,4,3,ROBED);s.px(l,'front',1,11,ICE);
}
s.save(process.argv[2]);
module.exports={meta:{id:'fantasy-female-frost-witch',nameRu:'Ледяная Колдунья',nameEn:'Frost Witch',role:'госпожа вечной зимы',style:'fantasy',gender:'female',model:'slim'}};
