'use strict';
const { Skin, shade, mix } = require('../../hand/paint');
const L=(c,t)=>mix(c,[255,255,255,255],t), D=(c,t)=>mix(c,[0,0,0,255],t);
const s=new Skin();
const BODY=[248,250,255,255],BODYH=[255,255,255,255],BODYD=[222,230,245,255]; // белое облако
const BLUE=[198,222,250,255],BLUED=[170,200,238,255];
const SUN=[255,238,170,255];
const PINK=[255,214,228,255];
const FACE=[120,140,175,255];
// ГОЛОВА — пушистое облако
s.cuboid('head',BODY,2);
s.faceFill('head','top',BODYH,2);s.faceFill('head','back',BODYD,2);
// пушистые комочки сверху
for(let x=0;x<8;x++)s.px('head','front',x,0, x%2?BODYH:BODYD);
s.px('head','top',1,0,BODYH);s.px('head','top',4,0,BODYH);s.px('head','top',6,0,BODYH);
// нижняя кромка с голубой тенью (как дождевое)
s.fill('head','front',0,7,8,1,BLUE);s.px('head','front',2,7,BLUED);s.px('head','front',5,7,BLUED);
// ЛИЦО — умильное
s.fill('head','front',1,3,2,2,FACE);s.fill('head','front',5,3,2,2,FACE);
s.px('head','front',1,3,BODYH);s.px('head','front',5,3,BODYH); // блики
// розовые щёчки
const bl=mix(BODY,PINK,0.7);s.px('head','front',1,5,bl);s.px('head','front',2,5,bl);s.px('head','front',5,5,bl);s.px('head','front',6,5,bl);
// крошечный ротик
s.px('head','front',3,6,PINK);s.px('head','front',4,6,PINK);
// солнечко выглядывает сбоку
s.px('head','left',7,2,SUN);s.px('head','right',0,2,SUN);
// ТОРС — облачное тело
for(const p of ['body','rarm','larm','rleg','lleg'])s.cuboid(p,BODY,2);
// пушистые комки-объём
for(const [x,y] of [[1,1],[6,1],[2,3],[5,4],[1,6],[6,6],[3,8]]){s.px('body','front',x,y,BODYD);}
for(const [x,y] of [[2,1],[5,1],[3,3],[6,4]]){s.px('body','front',x,y,BODYH);}
// солнышко на груди
s.px('body','front',3,4,SUN);s.px('body','front',4,4,L(SUN,0.3));s.px('body','front',3,5,SUN);s.px('body','front',4,5,SUN);
s.px('body','front',2,4,SUN);s.px('body','front',5,5,SUN);s.px('body','front',3,3,SUN); // лучики
// голубая морось снизу
for(let x=0;x<8;x++)s.px('body','front',x,9,BLUE);
for(const x of [1,3,5,7])s.px('body','front',x,10,BLUED); // капельки
for(let x=0;x<8;x++)s.px('body','front',x,11, x%2?BODYH:BLUE);
// маленькая радуга-дуга
s.px('body','front',1,8,PINK);s.px('body','front',2,8,SUN);s.px('body','front',6,8,BLUE);
s.faceFill('body','back',BODYD,2);s.faceFill('body','top',BODYH,2);
for(const a of ['rarm','larm']){
  s.cuboid(a,BODY,2);
  s.px(a,'front',1,2,BODYD);s.px(a,'front',2,5,BODYH);
  s.fill(a,'front',0,9,4,1,BLUE);s.px(a,'front',1,11,BLUED); // дождинки-ручки
}
for(const l of ['rleg','lleg']){
  s.cuboid(l,BODY,2);
  s.px(l,'front',1,3,BODYD);s.px(l,'front',2,6,BODYH);
  s.fill(l,'front',0,9,4,1,BLUE);s.fill(l,'front',0,11,4,1,BLUED); // капельки-ножки
}
s.save(process.argv[2]);
module.exports={meta:{id:'pastel-neutral-little-cloud',nameRu:'Облачко',nameEn:'Little Cloud',role:'тёплое дождливо-солнечное создание',style:'pastel',gender:'neutral',model:'classic'}};
