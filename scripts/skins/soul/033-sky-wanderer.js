'use strict';
const { Skin, shade, mix } = require('../../hand/paint');
const L=(c,t)=>mix(c,[255,255,255,255],t), D=(c,t)=>mix(c,[0,0,0,255],t);
const s=new Skin();
const SKIN=[250,220,200,255],SKD=shade(SKIN,0.86);
const HAIR=[160,200,245,255],HAIRH=[200,225,252,255],HAIRD=[124,164,215,255]; // небесно-голубые
const CLOAK=[210,232,250,255],CLOAKH=[236,246,254,255],CLOAKD=[176,205,235,255]; // плащ-небо
const SUN=[255,225,150,255];
const WHITE=[252,253,255,255];
s.cuboid('head',SKIN,3);s.fill('head','front',0,7,8,1,SKD);
// волосы как ветер
s.faceFill('head','top',HAIR,3);s.faceFill('head','back',HAIR,3);
for(let x=0;x<8;x++)s.px('head','top',x,0,HAIRH);
for(let y=0;y<5;y++){s.px('head','right',0,y,HAIR);s.px('head','left',7,y,HAIR);}
for(let x=0;x<8;x++)s.px('head','front',x,0,HAIR);
for(let x=0;x<8;x++)s.px('head','front',x,1, x%2?HAIRH:HAIRD); // развевающаяся чёлка
s.px('head','right',0,2,HAIR);s.px('head','right',1,1,HAIR); // прядь по ветру
// ЛИЦО
const Wt=[250,250,252,255];
for(const ex of [1,5]){s.px('head','front',ex,3,Wt);s.px('head','front',ex+1,3,Wt);s.px('head','front',ex,4,Wt);s.px('head','front',ex+1,4,Wt);}
s.px('head','front',1,4,[110,160,210,255]);s.px('head','front',2,4,[60,90,140,255]);s.px('head','front',5,4,[60,90,140,255]);s.px('head','front',6,4,[110,160,210,255]);
s.px('head','front',2,3,[255,255,255,255]);s.px('head','front',5,3,[255,255,255,255]);
s.px('head','front',4,5,SKD);s.px('head','front',3,6,[235,160,160,255]);s.px('head','front',4,6,[235,160,160,255]);
const bl=mix(SKIN,[255,180,180,255],0.35);s.px('head','front',1,5,bl);s.px('head','front',6,5,bl);
// ТОРС — лёгкая туника путешественника + плащ-небо
for(const p of ['body','rarm','larm','rleg','lleg'])s.cuboid(p,WHITE,3);
s.fill('body','front',0,0,8,12,WHITE);
// плащ по краям
for(let y=0;y<11;y++){s.px('body','front',0,y,CLOAK);s.px('body','front',1,y,CLOAKD);s.px('body','front',7,y,CLOAK);s.px('body','front',6,y,CLOAKD);}
// ворот-завязка
s.fill('body','front',3,0,2,1,CLOAK);s.px('body','front',3,1,SUN);s.px('body','front',4,1,SUN);
// солнце-эмблема на груди
s.px('body','front',3,3,SUN);s.px('body','front',4,3,L(SUN,0.3));s.px('body','front',3,4,SUN);s.px('body','front',4,4,SUN);
s.px('body','front',2,3,SUN);s.px('body','front',5,4,SUN);s.px('body','front',3,2,SUN);s.px('body','front',4,5,SUN); // лучи
// облачка-узор
s.px('body','front',2,6,CLOAK);s.px('body','front',3,6,CLOAKH);s.px('body','front',5,7,CLOAK);
// пояс-кушак
s.fill('body','front',2,9,4,1,CLOAKD);s.px('body','front',3,9,SUN);s.px('body','front',4,9,SUN);
s.faceFill('body','back',CLOAK,3);s.faceFill('body','top',CLOAKH,2);
for(const a of ['rarm','larm']){
  s.fill(a,'front',0,0,4,8,WHITE);
  s.fill(a,'front',0,0,4,3,CLOAK); // плащ-рукав
  s.px(a,'front',1,1,SUN);
  s.px(a,'front',1,5,CLOAKD);
  s.fill(a,'front',0,8,4,4,SKIN); // открытая кисть
  s.fill(a,'front',0,7,4,1,SUN); // браслет
}
for(const l of ['rleg','lleg']){
  s.fill(l,'front',0,0,4,7,WHITE);for(let y=0;y<7;y++)s.px(l,'front',0,y,CLOAKD);
  s.px(l,'front',1,3,CLOAK);
  s.fill(l,'front',0,7,4,5,D([180,150,110,255],0.05));s.fill(l,'front',0,7,4,1,SUN); // дорожные сапоги
}
s.save(process.argv[2]);
module.exports={meta:{id:'pastel-male-sky-wanderer',nameRu:'Небесный Странник',nameEn:'Sky Wanderer',role:'вечный путник облаков',style:'pastel',gender:'male',model:'classic'}};
