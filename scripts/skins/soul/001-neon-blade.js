'use strict';
// 001 — Неоновый Клинок / Neon Blade
// Роль: уличный мечник-одиночка, что режет тьму неоновых переулков светящимся клинком.
// Тема: cyber + male.  Кожа: тёплый загар.
const { Skin, shade, mix } = require('../../hand/paint');
const lighten=(c,t)=>mix(c,[255,255,255,255],t), darken=(c,t)=>mix(c,[0,0,0,255],t);
const s=new Skin();

const SKIN=[224,180,148,255], SKD=shade(SKIN,0.78);
const HAIR=[34,36,46,255], HAIR_H=[64,68,86,255];        // вороно-чёрные волосы
const NEON=[40,225,255,255], NEON_D=shade(NEON,0.6);     // циан-неон
const JACK=[28,30,40,255], JACK_H=[48,52,68,255], JACK_D=darken([28,30,40,255],0.3); // тёмная куртка
const PANT=[22,24,32,255];

// ГОЛОВА
s.cuboid('head',SKIN,5);
s.fill('head','front',0,7,8,1,SKD);
// волосы: ёжик с неоновыми кончиками
s.faceFill('head','top',HAIR,6); s.faceFill('head','back',HAIR,6);
for(let x=0;x<8;x++) s.px('head','top',x,0,HAIR_H);
for(const x of [0,2,4,6]) s.px('head','top',x,0,NEON_D);     // неоновые кончики сверху
for(let x=0;x<8;x++) s.px('head','front',x,0,HAIR);
for(const x of [0,2,4,6]) s.px('head','front',x,1,HAIR);     // рваная чёлка-иглы
s.px('head','front',1,1,HAIR_H); s.px('head','front',5,1,HAIR_H);
for(let y=0;y<3;y++){ s.px('head','right',0,y,HAIR); s.px('head','left',7,y,HAIR); }
// ЛИЦО
s.px('head','front',1,2,HAIR_H); s.px('head','front',2,2,HAIR_H);   // брови
s.px('head','front',5,2,HAIR_H); s.px('head','front',6,2,HAIR_H);
const W=[238,242,248,255],P=[18,18,28,255];
s.px('head','front',1,3,W);s.px('head','front',2,3,W);s.px('head','front',5,3,W);s.px('head','front',6,3,W);
s.px('head','front',1,4,W);s.px('head','front',2,4,W);s.px('head','front',5,4,W);s.px('head','front',6,4,W);
s.px('head','front',1,4,NEON);s.px('head','front',2,4,P);s.px('head','front',5,4,P);s.px('head','front',6,4,NEON); // циан-глаза
s.px('head','front',2,3,[255,255,255,255]);s.px('head','front',5,3,[255,255,255,255]); // блик
s.px('head','front',4,5,SKD);                                  // нос
s.px('head','front',3,6,shade(SKIN,0.5));s.px('head','front',4,6,shade(SKIN,0.5)); // рот
s.px('head','front',6,5,NEON);s.px('head','front',6,6,NEON_D); // неон-шрам у скулы

// ТОРС — боевая куртка
for(const p of ['body','rarm','larm','rleg','lleg']) s.cuboid(p,JACK,4);
s.faceFill('rleg','front',PANT,4);s.faceFill('lleg','front',PANT,4);s.faceFill('rleg','back',PANT,4);s.faceFill('lleg','back',PANT,4);
// воротник-стойка
s.fill('body','front',2,0,4,1,JACK_H);
// высокая молния по центру с неоном
for(let y=1;y<10;y++) s.px('body','front',4,y, y%3? NEON_D:NEON);
s.px('body','front',4,1,NEON);
// нагрудные панели со светом
s.fill('body','front',1,2,2,5,JACK_H); s.fill('body','front',5,2,2,5,JACK_H);
s.px('body','front',1,2,NEON);s.px('body','front',6,2,NEON);   // неоновая окантовка плеч
// ремень
s.fill('body','front',0,10,8,1,JACK_D);s.px('body','front',3,10,NEON);s.px('body','front',4,10,NEON);
// наплечники + тень спины
s.faceFill('body','top',JACK_H,3); s.faceFill('body','back',darken(JACK,0.2),5);
// перевязь меча через грудь (диагональ)
for(let i=0;i<7;i++) s.px('body','front',i,i+1, i%2?NEON_D:darken(JACK,0.4));

// РУКИ — рукава с неон-полосой и перчатки
for(const a of ['rarm','larm']){
  s.faceFill(a,'top',JACK_H,3);
  s.fill(a,'front',0,0,4,2,JACK_H);                      // наплечник
  s.px(a,'front',0,0,NEON);s.px(a,'front',3,0,NEON);
  s.fill(a,'front',0,4,4,1,NEON_D);                      // неон по локтю
  s.fill(a,'front',0,7,4,1,NEON);                        // неон-манжета
  s.fill(a,'front',0,8,4,4,darken(JACK,0.15));           // перчатка
  s.px(a,'front',1,9,NEON_D);s.px(a,'front',2,9,NEON_D);
}
// НОГИ — техно-штаны + ботинки с неон-подошвой
for(const l of ['rleg','lleg']){
  s.fill(l,'front',0,0,4,4,JACK_H);                      // бедро-панель
  s.px(l,'front',0,1,NEON_D);s.px(l,'front',3,1,NEON_D);
  s.fill(l,'front',0,7,4,1,NEON_D);                      // колено
  s.fill(l,'front',0,9,4,3,darken(JACK,0.25));           // ботинок
  s.fill(l,'front',0,11,4,1,NEON);                       // неон-подошва
}
s.save(process.argv[2]);
module.exports={meta:{id:'cyber-male-neon-blade',nameRu:'Неоновый Клинок',nameEn:'Neon Blade',role:'уличный мечник-одиночка',style:'cyber',gender:'male',model:'classic'}};
console.log('Neon Blade');
