'use strict';
const { Skin, shade, mix } = require('../../hand/paint');
const L=(c,t)=>mix(c,[255,255,255,255],t), D=(c,t)=>mix(c,[0,0,0,255],t);
const s=new Skin();
const SKIN=[150,140,170,255],SKD=shade(SKIN,0.8);         // лилово-серая кожа
const HOOD=[40,30,60,255],HOODH=[64,50,92,255];
const PURP=[190,110,255,255],PURPD=shade([190,110,255,255],0.6);
const GOLD=[240,210,120,255];
s.cuboid('head',SKIN,4);s.fill('head','front',0,7,8,1,SKD);
// глубокий капюшон оракула
s.faceFill('head','top',HOOD,4);s.faceFill('head','back',HOOD,4);
for(let y=0;y<8;y++){for(let x=0;x<8;x++){s.px('head','right',x,y,HOOD);s.px('head','left',x,y,HOOD);}}
for(let x=0;x<8;x++){s.px('head','front',x,0,HOOD);s.px('head','front',x,1,HOOD);}
s.px('head','front',0,2,HOOD);s.px('head','front',7,2,HOOD);
for(let x=1;x<7;x++)s.px('head','front',x,1,PURPD); // светящийся край
// третий глаз на лбу
s.px('head','front',3,2,GOLD);s.px('head','front',4,2,L(GOLD,0.4));
// ЛИЦО — провидец
const Wt=[225,215,240,255];
for(const ex of [1,5]){s.px('head','front',ex,3,Wt);s.px('head','front',ex+1,3,Wt);s.px('head','front',ex,4,Wt);s.px('head','front',ex+1,4,Wt);}
s.px('head','front',1,4,PURP);s.px('head','front',2,4,GOLD);s.px('head','front',5,4,GOLD);s.px('head','front',6,4,PURP);
s.px('head','front',1,3,L(PURP,0.4));s.px('head','front',6,3,L(PURP,0.4));
for(let x=1;x<7;x++)s.px('head','front',x,2,shade(SKIN,0.6));
s.px('head','front',4,5,SKD);s.px('head','front',3,6,shade(SKIN,0.6));s.px('head','front',4,6,shade(SKIN,0.6));
// руны-слёзы
s.px('head','front',1,5,PURPD);s.px('head','front',6,5,PURPD);
// ТОРС — мантия с созвездиями
for(const p of ['body','rarm','larm','rleg','lleg'])s.cuboid(p,HOOD,5);
s.fill('body','front',0,0,8,12,HOOD);
// золотой ворот
for(let x=1;x<7;x++)s.px('body','front',x,1,GOLD);
// звёзды-точки
for(const [x,y] of [[1,3],[3,2],[5,4],[6,6],[2,7],[4,8],[6,3],[1,8]]){s.px('body','front',x,y,GOLD);}
for(const [x,y] of [[2,4],[4,5],[5,7]]){s.px('body','front',x,y,PURP);}
// созвездие-линии
s.px('body','front',2,3,PURPD);s.px('body','front',3,3,PURPD);
// центральная сфера-предсказание
s.px('body','front',3,5,L(PURP,0.5));s.px('body','front',4,5,PURP);s.px('body','front',3,6,PURP);s.px('body','front',4,6,PURPD);
s.fill('body','front',0,10,8,1,GOLD);s.px('body','front',3,10,PURP);s.px('body','front',4,10,PURP);
s.faceFill('body','top',HOODH,4);s.faceFill('body','back',D(HOOD,0.15),5);
for(const a of ['rarm','larm']){
  s.cuboid(a,HOOD,5);s.fill(a,'front',0,0,4,12,HOOD);
  s.fill(a,'front',0,8,4,4,HOODH); // широкий рукав-мантия
  s.fill(a,'front',0,8,4,1,GOLD);
  s.px(a,'front',1,3,GOLD);s.px(a,'front',2,6,PURP);
}
for(const l of ['rleg','lleg']){
  s.fill(l,'front',0,0,4,9,HOOD);for(let y=0;y<9;y++)s.px(l,'front',0,y,D(HOOD,0.15));
  s.px(l,'front',1,3,GOLD);s.px(l,'front',2,6,PURP);
  s.fill(l,'front',0,9,4,3,GOLD);
}
s.save(process.argv[2]);
module.exports={meta:{id:'cyber-neutral-neon-oracle',nameRu:'Неон-Оракул',nameEn:'Neon Oracle',role:'предсказатель сети',style:'cyber',gender:'neutral',model:'classic'}};
