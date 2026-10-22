'use strict';
const { Skin, shade, mix } = require('../../hand/paint');
const L=(c,t)=>mix(c,[255,255,255,255],t), D=(c,t)=>mix(c,[0,0,0,255],t);
const s=new Skin();
const BODY=[255,242,248,255],BODYH=[255,251,253,255],BODYD=[240,218,230,255]; // marshmallow white body
const PINK=[255,200,220,255];
const BLUE=[200,225,250,255];
const MINT=[200,240,225,255];
const FACE=[255,170,195,255];
// HEAD — a puffy marshmallow cube
s.cuboid('head',BODY,2);
s.faceFill('head','top',BODYH,2);s.faceFill('head','back',BODYD,2);
// soft browned corners (like baked marshmallow)
s.px('head','front',0,7,BODYD);s.px('head','front',7,7,BODYD);s.px('head','front',0,1,PINK);s.px('head','front',7,1,BLUE);
// FACE — cute dot eyes
s.fill('head','front',1,3,2,2,[90,70,80,255]);s.fill('head','front',5,3,2,2,[90,70,80,255]);
s.px('head','front',1,3,[255,255,255,255]);s.px('head','front',5,3,[255,255,255,255]); // highlight
// blush
const bl=mix(BODY,FACE,0.6);s.fill('head','front',0,5,2,1,bl);s.fill('head','front',6,5,2,1,bl);
// smile
s.px('head','front',3,6,FACE);s.px('head','front',4,6,FACE);s.px('head','front',2,5,FACE);s.px('head','front',5,5,FACE);
// TORSO — soft marshmallow body
for(const p of ['body','rarm','larm','rleg','lleg'])s.cuboid(p,BODY,2);
// seam stitching like a marshmallow
s.fill('body','front',0,5,8,1,BODYD);
// pastel icing drips
s.px('body','front',1,2,PINK);s.px('body','front',6,2,BLUE);s.px('body','front',2,7,MINT);s.px('body','front',5,8,PINK);s.px('body','front',3,3,BLUE);
// sugar sprinkles
for(const [x,y] of [[2,4],[5,3],[1,7],[6,6],[3,8]]){s.px('body','front',x,y,[255,255,255,255]);}
// soft little heart in the center
s.px('body','front',3,4,FACE);s.px('body','front',4,4,FACE);s.px('body','front',3,5,FACE);
s.faceFill('body','back',BODYD,2);s.faceFill('body','top',BODYH,2);
for(const a of ['rarm','larm']){
  s.cuboid(a,BODY,2);
  s.px(a,'front',1,3,PINK);s.px(a,'front',2,7,BLUE); // drips
  s.fill(a,'front',0,10,4,2,BODYD); // puffy little hands
  s.px(a,'front',1,11,MINT);
}
for(const l of ['rleg','lleg']){
  s.cuboid(l,BODY,2);
  s.px(l,'front',1,4,PINK);s.px(l,'front',2,8,MINT);
  s.fill(l,'front',0,11,4,1,BODYD);
}
s.save(process.argv[2]);
module.exports={meta:{id:'pastel-neutral-marshmallow-golem',nameRu:'Зефирный Голем',nameEn:'Marshmallow Golem',role:'мягкий добрый страж',style:'pastel',gender:'neutral',model:'classic'}};
