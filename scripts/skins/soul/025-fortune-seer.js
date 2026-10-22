'use strict';
const { Skin, shade, mix } = require('../../hand/paint');
const L=(c,t)=>mix(c,[255,255,255,255],t), D=(c,t)=>mix(c,[0,0,0,255],t);
const s=new Skin();
const SKIN=[196,150,116,255],SKD=shade(SKIN,0.78);       // tan
const HAIR=[34,26,30,255],HAIRH=[60,48,52,255];           // black curls
const SHAWL=[150,40,110,255],SHAWLH=[190,64,140,255],SHAWLD=[104,28,78,255]; // purple shawl
const GOLD=[245,205,110,255];
const MYST=[150,120,255,255]; // mystical glow
s.cuboid('head',SKIN,4);s.fill('head','front',0,7,8,1,SKD);
// headscarf over the curls
s.faceFill('head','top',SHAWL,4);s.faceFill('head','back',SHAWL,4);
for(let x=0;x<8;x++)s.px('head','top',x,0,SHAWLH);
for(let y=0;y<7;y++){s.px('head','right',0,y,SHAWL);s.px('head','left',7,y,SHAWL);}
for(let x=0;x<8;x++)s.px('head','front',x,0,SHAWL);
s.px('head','front',0,1,SHAWL);s.px('head','front',7,1,SHAWL);
// gold coin trim along the scarf edge
for(let x=1;x<7;x++)s.px('head','front',x,1, x%2?GOLD:SHAWLD);
// curls from under the headscarf
s.px('head','front',1,2,HAIR);s.px('head','front',6,2,HAIR);
for(let y=2;y<6;y++){s.px('head','right',1,y,HAIR);s.px('head','left',6,y,HAIR);}
// FACE — mysterious
const Wt=[240,243,249,255];
for(const ex of [1,5]){s.px('head','front',ex,3,Wt);s.px('head','front',ex+1,3,Wt);s.px('head','front',ex,4,Wt);s.px('head','front',ex+1,4,Wt);}
s.px('head','front',1,4,MYST);s.px('head','front',2,4,[40,30,40,255]);s.px('head','front',5,4,[40,30,40,255]);s.px('head','front',6,4,MYST);
s.px('head','front',2,3,[255,255,255,255]);s.px('head','front',5,3,[255,255,255,255]);
s.px('head','front',0,3,[30,20,30,255]);s.px('head','front',7,3,[30,20,30,255]); // eyelashes
s.px('head','front',4,5,SKD);s.px('head','front',3,6,[180,70,90,255]);s.px('head','front',4,6,[180,70,90,255]);
const bl=mix(SKIN,[220,100,120,255],0.35);s.px('head','front',1,5,bl);s.px('head','front',6,5,bl);
// gold earring
s.px('head','right',1,5,GOLD);s.px('head','left',6,5,GOLD);
// TORSO — layered gypsy outfit
for(const p of ['body','rarm','larm','rleg','lleg'])s.cuboid(p,SHAWL,4);
s.fill('body','front',0,0,8,12,SHAWL);
// low-cut blouse
s.fill('body','front',2,1,4,3,[230,210,180,255]);s.px('body','front',3,1,SKIN);s.px('body','front',4,1,SKIN);
// gold coin necklace
for(let x=2;x<6;x++)s.px('body','front',x,2,GOLD);s.px('body','front',3,3,GOLD);s.px('body','front',4,3,GOLD);
// paisley patterns on the shawl
for(const [x,y] of [[1,3],[6,3],[1,6],[6,6],[2,8],[5,8]])s.px('body','front',x,y,GOLD);
for(const [x,y] of [[1,4],[6,4],[2,7],[5,7]])s.px('body','front',x,y,SHAWLH);
// glowing crystal ball amulet
s.px('body','front',3,5,MYST);s.px('body','front',4,5,L(MYST,0.4));s.px('body','front',3,6,MYST);s.px('body','front',4,6,SHAWLD);
// bright sash
s.fill('body','front',0,8,8,1,GOLD);s.fill('body','front',0,9,8,1,SHAWLD);
// layered skirt hem
for(let x=0;x<8;x++)s.px('body','front',x,10, x%2?SHAWLH:GOLD);
for(let x=0;x<8;x++)s.px('body','front',x,11, x%2?SHAWLD:SHAWL);
s.faceFill('body','back',SHAWLD,4);s.faceFill('body','top',SHAWLH,4);
for(const a of ['rarm','larm']){
  s.fill(a,'front',0,0,4,3,SHAWL);s.px(a,'front',1,1,GOLD);
  s.fill(a,'front',0,3,4,3,[230,210,180,255]); // blouse sleeve
  s.px(a,'front',0,5,GOLD);s.px(a,'front',3,5,GOLD); // bracelets
  s.fill(a,'front',0,6,4,1,GOLD);
  s.fill(a,'front',0,7,4,5,SKIN); // bare arm
  s.px(a,'front',0,8,GOLD);s.px(a,'front',3,8,GOLD);s.px(a,'front',1,10,MYST); // rings
}
for(const l of ['rleg','lleg']){
  for(let y=0;y<12;y++){const c=[SHAWL,SHAWLH,GOLD,SHAWLD][y%4];s.fill(l,'front',0,y,4,1,c);} // striped skirt-pants
  s.fill(l,'front',0,10,4,2,[120,80,50,255]); // sandals
}
s.save(process.argv[2]);
module.exports={meta:{id:'fantasy-female-fortune-seer',nameRu:'Цыганка-Прорицательница',nameEn:'Fortune Seer',role:'гадалка по судьбам',style:'fantasy',gender:'female',model:'slim'}};
