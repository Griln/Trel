'use strict';
const { Skin, shade, mix } = require('../../hand/paint');
const L=(c,t)=>mix(c,[255,255,255,255],t), D=(c,t)=>mix(c,[0,0,0,255],t);
const s=new Skin();
const SKIN=[252,226,210,255],SKD=shade(SKIN,0.88);
const HAIR=[170,230,210,255],HAIRH=[205,248,235,255],HAIRD=[128,195,178,255]; // мятные
const ROBE=[210,200,240,255],ROBEH=[235,228,250,255],ROBED=[175,162,215,255]; // лавандовая мантия
const HAT=[180,165,225,255],HATD=[140,124,185,255];
const STAR=[252,228,160,255];
const PINK=[255,200,218,255];
s.cuboid('head',SKIN,3);s.fill('head','front',0,7,8,1,SKD);
// мятные волосы
s.faceFill('head','top',HAIR,3);s.faceFill('head','back',HAIR,3);
for(let y=0;y<8;y++){for(let x=0;x<8;x++){s.px('head','right',x,y,HAIR);s.px('head','left',x,y,HAIR);}}
for(let x=0;x<8;x++)s.px('head','front',x,0,HAIR);
for(let y=1;y<6;y++){s.px('head','front',0,y,HAIR);s.px('head','front',7,y,HAIR);}
for(let y=0;y<8;y++){s.px('body','back',0,y,HAIR);s.px('body','back',7,y,HAIR);}
for(let x=1;x<7;x++)s.px('head','front',x,1, x%2?HAIRH:HAIRD); // чёлка
// остроконечная шляпа ведьмы (на hat-слое)
s.faceFill('hat','top',HAT,4);for(let x=2;x<6;x++)s.px('hat','top',x,0,HATD);
s.px('hat','top',3,0,STAR);s.px('hat','top',4,0,STAR);
// поля шляпы спереди
s.fill('head','front',0,0,8,1,HAT);s.px('head','front',3,0,STAR);
// ЛИЦО
const Wt=[250,250,252,255];
for(const ex of [1,5]){s.px('head','front',ex,3,Wt);s.px('head','front',ex+1,3,Wt);s.px('head','front',ex,4,Wt);s.px('head','front',ex+1,4,Wt);}
s.px('head','front',1,4,[120,180,160,255]);s.px('head','front',2,4,[70,120,105,255]);s.px('head','front',5,4,[70,120,105,255]);s.px('head','front',6,4,[120,180,160,255]);
s.px('head','front',2,3,[255,255,255,255]);s.px('head','front',5,3,[255,255,255,255]);
s.px('head','front',4,5,SKD);s.px('head','front',3,6,[235,155,170,255]);s.px('head','front',4,6,[235,155,170,255]);
const bl=mix(SKIN,[255,175,190,255],0.45);s.px('head','front',1,5,bl);s.px('head','front',6,5,bl);
// звёздочка-веснушка
s.px('head','front',6,2,STAR);
// ТОРС — мантия ведьмочки
for(const p of ['body','rarm','larm','rleg','lleg'])s.cuboid(p,ROBE,3);
s.fill('body','front',0,0,8,12,ROBE);
// воротник-пелерина
s.fill('body','front',1,0,6,2,ROBED);s.px('body','front',3,0,STAR);s.px('body','front',4,0,STAR);
// звёзды и луна на мантии
for(const [x,y] of [[1,4],[6,3],[2,7],[5,6],[1,8]])s.px('body','front',x,y,STAR);
// полумесяц-брошь
s.px('body','front',3,3,STAR);s.px('body','front',4,3,L(STAR,0.3));s.px('body','front',3,4,STAR);
// розовый бант-пояс
s.fill('body','front',2,8,4,1,PINK);s.px('body','front',2,8,L(PINK,0.3));s.px('body','front',5,8,L(PINK,0.3));s.px('body','front',3,9,PINK);s.px('body','front',4,9,PINK);
// волнистый подол
for(let x=0;x<8;x++)s.px('body','front',x,11, x%2?ROBED:HATD);
s.faceFill('body','back',ROBED,3);s.faceFill('body','top',ROBEH,2);
for(const a of ['rarm','larm']){
  s.fill(a,'front',0,0,4,12,ROBE);
  s.fill(a,'front',0,9,4,3,ROBED); // расклешённый рукав
  s.fill(a,'front',0,9,4,1,PINK);
  s.px(a,'front',1,3,STAR);s.px(a,'front',2,6,HAIRD);s.px(a,'front',1,10,STAR);
}
for(const l of ['rleg','lleg']){
  s.fill(l,'front',0,0,4,7,ROBE);for(let y=0;y<7;y++)s.px(l,'front',0,y,ROBED);
  s.px(l,'front',1,3,STAR);
  s.fill(l,'front',0,7,4,2,SKIN); // чулочки-ножка
  s.fill(l,'front',0,9,4,3,HATD);s.fill(l,'front',0,11,4,1,PINK); // ботиночки
}
s.save(process.argv[2]);
module.exports={meta:{id:'pastel-female-mint-witchling',nameRu:'Мятная Ведьмочка',nameEn:'Mint Witchling',role:'юная добрая колдунья',style:'pastel',gender:'female',model:'slim'}};
