'use strict';
const { Skin, shade, mix } = require('../../hand/paint');
const L=(c,t)=>mix(c,[255,255,255,255],t), D=(c,t)=>mix(c,[0,0,0,255],t);
const s=new Skin();
const SKIN=[196,150,116,255],SKD=shade(SKIN,0.78);       // смуглая
const HAIR=[34,26,30,255],HAIRH=[60,48,52,255];           // чёрные кудри
const SHAWL=[150,40,110,255],SHAWLH=[190,64,140,255],SHAWLD=[104,28,78,255]; // пурпурная шаль
const GOLD=[245,205,110,255];
const MYST=[150,120,255,255]; // мистический свет
s.cuboid('head',SKIN,4);s.fill('head','front',0,7,8,1,SKD);
// платок поверх кудрей
s.faceFill('head','top',SHAWL,4);s.faceFill('head','back',SHAWL,4);
for(let x=0;x<8;x++)s.px('head','top',x,0,SHAWLH);
for(let y=0;y<7;y++){s.px('head','right',0,y,SHAWL);s.px('head','left',7,y,SHAWL);}
for(let x=0;x<8;x++)s.px('head','front',x,0,SHAWL);
s.px('head','front',0,1,SHAWL);s.px('head','front',7,1,SHAWL);
// золотая монистка по краю платка
for(let x=1;x<7;x++)s.px('head','front',x,1, x%2?GOLD:SHAWLD);
// кудри из-под платка
s.px('head','front',1,2,HAIR);s.px('head','front',6,2,HAIR);
for(let y=2;y<6;y++){s.px('head','right',1,y,HAIR);s.px('head','left',6,y,HAIR);}
// ЛИЦО — загадочная
const Wt=[240,243,249,255];
for(const ex of [1,5]){s.px('head','front',ex,3,Wt);s.px('head','front',ex+1,3,Wt);s.px('head','front',ex,4,Wt);s.px('head','front',ex+1,4,Wt);}
s.px('head','front',1,4,MYST);s.px('head','front',2,4,[40,30,40,255]);s.px('head','front',5,4,[40,30,40,255]);s.px('head','front',6,4,MYST);
s.px('head','front',2,3,[255,255,255,255]);s.px('head','front',5,3,[255,255,255,255]);
s.px('head','front',0,3,[30,20,30,255]);s.px('head','front',7,3,[30,20,30,255]); // ресницы
s.px('head','front',4,5,SKD);s.px('head','front',3,6,[180,70,90,255]);s.px('head','front',4,6,[180,70,90,255]);
const bl=mix(SKIN,[220,100,120,255],0.35);s.px('head','front',1,5,bl);s.px('head','front',6,5,bl);
// золотая серьга
s.px('head','right',1,5,GOLD);s.px('head','left',6,5,GOLD);
// ТОРС — многослойная цыганская одежда
for(const p of ['body','rarm','larm','rleg','lleg'])s.cuboid(p,SHAWL,4);
s.fill('body','front',0,0,8,12,SHAWL);
// декольте-блуза
s.fill('body','front',2,1,4,3,[230,210,180,255]);s.px('body','front',3,1,SKIN);s.px('body','front',4,1,SKIN);
// золотое ожерелье-монисто
for(let x=2;x<6;x++)s.px('body','front',x,2,GOLD);s.px('body','front',3,3,GOLD);s.px('body','front',4,3,GOLD);
// узоры-пейсли на шали
for(const [x,y] of [[1,3],[6,3],[1,6],[6,6],[2,8],[5,8]])s.px('body','front',x,y,GOLD);
for(const [x,y] of [[1,4],[6,4],[2,7],[5,7]])s.px('body','front',x,y,SHAWLH);
// хрустальный шар-амулет со свечением
s.px('body','front',3,5,MYST);s.px('body','front',4,5,L(MYST,0.4));s.px('body','front',3,6,MYST);s.px('body','front',4,6,SHAWLD);
// яркий кушак
s.fill('body','front',0,8,8,1,GOLD);s.fill('body','front',0,9,8,1,SHAWLD);
// многослойная юбка-подол
for(let x=0;x<8;x++)s.px('body','front',x,10, x%2?SHAWLH:GOLD);
for(let x=0;x<8;x++)s.px('body','front',x,11, x%2?SHAWLD:SHAWL);
s.faceFill('body','back',SHAWLD,4);s.faceFill('body','top',SHAWLH,4);
for(const a of ['rarm','larm']){
  s.fill(a,'front',0,0,4,3,SHAWL);s.px(a,'front',1,1,GOLD);
  s.fill(a,'front',0,3,4,3,[230,210,180,255]); // рукав-блуза
  s.px(a,'front',0,5,GOLD);s.px(a,'front',3,5,GOLD); // браслеты
  s.fill(a,'front',0,6,4,1,GOLD);
  s.fill(a,'front',0,7,4,5,SKIN); // открытая рука
  s.px(a,'front',0,8,GOLD);s.px(a,'front',3,8,GOLD);s.px(a,'front',1,10,MYST); // кольца
}
for(const l of ['rleg','lleg']){
  for(let y=0;y<12;y++){const c=[SHAWL,SHAWLH,GOLD,SHAWLD][y%4];s.fill(l,'front',0,y,4,1,c);} // полосатая юбка-штаны
  s.fill(l,'front',0,10,4,2,[120,80,50,255]); // сандалии
}
s.save(process.argv[2]);
module.exports={meta:{id:'fantasy-female-fortune-seer',nameRu:'Цыганка-Прорицательница',nameEn:'Fortune Seer',role:'гадалка по судьбам',style:'fantasy',gender:'female',model:'slim'}};
