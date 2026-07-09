'use strict';
const { Skin, shade, mix } = require('../../hand/paint');
const L=(c,t)=>mix(c,[255,255,255,255],t), D=(c,t)=>mix(c,[0,0,0,255],t);
const s=new Skin();
const ROCK=[128,124,118,255],ROCKH=[164,160,152,255],ROCKD=[88,84,80,255]; // камень
const MOSS=[96,128,72,255];
const RUNE=[255,160,60,255],RUNEH=[255,210,120,255]; // оранжевые руны-магма
const MAGMA=[230,80,30,255];
// ГОЛОВА — каменная глыба
s.cuboid('head',ROCK,3);
s.faceFill('head','top',ROCKH,2);s.faceFill('head','back',ROCKD,2);
// трещины-сколы
s.px('head','front',2,1,ROCKD);s.px('head','front',2,2,ROCKD);s.px('head','front',5,5,ROCKD);s.px('head','front',5,6,ROCKD);
s.px('head','front',0,4,ROCKH);s.px('head','front',7,3,ROCKH); // выступы
// мох сверху
for(let x=1;x<7;x++)if(x%2)s.px('head','front',x,0,MOSS);s.px('head','top',2,0,MOSS);s.px('head','top',5,0,MOSS);
// ЛИЦО — глаза-руны магмы
s.fill('head','front',1,3,2,2,[40,36,34,255]);s.fill('head','front',5,3,2,2,[40,36,34,255]);
s.px('head','front',1,4,RUNE);s.px('head','front',2,3,RUNEH);s.px('head','front',5,3,RUNEH);s.px('head','front',6,4,RUNE);
// рот-расщелина с магмой
s.fill('head','front',2,6,4,1,[40,36,34,255]);s.px('head','front',3,6,MAGMA);s.px('head','front',4,6,RUNE);
// руна на лбу
s.px('head','front',3,1,RUNE);s.px('head','front',4,1,RUNE);
// ТОРС — массивный каменный корпус
for(const p of ['body','rarm','larm','rleg','lleg'])s.cuboid(p,ROCK,3);
// каменные плиты-сегменты
s.fill('body','front',0,5,8,1,ROCKD);for(let y=1;y<9;y++)s.px('body','front',4,y,ROCKD);
s.px('body','front',1,2,ROCKH);s.px('body','front',6,3,ROCKH);s.px('body','front',2,7,ROCKH);
// светящаяся магма-ядро в трещинах
s.px('body','front',3,4,MAGMA);s.px('body','front',4,4,RUNE);s.px('body','front',3,5,RUNE);s.px('body','front',4,5,MAGMA);
s.px('body','front',2,3,RUNE);s.px('body','front',5,6,RUNE);s.px('body','front',3,7,MAGMA); // трещины-магма
// мох по корпусу
s.px('body','front',0,2,MOSS);s.px('body','front',7,5,MOSS);s.px('body','front',1,8,MOSS);
s.faceFill('body','back',ROCKD,3);s.faceFill('body','top',ROCKH,2);
for(const a of ['rarm','larm']){
  s.cuboid(a,ROCK,3);
  s.px(a,'front',1,2,ROCKH);s.px(a,'front',2,5,ROCKD); // сколы
  s.px(a,'front',1,4,RUNE);s.px(a,'front',2,8,MAGMA); // руны-магма
  s.px(a,'front',0,3,MOSS);s.px(a,'front',3,9,MOSS);
  s.fill(a,'front',0,10,4,2,ROCKD); // кулак-валун
}
for(const l of ['rleg','lleg']){
  s.cuboid(l,ROCK,3);
  s.px(l,'front',1,3,ROCKH);s.px(l,'front',2,7,ROCKD);
  s.px(l,'front',1,5,RUNE);s.px(l,'front',2,9,MAGMA);
  s.fill(l,'front',0,11,4,1,ROCKD);s.px(l,'front',0,10,MOSS);
}
s.save(process.argv[2]);
module.exports={meta:{id:'fantasy-neutral-stone-golem',nameRu:'Каменный Голем',nameEn:'Stone Golem',role:'страж древних руин',style:'fantasy',gender:'neutral',model:'classic'}};
