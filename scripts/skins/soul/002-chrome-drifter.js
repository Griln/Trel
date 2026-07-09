'use strict';
const { Skin, shade, mix } = require('../../hand/paint');
const L=(c,t)=>mix(c,[255,255,255,255],t), D=(c,t)=>mix(c,[0,0,0,255],t);
const s=new Skin();
const SKIN=[212,182,160,255],SKD=shade(SKIN,0.78);
const HAIR=[120,110,96,255],HAIRH=[160,150,134,255];      // песочно-русые
const CHR=[150,158,168,255],CHRH=[200,206,214,255],CHRD=[96,102,112,255]; // хром
const AMB=[255,170,60,255],AMBD=shade([255,170,60,255],0.6); // янтарный неон
const PON=[78,70,58,255];                                  // пыльный пончо
// ГОЛОВА
s.cuboid('head',SKIN,5); s.fill('head','front',0,7,8,1,SKD);
// растрёпанные волосы + бандана
s.faceFill('head','top',HAIR,7); s.faceFill('head','back',HAIR,7);
for(let x=0;x<8;x++)s.px('head','top',x,0,HAIRH);
for(let x=0;x<8;x++)s.px('head','front',x,0,HAIR);
s.px('head','front',1,1,HAIR);s.px('head','front',6,1,HAIR);
for(let y=0;y<4;y++){s.px('head','right',0,y,HAIR);s.px('head','left',7,y,HAIR);}
// бандана на лбу
s.fill('head','front',0,1,8,1,AMBD);s.px('head','front',2,1,AMB);s.px('head','front',5,1,AMB);
// ЛИЦО — суровое, шрам
s.px('head','front',1,2,D(HAIR,0.2));s.px('head','front',2,2,D(HAIR,0.2));s.px('head','front',5,2,D(HAIR,0.2));s.px('head','front',6,2,D(HAIR,0.2));
const Wt=[238,242,248,255],P=[20,18,26,255];
for(const ex of [1,5]){s.px('head','front',ex,3,Wt);s.px('head','front',ex+1,3,Wt);s.px('head','front',ex,4,Wt);s.px('head','front',ex+1,4,Wt);}
s.px('head','front',1,4,AMB);s.px('head','front',2,4,P);s.px('head','front',5,4,P);s.px('head','front',6,4,AMB);
s.px('head','front',2,3,[255,255,255,255]);s.px('head','front',5,3,[255,255,255,255]);
s.px('head','front',4,5,SKD);s.px('head','front',3,6,shade(SKIN,0.5));s.px('head','front',4,6,shade(SKIN,0.5));
s.px('head','front',2,2,P);s.px('head','front',2,3,P);s.px('head','front',2,5,P); // вертикальный шрам через левый глаз
// борода-щетина
for(const x of [2,3,4,5])s.px('head','front',x,7,D(SKIN,0.25));
// ТОРС — пыльный пончо поверх хром-нагрудника
for(const p of ['body','rarm','larm','rleg','lleg'])s.cuboid(p,PON,6);
// хром-нагрудник проглядывает
s.fill('body','front',2,1,4,6,CHR);s.fill('body','front',2,1,4,1,CHRH);
s.px('body','front',3,2,CHRH);s.px('body','front',4,3,CHRD);
// янтарное ядро-реактор
s.px('body','front',3,4,AMB);s.px('body','front',4,4,L(AMB,0.5));s.px('body','front',3,5,AMB);s.px('body','front',4,5,AMBD);
// пончо-вырез по краям
for(let y=0;y<10;y++){s.px('body','front',0,y,PON);s.px('body','front',1,y,D(PON,0.15));s.px('body','front',7,y,PON);s.px('body','front',6,y,D(PON,0.15));}
// бахрома пончо снизу
for(let x=0;x<8;x++)s.px('body','front',x,9,x%2?D(PON,0.3):PON);
// ремень с патронами
s.fill('body','front',0,10,8,1,D(PON,0.4));for(const x of [1,3,5,7])s.px('body','front',x,10,AMBD);
s.faceFill('body','back',D(PON,0.2),7);s.faceFill('body','top',D(PON,0.1),5);
// РУКИ — хром-наручи + перчатки
for(const a of ['rarm','larm']){
  s.faceFill(a,'top',D(PON,0.1),4);
  s.fill(a,'front',0,0,4,3,PON);                  // плечо пончо
  s.fill(a,'front',0,5,4,3,CHR);s.fill(a,'front',0,5,4,1,CHRH); // хром-наруч
  s.px(a,'front',1,6,AMBD);s.px(a,'front',2,6,AMBD);
  s.fill(a,'front',0,8,4,4,D([90,78,64,255],0.1)); // кожаная перчатка
}
// НОГИ — штаны + хром-сапоги
for(const l of ['rleg','lleg']){
  s.fill(l,'front',0,0,4,4,D(PON,0.1));
  s.fill(l,'front',0,8,4,4,CHRD);s.fill(l,'front',0,8,4,1,CHR); // сапог
  s.px(l,'front',0,11,AMBD);s.px(l,'front',3,11,AMBD);
}
s.save(process.argv[2]);
module.exports={meta:{id:'cyber-male-chrome-drifter',nameRu:'Хром-Бродяга',nameEn:'Chrome Drifter',role:'наёмник пустошей',style:'cyber',gender:'male',model:'classic'}};
