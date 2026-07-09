'use strict';
const { Skin, shade, mix } = require('../../hand/paint');
const L=(c,t)=>mix(c,[255,255,255,255],t), D=(c,t)=>mix(c,[0,0,0,255],t);
const s=new Skin();
const SCALE=[180,50,50,255],SCALEH=[220,80,70,255],SCALED=[130,32,36,255]; // красная чешуя
const BELLY=[240,210,150,255],BELLYD=[200,170,110,255]; // светлое брюхо
const HORN=[230,220,200,255],HORND=[180,170,150,255];   // рога-кость
const FIRE=[255,170,40,255],FIREH=[255,230,100,255];
const GOLD=[245,205,110,255];
// ГОЛОВА — драконья морда
s.cuboid('head',SCALE,3);
s.faceFill('head','top',SCALEH,3);s.faceFill('head','back',SCALED,3);
// чешуйчатый узор
for(let y=0;y<8;y++)for(let x=0;x<8;x++)if((x+y)%2)s.px('head','front',x,y,SCALED);
// рога
s.px('hat','top',1,0,HORN);s.px('hat','top',6,0,HORN);s.px('head','front',0,0,HORN);s.px('head','front',7,0,HORN);s.px('head','front',1,0,HORND);s.px('head','front',6,0,HORND);
// гребень
s.px('head','top',3,0,FIRE);s.px('head','top',4,0,FIRE);
// ЛИЦО — рептильи глаза
s.fill('head','front',1,3,2,2,FIREH);s.fill('head','front',5,3,2,2,FIREH);
s.px('head','front',2,3,[20,20,20,255]);s.px('head','front',2,4,[20,20,20,255]); // вертикальный зрачок
s.px('head','front',5,3,[20,20,20,255]);s.px('head','front',5,4,[20,20,20,255]);
s.px('head','front',1,3,FIRE);s.px('head','front',6,4,FIRE);
// морда-брюхо + ноздри
s.fill('head','front',2,5,4,3,BELLY);
s.px('head','front',2,6,SCALED);s.px('head','front',5,6,SCALED); // ноздри
s.px('head','front',3,7,SCALED);s.px('head','front',4,7,SCALED); // пасть
s.px('head','front',2,7,FIRE);s.px('head','front',5,7,FIRE); // искры пламени
// ТОРС — чешуя со светлым брюхом
for(const p of ['body','rarm','larm','rleg','lleg'])s.cuboid(p,SCALE,3);
// чешуйчатый узор
for(let y=0;y<12;y++)for(let x=0;x<8;x++)if((x+y)%2)s.px('body','front',x,y,SCALED);
// светлое брюхо-пластины
s.fill('body','front',2,1,4,9,BELLY);
for(let y=2;y<10;y+=2)s.fill('body','front',2,y,4,1,BELLYD); // сегменты брюха
// огненное ядро в груди
s.px('body','front',3,3,FIRE);s.px('body','front',4,3,FIREH);s.px('body','front',3,4,FIREH);s.px('body','front',4,4,FIRE);
// гребень-шипы по плечам
for(let x=0;x<8;x++)if(x%2)s.px('body','front',x,0,FIRE);
// золотое ожерелье-сокровище
for(let x=2;x<6;x++)s.px('body','front',x,1,GOLD);
s.faceFill('body','back',SCALED,3);s.faceFill('body','top',SCALEH,3);
for(const a of ['rarm','larm']){
  s.cuboid(a,SCALE,3);
  for(let y=0;y<12;y++)for(let x=0;x<4;x++)if((x+y)%2)s.px(a,'front',x,y,SCALED);
  s.px(a,'front',1,4,FIRE);s.px(a,'front',2,7,FIREH);
  s.fill(a,'front',0,9,4,3,SCALED); // когти
  s.px(a,'front',0,11,HORN);s.px(a,'front',1,11,HORN);s.px(a,'front',3,11,HORN); // когти-кость
}
for(const l of ['rleg','lleg']){
  s.cuboid(l,SCALE,3);
  for(let y=0;y<12;y++)for(let x=0;x<4;x++)if((x+y)%2)s.px(l,'front',x,y,SCALED);
  s.px(l,'front',1,5,FIRE);
  s.fill(l,'front',0,10,4,2,SCALED);s.px(l,'front',0,11,HORN);s.px(l,'front',1,11,HORN);s.px(l,'front',2,11,HORN);s.px(l,'front',3,11,HORN); // лапы-когти
}
s.save(process.argv[2]);
module.exports={meta:{id:'fantasy-neutral-dragonkin',nameRu:'Дракончик-Оборотень',nameEn:'Dragonkin',role:'потомок древних драконов',style:'fantasy',gender:'neutral',model:'classic'}};
