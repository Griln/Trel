'use strict';
const { Skin, shade, mix } = require('../../hand/paint');
const L=(c,t)=>mix(c,[255,255,255,255],t), D=(c,t)=>mix(c,[0,0,0,255],t);
const s=new Skin();
const BODY=[222,212,248,255],BODYH=[240,234,252,255],BODYD=[192,180,228,255]; // лавандовое привидение
const STAR=[252,238,180,255],STARH=[255,250,215,255];
const BLUE=[200,218,250,255];
const PINK=[255,210,228,255];
const FACE=[130,118,160,255];
// ГОЛОВА — округлый дух
s.cuboid('head',BODY,3);
s.faceFill('head','top',BODYH,3);s.faceFill('head','back',BODYD,3);
// ночной колпак
s.fill('head','front',0,0,8,1,BLUE);s.px('head','front',3,0,STAR);s.px('head','top',3,0,BLUE);s.px('hat','top',2,0,BLUE);
// звёздная пыль
s.px('head','front',6,1,STAR);s.px('head','front',1,2,STARH);
// ЛИЦО — сонное (полузакрытые глаза)
s.fill('head','front',1,4,2,1,FACE);s.fill('head','front',5,4,2,1,FACE); // прикрытые веки
s.px('head','front',1,4,L(FACE,0.3));s.px('head','front',6,4,L(FACE,0.3));
// ресницы вниз
s.px('head','front',1,5,BODYD);s.px('head','front',6,5,BODYD);
// маленький зевающий ротик
s.px('head','front',3,6,PINK);s.px('head','front',4,6,PINK);s.px('head','front',3,7,D(PINK,0.1));
// румянец
const bl=mix(BODY,PINK,0.6);s.px('head','front',1,6,bl);s.px('head','front',6,6,bl);
// ТОРС — туманное тело духа
for(const p of ['body','rarm','larm','rleg','lleg'])s.cuboid(p,BODY,3);
// мягкая дымка
for(let y=0;y<12;y++)for(let x=0;x<8;x++)if((x+y)%3===0)s.px('body','front',x,y,BODYH);
// созвездия снов
for(const [x,y] of [[1,2],[6,3],[2,6],[5,7],[3,4],[6,9]]){s.px('body','front',x,y,STAR);}
s.px('body','front',2,2,STARH);s.px('body','front',5,7,STARH);
// полумесяц на груди
s.px('body','front',3,3,STAR);s.px('body','front',4,3,STARH);s.px('body','front',3,4,STAR);
// облачко-карман
s.px('body','front',2,8,BLUE);s.px('body','front',3,8,L(BLUE,0.3));s.px('body','front',5,9,PINK);
// волнистый призрачный низ
for(let x=0;x<8;x++)s.px('body','front',x,11, x%2?BODYH:BODYD);
for(let x=0;x<8;x++)s.px('body','front',x,10, x%2?BODYD:BODY);
s.faceFill('body','back',BODYD,3);s.faceFill('body','top',BODYH,3);
for(const a of ['rarm','larm']){
  s.cuboid(a,BODY,3);
  s.px(a,'front',1,3,STAR);s.px(a,'front',2,7,BLUE);
  for(let x=0;x<4;x++)s.px(a,'front',x,11, x%2?BODYH:BODYD); // тает
}
for(const l of ['rleg','lleg']){
  s.cuboid(l,BODY,3);
  s.px(l,'front',1,4,STAR);s.px(l,'front',2,8,PINK);
  for(let x=0;x<4;x++)s.px(l,'front',x,11, x%2?BODYD:BODYH); // призрачный хвост
  for(let x=0;x<4;x++)s.px(l,'front',x,10, x%2?BODY:BODYD);
}
s.save(process.argv[2]);
module.exports={meta:{id:'pastel-neutral-dream-spirit',nameRu:'Сонный Дух',nameEn:'Dream Spirit',role:'хранитель добрых снов',style:'pastel',gender:'neutral',model:'classic'}};
