'use strict';
const { Skin, shade, mix } = require('../../hand/paint');
const L=(c,t)=>mix(c,[255,255,255,255],t), D=(c,t)=>mix(c,[0,0,0,255],t);
const s=new Skin();
const SKIN=[255,228,212,255],SKD=shade(SKIN,0.88);
const HAIR=[255,195,215,255],HAIRH=[255,222,235,255],HAIRD=[228,150,185,255]; // сакура-розовые
const KIMO=[252,240,245,255],KIMOH=[255,250,252,255],KIMOD=[235,210,222,255]; // кимоно
const PETAL=[255,180,205,255];
const GOLD=[245,222,150,255];
const RED=[235,130,150,255];
s.cuboid('head',SKIN,3);s.fill('head','front',0,7,8,1,SKD);
// длинные розовые волосы
s.faceFill('head','top',HAIR,3);s.faceFill('head','back',HAIR,3);
for(let x=0;x<8;x++)s.px('head','top',x,0,HAIRH);
for(let y=0;y<8;y++){for(let x=0;x<8;x++){s.px('head','right',x,y,HAIR);s.px('head','left',x,y,HAIR);}}
for(let x=0;x<8;x++)s.px('head','front',x,0,HAIR);
for(let y=1;y<6;y++){s.px('head','front',0,y,HAIR);s.px('head','front',7,y,HAIR);}
for(let y=0;y<8;y++){s.px('body','back',0,y,HAIR);s.px('body','back',7,y,HAIR);s.px('body','back',1,y,HAIRD);s.px('body','back',6,y,HAIRD);}
// цветок сакуры в волосах
s.px('head','front',5,1,PETAL);s.px('head','front',6,0,PETAL);s.px('head','front',5,0,GOLD);
// чёлка
for(let x=1;x<7;x++)s.px('head','front',x,1, x%2?HAIRH:HAIRD);
// ЛИЦО — нежное
const Wt=[250,250,252,255];
for(const ex of [1,5]){s.px('head','front',ex,3,Wt);s.px('head','front',ex+1,3,Wt);s.px('head','front',ex,4,Wt);s.px('head','front',ex+1,4,Wt);}
s.px('head','front',1,4,[210,120,150,255]);s.px('head','front',2,4,[140,70,100,255]);s.px('head','front',5,4,[140,70,100,255]);s.px('head','front',6,4,[210,120,150,255]);
s.px('head','front',2,3,[255,255,255,255]);s.px('head','front',5,3,[255,255,255,255]);
s.px('head','front',0,3,[180,110,130,255]);s.px('head','front',7,3,[180,110,130,255]); // ресницы
s.px('head','front',4,5,SKD);s.px('head','front',3,6,RED);s.px('head','front',4,6,RED);
const bl=mix(SKIN,[255,170,185,255],0.45);s.px('head','front',1,5,bl);s.px('head','front',6,5,bl);
// ТОРС — кимоно
for(const p of ['body','rarm','larm','rleg','lleg'])s.cuboid(p,KIMO,3);
s.fill('body','front',0,0,8,12,KIMO);
// запах кимоно (V-образный)
s.px('body','front',3,1,KIMOD);s.px('body','front',4,1,KIMOD);s.px('body','front',2,2,KIMOD);s.px('body','front',5,2,KIMOD);s.px('body','front',2,3,KIMOD);s.px('body','front',5,3,KIMOD);
s.fill('body','front',3,2,2,6,KIMOD); // внутренний запах
// узор лепестков сакуры
for(const [x,y] of [[1,2],[6,3],[2,5],[5,6],[1,7],[6,7]]){s.px('body','front',x,y,PETAL);s.px('body','front',x,y+0,PETAL);}
s.px('body','front',1,2,PETAL);s.px('body','front',6,4,HAIR);s.px('body','front',2,6,PETAL);
// оби-пояс (красно-розовый)
s.fill('body','front',0,8,8,2,RED);s.fill('body','front',0,8,8,1,L(RED,0.2));
s.px('body','front',3,9,GOLD);s.px('body','front',4,9,GOLD);
// подол
for(let x=0;x<8;x++)s.px('body','front',x,11, x%2?PETAL:KIMOD);
s.faceFill('body','back',KIMOD,3);s.faceFill('body','top',KIMOH,2);
for(const a of ['rarm','larm']){
  s.fill(a,'front',0,0,4,12,KIMO);
  s.fill(a,'front',0,8,4,4,KIMOD); // широкий рукав кимоно
  s.fill(a,'front',0,8,4,1,RED);
  s.px(a,'front',1,3,PETAL);s.px(a,'front',2,6,HAIR);s.px(a,'front',1,10,PETAL); // лепестки
}
for(const l of ['rleg','lleg']){
  s.fill(l,'front',0,0,4,9,KIMO);for(let y=0;y<9;y++)s.px(l,'front',0,y,KIMOD);
  s.px(l,'front',1,3,PETAL);s.px(l,'front',2,6,HAIR);
  s.fill(l,'front',0,9,4,3,RED);s.px(l,'front',1,11,KIMOH); // гэта-сандалии
}
s.save(process.argv[2]);
module.exports={meta:{id:'pastel-female-sakura',nameRu:'Сакура',nameEn:'Sakura',role:'дева весеннего цветения',style:'pastel',gender:'female',model:'slim'}};
