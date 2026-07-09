'use strict';
const { Skin, shade, mix } = require('../../hand/paint');
const L=(c,t)=>mix(c,[255,255,255,255],t), D=(c,t)=>mix(c,[0,0,0,255],t);
const s=new Skin();
const SKIN=[170,168,158,255],SKD=shade(SKIN,0.74);       // мертвенно-бледная
const ROBE=[26,24,34,255],ROBEH=[44,40,58,255],ROBED=[14,12,18,255];
const NEC=[120,255,150,255],NECD=shade([120,255,150,255],0.55); // трупно-зелёный свет
const BONE=[214,210,196,255],BONED=[170,166,150,255];
const PURP=[120,60,160,255];
s.cuboid('head',SKIN,4);s.fill('head','front',0,7,8,1,SKD);
// глубокий капюшон с костяной короной
s.faceFill('head','top',ROBE,4);s.faceFill('head','back',ROBE,4);
for(let y=0;y<8;y++){for(let x=0;x<8;x++){s.px('head','right',x,y,ROBE);s.px('head','left',x,y,ROBE);}}
for(let x=0;x<8;x++){s.px('head','front',x,0,ROBE);s.px('head','front',x,1,ROBE);}
s.px('head','front',0,2,ROBE);s.px('head','front',7,2,ROBE);
// костяные шипы короны
s.px('hat','top',2,0,BONE);s.px('hat','top',5,0,BONE);s.px('head','front',2,0,BONE);s.px('head','front',5,0,BONE);
// ЛИЦО в тени — горящие зелёные глаза
const Wt=[60,70,60,255];
for(let x=1;x<7;x++)s.px('head','front',x,2,shade(SKIN,0.55));
for(const ex of [1,5]){s.px('head','front',ex,3,Wt);s.px('head','front',ex+1,3,Wt);}
s.px('head','front',1,4,NEC);s.px('head','front',2,4,NECD);s.px('head','front',5,4,NECD);s.px('head','front',6,4,NEC);
s.px('head','front',1,3,NECD);s.px('head','front',6,3,NECD);
// впалые щёки
s.px('head','front',1,5,SKD);s.px('head','front',6,5,SKD);
s.px('head','front',3,6,D(SKIN,0.3));s.px('head','front',4,6,D(SKIN,0.3));
s.px('head','front',3,5,SKD);s.px('head','front',4,5,SKD);
// ТОРС — некро-роба
for(const p of ['body','rarm','larm','rleg','lleg'])s.cuboid(p,ROBE,5);
s.fill('body','front',0,0,8,12,ROBE);
// костяной ворот-ожерелье из черепков
for(let x=1;x<7;x++)s.px('body','front',x,1, x%2?BONE:BONED);
s.px('body','front',3,0,ROBED);s.px('body','front',4,0,ROBED);
// рёберный костяной нагрудник
for(let y=3;y<8;y++){s.px('body','front',1,y,BONED);s.px('body','front',6,y,BONED);}
for(const y of [3,5,7]){s.px('body','front',2,y,BONE);s.px('body','front',3,y,BONE);s.px('body','front',4,y,BONE);s.px('body','front',5,y,BONE);}
// зелёное сердце-фантом
s.px('body','front',3,4,NEC);s.px('body','front',4,4,L(NEC,0.4));s.px('body','front',3,5,NECD);s.px('body','front',4,5,NEC);
// фиолетовые руны
s.px('body','front',0,4,PURP);s.px('body','front',7,4,PURP);s.px('body','front',0,7,PURP);s.px('body','front',7,7,PURP);
// пояс с черепом
s.fill('body','front',0,9,8,1,ROBED);s.px('body','front',3,9,BONE);s.px('body','front',4,9,BONE);
// рваный подол
for(let x=0;x<8;x++)s.px('body','front',x,11, x%2?ROBE:ROBED);
s.faceFill('body','back',ROBED,5);s.faceFill('body','top',ROBEH,4);
for(const a of ['rarm','larm']){
  s.fill(a,'front',0,0,4,12,ROBE);
  s.fill(a,'front',0,0,4,1,ROBEH);
  s.px(a,'front',1,3,NECD);s.px(a,'front',2,6,PURP); // руны
  s.fill(a,'front',0,8,4,4,SKIN); // костлявая кисть
  s.px(a,'front',0,9,SKD);s.px(a,'front',1,9,BONED);s.px(a,'front',2,9,BONED);s.px(a,'front',3,9,SKD);
  s.px(a,'front',1,11,NEC); // зелёная искра
}
for(const l of ['rleg','lleg']){
  s.fill(l,'front',0,0,4,10,ROBE);for(let y=0;y<10;y++)s.px(l,'front',0,y,ROBED);
  s.px(l,'front',1,4,PURP);s.px(l,'front',2,7,NECD);
  s.fill(l,'front',0,10,4,2,ROBED);s.px(l,'front',1,11,BONED); // костяные стопы
}
s.save(process.argv[2]);
module.exports={meta:{id:'fantasy-male-dark-necromancer',nameRu:'Тёмный Некромант',nameEn:'Dark Necromancer',role:'повелитель нежити',style:'fantasy',gender:'male',model:'classic'}};
