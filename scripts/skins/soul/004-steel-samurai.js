'use strict';
const { Skin, shade, mix } = require('../../hand/paint');
const L=(c,t)=>mix(c,[255,255,255,255],t), D=(c,t)=>mix(c,[0,0,0,255],t);
const s=new Skin();
const SKIN=[214,176,150,255],SKD=shade(SKIN,0.78);
const HAIR=[24,22,28,255],HAIRH=[60,56,70,255];
const ARM=[40,42,54,255],ARMH=[72,76,94,255],ARMD=D([40,42,54,255],0.3); // blackened armor
const MAG=[255,60,170,255],MAGD=shade([255,60,170,255],0.6);            // purple neon
const CLOTH=[120,28,44,255];                                            // dark crimson fabric
// HEAD
s.cuboid('head',SKIN,5);s.fill('head','front',0,7,8,1,SKD);
// hair tied into a samurai topknot
s.faceFill('head','top',HAIR,5);s.faceFill('head','back',HAIR,5);
for(let x=0;x<8;x++)s.px('head','top',x,0,HAIRH);
s.px('hat','top',3,0,HAIR);s.px('hat','top',4,0,HAIR);s.px('head','top',3,0,HAIRH);s.px('head','top',4,0,HAIRH); // topknot
for(let x=0;x<8;x++)s.px('head','front',x,0,HAIR);
s.px('head','front',1,1,HAIR);s.px('head','front',6,1,HAIR);
for(let y=0;y<3;y++){s.px('head','right',0,y,HAIR);s.px('head','left',7,y,HAIR);}
// forehead plate
s.fill('head','front',1,1,6,1,ARM);s.px('head','front',3,1,MAG);s.px('head','front',4,1,MAG);
// FACE — sharp gaze + respirator mask
s.px('head','front',1,2,HAIRH);s.px('head','front',2,2,HAIRH);s.px('head','front',5,2,HAIRH);s.px('head','front',6,2,HAIRH);
const Wt=[238,242,248,255],P=[18,16,24,255];
for(const ex of [1,5]){s.px('head','front',ex,3,Wt);s.px('head','front',ex+1,3,Wt);s.px('head','front',ex,4,Wt);s.px('head','front',ex+1,4,Wt);}
s.px('head','front',1,4,MAG);s.px('head','front',2,4,P);s.px('head','front',5,4,P);s.px('head','front',6,4,MAG);
s.px('head','front',2,3,[255,255,255,255]);s.px('head','front',5,3,[255,255,255,255]);
// the mask covers the nose and mouth
s.fill('head','front',2,5,4,3,ARM);s.fill('head','front',2,5,4,1,ARMH);
s.px('head','front',3,6,MAGD);s.px('head','front',4,6,MAGD);       // mask valve
// TORSO — plate armor over crimson fabric
for(const p of ['body','rarm','larm','rleg','lleg'])s.cuboid(p,CLOTH,5);
// chest plates
s.fill('body','front',1,1,6,8,ARM);
s.fill('body','front',1,1,6,1,ARMH);
s.px('body','front',1,2,ARMH);s.px('body','front',6,2,ARMH);
// plate separation
s.fill('body','front',1,4,6,1,ARMD);
// purple core gem
s.px('body','front',3,2,MAG);s.px('body','front',4,2,L(MAG,0.5));s.px('body','front',3,3,MAGD);s.px('body','front',4,3,MAG);
// crimson fabric on the sides
for(let y=1;y<9;y++){s.px('body','front',0,y,CLOTH);s.px('body','front',7,y,CLOTH);}
// obi belt
s.fill('body','front',0,9,8,2,CLOTH);s.fill('body','front',0,9,8,1,D(CLOTH,0.2));
s.px('body','front',3,10,MAG);s.px('body','front',4,10,MAG);
s.faceFill('body','top',ARMH,3);s.faceFill('body','back',D(CLOTH,0.2),5);
// large sode shoulder guards
for(const a of ['rarm','larm']){
  s.faceFill(a,'top',ARM,3);
  s.fill(a,'front',0,0,4,3,ARM);s.fill(a,'front',0,0,4,1,ARMH); // sode
  s.px(a,'front',0,1,MAGD);s.px(a,'front',3,1,MAGD);
  s.fill(a,'front',0,5,4,2,ARM);                  // kote bracer
  s.fill(a,'front',0,7,4,1,MAGD);
  s.fill(a,'front',0,8,4,4,D(ARM,0.2));            // armored glove
}
// suneate greaves
for(const l of ['rleg','lleg']){
  s.fill(l,'front',0,0,4,4,ARM);s.fill(l,'front',0,0,4,1,ARMH);
  s.fill(l,'front',0,7,4,1,MAGD);
  s.fill(l,'front',0,9,4,3,D(ARM,0.25));           // boot
  s.px(l,'front',0,11,MAGD);s.px(l,'front',3,11,MAGD);
}
s.save(process.argv[2]);
module.exports={meta:{id:'cyber-male-steel-samurai',nameRu:'Стальной Самурай',nameEn:'Steel Samurai',role:'кодекс чести в неоне',style:'cyber',gender:'male',model:'classic'}};
