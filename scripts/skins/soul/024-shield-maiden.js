'use strict';
const { Skin, shade, mix } = require('../../hand/paint');
const L=(c,t)=>mix(c,[255,255,255,255],t), D=(c,t)=>mix(c,[0,0,0,255],t);
const s=new Skin();
const SKIN=[226,186,158,255],SKD=shade(SKIN,0.78);
const HAIR=[190,130,60,255],HAIRH=[220,160,80,255],HAIRD=[150,100,46,255]; // медовые косы
const STEEL=[170,176,188,255],STEELH=[210,216,224,255],STEELD=[116,122,134,255];
const RED=[170,50,50,255];
const LEATH=[110,78,48,255];
s.cuboid('head',SKIN,4);s.fill('head','front',0,7,8,1,SKD);
// волосы с косами
s.faceFill('head','top',HAIR,4);s.faceFill('head','back',HAIR,4);
for(let x=0;x<8;x++)s.px('head','top',x,0,HAIRH);
for(let y=0;y<8;y++){for(let x=0;x<8;x++){s.px('head','right',x,y,HAIR);s.px('head','left',x,y,HAIR);}}
for(let x=0;x<8;x++)s.px('head','front',x,0,HAIR);
for(let y=1;y<5;y++){s.px('head','front',0,y,HAIR);s.px('head','front',7,y,HAIR);}
// косы по плечам (узор)
for(let y=0;y<8;y++){s.px('body','back',0,y,HAIR);s.px('body','back',1,y, y%2?HAIRD:HAIRH);s.px('body','back',7,y,HAIR);s.px('body','back',6,y,y%2?HAIRD:HAIRH);}
// стальной обруч-диадема
s.fill('head','front',1,1,6,1,STEEL);s.px('head','front',3,1,RED);s.px('head','front',4,1,RED);
// ЛИЦО — решительная
const Wt=[240,243,249,255];
for(const ex of [1,5]){s.px('head','front',ex,3,Wt);s.px('head','front',ex+1,3,Wt);s.px('head','front',ex,4,Wt);s.px('head','front',ex+1,4,Wt);}
s.px('head','front',1,4,[90,130,170,255]);s.px('head','front',2,4,[30,40,55,255]);s.px('head','front',5,4,[30,40,55,255]);s.px('head','front',6,4,[90,130,170,255]);
s.px('head','front',2,3,[255,255,255,255]);s.px('head','front',5,3,[255,255,255,255]);
s.px('head','front',4,5,SKD);s.px('head','front',3,6,[200,120,110,255]);s.px('head','front',4,6,[200,120,110,255]);
// боевая краска
s.px('head','front',1,5,RED);s.px('head','front',6,5,RED);
// ТОРС — кольчуга + кожаный нагрудник
for(const p of ['body','rarm','larm','rleg','lleg'])s.cuboid(p,STEEL,4);
// кольчужное плетение
for(let y=1;y<9;y++)for(let x=1;x<7;x++)s.px('body','front',x,y,(x+y)%2?STEEL:STEELD);
s.fill('body','front',1,1,6,1,STEELH);
// кожаный нагрудник поверх
s.fill('body','front',2,2,4,5,LEATH);s.fill('body','front',2,2,4,1,L(LEATH,0.2));
for(let y=3;y<7;y+=2){s.px('body','front',3,y,D(LEATH,0.2));s.px('body','front',4,y,D(LEATH,0.2));} // заклёпки
// красная эмблема
s.px('body','front',3,4,RED);s.px('body','front',4,4,L(RED,0.3));s.px('body','front',3,5,D(RED,0.2));s.px('body','front',4,5,RED);
// пояс с мечом
s.fill('body','front',0,9,8,1,LEATH);s.px('body','front',2,9,STEELH);s.px('body','front',3,9,RED);s.px('body','front',4,9,RED);
s.faceFill('body','back',STEELD,4);s.faceFill('body','top',STEELH,3);
for(const a of ['rarm','larm']){
  s.faceFill(a,'top',STEELH,3);
  s.fill(a,'front',0,0,4,3,STEEL);s.fill(a,'front',0,0,4,1,STEELH); // наплечник
  s.px(a,'front',1,1,RED);
  s.fill(a,'front',0,3,4,3,SKIN); // открытая рука
  s.fill(a,'front',0,6,4,2,STEELD);s.fill(a,'front',0,6,4,1,STEEL); // наруч
  s.fill(a,'front',0,8,4,4,LEATH);s.px(a,'front',1,8,STEELH); // перчатка
}
for(const l of ['rleg','lleg']){
  s.fill(l,'front',0,0,4,4,LEATH);for(let y=0;y<4;y++)s.px(l,'front',0,y,D(LEATH,0.2)); // юбка-кожа
  s.fill(l,'front',0,4,4,4,STEEL);for(let y=4;y<8;y++)for(let x=0;x<4;x++)if((x+y)%2)s.px(l,'front',x,y,STEELD); // поножи-кольчуга
  s.fill(l,'front',0,8,4,4,D(LEATH,0.1));s.fill(l,'front',0,8,4,1,STEEL); // сапоги
}
s.save(process.argv[2]);
module.exports={meta:{id:'fantasy-female-shield-maiden',nameRu:'Дева-Воин',nameEn:'Shield Maiden',role:'воительница северных кланов',style:'fantasy',gender:'female',model:'slim'}};
