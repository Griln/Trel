'use strict';
const { Skin, shade, mix } = require('../../hand/paint');
const L=(c,t)=>mix(c,[255,255,255,255],t), D=(c,t)=>mix(c,[0,0,0,255],t);
const s=new Skin();
const SKIN=[252,222,204,255],SKD=shade(SKIN,0.86);
const HAIR=[245,230,180,255],HAIRH=[252,244,210,255],HAIRD=[210,192,140,255]; // золотисто-кремовые
const ARM=[230,235,245,255],ARMH=[248,250,254,255],ARMD=[196,204,222,255]; // перламутровая броня
const PINK=[255,205,220,255];
const GOLD=[248,222,150,255];
const BLUE=[185,210,245,255];
s.cuboid('head',SKIN,3);s.fill('head','front',0,7,8,1,SKD);
// перламутровый шлем-открытый
s.faceFill('head','top',ARM,3);s.faceFill('head','back',ARM,3);
for(let x=0;x<8;x++)s.px('head','top',x,0,ARMH);
for(let x=0;x<8;x++)s.px('head','front',x,0,ARM);
for(let y=0;y<6;y++){s.px('head','right',0,y,ARM);s.px('head','left',7,y,ARM);s.px('head','right',1,y,ARMD);s.px('head','left',6,y,ARMD);}
for(let y=1;y<6;y++){s.px('head','front',0,y,ARM);s.px('head','front',7,y,ARM);}
// налобник + розовый самоцвет
s.fill('head','front',1,1,6,1,ARMH);s.px('head','front',3,1,PINK);s.px('head','front',4,1,L(PINK,0.3));
// кремовые пряди
s.px('head','front',2,2,HAIR);s.px('head','front',5,2,HAIR);
// крылышки на шлеме
s.px('head','right',0,2,ARMH);s.px('head','left',7,2,ARMH);s.px('head','right',0,1,BLUE);s.px('head','left',7,1,BLUE);
// ЛИЦО — мягко-героическое
const Wt=[250,250,252,255];
for(const ex of [1,5]){s.px('head','front',ex,3,Wt);s.px('head','front',ex+1,3,Wt);s.px('head','front',ex,4,Wt);s.px('head','front',ex+1,4,Wt);}
s.px('head','front',1,4,[120,160,220,255]);s.px('head','front',2,4,[60,90,150,255]);s.px('head','front',5,4,[60,90,150,255]);s.px('head','front',6,4,[120,160,220,255]);
s.px('head','front',2,3,[255,255,255,255]);s.px('head','front',5,3,[255,255,255,255]);
s.px('head','front',4,5,SKD);s.px('head','front',3,6,[235,160,160,255]);s.px('head','front',4,6,[235,160,160,255]);
const bl=mix(SKIN,[255,180,190,255],0.35);s.px('head','front',1,5,bl);s.px('head','front',6,5,bl);
// ТОРС — перламутровые латы + облачный плащ
for(const p of ['body','rarm','larm','rleg','lleg'])s.cuboid(p,ARM,3);
s.fill('body','front',1,1,6,8,ARM);s.fill('body','front',1,1,6,1,ARMH);
// грудные пластины с мягкими бликами
s.px('body','front',2,2,ARMH);s.px('body','front',5,2,ARMH);s.fill('body','front',1,5,6,1,ARMD);
// розовое сердце-самоцвет в золоте
s.px('body','front',3,3,GOLD);s.px('body','front',4,3,GOLD);s.px('body','front',3,4,PINK);s.px('body','front',4,4,L(PINK,0.3));s.px('body','front',3,5,PINK);s.px('body','front',4,5,GOLD);
// облачный плащ по краям (голубой)
for(let y=1;y<11;y++){s.px('body','front',0,y,BLUE);s.px('body','front',7,y,BLUE);}
s.px('body','front',0,10,ARMH);s.px('body','front',7,10,ARMH); // пушистый край
// золотой пояс
s.fill('body','front',1,9,6,1,GOLD);s.px('body','front',3,9,PINK);s.px('body','front',4,9,PINK);
s.faceFill('body','back',BLUE,3);s.faceFill('body','top',ARMH,2);
for(const a of ['rarm','larm']){
  s.faceFill(a,'top',ARMH,2);
  s.fill(a,'front',0,0,4,3,ARM);s.fill(a,'front',0,0,4,1,ARMH); // наплечник
  s.px(a,'front',1,1,PINK);s.px(a,'front',2,1,PINK);
  s.fill(a,'front',0,4,4,1,GOLD); // налокотник
  s.fill(a,'front',0,8,4,4,ARMD);s.px(a,'front',1,8,GOLD);s.px(a,'front',2,8,GOLD); // перчатка
}
for(const l of ['rleg','lleg']){
  s.fill(l,'front',0,0,4,7,ARM);s.fill(l,'front',0,4,4,1,GOLD);
  s.px(l,'front',1,2,ARMH);s.px(l,'front',1,5,PINK);
  s.fill(l,'front',0,8,4,4,ARMD);s.fill(l,'front',0,8,4,1,GOLD); // сабатоны
}
s.save(process.argv[2]);
module.exports={meta:{id:'pastel-male-cloud-knight',nameRu:'Облачный Рыцарь',nameEn:'Cloud Knight',role:'защитник снов и облаков',style:'pastel',gender:'male',model:'classic'}};
