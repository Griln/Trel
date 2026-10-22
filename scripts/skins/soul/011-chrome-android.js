'use strict';
const { Skin, shade, mix } = require('../../hand/paint');
const L=(c,t)=>mix(c,[255,255,255,255],t), D=(c,t)=>mix(c,[0,0,0,255],t);
const s=new Skin();
const METAL=[176,182,194,255],METH=[222,226,234,255],METD=[120,126,140,255]; // metal body
const PLATE=[60,66,80,255],PLATEH=[92,100,118,255];
const RED=[255,70,70,255],REDD=shade([255,70,70,255],0.6);
// HEAD — smooth skull helmet
s.cuboid('head',METAL,3);
s.faceFill('head','top',METH,2);s.faceFill('head','back',METD,2);
s.fill('head','front',0,7,8,1,METD);
// panel seams
s.fill('head','front',0,0,8,1,METH);s.px('head','front',0,0,METD);
for(let y=1;y<7;y++){s.px('head','front',0,y,METD);s.px('head','front',7,y,METD);}
s.fill('head','front',0,2,8,1,D(METAL,0.15)); // visor seam
// FACE — optical visor with a red eye
s.fill('head','front',1,3,6,2,[24,26,34,255]); // dark visor slit
s.px('head','front',2,4,RED);s.px('head','front',5,4,RED);s.px('head','front',3,4,REDD);s.px('head','front',4,4,REDD);
s.px('head','front',2,3,L(RED,0.4));s.px('head','front',5,3,L(RED,0.4));
// grille mouth
s.fill('head','front',2,6,4,1,D(METAL,0.2));for(const x of [2,4])s.px('head','front',x,6,METD);
// ear ports
s.px('head','right',1,4,RED);s.px('head','left',6,4,RED);
// TORSO — chassis body
for(const p of ['body','rarm','larm','rleg','lleg'])s.cuboid(p,PLATE,3);
s.fill('body','front',1,1,6,8,METAL);
s.fill('body','front',1,1,6,1,METH);
// panel seams
s.fill('body','front',0,5,8,1,D(PLATE,0.2));for(let y=1;y<9;y++)s.px('body','front',4,y,D(METAL,0.2));
// red reactor core
s.px('body','front',3,3,RED);s.px('body','front',4,3,L(RED,0.5));s.px('body','front',3,4,RED);s.px('body','front',4,4,RED);s.px('body','front',3,5,REDD);s.px('body','front',4,5,RED);
// ventilation slots
for(const y of [7,8])for(const x of [1,2,5,6])s.px('body','front',x,y,D(METAL,0.25));
s.fill('body','front',0,10,8,1,D(PLATE,0.3));s.px('body','front',3,10,RED);s.px('body','front',4,10,RED);
s.faceFill('body','top',PLATEH,2);s.faceFill('body','back',D(PLATE,0.2),3);
for(const a of ['rarm','larm']){
  s.faceFill(a,'top',METH,2);
  s.fill(a,'front',0,0,4,7,METAL);
  s.fill(a,'front',0,3,4,1,D(METAL,0.2)); // elbow joint
  s.px(a,'front',1,4,RED);s.px(a,'front',2,4,REDD);
  s.fill(a,'front',0,8,4,4,PLATE);s.px(a,'front',0,8,METH);s.px(a,'front',3,8,METH); // manipulator
}
for(const l of ['rleg','lleg']){
  s.fill(l,'front',0,0,4,8,METAL);s.fill(l,'front',0,4,4,1,D(METAL,0.2));
  s.px(l,'front',1,5,REDD);
  s.fill(l,'front',0,9,4,3,PLATE);s.fill(l,'front',0,11,4,1,REDD);
}
s.save(process.argv[2]);
module.exports={meta:{id:'cyber-neutral-chrome-android',nameRu:'Хром-Андроид',nameEn:'Chrome Android',role:'боевой андроид',style:'cyber',gender:'neutral',model:'classic'}};
