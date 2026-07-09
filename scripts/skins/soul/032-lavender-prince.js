'use strict';
const { Skin, shade, mix } = require('../../hand/paint');
const L=(c,t)=>mix(c,[255,255,255,255],t), D=(c,t)=>mix(c,[0,0,0,255],t);
const s=new Skin();
const SKIN=[252,224,206,255],SKD=shade(SKIN,0.86);
const HAIR=[200,180,235,255],HAIRH=[228,214,248,255],HAIRD=[165,144,205,255]; // лавандовые
const COAT=[225,215,245,255],COATH=[244,238,252,255],COATD=[190,178,222,255]; // светло-сиреневый камзол
const GOLD=[245,222,150,255];
const ROSE=[255,200,210,255];
s.cuboid('head',SKIN,3);s.fill('head','front',0,7,8,1,SKD);
// аккуратные лавандовые волосы с пробором
s.faceFill('head','top',HAIR,3);s.faceFill('head','back',HAIR,3);
for(let x=0;x<8;x++)s.px('head','top',x,0,HAIRH);
for(let y=0;y<5;y++){s.px('head','right',0,y,HAIR);s.px('head','left',7,y,HAIR);}
for(let x=0;x<8;x++)s.px('head','front',x,0,HAIR);
s.px('head','front',3,1,SKIN);s.px('head','front',4,1,SKIN); // пробор-чёлка
s.px('head','front',0,1,HAIR);s.px('head','front',1,1,HAIRD);s.px('head','front',6,1,HAIRD);s.px('head','front',7,1,HAIR);
s.px('head','front',2,1,HAIR);s.px('head','front',5,1,HAIR);
// небольшая золотая корона-обруч
s.px('head','front',2,0,GOLD);s.px('head','front',4,0,GOLD);s.px('head','front',5,0,GOLD);
// ЛИЦО — благородное мягкое
const Wt=[250,250,252,255];
for(const ex of [1,5]){s.px('head','front',ex,3,Wt);s.px('head','front',ex+1,3,Wt);s.px('head','front',ex,4,Wt);s.px('head','front',ex+1,4,Wt);}
s.px('head','front',1,4,[150,120,190,255]);s.px('head','front',2,4,[90,70,120,255]);s.px('head','front',5,4,[90,70,120,255]);s.px('head','front',6,4,[150,120,190,255]);
s.px('head','front',2,3,[255,255,255,255]);s.px('head','front',5,3,[255,255,255,255]);
s.px('head','front',4,5,SKD);s.px('head','front',3,6,[230,150,160,255]);s.px('head','front',4,6,[230,150,160,255]);
const bl=mix(SKIN,[255,180,195,255],0.35);s.px('head','front',1,5,bl);s.px('head','front',6,5,bl);
// ТОРС — придворный камзол
for(const p of ['body','rarm','larm','rleg','lleg'])s.cuboid(p,COAT,3);
s.fill('body','front',0,0,8,12,COAT);
// белое жабо
s.fill('body','front',3,0,2,3,COATH);s.px('body','front',3,1,ROSE);s.px('body','front',4,2,ROSE);
// золотые пуговицы по центру
for(let y=3;y<9;y+=2){s.px('body','front',3,y,GOLD);s.px('body','front',4,y,GOLD);}
// сиреневые отвороты-лацканы
for(let y=1;y<9;y++){s.px('body','front',1,y,COATD);s.px('body','front',6,y,COATD);}
s.px('body','front',2,2,COATH);s.px('body','front',5,2,COATH);
// розовая лента-орден через грудь
s.px('body','front',2,3,ROSE);s.px('body','front',3,4,ROSE);s.px('body','front',4,5,ROSE);s.px('body','front',5,6,ROSE);
// золотой пояс
s.fill('body','front',0,9,8,1,GOLD);s.px('body','front',3,9,ROSE);s.px('body','front',4,9,ROSE);
s.faceFill('body','back',COATD,3);s.faceFill('body','top',COATH,2);
for(const a of ['rarm','larm']){
  s.fill(a,'front',0,0,4,12,COAT);s.fill(a,'front',0,0,4,1,COATH);
  s.fill(a,'front',0,0,4,3,COATD); // эполет-плечо
  s.px(a,'front',1,1,GOLD);s.px(a,'front',2,1,GOLD);
  s.fill(a,'front',0,8,4,1,GOLD); // манжет
  s.fill(a,'front',0,9,4,3,COATH);s.px(a,'front',1,10,ROSE); // кружевная манжета
}
for(const l of ['rleg','lleg']){
  s.fill(l,'front',0,0,4,8,COATD); // бриджи
  s.px(l,'front',1,3,GOLD);
  s.fill(l,'front',0,8,4,4,COATH);s.fill(l,'front',0,11,4,1,GOLD); // туфли с пряжкой
}
s.save(process.argv[2]);
module.exports={meta:{id:'pastel-male-lavender-prince',nameRu:'Лавандовый Принц',nameEn:'Lavender Prince',role:'юный наследник весны',style:'pastel',gender:'male',model:'classic'}};
