'use strict';
const { Skin, shade, mix } = require('../../hand/paint');
const L=(c,t)=>mix(c,[255,255,255,255],t), D=(c,t)=>mix(c,[0,0,0,255],t);
const s=new Skin();
const SKIN=[228,196,172,255],SKD=shade(SKIN,0.8);
const HAIR=[225,210,140,255],HAIRH=[245,235,180,255],HAIRD=[185,170,110,255]; // золотистые
const LEAF=[60,140,80,255],LEAFH=[88,176,104,255],LEAFD=[42,100,58,255];      // листва-броня
const GOLD=[235,205,120,255];
const LEATH=[120,88,56,255];
s.cuboid('head',SKIN,4);s.fill('head','front',0,7,8,1,SKD);
// длинные золотистые волосы
s.faceFill('head','top',HAIR,4);s.faceFill('head','back',HAIR,4);
for(let x=0;x<8;x++)s.px('head','top',x,0,HAIRH);
for(let y=0;y<8;y++){for(let x=0;x<8;x++){s.px('head','right',x,y,HAIR);s.px('head','left',x,y,HAIR);}}
for(let x=0;x<8;x++)s.px('head','front',x,0,HAIR);
for(let y=1;y<6;y++){s.px('head','front',0,y,HAIR);s.px('head','front',7,y,HAIR);}
for(let y=0;y<8;y++){s.px('body','back',0,y,HAIR);s.px('body','back',7,y,HAIR);s.px('body','back',1,y,HAIRD);s.px('body','back',6,y,HAIRD);}
// остроконечные эльфийские уши
s.px('head','right',2,4,SKIN);s.px('head','left',5,4,SKIN);s.px('head','right',1,3,SKIN);s.px('head','left',6,3,SKIN);
// венок из листьев
s.fill('head','front',1,1,6,1,LEAF);s.px('head','front',2,1,LEAFH);s.px('head','front',5,1,LEAFH);s.px('head','front',3,1,GOLD);s.px('head','front',4,1,GOLD);
// ЛИЦО
s.px('head','front',1,2,HAIRD);s.px('head','front',6,2,HAIRD);
const Wt=[240,243,249,255];
for(const ex of [1,5]){s.px('head','front',ex,3,Wt);s.px('head','front',ex+1,3,Wt);s.px('head','front',ex,4,Wt);s.px('head','front',ex+1,4,Wt);}
s.px('head','front',1,4,LEAFH);s.px('head','front',2,4,[40,60,40,255]);s.px('head','front',5,4,[40,60,40,255]);s.px('head','front',6,4,LEAFH);
s.px('head','front',2,3,[255,255,255,255]);s.px('head','front',5,3,[255,255,255,255]);
s.px('head','front',0,3,[40,40,40,255]);s.px('head','front',7,3,[40,40,40,255]); // ресницы
s.px('head','front',4,5,SKD);s.px('head','front',3,6,[205,120,120,255]);s.px('head','front',4,6,[205,120,120,255]);
const bl=mix(SKIN,[255,150,160,255],0.35);s.px('head','front',1,5,bl);s.px('head','front',6,5,bl);
// ТОРС — лиственная броня + туника
for(const p of ['body','rarm','larm','rleg','lleg'])s.cuboid(p,LEAF,4);
s.fill('body','front',1,1,6,8,LEAFH);
// чешуйки-листья
for(let y=2;y<8;y++)for(let x=1;x<7;x++)if((x+y)%2)s.px('body','front',x,y,LEAF);
s.fill('body','front',1,1,6,1,LEAFD);
// золотой нагрудный медальон-лист
s.px('body','front',3,3,GOLD);s.px('body','front',4,3,GOLD);s.px('body','front',3,4,LEAFH);s.px('body','front',4,4,L(LEAFH,0.3));s.px('body','front',3,5,GOLD);
// ремень колчана
s.px('body','front',1,2,LEATH);s.px('body','front',2,3,LEATH);s.px('body','front',3,4,LEATH);s.px('body','front',4,5,LEATH);s.px('body','front',5,6,LEATH);
// стрелы за плечом
s.px('body','front',6,1,GOLD);s.px('body','front',6,2,HAIRD);
// пояс
s.fill('body','front',1,9,6,1,LEATH);s.px('body','front',3,9,GOLD);s.px('body','front',4,9,GOLD);
s.faceFill('body','back',LEAFD,4);s.faceFill('body','top',LEAFD,4);
for(const a of ['rarm','larm']){
  s.faceFill(a,'top',LEAFD,4);
  s.fill(a,'front',0,0,4,2,LEAF);s.px(a,'front',1,0,LEAFH); // лиственный наплечник
  s.fill(a,'front',0,2,4,4,SKIN); // открытое предплечье
  s.fill(a,'front',0,6,4,2,LEATH);s.px(a,'front',1,6,GOLD); // наруч-перчатка лучника
  s.fill(a,'front',0,8,4,4,SKIN);s.px(a,'front',0,8,LEATH);
}
for(const l of ['rleg','lleg']){
  s.fill(l,'front',0,0,4,5,LEAFH);for(let y=0;y<5;y++)for(let x=0;x<4;x++)if((x+y)%2)s.px(l,'front',x,y,LEAF); // лиственная юбка
  s.fill(l,'front',0,5,4,3,SKIN); // нога
  s.fill(l,'front',0,8,4,4,LEATH);s.fill(l,'front',0,8,4,1,GOLD); // сапожки
}
s.save(process.argv[2]);
module.exports={meta:{id:'fantasy-female-elven-archer',nameRu:'Эльфийская Лучница',nameEn:'Elven Archer',role:'страж эльфийских лесов',style:'fantasy',gender:'female',model:'slim'}};
