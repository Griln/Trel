'use strict';
const { Skin, shade, mix } = require('../../hand/paint');
const L=(c,t)=>mix(c,[255,255,255,255],t), D=(c,t)=>mix(c,[0,0,0,255],t);
const s=new Skin();
const CLOAK=[40,50,44,255],CLOAKH=[58,72,62,255],CLOAKD=[26,32,28,255]; // тёмно-болотный
const SKIN=[120,140,110,255],SKD=shade([120,140,110,255],0.75); // болезненно-зелёная
const WISP=[160,255,180,255],WISPD=shade([160,255,180,255],0.55); // болотный огонь
const MURK=[80,110,70,255];
// ГОЛОВА — под рваным капюшоном
s.cuboid('head',SKIN,4);s.fill('head','front',0,7,8,1,SKD);
s.faceFill('head','top',CLOAK,4);s.faceFill('head','back',CLOAK,4);
for(let y=0;y<8;y++){for(let x=0;x<8;x++){s.px('head','right',x,y,CLOAK);s.px('head','left',x,y,CLOAK);}}
for(let x=0;x<8;x++){s.px('head','front',x,0,CLOAK);s.px('head','front',x,1,CLOAK);}
s.px('head','front',0,2,CLOAK);s.px('head','front',7,2,CLOAK);
// рваные края капюшона + тина
s.px('head','front',2,1,MURK);s.px('head','front',5,1,MURK);s.px('head','front',1,2,CLOAKD);
// ЛИЦО в тени — горящие болотные глаза
for(let x=1;x<7;x++)s.px('head','front',x,2,shade(SKIN,0.5));
s.fill('head','front',1,3,2,2,[20,28,22,255]);s.fill('head','front',5,3,2,2,[20,28,22,255]);
s.px('head','front',1,4,WISP);s.px('head','front',2,3,WISP);s.px('head','front',5,3,WISP);s.px('head','front',6,4,WISP);
s.px('head','front',2,4,WISPD);s.px('head','front',5,4,WISPD);
// впалые щёки + рот-провал
s.px('head','front',1,5,SKD);s.px('head','front',6,5,SKD);
s.fill('head','front',3,6,2,1,[20,28,22,255]);s.px('head','front',3,6,WISPD);
// ТОРС — рваный болотный плащ
for(const p of ['body','rarm','larm','rleg','lleg'])s.cuboid(p,CLOAK,5);
s.fill('body','front',0,0,8,12,CLOAK);
// тина и водоросли свисают
for(const [x,y] of [[1,2],[3,1],[5,3],[6,2],[2,5],[4,6],[1,7],[6,6]])s.px('body','front',x,y,MURK);
// дыры в плаще со светом изнутри
s.px('body','front',2,4,WISPD);s.px('body','front',5,5,WISPD);s.px('body','front',3,8,WISPD);
// призрачное ядро
s.px('body','front',3,4,WISP);s.px('body','front',4,4,L(WISP,0.4));s.px('body','front',3,5,WISP);s.px('body','front',4,5,WISPD);
// клочья по бокам
for(let y=1;y<10;y++){s.px('body','front',0,y, y%2?CLOAKD:CLOAK);s.px('body','front',7,y, y%2?CLOAK:CLOAKD);}
// рваный низ + болотный туман
for(let x=0;x<8;x++)s.px('body','front',x,10, x%3?CLOAK:MURK);
for(let x=0;x<8;x++)s.px('body','front',x,11, x%2?CLOAKD:WISPD);
s.faceFill('body','back',CLOAKD,5);s.faceFill('body','top',CLOAKH,4);
for(const a of ['rarm','larm']){
  s.fill(a,'front',0,0,4,12,CLOAK);
  s.px(a,'front',1,2,MURK);s.px(a,'front',2,6,MURK);
  s.px(a,'front',1,4,WISPD);s.px(a,'front',2,8,WISP); // свет сквозь дыры
  s.fill(a,'front',0,9,4,3,SKIN); // костлявая кисть
  s.px(a,'front',0,9,SKD);s.px(a,'front',3,9,SKD);
  for(let x=0;x<4;x++)s.px(a,'front',x,11, x%2?WISPD:CLOAKD); // тает
}
for(const l of ['rleg','lleg']){
  s.fill(l,'front',0,0,4,10,CLOAK);for(let y=0;y<10;y++)s.px(l,'front',0,y, y%2?CLOAKD:CLOAK);
  s.px(l,'front',1,3,MURK);s.px(l,'front',2,7,WISPD);
  for(let x=0;x<4;x++)s.px(l,'front',x,11, x%2?WISP:CLOAKD); // растворяется в тумане
  for(let x=0;x<4;x++)s.px(l,'front',x,10, x%2?MURK:CLOAK);
}
s.save(process.argv[2]);
module.exports={meta:{id:'fantasy-neutral-bog-wraith',nameRu:'Призрак Болот',nameEn:'Bog Wraith',role:'неупокоенный дух топей',style:'fantasy',gender:'neutral',model:'classic'}};
