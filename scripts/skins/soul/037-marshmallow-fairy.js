'use strict';
const { Skin, shade, mix } = require('../../hand/paint');
const L=(c,t)=>mix(c,[255,255,255,255],t), D=(c,t)=>mix(c,[0,0,0,255],t);
const s=new Skin();
const SKIN=[255,232,220,255],SKD=shade(SKIN,0.88);
const HAIR=[230,215,250,255],HAIRH=[245,238,253,255],HAIRD=[195,178,228,255]; // lavender white
const DRESS=[255,240,248,255],DRESSH=[255,250,253,255],DRESSD=[245,218,232,255]; // marshmallow dress
const BLUE=[200,225,250,255];
const PINK=[255,200,220,255];
const GOLD=[250,228,160,255];
s.cuboid('head',SKIN,3);s.fill('head','front',0,7,8,1,SKD);
// fluffy cloud-like hair
s.faceFill('head','top',HAIR,3);s.faceFill('head','back',HAIR,3);
for(let x=0;x<8;x++)s.px('head','top',x,0,HAIRH);
for(let y=0;y<7;y++){for(let x=0;x<8;x++){s.px('head','right',x,y,HAIR);s.px('head','left',x,y,HAIR);}}
for(let x=0;x<8;x++)s.px('head','front',x,0,HAIR);
for(let y=1;y<5;y++){s.px('head','front',0,y,HAIR);s.px('head','front',7,y,HAIR);}
// two little buns
s.px('hat','top',1,0,HAIRH);s.px('hat','top',6,0,HAIRH);s.px('head','right',0,1,HAIR);s.px('head','left',7,1,HAIR);
for(let x=1;x<7;x++)s.px('head','front',x,1, x%2?HAIRH:HAIRD);
// tiny tiara
s.px('head','front',3,1,GOLD);s.px('head','front',4,1,PINK);
// FACE
const Wt=[250,250,252,255];
for(const ex of [1,5]){s.px('head','front',ex,3,Wt);s.px('head','front',ex+1,3,Wt);s.px('head','front',ex,4,Wt);s.px('head','front',ex+1,4,Wt);}
s.px('head','front',1,4,BLUE);s.px('head','front',2,4,[110,140,190,255]);s.px('head','front',5,4,[110,140,190,255]);s.px('head','front',6,4,BLUE);
s.px('head','front',2,3,[255,255,255,255]);s.px('head','front',5,3,[255,255,255,255]);
s.px('head','front',0,3,[170,150,200,255]);s.px('head','front',7,3,[170,150,200,255]);
s.px('head','front',4,5,SKD);s.px('head','front',3,6,[245,160,180,255]);s.px('head','front',4,6,[245,160,180,255]);
const bl=mix(SKIN,[255,180,200,255],0.45);s.px('head','front',1,5,bl);s.px('head','front',6,5,bl);
// little star by the eye
s.px('head','front',6,2,GOLD);
// TORSO — airy dress + wings
for(const p of ['body','rarm','larm','rleg','lleg'])s.cuboid(p,DRESS,3);
s.fill('body','front',0,0,8,12,DRESS);
// heart-shaped bodice
s.fill('body','front',2,1,4,3,DRESSD);s.px('body','front',2,1,PINK);s.px('body','front',5,1,PINK);s.px('body','front',3,3,PINK);s.px('body','front',4,3,PINK);
// fairy wings (visible at the edges/back)
s.px('body','front',0,2,BLUE);s.px('body','front',0,3,L(BLUE,0.3));s.px('body','front',0,4,BLUE);
s.px('body','front',7,2,PINK);s.px('body','front',7,3,L(PINK,0.3));s.px('body','front',7,4,PINK);
s.faceFill('body','back',BLUE,3); // wings at the back
s.px('body','back',1,1,L(BLUE,0.4));s.px('body','back',6,1,L(PINK,0.4));s.px('body','back',2,3,PINK);s.px('body','back',5,3,BLUE);
// little stars on the skirt
for(const [x,y] of [[2,6],[5,7],[3,8],[1,5],[6,6]])s.px('body','front',x,y,GOLD);
// ribbon belt
s.fill('body','front',1,5,6,1,PINK);s.px('body','front',3,5,GOLD);s.px('body','front',4,5,GOLD);
// fluffy hem
for(let x=0;x<8;x++)s.px('body','front',x,11, x%2?DRESSH:PINK);
for(let x=0;x<8;x++)s.px('body','front',x,10, x%2?DRESSD:DRESSH);
s.faceFill('body','top',DRESSH,2);
for(const a of ['rarm','larm']){
  s.fill(a,'front',0,0,4,6,DRESS);
  s.fill(a,'front',0,0,4,2,DRESSD); // puffed sleeves
  s.px(a,'front',1,1,PINK);
  s.fill(a,'front',0,6,4,6,SKIN); // bare arm
  s.px(a,'front',0,7,PINK);s.px(a,'front',3,7,PINK); // little bracelet
}
for(const l of ['rleg','lleg']){
  s.fill(l,'front',0,0,4,5,DRESS);for(let y=0;y<5;y++)s.px(l,'front',0,y,DRESSD);
  s.px(l,'front',1,3,GOLD);
  s.fill(l,'front',0,5,4,3,SKIN); // leg
  s.fill(l,'front',0,8,4,4,PINK);s.fill(l,'front',0,8,4,1,DRESSH);s.px(l,'front',1,11,GOLD); // ballet shoes
}
s.save(process.argv[2]);
module.exports={meta:{id:'pastel-female-marshmallow-fairy',nameRu:'Зефирная Фея',nameEn:'Marshmallow Fairy',role:'фея сладких снов',style:'pastel',gender:'female',model:'slim'}};
