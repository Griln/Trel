'use strict';
const { Skin, shade, mix } = require('../../hand/paint');
const L=(c,t)=>mix(c,[255,255,255,255],t), D=(c,t)=>mix(c,[0,0,0,255],t);
const s=new Skin();
const SKIN=[255,228,210,255],SKD=shade(SKIN,0.86);       // светлая мягкая
const HAIR=[170,235,210,255],HAIRH=[205,250,232,255],HAIRD=[130,200,178,255]; // мятные волосы
const HOOD=[255,225,235,255],HOODH=[255,242,248,255];    // нежно-розовое худи
const MINT=[150,225,205,255];
const PEACH=[255,200,175,255];
s.cuboid('head',SKIN,3);s.fill('head','front',0,7,8,1,SKD);
// мягкая мятная чёлка
s.faceFill('head','top',HAIR,3);s.faceFill('head','back',HAIR,3);
for(let x=0;x<8;x++)s.px('head','top',x,0,HAIRH);
for(let y=0;y<4;y++){s.px('head','right',0,y,HAIR);s.px('head','left',7,y,HAIR);}
for(let x=0;x<8;x++)s.px('head','front',x,0,HAIR);
for(let x=0;x<8;x++)if(x%2)s.px('head','front',x,1,HAIR);else s.px('head','front',x,1,HAIRD); // воздушная чёлка
s.px('head','front',0,1,HAIR);s.px('head','front',7,1,HAIR);
// ЛИЦО — мягкое, доброе
const Wt=[250,250,252,255];
for(const ex of [1,5]){s.px('head','front',ex,3,Wt);s.px('head','front',ex+1,3,Wt);s.px('head','front',ex,4,Wt);s.px('head','front',ex+1,4,Wt);}
s.px('head','front',1,4,[110,180,160,255]);s.px('head','front',2,4,[70,120,105,255]);s.px('head','front',5,4,[70,120,105,255]);s.px('head','front',6,4,[110,180,160,255]);
s.px('head','front',2,3,[255,255,255,255]);s.px('head','front',5,3,[255,255,255,255]);
s.px('head','front',4,5,SKD);
s.px('head','front',3,6,[235,150,150,255]);s.px('head','front',4,6,[235,150,150,255]); // улыбка
const bl=mix(SKIN,[255,170,180,255],0.4);s.px('head','front',1,5,bl);s.px('head','front',6,5,bl); // румянец
// ТОРС — пастельное худи
for(const p of ['body','rarm','larm','rleg','lleg'])s.cuboid(p,HOOD,3);
s.fill('body','front',0,0,8,12,HOOD);
// капюшон сзади
s.fill('body','front',1,0,6,1,HOODH);
// карман-кенгуру
s.fill('body','front',2,6,4,3,D(HOOD,0.06));s.fill('body','front',2,6,4,1,HOODH);
// шнурки
s.px('body','front',3,1,MINT);s.px('body','front',4,1,MINT);s.px('body','front',3,2,HAIRD);s.px('body','front',4,2,HAIRD);
// мягкий принт-облачко
s.px('body','front',2,3,MINT);s.px('body','front',3,3,L(MINT,0.3));s.px('body','front',4,3,L(MINT,0.3));s.px('body','front',5,3,MINT);
s.px('body','front',3,4,MINT);s.px('body','front',4,4,MINT);
// персиковые полоски-манжет низа
s.fill('body','front',0,11,8,1,PEACH);
s.faceFill('body','back',D(HOOD,0.04),3);s.faceFill('body','top',HOODH,2);
for(const a of ['rarm','larm']){
  s.fill(a,'front',0,0,4,12,HOOD);s.fill(a,'front',0,0,4,1,HOODH);
  s.px(a,'front',1,4,MINT);s.px(a,'front',2,7,MINT); // мелкий принт
  s.fill(a,'front',0,11,4,1,PEACH); // манжета
  s.fill(a,'front',0,9,4,2,SKIN); // кисть
}
for(const l of ['rleg','lleg']){
  s.fill(l,'front',0,0,4,8,D(HOOD,0.1)); // мягкие штаны
  s.px(l,'front',1,3,MINT);
  s.fill(l,'front',0,8,4,4,HOODH);s.fill(l,'front',0,11,4,1,MINT); // кеды
}
s.save(process.argv[2]);
module.exports={meta:{id:'pastel-male-mint-dreamer',nameRu:'Мятный Мечтатель',nameEn:'Mint Dreamer',role:'тихий художник снов',style:'pastel',gender:'male',model:'classic'}};
