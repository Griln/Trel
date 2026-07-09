'use strict';
const { Skin, shade, mix } = require('../../hand/paint');
const L=(c,t)=>mix(c,[255,255,255,255],t), D=(c,t)=>mix(c,[0,0,0,255],t);
const s=new Skin();
const SKIN=[248,216,196,255],SKD=shade(SKIN,0.86);
const HAIR=[255,180,210,255],HAIRH=[255,212,232,255],HAIRD=[225,130,170,255]; // розовый ирокез
const JACK=[200,230,235,255],JACKH=[228,244,246,255],JACKD=[160,198,205,255]; // мятная косуха
const LILAC=[210,190,245,255];
const STUD=[245,235,200,255]; // пастельные заклёпки
s.cuboid('head',SKIN,3);s.fill('head','front',0,7,8,1,SKD);
// розовый ирокез
s.faceFill('head','top',D(SKIN,0.05),3);s.faceFill('head','back',JACKD,3);
for(let x=2;x<6;x++)s.px('head','top',x,0,HAIR);s.px('hat','top',3,0,HAIRH);s.px('hat','top',4,0,HAIRH);
for(let x=2;x<6;x++)s.px('head','front',x,0,HAIR);s.px('head','front',3,0,HAIRH);
// выбритые виски с узором
s.px('head','front',1,1,LILAC);s.px('head','front',6,1,LILAC);
for(let y=0;y<3;y++){s.px('head','right',0,y,SKD);s.px('head','left',7,y,SKD);}
// ЛИЦО — дерзкое
const Wt=[250,250,252,255];
for(const ex of [1,5]){s.px('head','front',ex,3,Wt);s.px('head','front',ex+1,3,Wt);s.px('head','front',ex,4,Wt);s.px('head','front',ex+1,4,Wt);}
s.px('head','front',1,4,[200,90,140,255]);s.px('head','front',2,4,[120,50,90,255]);s.px('head','front',5,4,[120,50,90,255]);s.px('head','front',6,4,[200,90,140,255]);
s.px('head','front',2,3,[255,255,255,255]);s.px('head','front',5,3,[255,255,255,255]);
s.px('head','front',4,5,SKD);
s.px('head','front',2,6,SKD);s.px('head','front',3,6,SKD);s.px('head','front',4,6,[225,150,160,255]);s.px('head','front',5,6,[225,150,160,255]); // ухмылка набок
// пастельная серьга
s.px('head','left',6,5,STUD);s.px('head','right',1,5,LILAC);
const bl=mix(SKIN,[255,170,190,255],0.35);s.px('head','front',6,5,bl);
// ТОРС — мятная косуха с заклёпками
for(const p of ['body','rarm','larm','rleg','lleg'])s.cuboid(p,JACK,3);
s.fill('body','front',0,0,8,12,JACK);
// асимметричная молния
for(let y=1;y<9;y++)s.px('body','front',3,y,STUD);s.px('body','front',4,2,STUD);
// воротник-стойка
s.fill('body','front',1,0,6,1,JACKD);s.px('body','front',2,0,LILAC);s.px('body','front',5,0,LILAC);
// заклёпки по плечам
for(const [x,y] of [[1,1],[6,1],[1,3],[6,3],[2,8],[5,8]])s.px('body','front',x,y,STUD);
// нашивка-сердце (панк, но милый)
s.px('body','front',5,4,HAIR);s.px('body','front',6,4,HAIR);s.px('body','front',5,5,HAIRD);
// лиловая футболка под курткой
s.fill('body','front',3,9,2,1,LILAC);
// клёпаный ремень
s.fill('body','front',0,10,8,1,JACKD);for(const x of [1,3,5,7])s.px('body','front',x,10,STUD);
s.faceFill('body','back',JACKD,3);s.faceFill('body','top',JACKH,2);
for(const a of ['rarm','larm']){
  s.fill(a,'front',0,0,4,12,JACK);s.fill(a,'front',0,0,4,1,JACKH);
  s.px(a,'front',0,2,STUD);s.px(a,'front',3,2,STUD);s.px(a,'front',1,5,STUD); // заклёпки
  s.fill(a,'front',0,8,4,1,JACKD); // манжет
  s.fill(a,'front',0,9,4,3,SKIN);s.px(a,'front',0,9,LILAC); // браслет-кисть
}
for(const l of ['rleg','lleg']){
  s.fill(l,'front',0,0,4,8,D(LILAC,0.08)); // рваные джинсы-пастель
  s.px(l,'front',1,3,JACK);s.px(l,'front',2,5,SKIN); // дырка
  s.fill(l,'front',0,8,4,4,JACKH);s.fill(l,'front',0,11,4,1,HAIR); // кеды с розовой подошвой
  s.px(l,'front',1,9,STUD);
}
s.save(process.argv[2]);
module.exports={meta:{id:'pastel-male-sugar-rebel',nameRu:'Сахарный Бунтарь',nameEn:'Sugar Rebel',role:'панк с добрым сердцем',style:'pastel',gender:'male',model:'classic'}};
