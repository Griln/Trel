'use strict';
const { Skin, shade, mix } = require('../../hand/paint');
const L=(c,t)=>mix(c,[255,255,255,255],t), D=(c,t)=>mix(c,[0,0,0,255],t);
const s=new Skin();
const BODY=[60,120,90,255],BODYH=[88,160,118,255];       // полупрозрачное тело-дух
const GLOW=[180,255,200,255],GLOWY=[230,255,180,255];
const GOLD=[245,225,130,255];
const DARK=[34,70,54,255];
// ГОЛОВА — призрачно-растительная
s.cuboid('head',BODY,4);
s.faceFill('head','top',BODYH,4);s.faceFill('head','back',DARK,4);
// светящиеся прожилки-листья
for(let x=0;x<8;x+=3)for(let y=0;y<8;y++)s.px('head','front',x,y,DARK);
s.px('head','front',2,1,GLOW);s.px('head','front',5,2,GLOW);s.px('head','front',1,6,GLOWY);
// рожки-веточки
s.px('hat','top',2,0,GOLD);s.px('hat','top',5,0,GOLD);s.px('head','front',2,0,GLOWY);s.px('head','front',5,0,GLOWY);
// ЛИЦО — светящиеся добрые глаза
s.fill('head','front',1,3,2,2,DARK);s.fill('head','front',5,3,2,2,DARK);
s.px('head','front',1,4,GLOWY);s.px('head','front',2,3,GLOW);s.px('head','front',5,3,GLOW);s.px('head','front',6,4,GLOWY);
s.px('head','front',2,4,L(GLOW,0.4));s.px('head','front',5,4,L(GLOW,0.4));
// улыбка-свет
s.px('head','front',3,6,GLOW);s.px('head','front',4,6,GLOW);
// ТОРС — туманное тело с искрами
for(const p of ['body','rarm','larm','rleg','lleg'])s.cuboid(p,BODY,4);
// текстура-дымка
for(let y=0;y<12;y++)for(let x=0;x<8;x++)if((x*3+y*2)%5===0)s.px('body','front',x,y,BODYH);
// прожилки-молнии света
s.px('body','front',1,2,GLOW);s.px('body','front',2,3,GLOW);s.px('body','front',2,4,GLOWY);s.px('body','front',1,5,GLOW);
s.px('body','front',6,2,GLOW);s.px('body','front',5,3,GLOW);s.px('body','front',5,4,GLOWY);s.px('body','front',6,5,GLOW);
// ядро-сердце духа
s.px('body','front',3,4,L(GLOW,0.5));s.px('body','front',4,4,GLOW);s.px('body','front',3,5,GLOW);s.px('body','front',4,5,GLOWY);s.px('body','front',3,6,GLOW);s.px('body','front',4,6,L(GLOW,0.3));
// светлячки
s.px('body','front',0,7,GOLD);s.px('body','front',7,8,GOLD);s.px('body','front',2,9,GLOWY);
// нижний край растворяется
for(let x=0;x<8;x++)s.px('body','front',x,11, x%2?BODYH:DARK);
s.faceFill('body','back',DARK,4);s.faceFill('body','top',BODYH,4);
for(const a of ['rarm','larm']){
  s.cuboid(a,BODY,4);
  for(let y=0;y<12;y++)if(y%3===0)s.px(a,'front',1,y,BODYH);
  s.px(a,'front',1,3,GLOW);s.px(a,'front',2,7,GLOWY);s.px(a,'front',0,9,GOLD);
  for(let x=0;x<4;x++)s.px(a,'front',x,11, x%2?GLOW:DARK); // кисть-искры
}
for(const l of ['rleg','lleg']){
  s.cuboid(l,BODY,4);
  for(let y=0;y<12;y++)if(y%3===1)s.px(l,'front',1,y,BODYH);
  s.px(l,'front',1,4,GLOW);s.px(l,'front',2,8,GLOWY);
  for(let x=0;x<4;x++)s.px(l,'front',x,11, x%2?GLOWY:DARK); // тает в туман
}
s.save(process.argv[2]);
module.exports={meta:{id:'fantasy-neutral-forest-wisp',nameRu:'Дух Леса',nameEn:'Forest Wisp',role:'блуждающий огонёк чащи',style:'fantasy',gender:'neutral',model:'classic'}};
