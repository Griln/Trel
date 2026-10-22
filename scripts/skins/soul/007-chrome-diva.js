'use strict';
const { Skin, shade, mix } = require('../../hand/paint');
const L=(c,t)=>mix(c,[255,255,255,255],t), D=(c,t)=>mix(c,[0,0,0,255],t);
const s=new Skin();
const SKIN=[240,206,184,255],SKD=shade(SKIN,0.8);
const HAIR=[210,216,226,255],HAIRH=[245,248,252,255],HAIRD=[160,168,182,255]; // platinum
const DRESS=[36,30,46,255],DRESSH=[60,52,76,255];
const MAG=[255,70,200,255],MAGD=shade([255,70,200,255],0.6);
const CHR=[200,206,216,255];
s.cuboid('head',SKIN,4);s.fill('head','front',0,7,8,1,SKD);
// smooth platinum bob
s.faceFill('head','top',HAIR,4);s.faceFill('head','back',HAIR,4);
for(let x=0;x<8;x++)s.px('head','top',x,0,HAIRH);
for(let y=0;y<8;y++){for(let x=0;x<8;x++){s.px('head','right',x,y,HAIR);s.px('head','left',x,y,HAIR);}}
for(let x=0;x<8;x++)s.px('head','front',x,0,HAIR);
s.px('head','front',0,1,HAIR);s.px('head','front',7,1,HAIR);
for(let y=1;y<7;y++){s.px('head','front',0,y,HAIR);s.px('head','front',7,y,HAIR);} // the bob frames
s.px('head','front',2,0,HAIRH);s.px('head','front',5,0,HAIRH);
// halo tiara
s.fill('head','front',1,1,6,1,CHR);s.px('head','front',3,1,MAG);s.px('head','front',4,1,MAG);
// FACE — glamour
s.px('head','front',1,2,HAIRD);s.px('head','front',6,2,HAIRD);
const Wt=[240,243,249,255],P=[24,18,28,255];
for(const ex of [1,5]){s.px('head','front',ex,3,Wt);s.px('head','front',ex+1,3,Wt);s.px('head','front',ex,4,Wt);s.px('head','front',ex+1,4,Wt);}
s.px('head','front',1,4,MAG);s.px('head','front',2,4,P);s.px('head','front',5,4,P);s.px('head','front',6,4,MAG);
s.px('head','front',2,3,[255,255,255,255]);s.px('head','front',5,3,[255,255,255,255]);
s.px('head','front',0,3,P);s.px('head','front',7,3,P);
s.px('head','front',4,5,SKD);
s.px('head','front',3,6,[225,70,140,255]);s.px('head','front',4,6,[225,70,140,255]); // lipstick
const bl=mix(SKIN,[255,120,160,255],0.4);s.px('head','front',1,5,bl);s.px('head','front',6,5,bl);
s.px('head','front',6,2,MAGD); // sparkle by the eye
// TORSO — stage dress with a chrome corset
for(const p of ['body','rarm','larm','rleg','lleg'])s.cuboid(p,DRESS,4);
// chrome corset
s.fill('body','front',1,2,6,6,CHR);
s.fill('body','front',1,2,6,1,HAIRH);
for(let y=2;y<8;y++){s.px('body','front',3,y,D(CHR,0.2));s.px('body','front',4,y,D(CHR,0.2));} // lacing
s.px('body','front',2,3,MAG);s.px('body','front',5,3,MAG);
// neckline
s.px('body','front',3,1,SKIN);s.px('body','front',4,1,SKIN);
// magenta glowing skirt
s.fill('body','front',0,8,8,2,MAGD);s.fill('body','front',0,8,8,1,MAG);
s.fill('body','front',0,10,8,1,D(DRESS,0.2));
s.faceFill('body','top',DRESSH,3);s.faceFill('body','back',D(DRESS,0.2),4);
// long gloves
for(const a of ['rarm','larm']){
  s.faceFill(a,'top',DRESSH,3);
  s.fill(a,'front',0,4,4,8,D(DRESS,0.1)); // elbow-length glove
  s.fill(a,'front',0,4,4,1,MAG);
  s.px(a,'front',0,8,MAG);s.px(a,'front',3,8,MAG);
}
for(const l of ['rleg','lleg']){
  s.fill(l,'front',0,0,4,3,DRESSH);
  s.fill(l,'front',0,7,4,5,D(DRESS,0.1)); // tall boot
  s.fill(l,'front',0,7,4,1,MAG);s.fill(l,'front',0,11,4,1,MAGD);
}
s.save(process.argv[2]);
module.exports={meta:{id:'cyber-female-chrome-diva',nameRu:'Хром-Дива',nameEn:'Chrome Diva',role:'звезда неоновых сцен',style:'cyber',gender:'female',model:'classic'}};
