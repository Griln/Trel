'use strict';
const { Skin, shade, mix } = require('../../hand/paint');
const L=(c,t)=>mix(c,[255,255,255,255],t), D=(c,t)=>mix(c,[0,0,0,255],t);
const s=new Skin();
const SKIN=[200,150,118,255],SKD=shade(SKIN,0.76),SKH=L(SKIN,0.12);
const HAIR=[150,40,30,255],HAIRH=[180,60,40,255];        // рыжая грива
const FUR=[110,86,60,255],FURH=[140,114,82,255];          // мех
const IRON=[120,124,130,255],IROND=[80,84,90,255];
const BLUE=[60,120,200,255]; // боевая краска
s.cuboid('head',SKIN,5);s.fill('head','front',0,7,8,1,SKD);
// дикая грива
s.faceFill('head','top',HAIR,5);s.faceFill('head','back',HAIR,5);
for(let x=0;x<8;x++)s.px('head','top',x,0,HAIRH);
for(let y=0;y<8;y++){s.px('head','right',0,y,HAIR);s.px('head','right',1,y,HAIRH);s.px('head','left',7,y,HAIR);s.px('head','left',6,y,HAIRH);}
for(let x=0;x<8;x++)s.px('head','front',x,0,HAIR);
s.px('head','front',1,1,HAIR);s.px('head','front',2,1,HAIR);s.px('head','front',5,1,HAIR);s.px('head','front',6,1,HAIR);
// ЛИЦО — свирепое с боевой краской
const Wt=[238,242,248,255];
for(const ex of [1,5]){s.px('head','front',ex,3,Wt);s.px('head','front',ex+1,3,Wt);s.px('head','front',ex,4,Wt);s.px('head','front',ex+1,4,Wt);}
s.px('head','front',1,4,[80,140,90,255]);s.px('head','front',2,4,[30,30,30,255]);s.px('head','front',5,4,[30,30,30,255]);s.px('head','front',6,4,[80,140,90,255]);
s.px('head','front',2,3,[255,255,255,255]);s.px('head','front',5,3,[255,255,255,255]);
// синяя боевая краска через глаза
s.px('head','front',0,3,BLUE);s.px('head','front',0,4,BLUE);s.px('head','front',7,3,BLUE);s.px('head','front',7,4,BLUE);
s.px('head','front',3,3,BLUE);s.px('head','front',4,3,BLUE);
s.px('head','front',4,5,SKD);
// густая рыжая борода
s.fill('head','front',1,6,6,2,HAIR);s.px('head','front',3,6,SKD);s.px('head','front',4,6,SKD);
s.px('head','front',2,7,HAIRH);s.px('head','front',5,7,HAIRH);
// ТОРС — голый мускулистый + меховая накидка
for(const p of ['body','rarm','larm','rleg','lleg'])s.cuboid(p,SKIN,5);
s.fill('body','front',0,0,8,12,SKIN);
// меховая накидка на плечах
s.fill('body','front',0,0,8,2,FUR);s.fill('body','front',0,0,8,1,FURH);
for(let x=0;x<8;x++)if(x%2)s.px('body','front',x,2,FUR);
s.px('body','front',0,3,FUR);s.px('body','front',7,3,FUR);s.px('body','front',0,4,FUR);s.px('body','front',7,4,FUR);
// мышцы (тени)
s.px('body','front',2,4,SKH);s.px('body','front',5,4,SKH);s.fill('body','front',3,4,2,1,SKD);
s.px('body','front',2,6,SKD);s.px('body','front',5,6,SKD);s.fill('body','front',3,6,2,1,SKH);
s.px('body','front',3,7,SKD);s.px('body','front',4,7,SKD); // пресс
// боевые шрамы
s.px('body','front',5,3,SKD);s.px('body','front',5,4,SKD);s.px('body','front',2,7,SKD);
// синяя краска-узор на груди
s.px('body','front',1,5,BLUE);s.px('body','front',6,5,BLUE);s.px('body','front',3,8,BLUE);s.px('body','front',4,8,BLUE);
// кожаный + железный пояс
s.fill('body','front',0,9,8,2,FUR);s.fill('body','front',2,9,4,1,IRON);s.px('body','front',3,10,IROND);s.px('body','front',4,10,IROND);
s.faceFill('body','back',FUR,5);s.faceFill('body','top',FURH,4);
for(const a of ['rarm','larm']){
  s.fill(a,'front',0,0,4,3,FUR);s.fill(a,'front',0,0,4,1,FURH); // меховой наплечник
  s.fill(a,'front',0,3,4,5,SKIN); // голая рука
  s.px(a,'front',1,4,SKH);s.px(a,'front',2,6,SKD);s.px(a,'front',1,6,BLUE); // мышцы+краска
  s.fill(a,'front',0,5,4,1,IRON);s.px(a,'front',1,5,IROND); // железный браслет
  s.fill(a,'front',0,8,4,2,SKIN); // кисть
  s.fill(a,'front',0,10,4,2,FUR); // меховая обмотка
}
for(const l of ['rleg','lleg']){
  s.fill(l,'front',0,0,4,5,FUR);s.fill(l,'front',0,0,4,1,FURH); // меховые штаны
  s.px(l,'front',1,2,D(FUR,0.2));
  s.fill(l,'front',0,5,4,7,D([90,70,50,255],0.1)); // кожаные сапоги
  s.fill(l,'front',0,5,4,1,IRON);s.px(l,'front',0,11,IROND);s.px(l,'front',3,11,IROND);
}
s.save(process.argv[2]);
module.exports={meta:{id:'fantasy-male-mountain-barbarian',nameRu:'Горный Варвар',nameEn:'Mountain Barbarian',role:'берсерк северных вершин',style:'fantasy',gender:'male',model:'classic'}};
