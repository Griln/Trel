'use strict';
const { Skin, shade, mix } = require('../../hand/paint');
const L=(c,t)=>mix(c,[255,255,255,255],t), D=(c,t)=>mix(c,[0,0,0,255],t);
const s=new Skin();
const SKIN=[210,205,215,255],SKD=shade(SKIN,0.82);        // призрачно-бледная
const HAIR=[120,130,160,255],HAIRD=[80,88,115,255];
const SUIT=[34,40,58,255],SUITH=[54,62,86,255];
const GHOST=[120,180,255,255],GHOSTD=shade([120,180,255,255],0.55);
const VIOLET=[160,140,255,255];
s.cuboid('head',SKIN,4);s.fill('head','front',0,7,8,1,SKD);
// капюшон-вуаль
s.faceFill('head','top',SUIT,4);s.faceFill('head','back',SUIT,4);
for(let y=0;y<8;y++){for(let x=0;x<8;x++){s.px('head','right',x,y,SUIT);s.px('head','left',x,y,SUIT);}}
for(let x=0;x<8;x++)s.px('head','front',x,0,SUIT);
s.px('head','front',0,1,SUIT);s.px('head','front',7,1,SUIT);
s.px('head','front',0,2,SUIT);s.px('head','front',7,2,SUIT);
// пряди-глитч из-под капюшона
s.px('head','front',2,1,HAIR);s.px('head','front',5,1,HAIRD);
// край капюшона светится
for(let x=1;x<7;x++)s.px('head','front',x,1,GHOSTD);
// ЛИЦО — призрачное, светящиеся глаза без зрачка (но с ядром)
const Wt=[200,215,235,255];
for(const ex of [1,5]){s.px('head','front',ex,3,Wt);s.px('head','front',ex+1,3,Wt);s.px('head','front',ex,4,Wt);s.px('head','front',ex+1,4,Wt);}
s.px('head','front',1,4,GHOST);s.px('head','front',2,4,VIOLET);s.px('head','front',5,4,VIOLET);s.px('head','front',6,4,GHOST);
s.px('head','front',1,3,L(GHOST,0.4));s.px('head','front',6,3,L(GHOST,0.4));
for(let x=1;x<7;x++)s.px('head','front',x,2,shade(SKIN,0.6)); // тень капюшона
s.px('head','front',4,5,SKD);s.px('head','front',3,6,shade(SKIN,0.6));s.px('head','front',4,6,shade(SKIN,0.6));
// глитч-полосы на лице (прозрачность-эффект)
s.px('head','front',0,4,GHOSTD);s.px('head','front',7,5,GHOSTD);
// ТОРС — полупрозрачный плащ-сеть
for(const p of ['body','rarm','larm','rleg','lleg'])s.cuboid(p,SUIT,5);
s.fill('body','front',1,1,6,8,SUITH);
// сетка-узор
for(let y=1;y<9;y+=2)for(let x=1;x<7;x+=2)s.px('body','front',x,y,GHOSTD);
for(let y=2;y<9;y+=2)for(let x=2;x<7;x+=2)s.px('body','front',x,y,D(SUIT,0.2));
// светящееся ядро-данные
s.px('body','front',3,4,GHOST);s.px('body','front',4,4,L(GHOST,0.4));s.px('body','front',3,5,VIOLET);s.px('body','front',4,5,GHOST);
// глитч-сбой по торсу
s.fill('body','front',0,3,8,1,GHOSTD);s.px('body','front',2,3,VIOLET);s.px('body','front',6,6,VIOLET);
s.fill('body','front',0,10,8,1,D(SUIT,0.3));s.px('body','front',3,10,GHOST);s.px('body','front',4,10,GHOST);
s.faceFill('body','top',SUITH,4);s.faceFill('body','back',D(SUIT,0.15),5);
for(const a of ['rarm','larm']){
  s.faceFill(a,'top',SUITH,4);
  for(let y=1;y<7;y+=2)s.px(a,'front',1,y,GHOSTD);
  s.fill(a,'front',0,7,4,1,GHOSTD);
  s.fill(a,'front',0,8,4,4,D(SUIT,0.2));s.px(a,'front',0,8,GHOST);s.px(a,'front',3,8,VIOLET);
}
for(const l of ['rleg','lleg']){
  for(let y=0;y<7;y+=2)s.px(l,'front',1,y,GHOSTD);
  s.fill(l,'front',0,8,4,4,D(SUIT,0.25));s.fill(l,'front',0,11,4,1,GHOST);
}
s.save(process.argv[2]);
module.exports={meta:{id:'cyber-female-ghost-net',nameRu:'Призрак-Сеть',nameEn:'Ghost Net',role:'шпионка-невидимка',style:'cyber',gender:'female',model:'classic'}};
