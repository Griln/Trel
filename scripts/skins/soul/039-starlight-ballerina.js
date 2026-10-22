'use strict';
const { Skin, shade, mix } = require('../../hand/paint');
const L=(c,t)=>mix(c,[255,255,255,255],t), D=(c,t)=>mix(c,[0,0,0,255],t);
const s=new Skin();
const SKIN=[255,224,206,255],SKD=shade(SKIN,0.88);
const HAIR=[245,225,235,255],HAIRH=[252,242,247,255],HAIRD=[215,185,205,255]; // pearl pink
const TUTU=[210,230,252,255],TUTUH=[238,246,254,255],TUTUD=[180,205,240,255]; // blue tutu
const STAR=[252,232,170,255],STARH=[255,248,210,255];
const PINK=[255,205,222,255];
s.cuboid('head',SKIN,3);s.fill('head','front',0,7,8,1,SKD);
// hair in a ballerina bun
s.faceFill('head','top',HAIR,3);s.faceFill('head','back',HAIR,3);
for(let x=0;x<8;x++)s.px('head','top',x,0,HAIRH);
for(let y=0;y<5;y++){s.px('head','right',0,y,HAIR);s.px('head','left',7,y,HAIR);}
for(let x=0;x<8;x++)s.px('head','front',x,0,HAIR);
// bun on top
s.px('hat','top',3,0,HAIR);s.px('hat','top',4,0,HAIRH);s.px('head','top',3,0,HAIRD);s.px('head','top',4,0,HAIRD);
for(let x=1;x<7;x++)s.px('head','front',x,1, x%2?HAIRH:HAIRD); // smooth fringe
// star tiara
s.px('head','front',2,1,STAR);s.px('head','front',4,0,STARH);s.px('head','front',5,1,STAR);
// FACE — elegant
const Wt=[250,250,252,255];
for(const ex of [1,5]){s.px('head','front',ex,3,Wt);s.px('head','front',ex+1,3,Wt);s.px('head','front',ex,4,Wt);s.px('head','front',ex+1,4,Wt);}
s.px('head','front',1,4,[150,170,210,255]);s.px('head','front',2,4,[90,110,150,255]);s.px('head','front',5,4,[90,110,150,255]);s.px('head','front',6,4,[150,170,210,255]);
s.px('head','front',2,3,[255,255,255,255]);s.px('head','front',5,3,[255,255,255,255]);
s.px('head','front',0,3,[190,160,180,255]);s.px('head','front',7,3,[190,160,180,255]); // eyelashes
s.px('head','front',4,5,SKD);s.px('head','front',3,6,[245,160,180,255]);s.px('head','front',4,6,[245,160,180,255]);
const bl=mix(SKIN,[255,180,200,255],0.45);s.px('head','front',1,5,bl);s.px('head','front',6,5,bl);
// TORSO — ballet bodice + tutu
for(const p of ['body','rarm','larm','rleg','lleg'])s.cuboid(p,TUTU,3);
s.fill('body','front',0,0,8,12,SKIN); // bare shoulders / low neckline
// bodice
s.fill('body','front',2,2,4,6,TUTUD);s.fill('body','front',2,2,4,1,TUTUH);
// straps
s.px('body','front',2,1,PINK);s.px('body','front',5,1,PINK);
// stars on the bodice
s.px('body','front',3,3,STAR);s.px('body','front',4,4,STARH);s.px('body','front',3,5,STAR);s.px('body','front',4,6,STAR);
// pink ribbon under the bust
s.fill('body','front',2,7,4,1,PINK);
// fluffy tutu (spreads out at hip level)
s.fill('body','front',0,8,8,2,TUTU);s.fill('body','front',0,8,8,1,TUTUH);
for(let x=0;x<8;x++)s.px('body','front',x,8, x%2?TUTUH:TUTUD);
s.px('body','front',0,9,TUTUD);s.px('body','front',7,9,TUTUD);
// sparkles on the tutu
for(const [x,y] of [[1,9],[3,9],[5,9],[6,9]])s.px('body','front',x,y,STAR);
// tutu hem
for(let x=0;x<8;x++)s.px('body','front',x,10, x%2?TUTUH:TUTU);
for(let x=0;x<8;x++)s.px('body','front',x,11, x%2?TUTUD:STAR);
s.faceFill('body','back',TUTUD,3);s.faceFill('body','top',SKD,2);
for(const a of ['rarm','larm']){
  s.fill(a,'front',0,0,4,12,SKIN); // ballerina's bare arms
  s.px(a,'front',1,2,PINK);s.px(a,'front',2,2,PINK); // ribbon on the shoulder
  s.fill(a,'front',0,7,4,1,PINK); // bracelet
  s.px(a,'front',0,9,STAR);s.px(a,'front',3,9,STAR);
}
for(const l of ['rleg','lleg']){
  s.fill(l,'front',0,0,4,8,SKIN); // legs in tights
  s.fill(l,'front',0,8,4,4,PINK);s.fill(l,'front',0,8,4,1,STARH); // pointe shoes
  // pointe shoe ribbons
  s.px(l,'front',0,6,PINK);s.px(l,'front',3,6,PINK);s.px(l,'front',1,11,STAR);
}
s.save(process.argv[2]);
module.exports={meta:{id:'pastel-female-starlight-ballerina',nameRu:'Звёздная Балерина',nameEn:'Starlight Ballerina',role:'танцовщица звёздного зала',style:'pastel',gender:'female',model:'slim'}};
