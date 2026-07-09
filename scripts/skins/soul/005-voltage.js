'use strict';
const { Skin, shade, mix } = require('../../hand/paint');
const L=(c,t)=>mix(c,[255,255,255,255],t), D=(c,t)=>mix(c,[0,0,0,255],t);
const s=new Skin();
const SKIN=[210,168,140,255],SKD=shade(SKIN,0.78);
const HAIR=[235,210,80,255],HAIRH=[255,240,140,255];    // электро-жёлтые волосы
const SUIT=[32,34,40,255],SUITH=[54,58,68,255];
const VOLT=[255,235,60,255],VOLTD=shade([255,235,60,255],0.6);
const WIRE=[70,200,255,255];
s.cuboid('head',SKIN,5);s.fill('head','front',0,7,8,1,SKD);
// взъерошенные молнии-волосы
s.faceFill('head','top',HAIR,7);s.faceFill('head','back',HAIR,7);
for(let x=0;x<8;x++)s.px('head','top',x,0,HAIRH);
for(const x of [1,3,5,7])s.px('head','top',x,0,VOLTD);
for(let x=0;x<8;x++)s.px('head','front',x,0,HAIR);
for(const x of [1,3,5])s.px('head','front',x,1,HAIR);
for(let y=0;y<3;y++){s.px('head','right',0,y,HAIR);s.px('head','left',7,y,HAIR);}
// ЛИЦО — азартная ухмылка
s.px('head','front',1,2,D(HAIR,0.3));s.px('head','front',2,2,D(HAIR,0.3));s.px('head','front',5,2,D(HAIR,0.3));s.px('head','front',6,2,D(HAIR,0.3));
const Wt=[238,242,248,255],P=[20,18,20,255];
for(const ex of [1,5]){s.px('head','front',ex,3,Wt);s.px('head','front',ex+1,3,Wt);s.px('head','front',ex,4,Wt);s.px('head','front',ex+1,4,Wt);}
s.px('head','front',1,4,VOLT);s.px('head','front',2,4,P);s.px('head','front',5,4,P);s.px('head','front',6,4,VOLT);
s.px('head','front',2,3,[255,255,255,255]);s.px('head','front',5,3,[255,255,255,255]);
s.px('head','front',4,5,SKD);
s.px('head','front',2,6,SKD);s.px('head','front',3,6,shade(SKIN,0.5));s.px('head','front',4,6,shade(SKIN,0.5));s.px('head','front',5,6,SKD); // ухмылка
// зигзаг-татуировка на щеке
s.px('head','front',6,5,VOLT);s.px('head','front',5,5,VOLTD);
// ТОРС — комбинезон с оголёнными проводами
for(const p of ['body','rarm','larm','rleg','lleg'])s.cuboid(p,SUIT,5);
s.fill('body','front',1,1,6,8,SUITH);
// батарея-ядро
s.fill('body','front',3,3,2,3,D(SUIT,0.3));s.px('body','front',3,3,VOLT);s.px('body','front',4,3,VOLT);s.px('body','front',3,5,VOLT);s.px('body','front',4,5,VOLT);
s.px('body','front',3,4,L(VOLT,0.5));s.px('body','front',4,4,VOLT);
// провода-молнии расходятся
s.px('body','front',2,2,WIRE);s.px('body','front',1,3,WIRE);s.px('body','front',5,2,VOLT);s.px('body','front',6,3,VOLT);
s.px('body','front',2,6,VOLT);s.px('body','front',1,7,WIRE);s.px('body','front',5,6,WIRE);s.px('body','front',6,7,VOLT);
// плечевые разъёмы
s.px('body','front',0,2,VOLT);s.px('body','front',7,2,VOLT);
s.fill('body','front',0,10,8,1,D(SUIT,0.3));s.px('body','front',3,10,VOLT);s.px('body','front',4,10,VOLT);
s.faceFill('body','top',SUITH,4);s.faceFill('body','back',D(SUIT,0.2),5);
for(const a of ['rarm','larm']){
  s.faceFill(a,'top',SUITH,4);
  s.px(a,'front',1,2,VOLT);s.px(a,'front',2,4,WIRE);s.px(a,'front',1,6,VOLT); // провода по рукаву
  s.fill(a,'front',0,7,4,1,VOLTD);
  s.fill(a,'front',0,8,4,4,D(SUIT,0.15));s.px(a,'front',0,8,VOLT);s.px(a,'front',3,8,VOLT);
}
for(const l of ['rleg','lleg']){
  s.fill(l,'front',0,0,4,4,SUITH);s.px(l,'front',1,2,VOLTD);
  s.fill(l,'front',0,7,4,1,VOLTD);
  s.fill(l,'front',0,9,4,3,D(SUIT,0.2));s.fill(l,'front',0,11,4,1,VOLT);
}
s.save(process.argv[2]);
module.exports={meta:{id:'cyber-male-voltage',nameRu:'Вольтаж',nameEn:'Voltage',role:'боец на электробатарее',style:'cyber',gender:'male',model:'classic'}};
