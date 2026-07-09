'use strict';
const { Skin, shade, mix } = require('../../hand/paint');
const L=(c,t)=>mix(c,[255,255,255,255],t), D=(c,t)=>mix(c,[0,0,0,255],t);
const s=new Skin();
const BODY=[20,22,30,255];
const R=[255,40,80,255],G=[40,255,120,255],B=[60,140,255,255]; // RGB-сбой
// ГОЛОВА — расколотая на RGB-каналы
s.cuboid('head',BODY,3);
s.faceFill('head','top',D(BODY,0.1),3);s.faceFill('head','back',D(BODY,0.1),3);
// глитч-полосы по лицу
for(let y=0;y<8;y++){const c=[R,G,B][y%3];s.px('head','front',0,y,c);s.px('head','front',7,y,D(c,0.3));}
s.fill('head','front',1,2,6,1,R);s.fill('head','front',1,5,6,1,B); // смещённые строки
// глаза — рассинхрон каналов
s.px('head','front',1,3,[230,235,240,255]);s.px('head','front',2,3,[230,235,240,255]);
s.px('head','front',5,3,[230,235,240,255]);s.px('head','front',6,3,[230,235,240,255]);
s.px('head','front',1,4,R);s.px('head','front',2,4,[16,16,20,255]);
s.px('head','front',5,4,[16,16,20,255]);s.px('head','front',6,4,G);
s.px('head','front',0,4,B);s.px('head','front',7,4,R); // двоение
s.px('head','front',3,6,G);s.px('head','front',4,6,R); // рот-сбой
// ТОРС — нестабильная форма
for(const p of ['body','rarm','larm','rleg','lleg'])s.cuboid(p,BODY,3);
// горизонтальные RGB-разрывы
for(let y=0;y<12;y++){if(y%2===0){const c=[R,G,B][(y/2)%3|0];s.fill('body','front',0,y,8,1,D(c,0.4));}}
s.fill('body','front',1,3,7,1,R);s.fill('body','front',0,6,6,1,B);s.fill('body','front',2,8,6,1,G); // смещения
// ядро-сбой
s.px('body','front',3,4,R);s.px('body','front',4,4,G);s.px('body','front',3,5,B);s.px('body','front',4,5,L([255,255,255,255],0));
s.px('body','front',4,5,[255,255,255,255]);
// артефакты
s.px('body','front',6,2,G);s.px('body','front',1,9,R);s.px('body','front',7,7,B);
s.faceFill('body','top',D(BODY,0.1),3);s.faceFill('body','back',D(BODY,0.1),3);
for(const a of ['rarm','larm']){
  for(let y=0;y<12;y++){if(y%3===0){const c=[R,G,B][(y/3)%3|0];s.fill(a,'front',0,y,4,1,D(c,0.3));}}
  s.px(a,'front',1,4,R);s.px(a,'front',2,7,G);s.px(a,'front',0,9,B);
}
for(const l of ['rleg','lleg']){
  for(let y=0;y<12;y++){if(y%3===1){const c=[R,G,B][(y%3)];s.fill(l,'front',0,y,4,1,D(c,0.35));}}
  s.px(l,'front',1,5,G);s.fill(l,'front',0,11,4,1,R);
}
s.save(process.argv[2]);
module.exports={meta:{id:'cyber-neutral-glitch',nameRu:'Глитч',nameEn:'Glitch',role:'сбой, ставший сущностью',style:'cyber',gender:'neutral',model:'classic'}};
